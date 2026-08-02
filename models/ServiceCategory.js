import mongoose from 'mongoose';
import { SERVICE_LIFECYCLE_STATUSES } from '../shared/serviceEngine.js';
import { ToggleOverridesSchema } from './serviceEngineSchemas.js';
const schema = new mongoose.Schema({
  categoryId: { type: String, required: true, unique: true }, slug: { type: String, required: true, unique: true, lowercase: true, trim: true },
  name: { type: String, required: true, maxlength: 120 }, description: { type: String, default: '', maxlength: 1200 }, icon: { type: String, default: '', maxlength: 32 },
  family: { type: String, enum: ['professional', 'odd_job', 'other'], default: 'professional' }, order: { type: Number, default: 0, min: 0, max: 999 },
  featured: { type: Boolean, default: false }, status: { type: String, enum: SERVICE_LIFECYCLE_STATUSES, default: 'draft', index: true },
  statusBeforeArchive: { type: String, enum: SERVICE_LIFECYCLE_STATUSES, default: 'draft' }, toggles: { type: ToggleOverridesSchema, default: () => ({}) },
  publishedAt: Date, archivedAt: Date, createdBy: { type: String, default: '' }, updatedBy: { type: String, default: '' }
}, { timestamps: true });
export default mongoose.model('ServiceCategory', schema);
