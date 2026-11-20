import ContactEnquiry from '../models/ContactEnquiry.js';
import SupportTicket from '../models/SupportTicket.js';
import ServiceRequest from '../models/ServiceRequest.js';
import ChannelContact from '../models/ChannelContact.js';
import ChannelMessage from '../models/ChannelMessage.js';
import CompanyCaseAction from '../models/CompanyCaseAction.js';
import Admin from '../models/Admin.js';
import {hasAdminPermission} from '../shared/adminPermissions.js';
import {isIpsAcademicProject,isIpsQaFixtureEmail,isIpsQaFixtureAdmin} from '../shared/ipsCompanyScope.js';

export const COMPANY_KIND_PERMISSIONS=Object.freeze({
  enquiry:{view:'support.view',manage:'support.manage'},
  support:{view:'support.view',manage:'support.manage'},
  project:{view:'services.view',manage:'services.manage'},
  telegram:{view:'messages.view',manage:'messages.manage'}
});
const validRef=/^[A-Za-z0-9_-]{4,120}$/;
const companyMode=()=>process.env.NODE_ENV==='production'&&
  String(process.env.IPS_EVALUATION_MODE||'').toLowerCase()!=='true';

export function normalizedCompanyCase(kind,doc){
  if(kind==='enquiry')return {
    kind,ref:doc.enquiry_id,subject:doc.subject||'Private enquiry',
    person:doc.username||'Private client',status:doc.status||'new',
    channel:doc.preferred_channel||'workspace',verified:Boolean(doc.contact_verified&&doc.contact_consent),
    owner:doc.assigned_admin_id||'',due_at:doc.next_update_at||null,
    updated_at:doc.last_activity_at||doc.updatedAt||doc.createdAt,
    project_ref:doc.service_request_id||'',new_message:false,
    priority:doc.next_update_at&&new Date(doc.next_update_at).getTime()<Date.now()&&
      ['new','in_progress'].includes(doc.status)?'urgent':'standard'
  };
  if(kind==='support')return {
    kind,ref:doc.ticket_id,subject:doc.subject||'Support request',
    person:doc.client_name||'Private client',status:doc.status||'Open',
    channel:'workspace',verified:true,owner:doc.assigned_admin||'',
    due_at:null,updated_at:doc.last_activity_at||doc.updatedAt||doc.createdAt,
    project_ref:'',new_message:false,
    priority:doc.priority||'standard'
  };
  if(kind==='project')return {
    kind,ref:doc.request_id,subject:doc.title||'Academic project',
    person:doc.client_name||'Private client',status:doc.status||'New Request',
    channel:'workspace',verified:true,owner:doc.provider_name||'',
    due_at:doc.deadline||null,updated_at:doc.updatedAt||doc.createdAt,
    project_ref:doc.request_id,new_message:false,
    priority:doc.urgency==='urgent'?'urgent':'standard',
    assigned_specialist:Boolean(doc.provider_id)
  };
  if(kind==='telegram')return {
    kind,ref:String(doc._id),subject:'Telegram enquiry',
    person:doc.display_name||'Telegram visitor',status:doc.status||'open',
    channel:'telegram',verified:Boolean(doc.verified_at),owner:'',
    due_at:null,updated_at:doc.last_message_at||doc.updatedAt||doc.createdAt,
    project_ref:'',new_message:Number(doc.unread_count||0)>0,unread_count:Number(doc.unread_count||0),
    priority:Number(doc.unread_count||0)>0?'urgent':'standard'
  };
  return null;
}
export function allowedCompanyCase(kind,doc,{production=false}={}){
  if(!doc)return false;
  if(kind==='project')return isIpsAcademicProject(doc);
  if(kind==='telegram')return doc.channel==='telegram';
  if(kind==='enquiry')return ['general','quote'].includes(doc.request_type)&&
    (!production||!isIpsQaFixtureEmail(doc.email))&&
    (!production||['academic-quote','academic-website','academic-web','website'].includes(doc.source));
  if(kind==='support')return !production||!isIpsQaFixtureEmail(doc.client_email);
  return false;
}

