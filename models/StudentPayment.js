import mongoose from 'mongoose';

const StudentPaymentSchema = new mongoose.Schema({
  payment_id: { type: String, required: true, unique: true },
  request_id: { type: String, required: true, index: true },
  active_checkout_key: { type: String, unique: true, sparse: true },
  client_id: { type: String, required: true, index: true },
  quote_version: { type: Number, required: true },
  amount_minor: { type: Number, required: true, min: 1 },
  currency: { type: String, required: true },
  status: { type: String, enum: ['pending','processing','paid','failed','expired','review_required','refunded'], default: 'pending' },
  provider: { type: String, default: 'stripe' },
  provider_session_id: { type: String, unique: true, sparse: true },
  checkout_url: { type: String, default: '' },
  checkout_expires_at: Date,
  provider_payment_intent: { type: String, default: '' },
  paid_at: Date,
  refunded_minor:{type:Number,default:0,min:0},
  refund_lock:{type:String,default:''},
  last_event_id: { type: String, default: '' },
  problem: { type: String, default: '' }
}, { timestamps: true });

export default mongoose.model('StudentPayment', StudentPaymentSchema);
