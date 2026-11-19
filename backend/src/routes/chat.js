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
  function publish(userId) {
    for (const client of clients) {
      if (client.admin || client.id === String(userId)) {
        client.response.write('event: message\ndata: ' + JSON.stringify({ userId: String(userId) }) + '\n\n');
      }
    }
  }
  router.use((_req, res, next) => { res.set('Cache-Control', 'no-store'); next(); });
  router.use(authenticate(users));

  router.get('/events', (req, res) => {
    res.set({ 'Content-Type': 'text/event-stream', 'Connection': 'keep-alive', 'X-Accel-Buffering': 'no' });
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
    res.on('close', () => { clearInterval(heartbeat); clients.delete(client); });
  });

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

  router.get('/messages', async (req, res) => {
    const { before } = req.query;
    if (before !== undefined && !validId(before)) return res.status(400).json({ message: 'Mốc phân trang không hợp lệ.' });
    const filter = { userId: req.chatUserId };
    if (before) filter._id = { $lt: before };
    const rows = await ChatMessage.find(filter).sort({ _id: -1 }).limit(31).lean();
    res.json({ messages: rows.slice(0, 30).reverse(), next: rows.length > 30 ? String(rows[29]._id) : null });
  });

  router.post('/messages', rateLimit({
    windowMs: 60000, limit: 60, keyGenerator: req => String(req.user._id),
    message: { message: 'Bạn gửi quá nhanh. Hãy thử lại sau một phút.' },
  }), async (req, res) => {
    const { body, requestId } = req.body ?? {};
    if (typeof body !== 'string' || !body.trim() || body.trim().length > 2000 ||
        typeof requestId !== 'string' || !/^[a-f0-9-]{36}$/i.test(requestId)) {
      return res.status(400).json({ message: 'Nhập tin nhắn từ 1 đến 2.000 ký tự.' });
    }
    let message;
    try {
      message = await ChatMessage.create({
        userId: req.chatUserId, senderId: req.user._id,
        sender: req.user.displayName || req.user.username, fromAdmin: req.user.role === 'admin',
        body: body.trim(), requestId,
      });
    } catch (error) {
      if (error.code !== 11000) throw error;
      message = await ChatMessage.findOne({ senderId: req.user._id, requestId, userId: req.chatUserId });
      if (!message) return res.status(409).json({ message: 'Mã gửi đã được sử dụng.' });
    }
    publish(req.chatUserId);
    res.status(201).json({ message });
  });

  return router;
}
