import mongoose from 'mongoose';
import { SERVICE_LIFECYCLE_STATUSES } from '../shared/serviceEngine.js';
import { ServiceQuestionSchema, ServiceStepSchema, ToggleOverridesSchema } from './serviceEngineSchemas.js';
const schema = new mongoose.Schema({
  serviceId: { type: String, required: true, unique: true }, slug: { type: String, required: true, unique: true, lowercase: true, trim: true },
  categoryId: { type: String, required: true, index: true }, name: { type: String, required: true, maxlength: 120 }, description: { type: String, default: '', maxlength: 3000 },
  order: { type: Number, default: 0, min: 0, max: 999 }, featured: { type: Boolean, default: false },
  status: { type: String, enum: SERVICE_LIFECYCLE_STATUSES, default: 'draft', index: true }, statusBeforeArchive: { type: String, enum: SERVICE_LIFECYCLE_STATUSES, default: 'draft' },
  toggles: { type: ToggleOverridesSchema, default: () => ({}) }, templateId: { type: String, default: '' },
  steps: { type: [ServiceStepSchema], default: () => [{ id: 'step-1', title: 'Your request', order: 0 }] }, questions: { type: [ServiceQuestionSchema], default: [] },
  revision: { type: Number, default: 1, min: 1 }, publishedAt: Date, archivedAt: Date, createdBy: { type: String, default: '' }, updatedBy: { type: String, default: '' }
}, { timestamps: true });
export default mongoose.model('ServiceDefinition', schema);
