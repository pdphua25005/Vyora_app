/*
XÁC THỰC TÀI KHOẢN — được gắn tại /api/auth trong src/app.js.
Luồng báo cáo: đăng ký -> lưu passwordHash -> đăng nhập -> cấp cookie JWT
-> middleware authenticate đọc cookie và gán tài khoản vào req.user.
req.body chứa JSON gửi lên; req.params chứa tham số trên đường dẫn;
req.query chứa bộ lọc sau dấu ?. res.status(...).json(...) trả mã HTTP và JSON.
Các lỗi phát sinh ngoài xử lý tại đây được chuyển tới middleware lỗi ở app.js.
*/

import { Router } from 'express'; // 	Tạo nhóm API riêng cho Authentication
import bcrypt from 'bcrypt'; // Băm mật khẩu khi đăng ký và so sánh khi đăng nhập
import { rateLimit } from 'express-rate-limit'; // Giới hạn số lần gọi API
import { User } from '../models/user.js'; // 	Mongoose Model truy cập collection người dùng
import { authenticate, publicUser, SESSION_COOKIE, sessionCookieOptions, startSession } from '../middleware/auth.js'; // Kiểm tra phiên, chọn dữ liệu công khai và tạo cookie JWT

import { profileUser, updateProfile } from './profile.js';

const COST = 12;
const fallbackHash = bcrypt.hash('vyora-unused-password', COST); // Hash dự phòng để vẫn chạy bcrypt.compare khi tên đăng nhập không tồn tại, giảm chênh lệch thời gian phản hồi
const normalize = value => typeof value === 'string' ? value.trim().toLowerCase() : ''; // Hàm chuẩn hoá dữ liệu đầu vào
const usernamePattern = /^[a-z0-9_.-]{3,30}$/; // Hàm kiểm tra tên đăng nhập
const fitsBcrypt = value => typeof value === 'string' && value.length > 0 && Buffer.byteLength(value, 'utf8') <= 72; //Mật khẩu phải là chuỗi. Không được rỗng. Không vượt quá 72 byte UTF-8

