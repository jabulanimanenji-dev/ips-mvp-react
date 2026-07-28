import mongoose from 'mongoose';

const AttachmentSchema = new mongoose.Schema({
  original_name: String,
  stored_name: String,
  mime_type: String,
  size: Number
}, { _id: false });

const DirectMessageSchema = new mongoose.Schema({
  conversation_id: { type: String, required: true, index: true },
  sender_id: { type: String, required: true },
  sender_role: { type: String, enum: ['client', 'writer', 'admin'], required: true },
  body: { type: String, default: '', maxlength: 5000 },
  attachments: [AttachmentSchema],
  reply_to: { type: mongoose.Schema.Types.ObjectId, ref: 'DirectMessage', default: null },
  read_by: [{ type: String }],
  edited_at: Date,
  deleted_at: Date
}, { timestamps: true });

export default mongoose.model('DirectMessage', DirectMessageSchema);
