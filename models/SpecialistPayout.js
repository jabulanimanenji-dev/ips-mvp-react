import mongoose from 'mongoose';

const SpecialistPayoutSchema=new mongoose.Schema({
  request_id:{type:String,required:true,unique:true,index:true},
  writer_id:{type:String,required:true,index:true},
  amount_minor:{type:Number,required:true,min:1,max:10000000},
  currency:{type:String,required:true,enum:['PLN','EUR','USD']},
  status:{type:String,required:true,enum:['approved','paid'],default:'approved',index:true},
  agreed_scope:{type:String,required:true,maxlength:1000},
  approved_by:{type:String,required:true},
  approved_at:{type:Date,required:true,default:Date.now},
  paid_at:{type:Date},
  recorded_by:{type:String,default:''},
  payment_reference:{type:String,default:'',maxlength:160}
},{timestamps:true});
export default mongoose.model('SpecialistPayout',SpecialistPayoutSchema);
