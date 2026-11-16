import mongoose from 'mongoose';

const ChannelMessageSchema = new mongoose.Schema({
  contact_id: { type: mongoose.Schema.Types.ObjectId, ref: 'ChannelContact', required: true, index: true },
  channel: { type: String, enum: ['telegram','whatsapp'], required: true },
  external_message_id: { type: String, required: true },
  direction: { type: String, enum: ['inbound','outbound'], required: true },
  body: { type: String, default: '', maxlength: 3000 },
  provider_at: Date,
  sent_by: { type: String, default: '' },
  status: { type: String, enum: ['received','sent'], required: true }
}, { timestamps: true, strict: true });
ChannelMessageSchema.index({channel: 1,external_message_id: 1}, {unique:true});
ChannelMessageSchema.index({contact_id:1,createdAt:1});
export default mongoose.model('ChannelMessage', ChannelMessageSchema);
