import { Router } from 'express'; // 	Tạo nhóm API riêng cho Authentication
import bcrypt from 'bcrypt'; // Hàm dùng để so sánh mật khẩu
import { rateLimit } from 'express-rate-limit'; // Giới hạn số lần gọi API
import { User } from '../models/user.js'; // 	Mongoose Model truy cập collection người dùng
import { authenticate, publicUser, SESSION_COOKIE, sessionCookieOptions, startSession } from '../middleware/auth.js'; // Trả về thông tin và trả về giao diện đăng nhập

import { profileUser, updateProfile } from './profile.js';

const COST = 12;
const fallbackHash = bcrypt.hash('vyora-unused-password', COST); // Hàm trả về User có tên đăng nhập bị trùng mà không cần submit
const normalize = value => typeof value === 'string' ? value.trim().toLowerCase() : ''; // Hàm chuẩn hoá dữ liệu đầu vào
const usernamePattern = /^[a-z0-9_.-]{3,30}$/; // Hàm kiểm tra tên đăng nhập
const fitsBcrypt = value => typeof value === 'string' && value.length > 0 && Buffer.byteLength(value, 'utf8') <= 72; //Mật khẩu phải là chuỗi. Không được rỗng. Không vượt quá 72 byte UTF-8

export function authRoutes(users = User) {
  const router = Router();
  const limit = rateLimit({
    windowMs: 15 * 60 * 1000,
    limit: 20,
    standardHeaders: 'draft-8',
    legacyHeaders: false,
    message: { message: 'Bạn đã thử quá nhiều lần. Vui lòng thử lại sau.' },
  }); // Đây là hàm để chặn spam API

  router.use((req, res, next) => {
    res.set('Cache-Control', 'no-store');
    // Reject ordinary cross-origin HTML form submissions to the auth endpoints.
    if (['POST', 'PATCH'].includes(req.method) && !req.is('application/json')) {
      return res.status(415).json({ message: 'Yêu cầu phải sử dụng JSON.' });
    }
    next();
  });

  //API đăng kí tài khoản
  router.post('/register', limit, async (req, res) => {
    const { password, passwordConfirmation } = req.body ?? {}; // ?? {} nghĩa là nếu req.body là null hoặc undefined, sử dụng object rỗng để tránh lỗi
    const username = normalize(req.body?.username);
    const email = normalize(req.body?.email);
    const phone = typeof req.body?.phone === 'string' ? req.body.phone.trim() : '';
    let message;
    // Kiểm tra phiên nhập của user
    if (!usernamePattern.test(username)) message = 'Tên đăng nhập cần 3–30 ký tự: chữ không dấu, số, dấu chấm, gạch dưới hoặc gạch ngang.';
    else if (email.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) message = 'Email không hợp lệ.';
    else if (!/^\+?[0-9]{9,15}$/.test(phone)) message = 'Số điện thoại cần từ 9 đến 15 chữ số.';
    else if (!fitsBcrypt(password) || [...password].length < 8) message = 'Mật khẩu cần ít nhất 8 ký tự và tối đa 72 byte UTF-8.';
    else if (password !== passwordConfirmation) message = 'Mật khẩu nhập lại không khớp.';
    if (message) return res.status(400).json({ message });

    // Tạo tài khoản trên Mongo DB. Hệ thống tự động thêm role cho account khi đã đăng kí thành công
    try {
      const user = await users.create({ username, email, phone, passwordHash: await bcrypt.hash(password, COST), role: 'user' });
      return res.status(201).json({ user: publicUser(user) });
    } catch (error) {
      if (error.code === 11000) return res.status(409).json({ message: 'Tên đăng nhập hoặc email đã được sử dụng.' });
      throw error;
    }
  });
  //API đăng nhập
  router.post('/login', limit, async (req, res) => {
    const username = normalize(req.body?.username);
    const { password, remember } = req.body ?? {}; // Nhận thông tin đăng nhập. remember là nhớ mật khẩu
    if (!usernamePattern.test(username) || !fitsBcrypt(password)) {
      return res.status(401).json({ message: 'Tên đăng nhập hoặc mật khẩu không đúng.' });
    } // Kiểm tra định dạng nếu không đạt yc trả HTTP 401
    const user = await users.findOne({ username }).select('+passwordHash');
    const matches = await bcrypt.compare(password, user?.passwordHash ?? await fallbackHash);
    if (!user || !matches || user.deletedAt) {
      return res.status(401).json({ message: 'Tên đăng nhập hoặc mật khẩu không đúng.' });
    }
    await users.updateOne({ _id: user._id, deletedAt: null }, { $max: { lastLoginAt: new Date() } }, { timestamps: false });
    startSession(res, user, remember === true);
    return res.json({ user: publicUser(user) });
  });

  router.get('/me', authenticate(users), (req, res) => res.json({ user: profileUser(req.user) }));
  router.patch('/me', authenticate(users), limit, updateProfile(users));
  router.post('/logout', (_req, res) => {
    res.clearCookie(SESSION_COOKIE, sessionCookieOptions()).status(204).end();
  });
  return router;
}
