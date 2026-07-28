import mongoose from 'mongoose';

const QuoteVersionSchema = new mongoose.Schema({
  work_id: { type: String, required: true, index: true },
  work_kind: { type: String, enum: ['academic', 'service'], required: true },
  version: { type: Number, required: true },
  labor: { type: Number, default: 0 },
  service_fee: { type: Number, default: 0 },
  expenses: { type: Number, default: 0 },
  total: { type: Number, required: true },
  currency: { type: String, default: 'USD' },
  notes: { type: String, required: true },
  expires_at: Date,
  issued_by: { type: String, required: true },
  accepted: { type: Boolean, default: false },
  accepted_by: { type: String, default: '' },
  accepted_at: Date,
  superseded_at: Date
}, { timestamps: true });

QuoteVersionSchema.index({ work_id: 1, version: 1 }, { unique: true });
export default mongoose.model('QuoteVersion', QuoteVersionSchema);
