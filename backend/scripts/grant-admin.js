import 'dotenv/config';
import mongoose from 'mongoose';
import { User } from '../src/models/user.js';
import { connectDB } from '../src/config/db.js';

const username = process.argv[2]?.trim().toLowerCase();
if (!username || !/^[a-z0-9_.-]{3,30}$/.test(username)) {
  console.error('Cách dùng: npm run admin:grant -- ten_dang_nhap');
  process.exit(1);
}

try {
  await connectDB();
  const result = await User.updateOne(
    { username, deletedAt: null, role: { $ne: 'admin' } },
    { $set: { role: 'admin' }, $inc: { sessionVersion: 1 } },
  );
  if (result.modifiedCount) {
    console.log('Đã cấp quyền quản trị cho ' + username + '. Hãy đăng nhập lại.');
  } else if (await User.exists({ username, deletedAt: null, role: 'admin' })) {
    console.log('Tài khoản này đã có quyền quản trị.');
  } else {
    console.error('Không tìm thấy tài khoản đang hoạt động.');
    process.exitCode = 1;
  }
} catch (error) {
  console.error('Cấp quyền thất bại:', error.code ?? error.name);
  process.exitCode = 1;
} finally {
  await mongoose.disconnect();
}
