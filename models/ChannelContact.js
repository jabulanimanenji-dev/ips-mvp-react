import mongoose from 'mongoose';

// An external chat is unverified until a student links it from an authenticated IPS session.
// No payment, academic document, or authentication data is shared with providers automatically.
const ChannelContactSchema = new mongoose.Schema({
  channel: { type: String, required: true, enum: ['telegram','whatsapp'] },
  external_id: { type: String, required: true },
  display_name: { type: String, default: '', maxlength: 120 },
  client_id: { type: String, default: '', index: true },
  verified_at: Date,
  last_inbound_at: Date,
  last_message_at: Date,
  status: { type: String, default: 'open', enum: ['open','closed'] },
  unread_count: { type: Number, default: 0, min: 0 }
}, { timestamps: true, strict: true });
ChannelContactSchema.index({ channel: 1, external_id: 1 }, { unique: true });
export default mongoose.model('ChannelContact', ChannelContactSchema);
