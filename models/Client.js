import mongoose from 'mongoose';

const ClientSchema = new mongoose.Schema({
  client_id: { type: String, required: true, unique: true },
  // Academic visitors use a chosen private username; legal names are not
  // collected for registration or ordinary quotation requests.
  username: { type: String, trim: true, maxlength: 32 },
  username_key: { type: String, lowercase: true, trim: true },
  full_name: { type: String, default: '' },
  email_verified_at: { type: Date, default: null },
  first_login_at: { type: Date, default: null },
  verification_hash: { type: String, select: false },
  verification_expires_at: { type: Date, select: false },
  verification_sent_at: { type: Date, select: false },
  verification_attempts: { type: Number, default: 0, select: false },
  email: { type: String, required: true, unique: true },
  password: { type: String, required: true },
  phone: { type: String, default: '' },
  country: { type: String, default: '' },
  registration_date: { type: String, default: () => new Date().toISOString().split('T')[0] },
  total_orders: { type: Number, default: 0 },
  total_spent: { type: Number, default: 0 },
  status: { type: String, default: 'Active' },
  notes: { type: String, default: '' }
}, { timestamps: true });

ClientSchema.index({username_key:1},{unique:true,partialFilterExpression:{username_key:{$type:'string'}}});
export default mongoose.model('Client', ClientSchema);