import mongoose from 'mongoose';

const mediaAssetSchema = new mongoose.Schema({
  asset_id: { type: String, required: true, unique: true, index: true },
  original_name: { type: String, required: true },
  stored_name: { type: String, required: true, unique: true },
  mime_type: {
    type: String,
    enum: ['image/jpeg', 'image/png', 'image/webp', 'image/gif', 'video/mp4', 'video/webm'],
    required: true
  },
  media_type: { type: String, enum: ['image', 'video'], required: true },
  size: { type: Number, required: true, min: 1 },
  alt_text: { type: String, default: '' },
  caption: { type: String, default: '' },
  tags: [{ type: String }],
  uploaded_by: { type: String, required: true }
}, { timestamps: true });

export default mongoose.model('MediaAsset', mediaAssetSchema);
