import mongoose from 'mongoose';

const WorkExpenseSchema = new mongoose.Schema({
  work_id: { type: String, required: true, index: true },
  work_kind: { type: String, enum: ['academic', 'service'], required: true },
  category: { type: String, required: true },
  merchant: { type: String, default: '' },
  description: { type: String, required: true, maxlength: 2000 },
  amount: { type: Number, required: true, min: 0 },
  currency: { type: String, default: 'USD' },
  expense_date: { type: Date, required: true },
  receipt_file_id: { type: mongoose.Schema.Types.ObjectId, ref: 'PlatformFile', default: null },
  submitted_by_id: { type: String, required: true },
  submitted_by_role: { type: String, enum: ['client', 'provider', 'writer', 'admin'], required: true },
  pre_approved: { type: Boolean, default: false },
  client_visible: { type: Boolean, default: false },
  status: { type: String, enum: ['submitted', 'more_info_required', 'approved', 'partially_approved', 'rejected', 'reimbursed'], default: 'submitted' },
  approved_amount: { type: Number, default: 0, min: 0 },
  admin_reason: { type: String, default: '', maxlength: 2000 },
  reviewed_by: { type: String, default: '' },
  reviewed_at: Date
}, { timestamps: true });

export default mongoose.model('WorkExpense', WorkExpenseSchema);
