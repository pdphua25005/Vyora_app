import bcrypt from 'bcrypt';
import { publicUser } from '../middleware/auth.js';

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

export function validBirthDate(value) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const parsed = new Date(value);
  return !Number.isNaN(parsed.valueOf()) && parsed.toISOString().slice(0, 10) === value &&
    value >= '1900-01-01' && value <= new Date().toISOString().slice(0, 10);
}

function validAvatar(value) {
  const match = /^data:image\/(png|jpeg);base64,([A-Za-z0-9+/]+={0,2})$/.exec(value);
  if (!match) return false;
  const bytes = Buffer.from(match[2], 'base64');
  if (bytes.length > 1024 * 1024 || bytes.toString('base64') !== match[2]) return false;
  return match[1] === 'png'
    ? bytes.length > 24 && bytes.subarray(0, 8).toString('hex') === '89504e470d0a1a0a'
    : bytes.length > 4 && bytes.subarray(0, 3).toString('hex') === 'ffd8ff' && bytes.subarray(-2).toString('hex') === 'ffd9';
}

export function updateProfile(users) {
  return async (req, res) => {
    const body = req.body;
    const invalid = message => res.status(400).json({ message });
    if (!body || typeof body !== 'object' || Array.isArray(body)) return invalid('Dữ liệu hồ sơ không hợp lệ.');

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

    const filter = { _id: req.user._id };
    if (changes.username !== undefined) {
      changes.username = changes.username.toLowerCase();
      if (changes.username === req.user.username) delete changes.username;
      else {
        if (!/^[a-z0-9_.-]{3,30}$/.test(changes.username)) return invalid('Tên đăng nhập cần 3–30 ký tự: chữ không dấu, số, dấu chấm, gạch dưới hoặc gạch ngang.');
        if (req.user.usernameChanged) return res.status(409).json({ message: 'Bạn đã đổi tên đăng nhập một lần.' });
        filter.usernameChanged = { $ne: true };
        changes.usernameChanged = true;
      }
    }
    if (changes.email !== undefined) {
      changes.email = changes.email.toLowerCase();
      if (changes.email === req.user.email) delete changes.email;
      else {
        if (changes.email.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(changes.email)) return invalid('Email không hợp lệ.');
        const currentPassword = body.currentPassword;
        if (typeof currentPassword !== 'string' || !currentPassword || Buffer.byteLength(currentPassword) > 72) {
          return invalid('Nhập mật khẩu hiện tại để thay đổi email.');
        }
        const user = await users.findById(req.user._id).select('+passwordHash');
        if (!user || !await bcrypt.compare(currentPassword, user.passwordHash)) return invalid('Mật khẩu hiện tại không đúng.');
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
