import mongoose from 'mongoose';

// Durable internal work notes and follow-up tasks. Never transmitted through
// customer contact channels or surfaced in client/specialist APIs.
const CompanyCaseActionSchema=new mongoose.Schema({
  case_kind:{type:String,required:true,enum:['enquiry','support','project','telegram'],index:true},
  case_ref:{type:String,required:true,maxlength:120,index:true},
  entry_kind:{type:String,required:true,enum:['note','task']},
  body:{type:String,required:true,maxlength:2000},
  priority:{type:String,enum:['standard','urgent'],default:'standard'},
  due_at:{type:Date,default:null},
  task_status:{type:String,enum:['open','done'],default:'open'},
  created_by:{type:String,required:true,maxlength:160},
  assigned_to:{type:String,required:true,maxlength:160},
  completed_by:{type:String,default:'',maxlength:160},
  completed_at:{type:Date,default:null}
},{timestamps:true,strict:true});
CompanyCaseActionSchema.index({case_kind:1,case_ref:1,createdAt:-1});
CompanyCaseActionSchema.index({entry_kind:1,task_status:1,due_at:1});
export default mongoose.model('CompanyCaseAction',CompanyCaseActionSchema);
