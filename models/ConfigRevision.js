import mongoose from 'mongoose';

const ConfigRevisionSchema = new mongoose.Schema({
  key: { type: String, required: true, default: 'platform', index: true },
  version: { type: Number, required: true },
  config: { type: mongoose.Schema.Types.Mixed, required: true },
  publishedBy: { type: String, required: true },
  note: { type: String, default: '' }
}, { timestamps: true });

ConfigRevisionSchema.index({ key: 1, version: 1 }, { unique: true });

export default mongoose.model('ConfigRevision', ConfigRevisionSchema);
