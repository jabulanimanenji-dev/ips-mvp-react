import mongoose from 'mongoose';

const MessageSchema = new mongoose.Schema({
  order_id: { type: String, required: true, index: true },
  sender_id: { type: String, required: true },
  sender_role: { type: String, enum: ['client', 'writer', 'admin'], required: true },
  channel: { type: String, enum: ['client_admin', 'writer_admin', 'client_provider', 'admin_internal', 'announcement'], required: true },
  body: { type: String, required: true, maxlength: 5000 },
  read_by: [{ type: String }]
}, { timestamps: true });

export default mongoose.model('Message', MessageSchema);
