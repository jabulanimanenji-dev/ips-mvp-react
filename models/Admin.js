import mongoose from 'mongoose';

const AdminSchema = new mongoose.Schema({
  id: { type: String, required: true, unique: true },
  name: { type: String, required: true },
  email: { type: String, required: true, unique: true },
  password: { type: String, required: true },
  role: { type: String, default: 'admin', index: true },
  custom_role_id: { type: String, default: '' },
  permissions: { type: [String], default: [] },
  company_role: {type:String,enum:['manager','staff'],default:undefined,index:true},
  department: {type:String,default:'',index:true},
  manager_id: {type:String,default:'',index:true},
  email_verified_at: {type:Date,default:null},
  invite_token_hash: {type:String,select:false},
  invite_expires_at: {type:Date,select:false},
  invite_sent_at: {type:Date,select:false},
  password_reset_hash: {type:String,select:false},
  password_reset_expires_at: {type:Date,select:false},
  password_reset_sent_at: {type:Date,select:false},
  status: { type: String, enum: ['Invited', 'Active', 'Suspended', 'Locked', 'Archived'], default: 'Active', index: true },
  must_change_password: { type: Boolean, default: true },
  session_version: { type: Number, default: 1 },
  created_by: { type: String, default: '' },
  last_login_at: Date,
  last_password_reset_at: Date,
  suspended_reason: { type: String, default: '' }
}, { timestamps: true });

AdminSchema.index({company_role:1,department:1,manager_id:1});
export default mongoose.model('Admin', AdminSchema);
