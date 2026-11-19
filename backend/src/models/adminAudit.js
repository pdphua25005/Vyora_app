import mongoose from 'mongoose';

const auditSchema = new mongoose.Schema({
  actor: { type: String, required: true },
  actorId: { type: mongoose.Schema.Types.ObjectId, required: true },
  action: { type: String, required: true },
  targetId: { type: mongoose.Schema.Types.ObjectId, required: true },
  target: { type: String, required: true },
  fields: [String],
}, { timestamps: { createdAt: true, updatedAt: false } });

export const AdminAudit = mongoose.model('AdminAudit', auditSchema);
