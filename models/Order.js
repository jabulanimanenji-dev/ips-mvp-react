import mongoose from 'mongoose';

const MilestoneSchema = new mongoose.Schema({
  stage: Number,
  name: String,
  status: { type: String, default: 'pending' },
  paid: { type: Boolean, default: false },
  due_date: String,
  amount: Number,
  progress: { type: Number, default: 0, min: 0, max: 100 },
  admin_feedback: { type: String, default: '' },
  submitted_at: Date,
  approved_at: Date
}, { _id: false });

const OrderSchema = new mongoose.Schema({
  order_id: { type: String, required: true, unique: true },
  client_id: { type: String, required: true },
  client_name: { type: String, required: true },
  client_email: { type: String, required: true },
  service_type: { type: String, required: true },
  academic_level: { type: String, default: 'N/A' },
  subject: { type: String, default: '' },
  topic_title: { type: String, default: '' },
  word_count: { type: Number, default: 0 },
  pages: { type: Number, default: 0 },
  total_fee_usd: { type: Number, default: 0 },
  deadline: { type: String, required: true },
  status: { type: String, default: 'New' },
  progress: { type: Number, default: 0, min: 0, max: 100 },
  current_milestone: { type: Number, default: 1 },
  client_approved: { type: Boolean, default: false },
  revision_count: { type: Number, default: 0 },
  admin_notes: { type: String, default: '' },
  writer_notes: { type: String, default: '' },
  direct_contact_enabled: { type: Boolean, default: false },
  status_history: [{
    status: String,
    actor_id: String,
    actor_role: String,
    reason: String,
    changed_at: { type: Date, default: Date.now }
  }],
  writer_id: { type: String, default: '' },
  writer_name: { type: String, default: '' },
  requirements: { type: String, default: '' },
  milestones: [MilestoneSchema],
  files: [{ type: String }]
}, { timestamps: true });

export default mongoose.model('Order', OrderSchema);
