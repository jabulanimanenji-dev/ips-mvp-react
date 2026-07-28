import mongoose from 'mongoose';

const AdminSchema = new mongoose.Schema({
  id: { type: String, required: true, unique: true },
  name: { type: String, required: true },
  email: { type: String, required: true, unique: true },
  password: { type: String, required: true },
  role: { type: String, default: 'admin', index: true },
  custom_role_id: { type: String, default: '' },
  permissions: { type: [String], default: [] },
  status: { type: String, enum: ['Active', 'Suspended', 'Locked', 'Archived'], default: 'Active', index: true },
  must_change_password: { type: Boolean, default: true },
  session_version: { type: Number, default: 1 },
  created_by: { type: String, default: '' },
  last_login_at: Date,
  last_password_reset_at: Date,
  suspended_reason: { type: String, default: '' }
}, { timestamps: true });

export default mongoose.model('Admin', AdminSchema);
