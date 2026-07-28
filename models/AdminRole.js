import mongoose from 'mongoose';

const AdminRoleSchema = new mongoose.Schema({
  role_id: { type: String, required: true, unique: true, index: true },
  name: { type: String, required: true, unique: true, maxlength: 80 },
  description: { type: String, default: '', maxlength: 500 },
  permissions: { type: [String], default: [] },
  protected: { type: Boolean, default: false },
  created_by: { type: String, required: true },
  updated_by: { type: String, default: '' }
}, { timestamps: true });

export default mongoose.model('AdminRole', AdminRoleSchema);
