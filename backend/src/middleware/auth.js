import jwt from 'jsonwebtoken';
import { User } from '../models/user.js';

export const SESSION_COOKIE = 'vyora_session';
export const sessionCookieOptions = () => ({
  httpOnly: true,
  secure: process.env.NODE_ENV === 'production',
  sameSite: 'strict',
  path: '/api',
});

const claims = { issuer: 'vyora', audience: 'vyora-web' };

export function startSession(res, user, remember) {
  const expiresIn = remember ? 7 * 86400 : 8 * 3600;
  const token = jwt.sign({ version: user.sessionVersion ?? 0 }, process.env.JWT_SECRET, {
    ...claims, algorithm: 'HS256', subject: String(user._id), expiresIn,
  });
  res.cookie(SESSION_COOKIE, token, {
    ...sessionCookieOptions(),
    ...(remember ? { maxAge: expiresIn * 1000 } : {}),
  });
}

export function publicUser(user) {
  return { id: String(user._id), username: user.username, email: user.email, phone: user.phone, role: user.role };
}

export function authenticate(users = User, { optional = false } = {}) {
  return async (req, res, next) => {
    function invalidSession(message) {
      if (optional) return next();
      return res.status(401).json({ message });
    }

    let subject;
    let version;
    try {
      ({ sub: subject, version = 0 } = jwt.verify(req.cookies[SESSION_COOKIE], process.env.JWT_SECRET, {
        ...claims, algorithms: ['HS256'],
      }));
    } catch {
      return invalidSession('Bạn chưa đăng nhập hoặc phiên đã hết hạn.');
    }
    if (typeof subject !== 'string' || !/^[a-f0-9]{24}$/i.test(subject)) {
      return invalidSession('Phiên đăng nhập không hợp lệ.');
    }
    const user = await users.findById(subject);
    if (!user || user.deletedAt || version !== (user.sessionVersion ?? 0)) {
      return invalidSession('Phiên đăng nhập không còn hiệu lực.');
    }
    req.user = user;
    next();
  };
}

export const requireRole = (...roles) => (req, res, next) => {
  if (!req.user) return res.status(401).json({ message: 'Bạn chưa đăng nhập.' });
  if (!roles.includes(req.user.role)) return res.status(403).json({ message: 'Bạn không có quyền truy cập.' });
  next();
};
