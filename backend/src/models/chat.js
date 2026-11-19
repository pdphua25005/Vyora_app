import mongoose from 'mongoose';

const schema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, required: true },
  senderId: { type: mongoose.Schema.Types.ObjectId, required: true },
  sender: { type: String, required: true },
  fromAdmin: { type: Boolean, required: true },
  body: { type: String, required: true, maxlength: 2000 },
  requestId: { type: String, required: true },
}, { timestamps: true });

schema.index({ userId: 1, _id: -1 });
schema.index({ senderId: 1, requestId: 1 }, { unique: true });

export const ChatMessage = mongoose.model('ChatMessage', schema);
