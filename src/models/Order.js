import mongoose from 'mongoose';

const MilestoneSchema = new mongoose.Schema({
  stage: Number,
  name: String,
  status: { type: String, default: 'pending' },
  paid: { type: Boolean, default: false },
  due_date: String,
  amount: Number
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
  writer_id: { type: String, default: '' },
  writer_name: { type: String, default: '' },
  requirements: { type: String, default: '' },
  milestones: [MilestoneSchema],
  files: [{ type: String }]
}, { timestamps: true });

export default mongoose.model('Order', OrderSchema);