import mongoose from 'mongoose';

export const ROLES = ['user', 'partner', 'admin'];

const userSchema = new mongoose.Schema({
  username: { type: String, required: true, trim: true, lowercase: true, unique: true },
  email: { type: String, required: true, trim: true, lowercase: true, unique: true },
  phone: { type: String, required: true },
  passwordHash: { type: String, required: true, select: false },
  displayName: { type: String, maxlength: 80 },
  gender: { type: String, enum: ['', 'male', 'female', 'other'] },
  birthDate: String,
  avatar: String,
  usernameChanged: { type: Boolean, default: false },
  role: { type: String, enum: ROLES, default: 'user', required: true },
  deletedAt: Date,
  lastLoginAt: Date,
  sessionVersion: { type: Number, default: 0 },
}, { timestamps: true });

export const User = mongoose.model('User', userSchema);