export function authRoutes(users = User) {
  const router = Router();
  // Giới hạn dùng chung cho đăng ký, đăng nhập và sửa hồ sơ, 20 yêu cầu/IP/15 phút; vượt mức trả 429.
  const limit = rateLimit({
    windowMs: 15 * 60 * 1000,
    limit: 20,
    standardHeaders: 'draft-8',
    legacyHeaders: false,
    message: { message: 'Bạn đã thử quá nhiều lần. Vui lòng thử lại sau.' },
  }); // Đây là hàm để chặn spam API

  router.use((req, res, next) => {
    res.set('Cache-Control', 'no-store');
    // POST và PATCH nhận JSON; Content-Type khác application/json trả 415.
    if (['POST', 'PATCH'].includes(req.method) && !req.is('application/json')) {
      return res.status(415).json({ message: 'Yêu cầu phải sử dụng JSON.' });
    }
    next();
  });

  //API đăng kí tài khoản
  /**
   * POST /api/auth/register — Tạo tài khoản.
   * Quyền truy cập — Công khai.
   * Đầu vào — JSON { username, email, phone, password, passwordConfirmation }.
   * Thành công — 201 { user } gồm id, username, email, phone, role; passwordHash được loại khỏi phản hồi.
   * Xử lý — Kiểm tra đầu vào, bcrypt.hash mật khẩu, tạo User với role user.
   * Lỗi thường gặp — 400 dữ liệu sai; 409 trùng username/email; 415 sai Content-Type; 429 quá nhiều yêu cầu.
   */
  router.post('/register', limit, async (req, res) => {
    const { password, passwordConfirmation } = req.body ?? {}; // ?? {} nghĩa là nếu req.body là null hoặc undefined, sử dụng object rỗng để tránh lỗi
    const username = normalize(req.body?.username);
    const email = normalize(req.body?.email);
    const phone = typeof req.body?.phone === 'string' ? req.body.phone.trim() : '';
    let message;
    // Bước 1. Chuẩn hóa và kiểm tra dữ liệu trước khi ghi vào MongoDB.
    if (!usernamePattern.test(username)) message = 'Tên đăng nhập cần 3–30 ký tự: chữ không dấu, số, dấu chấm, gạch dưới hoặc gạch ngang.';
    else if (email.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) message = 'Email không hợp lệ.';
    else if (!/^\+?[0-9]{9,15}$/.test(phone)) message = 'Số điện thoại cần từ 9 đến 15 chữ số.';
    else if (!fitsBcrypt(password) || [...password].length < 8) message = 'Mật khẩu cần ít nhất 8 ký tự và tối đa 72 byte UTF-8.';
    else if (password !== passwordConfirmation) message = 'Mật khẩu nhập lại không khớp.';
    if (message) return res.status(400).json({ message });

    // Bước 2. Băm mật khẩu với COST = 12, lưu hash và cấp vai trò user.
    try {
      const user = await users.create({ username, email, phone, passwordHash: await bcrypt.hash(password, COST), role: 'user' });
      return res.status(201).json({ user: publicUser(user) });
    } catch (error) {
      if (error.code === 11000) return res.status(409).json({ message: 'Tên đăng nhập hoặc email đã được sử dụng.' });
      throw error;
    }
  });
  //API đăng nhập
  /**
   * POST /api/auth/login — Đăng nhập.
   * Quyền truy cập — Công khai.
   * Đầu vào — JSON { username, password, remember? }; remember là boolean.
   * Thành công — 200 { user } và Set-Cookie vyora_session chứa JWT, có HttpOnly.
   * Xử lý — Tìm User, đọc hash, bcrypt.compare, kiểm tra tài khoản còn hoạt động, lưu lastLoginAt rồi tạo phiên.
   * Lỗi thường gặp — 401 sai thông tin hoặc tài khoản đã xóa; 415 sai Content-Type; 429 quá nhiều yêu cầu.
   */
  router.post('/login', limit, async (req, res) => {
    const username = normalize(req.body?.username);
    const { password, remember } = req.body ?? {}; // remember quyết định thời hạn phiên đăng nhập và cookie
    if (!usernamePattern.test(username) || !fitsBcrypt(password)) {
      return res.status(401).json({ message: 'Tên đăng nhập hoặc mật khẩu không đúng.' });
    } // Kiểm tra định dạng nếu không đạt yc trả HTTP 401
    const user = await users.findOne({ username }).select('+passwordHash');
    const matches = await bcrypt.compare(password, user?.passwordHash ?? await fallbackHash);
    if (!user || !matches || user.deletedAt) {
      return res.status(401).json({ message: 'Tên đăng nhập hoặc mật khẩu không đúng.' });
    }
    await users.updateOne({ _id: user._id, deletedAt: null }, { $max: { lastLoginAt: new Date() } }, { timestamps: false });
    // startSession tạo phiên 8 giờ; remember=true dùng 7 ngày và cookie có Max-Age.
    startSession(res, user, remember === true);
    return res.json({ user: publicUser(user) });
  });

  /**
   * GET /api/auth/me — Lấy hồ sơ của phiên hiện tại.
   * Quyền truy cập — Đã đăng nhập.
   * Đầu vào — Cookie vyora_session do trình duyệt tự gửi.
   * Thành công — 200 { user }, có thêm displayName, gender, birthDate, avatar, usernameChanged.
   * Xử lý — authenticate kiểm tra JWT và tài khoản; profileUser chọn trường hồ sơ để trả về.
   * Lỗi thường gặp — 401 thiếu cookie, JWT hết hạn, tài khoản đã xóa hoặc phiên bị thu hồi.
   */
  router.get('/me', authenticate(users), (req, res) => res.json({ user: profileUser(req.user) }));
  /**
   * PATCH /api/auth/me — Cập nhật một phần hồ sơ.
   * Quyền truy cập — Đã đăng nhập.
   * Đầu vào — JSON các trường muốn sửa; xem chi tiết trong profile.js.
   * Thành công — 200 { user } là hồ sơ sau cập nhật.
   * Xử lý — authenticate -> giới hạn tần suất -> updateProfile(users).
   * Lỗi thường gặp — 400 dữ liệu hoặc mật khẩu xác nhận sai; 401 hết phiên; 409 xung đột; 429 quá nhiều yêu cầu.
   */
  router.patch('/me', authenticate(users), limit, updateProfile(users));
  /**
   * POST /api/auth/logout — Đăng xuất trên trình duyệt.
   * Quyền truy cập — Có thể gọi cả khi cookie đã hết hạn.
   * Đầu vào — Gửi JSON {}, cookie hiện có được gửi cùng yêu cầu.
   * Thành công — 204, phản hồi rỗng và Set-Cookie để xóa cookie phiên.
   * Xử lý — Xóa vyora_session với cùng tùy chọn path/secure/sameSite đã dùng lúc tạo cookie.
   * Lỗi thường gặp — 415 nếu POST không có Content-Type application/json.
   */
  router.post('/logout', (_req, res) => {
    res.clearCookie(SESSION_COOKIE, sessionCookieOptions()).status(204).end();
  });
  return router;
}
