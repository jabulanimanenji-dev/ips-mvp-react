import mongoose from 'mongoose';

const ActionStateSchema = new mongoose.Schema({
  action_key: { type: String, required: true, unique: true, index: true },
  owner_role: { type: String, enum: ['admin', 'writer'], required: true, index: true },
  owner_id: { type: String, default: '', index: true },
  status: { type: String, enum: ['open', 'in_progress', 'resolved', 'dismissed'], default: 'open' },
  priority: { type: String, enum: ['low', 'normal', 'high', 'urgent'], default: 'normal' },
  assigned_to: { type: String, default: '' },
  snoozed_until: Date,
  resolution_note: { type: String, default: '', maxlength: 2000 },
  snapshot: { type: mongoose.Schema.Types.Mixed, default: null },
  last_action_by: { type: String, default: '' },
  resolved_at: Date
}, { timestamps: true });

export default mongoose.model('ActionState', ActionStateSchema);
