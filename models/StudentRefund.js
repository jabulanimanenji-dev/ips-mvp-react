import mongoose from 'mongoose';

const StudentRefundSchema=new mongoose.Schema({
  refund_id:{type:String,required:true,unique:true},
  request_id:{type:String,required:true,index:true},
  payment_id:{type:String,required:true,index:true},
  client_id:{type:String,required:true,index:true},
  amount_minor:{type:Number,required:true,min:1},
  currency:{type:String,required:true},
  status:{type:String,required:true,enum:['requested','processing','succeeded','failed','requires_action'],default:'requested',index:true},
  provider_refund_id:{type:String,default:undefined,unique:true,sparse:true},
  reason:{type:String,required:true,maxlength:1600},
  requested_by:{type:String,required:true},
  requested_at:{type:Date,required:true,default:Date.now},
  provider_status:{type:String,default:''},
  last_event_id:{type:String,default:''},
  completed_at:{type:Date},
  failure:{type:String,default:'',maxlength:300}
},{timestamps:true});
export default mongoose.model('StudentRefund',StudentRefundSchema);
