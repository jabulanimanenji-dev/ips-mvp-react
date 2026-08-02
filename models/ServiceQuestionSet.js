import mongoose from 'mongoose';
import { ServiceQuestionSchema, ServiceStepSchema } from './serviceEngineSchemas.js';
const schema = new mongoose.Schema({
  questionSetId: { type: String, required: true, unique: true }, slug: { type: String, required: true, unique: true, lowercase: true, trim: true },
  name: { type: String, required: true, maxlength: 120 }, description: { type: String, default: '', maxlength: 1000 }, protected: { type: Boolean, default: false },
  steps: { type: [ServiceStepSchema], default: () => [{ id: 'step-1', title: 'Your request', order: 0 }] }, questions: { type: [ServiceQuestionSchema], default: [] },
  version: { type: Number, default: 1, min: 1 }, createdBy: { type: String, default: '' }, updatedBy: { type: String, default: '' }
}, { timestamps: true });
export default mongoose.model('ServiceQuestionSet', schema);