async function findCase(kind,ref){
  if(kind==='enquiry')return ContactEnquiry.findOne({enquiry_id:ref}).lean();
  if(kind==='support')return SupportTicket.findOne({ticket_id:ref}).lean();
  if(kind==='project')return ServiceRequest.findOne({request_id:ref}).lean();
  if(kind==='telegram'&&/^[a-f0-9]{24}$/i.test(ref))
    return ChannelContact.findById(ref).lean();
  return null;
}
function getAccess(req,res,requireSession,kind,mode='view'){
  const session=requireSession(req,res);
  if(!session)return null;
  if(session.role!=='admin'||!req.adminAccess){
    res.status(403).json({success:false,error:'Authorized company administrator required.'});
    return null;
  }
  const permission=COMPANY_KIND_PERMISSIONS[kind]?.[mode];
  if(!permission||!hasAdminPermission(req.adminAccess,permission)){
    res.status(403).json({success:false,error:'The assigned role does not allow this case operation.'});
    return null;
  }
  return session;
}
const error=(res,msg='The IPS company case desk is temporarily unavailable.')=>
  res.status(503).json({success:false,error:msg});

export function registerCompanyCaseDesk(app,{requireSession}){
  // Only company owners / authorized team managers can view other admin identities
  // and delegate tasks. Ordinary support staff retain self-assignment.
  app.get('/api/admin/company-cases/staff',async(req,res)=>{
    const session=requireSession(req,res);if(!session)return;
    if(session.role!=='admin'||!req.adminAccess||
      !hasAdminPermission(req.adminAccess,'team.manage'))
      return res.status(403).json({success:false,error:'Team-management permission required.'});
    try{
      const access=req.adminAccess;
      const filter=access.isRoot?{status:'Active',company_role:'manager'}:{
        status:'Active',company_role:'staff',department:access.department,manager_id:access.adminId
      };
      const accounts=await Admin.find(filter)
        .select('id name role status email department company_role manager_id').sort({name:1}).lean();
      const staff=accounts.filter(a=>!companyMode()||!isIpsQaFixtureAdmin(a))
        .map(a=>({id:a.id,name:a.name||a.id,role:a.company_role||a.role}));
      if(!staff.some(a=>a.id===session.id))
        staff.unshift({id:session.id,name:req.adminAccess.name||'IPS owner',role:req.adminAccess.role||'admin'});
      res.set('Cache-Control','private, no-store');
      res.json({success:true,staff});
    }catch{return error(res,'The IPS team directory is temporarily unavailable.');}
  });
  app.get('/api/admin/company-cases',async(req,res)=>{
    const session=requireSession(req,res);if(!session)return;
    if(session.role!=='admin'||!req.adminAccess)return res.sendStatus(403);
    try{
      const permitted=Object.keys(COMPANY_KIND_PERMISSIONS).filter(kind=>
        hasAdminPermission(req.adminAccess,COMPANY_KIND_PERMISSIONS[kind].view));
      const results=await Promise.all(permitted.map(async kind=>{
        if(kind==='enquiry')return {kind,docs:await ContactEnquiry.find({
          request_type:{$in:['general','quote']}
        }).sort({last_activity_at:-1}).limit(140)
          .select('enquiry_id subject username status preferred_channel request_type source email contact_verified contact_consent assigned_admin_id next_update_at last_activity_at service_request_id createdAt updatedAt').lean()};
        if(kind==='support')return {kind,docs:await SupportTicket.find().sort({last_activity_at:-1}).limit(100)
          .select('ticket_id subject client_name client_email status priority assigned_admin last_activity_at createdAt updatedAt').lean()};
        if(kind==='project')return {kind,docs:await ServiceRequest.find({category:'Academic Support',source:'quote_intake'})
          .sort({updatedAt:-1}).limit(120).select('request_id source source_quote_id category title status client_name provider_id provider_name deadline urgency createdAt updatedAt').lean()};
        return {kind,docs:await ChannelContact.find({channel:'telegram'})
          .sort({last_message_at:-1}).limit(100)
          .select('_id channel display_name verified_at status last_message_at unread_count createdAt updatedAt').lean()};
      }));
      const cases=results.flatMap(({kind,docs})=>docs
        .filter(doc=>allowedCompanyCase(kind,doc,{production:companyMode()}))
        .map(doc=>normalizedCompanyCase(kind,doc)));
      cases.sort((a,b)=>Date.parse(b.updated_at||0)-Date.parse(a.updated_at||0));
      const keys=cases.map(x=>({case_kind:x.kind,case_ref:x.ref}));
      const actions=keys.length?await CompanyCaseAction.find({
        entry_kind:'task',task_status:'open',$or:keys
      }).select('case_kind case_ref priority due_at').lean():[];
      const dueNow=Date.now();
      const taskCounts=new Map();
      for(const action of actions){
        const key=action.case_kind+':'+action.case_ref;
        const state=taskCounts.get(key)||{open:0,overdue:0};
        state.open++;
        if(action.due_at&&new Date(action.due_at).getTime()<dueNow)state.overdue++;
        taskCounts.set(key,state);
      }
      for(const item of cases)item.tasks=taskCounts.get(item.kind+':'+item.ref)||{open:0,overdue:0};
      res.set('Cache-Control','private, no-store');
      res.json({success:true,cases,as_of:new Date().toISOString(),scope:permitted});
    }catch(e){return error(res);}
  });

  app.get('/api/admin/company-cases/:kind/:ref',async(req,res)=>{
    const {kind,ref}=req.params;
    if(!getAccess(req,res,requireSession,kind))return;
    if(!validRef.test(ref))return res.status(400).json({success:false,error:'Invalid IPS case reference.'});
    try{
      const record=await findCase(kind,ref);
      if(!allowedCompanyCase(kind,record,{production:companyMode()}))
        return res.status(404).json({success:false,error:'This IPS company case was not found.'});
      const [actions,externalMessages]=await Promise.all([
        CompanyCaseAction.find({case_kind:kind,case_ref:ref}).sort({createdAt:-1}).limit(100).lean(),
        kind==='telegram'?ChannelMessage.find({contact_id:record._id}).sort({createdAt:-1}).limit(80).lean():Promise.resolve([])
      ]);
      const events=kind==='enquiry'?(record.messages||[]).map(m=>({
        id:String(m._id),at:m.created_at||record.createdAt,who:m.direction==='outbound'?'IPS':'Client',
        type:m.direction,body:m.body||'',status:m.delivery_status||'unknown'
      })):kind==='support'?(record.messages||[]).map(m=>({
        id:String(m._id),at:m.created_at||record.createdAt,who:m.sender_role==='admin'?'IPS':'Client',
        type:m.sender_role==='admin'?'outbound':'inbound',body:m.body||'',status:'recorded'
      })):kind==='project'?(record.status_history||[]).map((h,i)=>({
        id:String(i),at:h.changed_at||record.createdAt,who:h.actor_role||'IPS',type:'status',
        body:[h.status,h.reason].filter(Boolean).join(' · '),status:'recorded'
      })):externalMessages.map(m=>({
        id:String(m._id),at:m.createdAt,who:m.direction==='outbound'?'IPS':'Telegram customer',
        type:m.direction,body:m.body||'',status:m.status
      }));
      events.sort((a,b)=>Date.parse(b.at||0)-Date.parse(a.at||0));
      res.set('Cache-Control','private, no-store');
      res.json({success:true,case:normalizedCompanyCase(kind,record),
        details:kind==='enquiry'?{
          service:record.service,discipline:record.discipline,study_level:record.study_level,
          preferred_deadline:record.preferred_deadline,contact_consent:record.contact_consent,
          email:record.email,telegram_username:record.telegram_username,
          contact_verified:record.contact_verified,verification_status:record.verification_status,
          next_update_at:record.next_update_at,assigned_admin_id:record.assigned_admin_id,
          admin_note:record.admin_note,client_id:record.client_id,
          service_request_id:record.service_request_id,contact_thread_id:record.contact_thread_id
        }:kind==='support'?{
          client_id:record.client_id,client_email:record.client_email,
          category:record.category,priority:record.priority,assigned_admin:record.assigned_admin,
          resolution_note:record.resolution_note
        }:kind==='project'?{
          source_quote_id:record.source_quote_id,client_id:record.client_id,
          provider_id:record.provider_id,provider_name:record.provider_name,
          payment_status:record.payment_status,progress:record.progress,
          deadline:record.deadline,description:record.description,
          quote:record.quote?{total:record.quote.total,currency:record.quote.currency,
            notes:record.quote.notes,accepted:record.quote.accepted,expires_at:record.quote.expires_at}:null
        }:{verified_at:record.verified_at,client_id:record.client_id,
          unread_count:record.unread_count},
        actions,events:events.slice(0,100)});
    }catch{return error(res);}
  });
  app.post('/api/admin/company-cases/:kind/:ref/actions',async(req,res)=>{
    const {kind,ref}=req.params;
    const session=getAccess(req,res,requireSession,kind,'manage');if(!session)return;
    if(!validRef.test(ref))return res.status(400).json({success:false,error:'Invalid case reference.'});
    const entry_kind=String(req.body?.entry_kind||'');
    const body=String(req.body?.body||'').trim();
    if(!['note','task'].includes(entry_kind)||body.length<3||body.length>2000)
      return res.status(400).json({success:false,error:'Write a 3–2000 character internal note or task.'});
    let due_at=null;
    if(entry_kind==='task'&&req.body?.due_at){
      const d=new Date(req.body.due_at);
      if(!Number.isFinite(d.getTime())||d.getTime()<=Date.now()||d.getTime()>Date.now()+90*86400000)
        return res.status(400).json({success:false,error:'Follow-up date must be within the next 90 days.'});
      due_at=d;
    }
    const priority=req.body?.priority==='urgent'?'urgent':'standard';
    let assignedTo=session.id;
    const requestedAssignee=entry_kind==='task'?String(req.body?.assigned_to||'').trim():'';
    if(requestedAssignee&&requestedAssignee!==session.id){
      if(!hasAdminPermission(req.adminAccess,'team.manage'))
        return res.status(403).json({success:false,error:'Team-management permission is required to delegate work.'});
      if(!validRef.test(requestedAssignee))
        return res.status(400).json({success:false,error:'Invalid assigned staff reference.'});
      try{
        const access=req.adminAccess;
        const filter=access.isRoot?
          {id:requestedAssignee,status:'Active',company_role:'manager'}:
          {id:requestedAssignee,status:'Active',company_role:'staff',
            department:access.department,manager_id:access.adminId};
        const colleague=await Admin.findOne(filter).select('id email status department manager_id company_role').lean();
        if(!colleague||(companyMode()&&isIpsQaFixtureAdmin(colleague)))
          return res.status(403).json({success:false,error:'Only a managed and active member of your own team may receive delegated tasks.'});
        assignedTo=colleague.id;
      }catch{return error(res,'Could not verify the assigned staff member.');}
    }
    try{
      const target=await findCase(kind,ref);
      if(!allowedCompanyCase(kind,target,{production:companyMode()}))
        return res.status(404).json({success:false,error:'This IPS case does not exist.'});
      const entry=await CompanyCaseAction.create({case_kind:kind,case_ref:ref,entry_kind,
        body,priority,due_at,created_by:session.id,assigned_to:assignedTo});
      res.set('Cache-Control','private, no-store');
      return res.status(201).json({success:true,action:entry});
    }catch{return error(res,'Could not save the internal case action.');}
  });
  app.patch('/api/admin/company-cases/:kind/:ref/tasks/:id',async(req,res)=>{
    const {kind,ref,id}=req.params;
    const session=getAccess(req,res,requireSession,kind,'manage');if(!session)return;
    if(!validRef.test(ref)||!/^[a-f0-9]{24}$/i.test(id)||!['open','done'].includes(req.body?.task_status))
      return res.status(400).json({success:false,error:'Invalid task update.'});
    try{
      const record=await findCase(kind,ref);
      if(!allowedCompanyCase(kind,record,{production:companyMode()}))
        return res.status(404).json({success:false,error:'Case not found.'});
      const done=req.body.task_status==='done';
      const task=await CompanyCaseAction.findOneAndUpdate({
        _id:id,case_kind:kind,case_ref:ref,entry_kind:'task'
      },{$set:{task_status:done?'done':'open',completed_by:done?session.id:'',
        completed_at:done?new Date():null}},{new:true,runValidators:true});
      if(!task)return res.status(404).json({success:false,error:'Case task not found.'});
      res.set('Cache-Control','private, no-store');
      res.json({success:true,action:task});
    }catch{return error(res,'Could not update the case follow-up task.');}
  });
}
