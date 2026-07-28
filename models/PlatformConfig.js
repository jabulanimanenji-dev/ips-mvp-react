import mongoose from 'mongoose';

const PlatformConfigSchema = new mongoose.Schema({
  key: { type: String, required: true, unique: true, default: 'platform' },
  draft: { type: mongoose.Schema.Types.Mixed, required: true, default: {} },
  published: { type: mongoose.Schema.Types.Mixed, required: true, default: {} },
  draftVersion: { type: Number, required: true, default: 1 },
  publishedVersion: { type: Number, required: true, default: 1 },
  draftUpdatedBy: { type: String, default: '' },
  publishedBy: { type: String, default: '' },
  publishedAt: { type: Date, default: null }
}, { timestamps: true });

export default mongoose.model('PlatformConfig', PlatformConfigSchema);
