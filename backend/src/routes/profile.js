/*
XỬ LÝ HỒ SƠ — các hàm trong file này được auth.routes.js sử dụng.
profileUser phục vụ GET /api/auth/me và phản hồi PATCH /api/auth/me.
updateProfile tạo hàm xử lý PATCH; quyền đăng nhập đã được kiểm tra ở router.
Body được app.js đọc với giới hạn 1.400 KB cho PATCH /api/auth/me.
*/

import bcrypt from 'bcrypt';
import { publicUser } from '../middleware/auth.js';

// Chọn dữ liệu hồ sơ gửi tới frontend và đặt giá trị mặc định cho tài khoản cũ.
export function profileUser(user) {
  return {
    ...publicUser(user),
    displayName: user.displayName ?? '',
    gender: user.gender ?? '',
    birthDate: user.birthDate ?? '',
    avatar: user.avatar ?? '',
    usernameChanged: user.usernameChanged === true,
  };
}

// Chấp nhận ngày thực tế theo YYYY-MM-DD, từ 01/01/1900 tới hôm nay.
export function validBirthDate(value) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const parsed = new Date(value);
  return !Number.isNaN(parsed.valueOf()) && parsed.toISOString().slice(0, 10) === value &&
    value >= '1900-01-01' && value <= new Date().toISOString().slice(0, 10);
}

// Đọc data URL Base64, giới hạn ảnh 1 MB và kiểm tra dấu hiệu định dạng PNG/JPEG.
function validAvatar(value) {
  const match = /^data:image\/(png|jpeg);base64,([A-Za-z0-9+/]+={0,2})$/.exec(value);
  if (!match) return false;
  const bytes = Buffer.from(match[2], 'base64');
  if (bytes.length > 1024 * 1024 || bytes.toString('base64') !== match[2]) return false;
  return match[1] === 'png'
    ? bytes.length > 24 && bytes.subarray(0, 8).toString('hex') === '89504e470d0a1a0a'
    : bytes.length > 4 && bytes.subarray(0, 3).toString('hex') === 'ffd8ff' && bytes.subarray(-2).toString('hex') === 'ffd9';
}

/**
 * PATCH /api/auth/me — Hàm xử lý cập nhật hồ sơ.
 * Quyền truy cập — req.user đã được authenticate xác thực.
 * Đầu vào — JSON { username?, displayName?, email?, phone?, gender?, birthDate?, avatar?, currentPassword? }.
 * Thành công — 200 { user }; chỉ cập nhật những trường được gửi trong danh sách cho phép.
 * Xử lý — Kiểm tra từng trường, áp dụng quy tắc đổi tên/email, cập nhật có điều kiện rồi trả hồ sơ.
 * Lỗi thường gặp — 400 trường sai hoặc currentPassword sai; 409 tên/email trùng, đổi tên lần hai hoặc hồ sơ đã thay đổi.
 */
export function updateProfile(users) {
  return async (req, res) => {
    const body = req.body;
    const invalid = message => res.status(400).json({ message });
    if (!body || typeof body !== 'object' || Array.isArray(body)) return invalid('Dữ liệu hồ sơ không hợp lệ.');

    // Chỉ lấy các trường được phép; các trường như role, passwordHash gửi thêm sẽ bị bỏ qua.
    const fields = ['username', 'displayName', 'email', 'phone', 'gender', 'birthDate', 'avatar'];
    const changes = {};
    for (const field of fields) {
      if (!Object.hasOwn(body, field)) continue;
      if (typeof body[field] !== 'string') return invalid('Dữ liệu hồ sơ không hợp lệ.');
      changes[field] = body[field].trim();
    }
    if (changes.displayName?.length > 80) return invalid('Tên chỉ được tối đa 80 ký tự.');
    if (changes.gender && !['male', 'female', 'other'].includes(changes.gender)) return invalid('Giới tính không hợp lệ.');
    if (changes.birthDate && !validBirthDate(changes.birthDate)) return invalid('Ngày sinh không hợp lệ.');
    if (changes.phone !== undefined && !/^\+?[0-9]{9,15}$/.test(changes.phone)) return invalid('Số điện thoại cần từ 9 đến 15 chữ số.');
    if (changes.avatar && !validAvatar(changes.avatar)) return invalid('Ảnh cần là JPEG hoặc PNG và không vượt quá 1 MB.');

    // Lấy chủ sở hữu từ phiên đăng nhập để giới hạn cập nhật đúng tài khoản đang dùng.
    const filter = { _id: req.user._id };
    if (changes.username !== undefined) {
      changes.username = changes.username.toLowerCase();
      if (changes.username === req.user.username) delete changes.username;
      else {
        if (!/^[a-z0-9_.-]{3,30}$/.test(changes.username)) return invalid('Tên đăng nhập cần 3–30 ký tự: chữ không dấu, số, dấu chấm, gạch dưới hoặc gạch ngang.');
        if (req.user.usernameChanged) return res.status(409).json({ message: 'Bạn đã đổi tên đăng nhập một lần.' });
        // Điều kiện nằm ngay trong lệnh cập nhật giúp hai yêu cầu đồng thời không đổi tên hai lần.
        filter.usernameChanged = { $ne: true };
        changes.usernameChanged = true;
      }
    }
    if (changes.email !== undefined) {
      changes.email = changes.email.toLowerCase();
      if (changes.email === req.user.email) delete changes.email;
      else {
        if (changes.email.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(changes.email)) return invalid('Email không hợp lệ.');
        // Đổi email cần xác nhận mật khẩu hiện tại bằng bcrypt.compare.
        const currentPassword = body.currentPassword;
        if (typeof currentPassword !== 'string' || !currentPassword || Buffer.byteLength(currentPassword) > 72) {
          return invalid('Nhập mật khẩu hiện tại để thay đổi email.');
        }
        const user = await users.findById(req.user._id).select('+passwordHash');
        if (!user || !await bcrypt.compare(currentPassword, user.passwordHash)) return invalid('Mật khẩu hiện tại không đúng.');
        // Chỉ lưu nếu hash vẫn khớp lúc kiểm tra, phát hiện thay đổi đồng thời để trả 409.
        filter.passwordHash = user.passwordHash;
      }
    }

    if (!Object.keys(changes).length) return res.json({ user: profileUser(req.user) });
    try {
      const updated = await users.findOneAndUpdate(filter, { $set: changes }, { returnDocument: 'after', runValidators: true });
      if (!updated) return res.status(409).json({ message: 'Hồ sơ đã thay đổi. Tải lại trang rồi thử lại.' });
      return res.json({ user: profileUser(updated) });
    } catch (error) {
      if (error.code === 11000) return res.status(409).json({ message: 'Tên đăng nhập hoặc email đã được sử dụng.' });
      throw error;
    }
  };
}
