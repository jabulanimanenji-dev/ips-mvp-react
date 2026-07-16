import mongoose from 'mongoose';

const ClientSchema = new mongoose.Schema({
  client_id: { type: String, required: true, unique: true },
  full_name: { type: String, required: true },
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

export default mongoose.model('Client', ClientSchema);