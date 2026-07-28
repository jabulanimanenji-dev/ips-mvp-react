import mongoose from 'mongoose';

const ParticipantSchema = new mongoose.Schema({
  role: { type: String, enum: ['client', 'writer', 'admin'], required: true },
  id: { type: String, required: true },
  name: { type: String, default: '' },
  archived: { type: Boolean, default: false },
  muted: { type: Boolean, default: false }
}, { _id: false });

const DirectConversationSchema = new mongoose.Schema({
  conversation_id: { type: String, required: true, unique: true, index: true },
  subject: { type: String, required: true, maxlength: 180 },
  type: { type: String, enum: ['client_admin', 'writer_admin', 'client_provider'], required: true },
  participants: { type: [ParticipantSchema], validate: value => value.length >= 2 },
  work_id: { type: String, default: '', index: true },
  work_kind: { type: String, enum: ['', 'academic', 'service'], default: '' },
  status: { type: String, enum: ['open', 'resolved', 'closed'], default: 'open' },
  priority: { type: String, enum: ['normal', 'important', 'urgent'], default: 'normal' },
  created_by_id: { type: String, required: true },
  created_by_role: { type: String, required: true },
  last_message_at: Date,
  last_message_preview: { type: String, default: '' }
}, { timestamps: true });

export default mongoose.model('DirectConversation', DirectConversationSchema);
