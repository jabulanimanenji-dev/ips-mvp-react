import mongoose from 'mongoose';

const ConversationStateSchema = new mongoose.Schema({
  work_id: { type: String, required: true, index: true },
  channel: { type: String, required: true },
  assigned_admin: { type: String, default: '' },
  priority: { type: String, enum: ['normal', 'important', 'urgent', 'critical'], default: 'normal' },
  status: { type: String, enum: ['open', 'waiting_client', 'waiting_provider', 'waiting_admin', 'resolved', 'archived'], default: 'open' },
  tags: [{ type: String, maxlength: 60 }],
  follow_up_at: Date,
  snoozed_until: Date,
  escalated: { type: Boolean, default: false },
  escalation_reason: { type: String, default: '', maxlength: 1000 },
  resolution_reason: { type: String, default: '', maxlength: 2000 },
  last_admin_reply_at: Date
}, { timestamps: true });

ConversationStateSchema.index({ work_id: 1, channel: 1 }, { unique: true });
export default mongoose.model('ConversationState', ConversationStateSchema);
