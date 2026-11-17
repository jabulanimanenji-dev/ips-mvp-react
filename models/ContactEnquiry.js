import mongoose from 'mongoose';

const ContactMessageSchema=new mongoose.Schema({
  direction:{type:String,enum:['inbound','outbound'],required:true},
  channel:{type:String,enum:['website','email','phone','whatsapp','telegram'],required:true},
  body:{type:String,required:true,maxlength:3000},
  author:{type:String,default:''},
  provider_id:{type:String,default:''},
  delivery_status:{type:String,enum:['received','sent','failed','not_sent'],required:true},
  created_at:{type:Date,default:Date.now}
},{_id:true});
const ContactEnquirySchema=new mongoose.Schema({
  enquiry_id:{type:String,unique:true,required:true,index:true},
  client_id:{type:String,default:''},
  name:{type:String,required:true,maxlength:100},
  email:{type:String,default:'',maxlength:254},
  phone:{type:String,default:'',maxlength:24},
  preferred_channel:{type:String,enum:['email','phone','whatsapp','telegram'],required:true},
  subject:{type:String,required:true,maxlength:140},
  status:{type:String,enum:['new','in_progress','waiting_for_customer','closed'],default:'new',index:true},
  contact_consent:{type:Boolean,required:true,default:false},
  consent_at:{type:Date,required:true},
  source:{type:String,default:'academic-website'},
  admin_note:{type:String,default:'',maxlength:1600},
  pending_reply:{type:String,required:false},
  messages:{type:[ContactMessageSchema],default:[]},
  last_activity_at:{type:Date,default:Date.now,index:true}
},{timestamps:true,strict:true});
ContactEnquirySchema.index({createdAt:-1});
export default mongoose.model('ContactEnquiry',ContactEnquirySchema);
