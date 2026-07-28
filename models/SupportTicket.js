import mongoose from 'mongoose';

const SupportMessageSchema = new mongoose.Schema({
  sender_id: { type: String, required: true },
  sender_role: { type: String, enum: ['client', 'admin'], required: true },
  body: { type: String, required: true, maxlength: 5000 },
  created_at: { type: Date, default: Date.now }
}, { _id: true });

const SupportTicketSchema = new mongoose.Schema({
  ticket_id: { type: String, required: true, unique: true, index: true },
  client_id: { type: String, required: true, index: true },
  client_name: { type: String, required: true },
  client_email: { type: String, required: true },
  subject: { type: String, required: true, maxlength: 180 },
  category: {
    type: String,
    enum: ['general', 'order', 'service', 'billing', 'technical', 'account'],
    default: 'general'
  },
  priority: { type: String, enum: ['standard', 'urgent'], default: 'standard' },
  status: {
    type: String,
    enum: ['Open', 'In Progress', 'Waiting for Client', 'Resolved', 'Closed'],
    default: 'Open',
    index: true
  },
  assigned_admin: { type: String, default: '' },
  resolution_note: { type: String, default: '', maxlength: 2000 },
  messages: { type: [SupportMessageSchema], default: [] },
  last_activity_at: { type: Date, default: Date.now, index: true }
}, { timestamps: true });

export default mongoose.model('SupportTicket', SupportTicketSchema);
