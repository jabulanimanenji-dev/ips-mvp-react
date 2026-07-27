import mongoose from 'mongoose';

const NotificationSchema = new mongoose.Schema({
  recipient_id: { type: String, required: true, index: true },
  recipient_role: { type: String, enum: ['client', 'writer', 'admin'], required: true },
  order_id: String,
  type: { type: String, required: true },
  message: { type: String, required: true },
  read: { type: Boolean, default: false }
}, { timestamps: true });

export default mongoose.model('Notification', NotificationSchema);
