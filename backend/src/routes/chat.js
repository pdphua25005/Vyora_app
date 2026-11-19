/*
CHAT HỖ TRỢ — router được gắn tại /api/chat trong src/app.js.
Tất cả API yêu cầu phiên đăng nhập, trả 401 nếu authenticate từ chối.
Luồng báo cáo: POST lưu tin -> publish phát tín hiệu SSE -> frontend nhận
tín hiệu -> gọi GET /messages để tải tin. Tin nhắn được lưu trong MongoDB.
clients là các kết nối đang mở trong tiến trình Node.js hiện tại;
triển khai nhiều tiến trình cần cơ chế chia sẻ sự kiện giữa các tiến trình.
*/

import { Router } from 'express';
import jwt from 'jsonwebtoken';
import { Types } from 'mongoose';
import { rateLimit } from 'express-rate-limit';
import { SESSION_COOKIE, authenticate } from '../middleware/auth.js';
import { User } from '../models/user.js';
import { ChatMessage } from '../models/chat.js';

const validId = value => typeof value === 'string' && /^[a-f0-9]{24}$/i.test(value);

export function chatRoutes(users = User) {
  const router = Router();
  // Mỗi kết nối nhận một tín hiệu để tải lại tin nhắn của đúng cuộc trò chuyện.
  const clients = new Set();
  // Admin nhận tín hiệu từ mọi cuộc trò chuyện; user chỉ nhận tín hiệu của chính mình.
  function publish(userId) {
    for (const client of clients) {
      if (client.admin || client.id === String(userId)) {
        client.response.write('event: message\ndata: ' + JSON.stringify({ userId: String(userId) }) + '\n\n');
      }
    }
  }
  router.use((_req, res, next) => { res.set('Cache-Control', 'no-store'); next(); });
  router.use(authenticate(users));

  /**
   * GET /api/chat/events — Kết nối cập nhật thời gian thực SSE.
   * Quyền truy cập — Đã đăng nhập.
   * Đầu vào — Cookie phiên; frontend mở bằng EventSource.
   * Thành công — 200 với Content-Type text/event-stream; kết nối được giữ mở.
   * Xử lý — Gửi ready khi nối; publish gửi message { userId }; heartbeat mỗi 15 giây kiểm tra phiên, tài khoản và quyền.
   * Lỗi thường gặp — 401 trước khi mở; khi phiên/quyền thay đổi gửi expired rồi đóng hoặc đóng khi JWT không hợp lệ.
   */
  router.get('/events', (req, res) => {
    res.set({ 'Content-Type': 'text/event-stream', 'Connection': 'keep-alive', 'X-Accel-Buffering': 'no' });
    // Gửi header ngay để EventSource xác nhận kết nối mà không chờ JSON hay kết thúc response.
    res.flushHeaders();
    const client = { id: String(req.user._id), admin: req.user.role === 'admin', response: res };
    clients.add(client);
    res.write('event: ready\ndata: {}\n\n');
    // Kiểm tra lại quyền khi tài khoản bị xóa hoặc phiên bị thu hồi.
    const heartbeat = setInterval(async () => {
      try {
        jwt.verify(req.cookies[SESSION_COOKIE], process.env.JWT_SECRET, { algorithms: ['HS256'], issuer: 'vyora', audience: 'vyora-web' });
        const user = await users.findById(client.id);
        if (!user || user.deletedAt || (user.sessionVersion ?? 0) !== (req.user.sessionVersion ?? 0) ||
            user.role !== req.user.role || Date.now() - started > 15 * 60 * 1000) {
          res.write('event: expired\ndata: {}\n\n');
          return res.end();
        }
        res.write(': heartbeat\n\n');
      } catch { res.end(); }
    }, 15000);
    const started = Date.now();
    // Khi client rời trang hoặc mất kết nối, dọn timer và xóa client khỏi Set để giải phóng tài nguyên.
    res.on('close', () => { clearInterval(heartbeat); clients.delete(client); });
  });

  /**
   * GET /api/chat/conversations — Hộp thư quản trị.
   * Quyền truy cập — Admin.
   * Đầu vào — Query before? là _id tin cuối của trang hội thoại trước.
   * Thành công — 200 { conversations, next }, tối đa 30 cuộc trò chuyện.
   * Xử lý — Nhóm ChatMessage theo userId, lấy tin mới nhất, nối thông tin khách rồi phân trang theo tin mới nhất.
   * Lỗi thường gặp — 400 before sai; 403 thiếu quyền admin.
   */
  router.get('/conversations', async (req, res) => {
    if (req.user.role !== 'admin') return res.status(403).json({ message: 'Cần quyền quản trị.' });
    const { before } = req.query;
    if (before !== undefined && !validId(before)) return res.status(400).json({ message: 'Mốc phân trang không hợp lệ.' });
    const rows = await ChatMessage.aggregate([
      { $sort: { _id: -1 } },
      { $group: { _id: '$userId', latest: { $first: '$$ROOT' } } },
      ...(before ? [{ $match: { 'latest._id': { $lt: new Types.ObjectId(before) } } }] : []),
      { $sort: { 'latest._id': -1 } }, { $limit: 31 },
      { $lookup: { from: User.collection.name, localField: '_id', foreignField: '_id',
        pipeline: [{ $project: { username: 1, displayName: 1, deletedAt: 1 } }], as: 'customer' } },
      { $unwind: '$customer' },
      { $project: { userId: '$_id', latest: 1, customer: 1 } },
    ]);
    res.json({ conversations: rows.slice(0, 30), next: rows.length > 30 ? String(rows[29].latest._id) : null });
  });

  /*
   * Middleware dùng chung cho GET/POST /messages.
   * Query userId tùy chọn; mặc định lấy tài khoản hiện tại.
   * User chỉ đọc/gửi trong cuộc trò chuyện của mình; admin được chọn userId khách.
   * req.chatUserId lưu mã cuộc trò chuyện đã kiểm tra cho các handler phía dưới.
   * Trả 400 mã sai, 403 truy cập hội thoại người khác, 404 tài khoản không tồn tại.
   */
  router.use('/messages', async (req, res, next) => {
    const id = req.query.userId ?? String(req.user._id);
    if (!validId(id)) return res.status(400).json({ message: 'Tài khoản không hợp lệ.' });
    if (id !== String(req.user._id) && req.user.role !== 'admin') {
      return res.status(403).json({ message: 'Bạn chỉ có thể mở cuộc trò chuyện của mình.' });
    }
    if (!await users.findById(id)) return res.status(404).json({ message: 'Không tìm thấy tài khoản.' });
    req.chatUserId = id;
    next();
  });

  /**
   * GET /api/chat/messages — Đọc lịch sử tin nhắn.
   * Quyền truy cập — Chủ cuộc trò chuyện hoặc admin.
   * Đầu vào — Query userId?, before?.
   * Thành công — 200 { messages, next }, tối đa 30 tin; messages xếp cũ tới mới để hiển thị.
   * Xử lý — Tìm 31 tin gần nhất theo _id giảm dần, giữ 30 và đảo thứ tự; next dùng tải tin cũ hơn.
   * Lỗi thường gặp — 400 before sai; các lỗi 401/403/404 theo middleware.
   */
  router.get('/messages', async (req, res) => {
    const { before } = req.query;
    if (before !== undefined && !validId(before)) return res.status(400).json({ message: 'Mốc phân trang không hợp lệ.' });
    const filter = { userId: req.chatUserId };
    if (before) filter._id = { $lt: before };
    const rows = await ChatMessage.find(filter).sort({ _id: -1 }).limit(31).lean();
    res.json({ messages: rows.slice(0, 30).reverse(), next: rows.length > 30 ? String(rows[29]._id) : null });
  });

  /**
   * POST /api/chat/messages — Gửi tin nhắn.
   * Quyền truy cập — Chủ cuộc trò chuyện hoặc admin.
   * Đầu vào — Query userId?; JSON { body, requestId }, requestId thường dùng crypto.randomUUID().
   * Thành công — 201 { message }, gồm nội dung, người gửi, fromAdmin, userId và createdAt.
   * Xử lý — Kiểm tra body 1–2.000 ký tự, lưu ChatMessage, phát SSE tới các bên liên quan rồi phản hồi.
   * Lỗi thường gặp — 400 dữ liệu sai; 409 mã gửi thuộc hội thoại khác; 429 vượt 60 tin/tài khoản/phút.
   */
  router.post('/messages', rateLimit({
    windowMs: 60000, limit: 60, keyGenerator: req => String(req.user._id),
    message: { message: 'Bạn gửi quá nhanh. Hãy thử lại sau một phút.' },
  }), async (req, res) => {
    const { body, requestId } = req.body ?? {};
    if (typeof body !== 'string' || !body.trim() || body.trim().length > 2000 ||
        typeof requestId !== 'string' || !/^[a-f0-9-]{36}$/i.test(requestId)) {
      return res.status(400).json({ message: 'Nhập tin nhắn từ 1 đến 2.000 ký tự.' });
    }
    // senderId và fromAdmin được lấy từ phiên để xác định đúng người gửi.
    let message;
    try {
      message = await ChatMessage.create({
        userId: req.chatUserId, senderId: req.user._id,
        sender: req.user.displayName || req.user.username, fromAdmin: req.user.role === 'admin',
        body: body.trim(), requestId,
      });
    } catch (error) {
      // Unique index senderId + requestId giúp gửi lại cùng yêu cầu không tạo tin nhắn trùng.
      if (error.code !== 11000) throw error;
      message = await ChatMessage.findOne({ senderId: req.user._id, requestId, userId: req.chatUserId });
      if (!message) return res.status(409).json({ message: 'Mã gửi đã được sử dụng.' });
    }
    publish(req.chatUserId);
    res.status(201).json({ message });
  });

  return router;
}
