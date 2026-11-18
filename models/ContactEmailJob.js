import mongoose from 'mongoose';

// Durable transactional-email outbox. Notifications do not carry attachments
// or the original enquiry text.
const ContactEmailJobSchema=new mongoose.Schema({
  enquiry_id:{type:String,required:true,index:true},
  kind:{type:String,enum:['staff_notice','client_receipt'],required:true},
  recipient:{type:String,required:true,maxlength:254},
  subject:{type:String,required:true,maxlength:200},
  body:{type:String,required:true,maxlength:1500},
  status:{type:String,enum:['pending','sending','retry','accepted','delivered','bounced','complained','failed'],default:'pending',index:true},
  attempts:{type:Number,default:0,min:0},
  next_attempt_at:{type:Date,default:Date.now},
  lease_until:{type:Date},
  provider_id:{type:String,default:'',index:true},
  provider_accepted_at:{type:Date},
  delivery_updated_at:{type:Date},
  last_error:{type:String,default:'',maxlength:180}
},{timestamps:true,strict:true});
ContactEmailJobSchema.index({enquiry_id:1,kind:1},{unique:true});
ContactEmailJobSchema.index({status:1,next_attempt_at:1,lease_until:1});
export default mongoose.model('ContactEmailJob',ContactEmailJobSchema);
