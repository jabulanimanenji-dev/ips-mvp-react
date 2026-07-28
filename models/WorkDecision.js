import mongoose from 'mongoose';

const WorkDecisionSchema = new mongoose.Schema({
  work_id: { type: String, required: true, index: true },
  work_kind: { type: String, enum: ['academic', 'service'], required: true },
  type: {
    type: String,
    enum: ['quote_change', 'clarification', 'revision', 'hold', 'cancellation', 'dispute'],
    required: true
  },
  subject: { type: String, required: true, maxlength: 180 },
  details: { type: String, required: true, maxlength: 5000 },
  requested_changes: [{ type: String, maxlength: 500 }],
  priority: { type: String, enum: ['normal', 'important', 'urgent'], default: 'normal' },
  status: { type: String, enum: ['open', 'answered', 'resolved', 'declined'], default: 'open' },
  created_by_id: { type: String, required: true },
  created_by_role: { type: String, enum: ['client', 'provider', 'writer', 'admin'], required: true },
  assigned_to_role: { type: String, enum: ['client', 'provider', 'writer', 'admin'], required: true },
  response: { type: String, default: '', maxlength: 5000 },
  responded_by_id: { type: String, default: '' },
  responded_by_role: { type: String, default: '' },
  responded_at: Date,
  resolved_by_id: { type: String, default: '' },
  resolved_at: Date,
  quote_snapshot: { type: mongoose.Schema.Types.Mixed, default: null }
}, { timestamps: true });

export default mongoose.model('WorkDecision', WorkDecisionSchema);
