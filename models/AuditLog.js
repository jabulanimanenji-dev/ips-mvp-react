import mongoose from 'mongoose';

const AuditLogSchema = new mongoose.Schema({
  order_id: { type: String, index: true },
  actor_id: { type: String, required: true },
  actor_role: { type: String, required: true },
  action: { type: String, required: true },
  details: { type: mongoose.Schema.Types.Mixed, default: {} }
}, { timestamps: true });

export default mongoose.model('AuditLog', AuditLogSchema);
