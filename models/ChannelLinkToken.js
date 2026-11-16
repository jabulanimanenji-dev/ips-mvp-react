import mongoose from 'mongoose';

const ChannelLinkTokenSchema = new mongoose.Schema({
  token_hash: { type: String, required: true, unique: true },
  client_id: { type: String, required: true, index: true },
  expires_at: { type: Date, required: true },
  consumed_at: Date
}, { timestamps: true });
ChannelLinkTokenSchema.index({expires_at:1},{expireAfterSeconds:0});
export default mongoose.model('ChannelLinkToken',ChannelLinkTokenSchema);
