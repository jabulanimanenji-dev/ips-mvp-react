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
  // Username is a pseudonym. No legal name is collected for a quotation.
  name:{type:String,default:'',maxlength:100},
  username:{type:String,default:'',maxlength:32,index:true},
  request_type:{type:String,enum:['general','quote'],default:'general'},
  service:{type:String,default:'',maxlength:100},
  discipline:{type:String,default:'',maxlength:160},
  study_level:{type:String,default:'',maxlength:70},
  preferred_deadline:{type:String,default:'',maxlength:10},
  telegram_username:{type:String,default:'',maxlength:32},
  contact_thread_id:{type:String,default:'',index:true},
  contact_verified:{type:Boolean,default:false},
  contact_verified_at:{type:Date},
  verification_status:{type:String,enum:['awaiting_verification','verified'],default:'awaiting_verification'},
  email_verified_at:{type:Date,default:null},
  verification_hash:{type:String,select:false},
  verification_expires_at:{type:Date,select:false},
  verification_sent_at:{type:Date,select:false},
  verification_attempts:{type:Number,default:0,select:false},
  purge_at:{type:Date},
  email:{type:String,default:'',maxlength:254},
  phone:{type:String,default:'',maxlength:24},
  preferred_channel:{type:String,enum:['email','phone','whatsapp','telegram','workspace'],required:true},
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
// Only new, explicitly expiring guest quote records receive purge_at.
// Existing customer records are not deleted by this index.
ContactEnquirySchema.index({purge_at:1},{expireAfterSeconds:0});
export default mongoose.model('ContactEnquiry',ContactEnquirySchema);
