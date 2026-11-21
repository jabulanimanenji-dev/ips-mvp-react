// Fictional IPS Academic Services evaluation identities and academic records.
// Sandbox only; never authenticates real students, pays anyone or contacts a real provider.
import crypto from 'node:crypto';
import mongoose from 'mongoose';
const env=process.env;
if(env.NODE_ENV!=='test'||env.IPS_ACADEMIC_MODE!=='evaluation'||env.IPS_ACADEMIC_TEST_SETTLEMENT==='true')
 throw Error('Synthetic academic seed refuses non-isolated or payment-test runtime.');
if(!/^mongodb:\/\/[^@]*@?127\.0\.0\.1:27017\//.test(String(env.MONGODB_URI||''))&&
 !/^mongodb:\/\/localhost:27017\//.test(String(env.MONGODB_URI||'')))
 throw Error('Synthetic IPS academic seed requires localhost-only MongoDB');
const credentials=[
 ['student','student.academic.review@example.org','IPS_REVIEW_STUDENT_PASSWORD','STU-DEMO-2026'],
 ['specialist','specialist.academic.review@example.org','IPS_REVIEW_SPECIALIST_PASSWORD','SPC-DEMO-2026'],
 ['manager','manager.academic.review@example.org','IPS_REVIEW_MANAGER_PASSWORD','EMP-MANAGER-2026'],
 ['staff','staff.academic.review@example.org','IPS_REVIEW_STAFF_PASSWORD','EMP-STAFF-2026']
];
if(credentials.some(x=>!env[x[2]]||env[x[2]].length<12))throw Error('Private review-account credentials required.');
if(!env.ROOT_EMAIL||!env.ROOT_PASSWORD)throw Error('Synthetic Root review credentials missing.');
const saltHash=val=>{const salt=crypto.randomBytes(16).toString('hex');return 'scrypt$'+salt+'$'+crypto.scryptSync(val,salt,64).toString('hex')};
const con=await mongoose.createConnection(env.MONGODB_URI,{dbName:'ips_academic_sandbox'}).asPromise();
const db=con.db,now=new Date();
try{
 const [stu,sp,manager,staff]=credentials.map(([role,email,envName,id])=>({
  id,role,email,username:role==='student'?'QuietScholar':'',
  ...(role==='student'?{usernameKey:'quietscholar'}:{}),
  name:role==='specialist'?'Evaluation Academic Research Editor':role==='manager'?'Evaluation Client Relations Manager':role==='staff'?'Evaluation Student Services Associate':'',
  verified:true,approved:role==='specialist',status:'active',sessionVersion:1,
  expertise:role==='specialist'?['thesis-dissertation','academic-editing','research-methods','references-formatting']:[],
  ...(role==='specialist'?{availabilityStatus:'available',maxConcurrentCases:3,
    activeAssignments:1,turnaroundDays:7,
    qualification:'Synthetic research editing certificate for isolated evaluation only',
    experience:'Fictional academic editing experience',
    credentialEvidenceReference:'Fictional isolated reviewer record 2026',
    credentialReviewStatus:'verified',
    professionalAgreementVersion:'IPS-SPECIALIST-CONFIDENTIALITY-V1-2026',
    professionalAgreementAcceptedAt:now,
    credentialReviewHistory:[{decision:'approved',reviewerId:'synthetic-fixture',reviewedAt:now,
     reviewNote:'Synthetic review fixture only, not an actual verified professional credential.',
     evidenceVerificationReference:'SYNTHETIC-APPROVAL-FIXTURE-2026'}]}:{}),
  department:role==='manager'||role==='staff'?'client_relations':'',
  managerId:role==='staff'?'EMP-MANAGER-2026':'',
  passwordHash:saltHash(env[envName]),createdAt:now,lastLoginAt:now,
  contactPreference:'workspace',synthetic:true
 }));
 const accounts=db.collection('academic_accounts'),quotes=db.collection('academic_quotations'),
 projects=db.collection('academic_commissions'),messages=db.collection('academic_case_messages'),
 files=db.collection('academic_private_files'),support=db.collection('academic_support_cases'),
 notifications=db.collection('academic_notifications');
 for(const a of [stu,sp,manager,staff])await accounts.updateOne({id:a.id},{$setOnInsert:a},{upsert:true});
 const q={id:'IPS-Q-EVAL-THESIS',studentId:stu.id,username:stu.username,contactEmail:stu.email,
  contactChannel:'workspace',serviceId:'thesis-dissertation',serviceName:'Thesis & Dissertation Guidance',
  academicLevel:'Undergraduate',subject:'Pediatric Nursing and Research Methods',
  requirements:'EVALUATION ONLY: a student asks for chapter structure and methodology coaching on an independently authored nursing research thesis.',
  institutionGuidance:'EVALUATION ONLY: guidance must preserve student authorship and require source verification.',
  deadline:'2026-12-20',integrityAcknowledged:true,
  status:'accepted',scopeDecision:'approved',scopeNote:'Permissible coaching and editorial support only.',
  priceMinor:32000,currency:'PLN',deliverables:'Methodology consultation, chapter feedback and research planning notes.',
  terms:'EVALUATION ONLY: fictional quote; no real contract, charge or payment.',
  contactVerified:true,createdAt:now,updatedAt:now,synthetic:true};
 await quotes.updateOne({id:q.id},{$setOnInsert:q},{upsert:true});
 const newQ={id:'IPS-Q-EVAL-EDITING',studentId:stu.id,username:stu.username,contactEmail:stu.email,
  contactChannel:'workspace',serviceId:'academic-editing',serviceName:'Academic Editing & Proofreading',
  academicLevel:'Undergraduate',subject:'Nursing Literature Review',deadline:'2026-12-10',
  requirements:'EVALUATION ONLY: feedback on student-authored research language and referencing; no ghostwriting.',
  institutionGuidance:'Use the student provided institutional style guide.',integrityAcknowledged:true,
  status:'received',scopeDecision:'pending',priceMinor:null,currency:'PLN',createdAt:now,updatedAt:now,synthetic:true};
 await quotes.updateOne({id:newQ.id},{$setOnInsert:newQ},{upsert:true});
 const project={id:'IPS-A-EVAL-THESIS',quoteId:q.id,studentId:stu.id,specialistId:sp.id,
  serviceId:q.serviceId,serviceName:q.serviceName,academicLevel:q.academicLevel,subject:q.subject,
  requirements:q.requirements,deliverables:q.deliverables,deadline:q.deadline,
  priceMinor:q.priceMinor,currency:'PLN',status:'completed',paymentStatus:'synthetic_test_only',
  evaluationPayment:true,revisionCount:1,assignedBy:env.ROOT_EMAIL,qaReviewer:env.ROOT_EMAIL,
  qaDecision:'approve',qaNote:'EVALUATION ONLY: fictional QA approval of fictional support material.',
  pendingFileId:'AF-EVAL-FINAL',releasedFileId:'AF-EVAL-FINAL',
  milestones:[
   {name:'Academic scope and quotation',status:'complete',at:now},
   {name:'Commission/payment verification',status:'synthetic_test_only',at:now},
   {name:'Specialist assignment',status:'complete',at:now},
   {name:'Academic quality assurance',status:'complete',at:now},
   {name:'Secure final delivery',status:'complete',at:now}
  ],createdAt:now,updatedAt:now,synthetic:true};
 await projects.updateOne({id:project.id},{$setOnInsert:project},{upsert:true});
 // Deliberately open fictional academic cases so Nyoro can exercise both role workspaces,
 // not just inspect previously completed records. No real payment is represented.
 const offeredQuote={...q,id:'IPS-Q-EVAL-RESEARCH-OFFER',
  serviceId:'research-methods',serviceName:'Research Methodology Consultation',
  subject:'Undergraduate Nursing Research Design',status:'offered',priceMinor:18500,
  requirements:'EVALUATION ONLY: researcher asks for guidance on study design and sampling in a self-authored nursing project.',
  deliverables:'Research design consultation and methodological feedback on researcher-owned drafts.',
  terms:'EVALUATION ONLY: fictional offer to test written acceptance, not a contractual or financial transaction.'};
 await quotes.updateOne({id:offeredQuote.id},{$setOnInsert:offeredQuote},{upsert:true});
 const activeQuote={...q,id:'IPS-Q-EVAL-EDITING-ASSIGNMENT',
  serviceId:'academic-editing',serviceName:'Academic Editing & Proofreading',status:'accepted',
  subject:'Nursing Literature Review Editorial Feedback',
  requirements:'EVALUATION ONLY: an approved academic editor is assigned to provide clarity and citation-consistency feedback.',
  deliverables:'Tracked feedback on the author-owned nursing literature review and permitted academic formatting guidance.',
  priceMinor:16500};
 await quotes.updateOne({id:activeQuote.id},{$setOnInsert:activeQuote},{upsert:true});
 const activeCase={...project,id:'IPS-A-EVAL-EDITING-ACTIVE',quoteId:activeQuote.id,
  serviceId:activeQuote.serviceId,serviceName:activeQuote.serviceName,
  subject:activeQuote.subject,requirements:activeQuote.requirements,
  deliverables:activeQuote.deliverables,priceMinor:activeQuote.priceMinor,
  status:'specialist_assigned',revisionCount:0,qaReviewer:'',qaDecision:'',qaNote:'',
  pendingFileId:'',releasedFileId:'',
  milestones:[
   {name:'Academic scope and quotation',status:'complete',at:now},
   {name:'Commission/payment verification',status:'synthetic_test_only',at:now},
   {name:'Specialist assignment',status:'complete',at:now},
   {name:'Academic quality assurance',status:'pending',at:now},
   {name:'Secure final delivery',status:'pending',at:now}
  ]};
 await projects.updateOne({id:activeCase.id},{$setOnInsert:activeCase},{upsert:true});
 const bytes=Buffer.from('IPS ACADEMIC SERVICES — FICTIONAL EVALUATION DOCUMENT.\nThis sample demonstrates permissible research methods coaching and editorial feedback. It is not a genuine client deliverable, scholarly source or payment receipt.\n');
 const document={id:'AF-EVAL-FINAL',commissionId:project.id,studentId:stu.id,specialistId:sp.id,
  filename:'academic-methodology-consultation-evaluation.txt',mime:'text/plain',
  sha256:crypto.createHash('sha256').update(bytes).digest('hex'),
  fileData:bytes,createdAt:now,kind:'specialist_submission',revision:1,synthetic:true};
 await files.updateOne({id:document.id},{$setOnInsert:document},{upsert:true});
 for(const m of [
  {id:'AM-EVAL-STUDENT',actorId:stu.id,actorRole:'student',audience:'student',
   body:'EVALUATION ONLY: please confirm which parts of my methodology need clarification.'},
  {id:'AM-EVAL-SPECIALIST',actorId:sp.id,actorRole:'specialist',audience:'specialist',
   body:'EVALUATION ONLY: I sent methodology coaching notes to IPS for independent review.'},
  {id:'AM-EVAL-SHARED',actorId:env.ROOT_EMAIL,actorRole:'root',audience:'shared',
   body:'EVALUATION ONLY: IPS approved the fictional academic consultation document for secure client delivery.'}
 ])await messages.updateOne({id:m.id},{$setOnInsert:{...m,commissionId:project.id,createdAt:now,channel:'ips_workspace',synthetic:true}},{upsert:true});
 // Real persisted, fictional enquiry correspondence and attachments before commissioning.
 // No real academic data is used; these are inspectable in the normal Student and Root workspaces.
 const quoteMessages=db.collection('academic_quote_messages'),
  quoteFiles=db.collection('academic_quote_files'),
  directMessages=db.collection('academic_direct_messages'),
  directFiles=db.collection('academic_direct_files');
 for(const m of [
  {id:'QM-EVAL-STUDENT',quoteId:newQ.id,actorId:stu.id,actorRole:'student',audience:'student',
   body:'EVALUATION ONLY: I have uploaded my institution’s formatting instructions for the literature review.'},
  {id:'QM-EVAL-IPS',quoteId:newQ.id,actorId:env.ROOT_EMAIL,actorRole:'root',audience:'student',
   body:'EVALUATION ONLY: IPS received your guidance. We will confirm a permitted editing scope and send a written quotation.'}
 ])await quoteMessages.updateOne({id:m.id},{$setOnInsert:{...m,createdAt:now,synthetic:true}},{upsert:true});
 const briefBytes=Buffer.from('EVALUATION ONLY: fictional institution style guidance for a student-authored nursing literature review. This is not a real university document.');
 const noteBytes=Buffer.from('EVALUATION ONLY: internal IPS quote-scope review note; should never appear in Student file lists.');
 for(const [id,filename,data,audience,actor] of [
  ['QF-EVAL-STUDENT','nursing-review-formatting-guidance.txt',briefBytes,'student',stu.id],
  ['QF-EVAL-INTERNAL','ips-internal-scope-review.txt',noteBytes,'internal',env.ROOT_EMAIL]
 ]){
  await quoteFiles.updateOne({id},{$setOnInsert:{id,quoteId:newQ.id,studentId:stu.id,filename,mime:'text/plain',
   purpose:'enquiry_reference',audience,sha256:crypto.createHash('sha256').update(data).digest('hex'),
   fileData:data,uploadedBy:actor,uploadedRole:actor===stu.id?'student':'root',
   createdAt:now,synthetic:true}},{upsert:true});
 }
 const directBytes=Buffer.from('EVALUATION ONLY: IPS academic scope coordination and a sample private guidance attachment. No real client content.');
 const directId='DMF-EVAL-ROOT-GUIDANCE';
 await directFiles.updateOne({id:directId},{$setOnInsert:{
  id:directId,toId:stu.id,fromId:env.ROOT_EMAIL,filename:'ips-private-guidance-sample.txt',
  mime:'text/plain',sha256:crypto.createHash('sha256').update(directBytes).digest('hex'),
  fileData:directBytes,createdAt:now,synthetic:true}},{upsert:true});
 for(const d of [
  {id:'DM-EVAL-STUDENT',fromId:env.ROOT_EMAIL,fromRole:'root',toId:stu.id,
   subject:'Message from IPS',body:'EVALUATION ONLY: here is your private academic coordination attachment.',
   attachmentId:directId},
  {id:'DM-EVAL-STUDENT-REPLY',threadId:'DM-EVAL-STUDENT',fromId:stu.id,fromRole:'student',
   toId:env.ROOT_EMAIL,subject:'IPS private message',body:'EVALUATION ONLY: I have received the file and can reply here.'},
  {id:'DM-EVAL-SPECIALIST',fromId:env.ROOT_EMAIL,fromRole:'root',toId:sp.id,
   subject:'Message from IPS',body:'EVALUATION ONLY: please review the assigned academic editing brief and upload permitted feedback.'}
 ])await directMessages.updateOne({id:d.id},{$setOnInsert:{...d,createdAt:now,synthetic:true}},{upsert:true});
 await support.updateOne({id:'IPS-S-EVAL'},{$setOnInsert:{
  id:'IPS-S-EVAL',ownerId:stu.id,ownerRole:'student',subject:'Academic editing and confidentiality inquiry',
  category:'academic_service',priority:'normal',status:'open',assignedTo:staff.id,
  createdAt:now,updatedAt:now,synthetic:true,
  replies:[{actorId:stu.id,role:'student',message:'EVALUATION ONLY: is my nursing literature review confidential in the IPS system?',at:now}]
 }},{upsert:true});
 for(const a of [stu,sp,manager,staff])await notifications.updateOne({id:'IPS-N-EVAL-'+a.role},
  {$setOnInsert:{id:'IPS-N-EVAL-'+a.role,accountId:a.id,kind:'evaluation',
   message:'Evaluation account — all identities, academic assignments, billing values and documents are fictional.',
   read:false,createdAt:now,synthetic:true}},{upsert:true});
 console.log('IPS_ACADEMIC_EVALUATION_SEED_GREEN: four independent fictional academic roles, subject-specific quotations, thesis guidance, private file');
}finally{await con.close()}
