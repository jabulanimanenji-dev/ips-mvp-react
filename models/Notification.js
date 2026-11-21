import mongoose from 'mongoose';

const NotificationSchema = new mongoose.Schema({
  recipient_id: { type: String, required: true, index: true },
  recipient_role: { type: String, enum: ['client', 'writer', 'admin'], required: true },
  // Sparse unique work-event key prevents duplicate alerts across replicas/retries.
  dedupe_key: {type:String,maxlength:255,select:false},
  order_id: String,
  type: { type: String, required: true },
  message: { type: String, required: true },
  read: { type: Boolean, default: false }
}, { timestamps: true });

NotificationSchema.index({dedupe_key:1},{unique:true,sparse:true});
export default mongoose.model('Notification', NotificationSchema);
