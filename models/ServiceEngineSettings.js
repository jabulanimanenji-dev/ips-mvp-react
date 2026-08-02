import mongoose from 'mongoose';
import { GlobalTogglesSchema } from './serviceEngineSchemas.js';
const schema = new mongoose.Schema({ key: { type: String, required: true, unique: true, default: 'service-engine' }, enabled: { type: Boolean, default: true }, toggles: { type: GlobalTogglesSchema, default: () => ({}) }, version: { type: Number, default: 1, min: 1 }, updatedBy: { type: String, default: '' } }, { timestamps: true });
export default mongoose.model('ServiceEngineSettings', schema);
