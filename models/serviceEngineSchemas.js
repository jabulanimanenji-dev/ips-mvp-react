import mongoose from 'mongoose';
import { SERVICE_CONDITION_OPERATORS, SERVICE_ENGINE_TOGGLE_DEFINITIONS, SERVICE_QUESTION_TYPES } from '../shared/serviceEngine.js';

const ToggleDefinition = Object.fromEntries(SERVICE_ENGINE_TOGGLE_DEFINITIONS.map(({ key }) => [key, { type: Boolean, default: null }]));
const GlobalToggleDefinition = Object.fromEntries(SERVICE_ENGINE_TOGGLE_DEFINITIONS.map(({ key }) => [key, { type: Boolean, default: true }]));
export const ToggleOverridesSchema = new mongoose.Schema(ToggleDefinition, { _id: false });
export const GlobalTogglesSchema = new mongoose.Schema(GlobalToggleDefinition, { _id: false });
const OptionSchema = new mongoose.Schema({ label: { type: String, required: true, maxlength: 120 }, value: { type: String, required: true, maxlength: 120 } }, { _id: false });
const ValidationSchema = new mongoose.Schema({ min: Number, max: Number, minLength: Number, maxLength: Number, pattern: { type: String, maxlength: 240 }, minSelections: Number, maxSelections: Number }, { _id: false });
const ConditionSchema = new mongoose.Schema({ enabled: { type: Boolean, default: false }, questionId: { type: String, default: '', maxlength: 100 }, operator: { type: String, enum: SERVICE_CONDITION_OPERATORS, default: 'equals' }, value: mongoose.Schema.Types.Mixed }, { _id: false });
const UploadSchema = new mongoose.Schema({ accept: { type: String, default: '', maxlength: 240 }, maxFiles: { type: Number, default: 1, min: 1, max: 20 }, maxSizeMb: { type: Number, default: 10, min: 1, max: 100 }, imageOnly: { type: Boolean, default: false } }, { _id: false });
export const ServiceQuestionSchema = new mongoose.Schema({
  id: { type: String, required: true, maxlength: 100 }, key: { type: String, required: true, maxlength: 100 },
  type: { type: String, required: true, enum: SERVICE_QUESTION_TYPES.map(item => item.value) }, label: { type: String, required: true, maxlength: 180 },
  helpText: { type: String, default: '', maxlength: 500 }, placeholder: { type: String, default: '', maxlength: 240 },
  required: { type: Boolean, default: false }, step: { type: Number, default: 1, min: 1, max: 20 }, order: { type: Number, default: 0, min: 0 },
  options: { type: [OptionSchema], default: [] }, validation: { type: ValidationSchema, default: () => ({}) },
  condition: { type: ConditionSchema, default: () => ({}) }, upload: { type: UploadSchema, default: () => ({}) }
}, { _id: false });
export const ServiceStepSchema = new mongoose.Schema({ id: { type: String, required: true }, title: { type: String, required: true, maxlength: 120 }, description: { type: String, default: '', maxlength: 300 }, order: { type: Number, default: 0 } }, { _id: false });
