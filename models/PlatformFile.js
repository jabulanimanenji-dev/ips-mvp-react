import mongoose from 'mongoose';

const PlatformFileSchema = new mongoose.Schema({
  order_id: { type: String, required: true, index: true },
  milestone_stage: { type: Number, default: null },
  original_name: { type: String, required: true },
  stored_name: { type: String, required: true, unique: true },
  mime_type: { type: String, required: true },
  size: { type: Number, required: true },
  category: { type: String, default: 'Other' },
  description: { type: String, default: '' },
  uploader_id: { type: String, required: true },
  uploader_role: { type: String, enum: ['client', 'writer', 'admin'], required: true },
  visibility: { type: String, enum: ['admin', 'admin_writer', 'admin_client', 'all'], default: 'admin' },
  state: { type: String, enum: ['pending', 'approved', 'released', 'rejected', 'archived'], default: 'pending' },
  version: { type: Number, default: 1 },
  download_count: { type: Number, default: 0 },
  released_at: Date
}, { timestamps: true });

export default mongoose.model('PlatformFile', PlatformFileSchema);
