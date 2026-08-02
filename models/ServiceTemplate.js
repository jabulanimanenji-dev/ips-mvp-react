import mongoose from 'mongoose';
import { SERVICE_TEMPLATE_KINDS } from '../shared/serviceEngine.js';
import { ServiceQuestionSchema, ServiceStepSchema } from './serviceEngineSchemas.js';
const schema = new mongoose.Schema({
  templateId: { type: String, required: true, unique: true }, slug: { type: String, required: true, unique: true, lowercase: true, trim: true },
  name: { type: String, required: true, maxlength: 120 }, kind: { type: String, enum: [...SERVICE_TEMPLATE_KINDS, 'custom'], default: 'custom' },
  description: { type: String, default: '', maxlength: 1000 }, builtIn: { type: Boolean, default: false }, protected: { type: Boolean, default: false }, active: { type: Boolean, default: true },
  serviceDefaults: { type: mongoose.Schema.Types.Mixed, default: {} }, steps: { type: [ServiceStepSchema], default: () => [{ id: 'step-1', title: 'Your request', order: 0 }] },
  questions: { type: [ServiceQuestionSchema], default: [] }, createdBy: { type: String, default: '' }, updatedBy: { type: String, default: '' }
}, { timestamps: true });
export default mongoose.model('ServiceTemplate', schema);
