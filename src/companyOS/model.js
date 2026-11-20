import {COMPANY_DEPARTMENTS} from '../../shared/companyGovernance.js';
import {isOpenCompanyCase,isOverdueCompanyCase,needsCompanyCaseOwner,requiresManagementAttention} from '../../shared/companyPulse.js';
import {isIpsQaFixtureClient,isIpsQaFixtureEmail} from '../../shared/ipsCompanyScope.js';

export const COMPANY_NAV=Object.freeze([
  {group:'RUN THE COMPANY',name:'Executive cockpit',path:'/admin/dashboard',permission:'dashboard.view',icon:'overview',sub:'Decisions and accountable work'},
  {group:'RUN THE COMPANY',name:'Work command',path:'/admin/case-desk',permission:'dashboard.view',icon:'activity',sub:'One queue, every department'},
  {group:'RUN THE COMPANY',name:'Service journeys',path:'/admin/journeys',permission:'dashboard.view',icon:'projects',sub:'Client to approved handover'},
  {group:'ORGANIZATION',name:'Departments',path:'/admin/departments',permission:'dashboard.view',icon:'specialists',sub:'Leadership and coverage'},
  {group:'ORGANIZATION',name:'People & authority',path:'/admin/access',permission:'team.manage',icon:'shield',sub:'Delegation and offboarding'},
  {group:'ORGANIZATION',name:'Client accounts',path:'/admin/clients',permission:'clients.view',icon:'clients',sub:'Verification and recovery'},
  {group:'ORGANIZATION',name:'Specialist network',path:'/admin/writers',permission:'providers.view',icon:'specialists',sub:'Eligibility and readiness'},
  {group:'DELIVERY',name:'Quotation intake',path:'/admin/enquiries',permission:'support.view',icon:'quotes',sub:'Consent and client approval'},
  {group:'DELIVERY',name:'Project delivery',path:'/admin/services',permission:'services.view',icon:'projects',sub:'Payment and assignment gates'},
  {group:'DELIVERY',name:'Quality control',path:'/admin/quality',permission:'services.view',icon:'check',sub:'Reviews and release'},
  {group:'CLIENT CARE',name:'Support operations',path:'/admin/support',permission:'support.view',icon:'support',sub:'Client problems and resolution'},
  {group:'CLIENT CARE',name:'Written channels',path:'/admin/external-chats',permission:'messages.view',icon:'messages',sub:'Telegram and secure messaging'},
  {group:'INTELLIGENCE',name:'Company intelligence',path:'/admin/reports',permission:'reports.view',icon:'reports',sub:'Real work, capacity and quality'},
  {group:'INTELLIGENCE',name:'Billing readiness',path:'/admin/payments',permission:'payments.view',icon:'payments',sub:'Payments not yet activated'},
  {group:'INTELLIGENCE',name:'Security & policy',path:'/admin/settings',permission:'settings.view',icon:'lock',sub:'Controls and audit posture'}
]);
export const CASE_TYPES={
  enquiry:{label:'Quotation',permission:'support.view',manage:'support.manage',icon:'quotes'},
  support:{label:'Support',permission:'support.view',manage:'support.manage',icon:'support'},
  project:{label:'Academic project',permission:'services.view',manage:'services.manage',icon:'projects'},
  telegram:{label:'Telegram',permission:'messages.view',manage:'messages.manage',icon:'messages'}
};
export const DEPARTMENT_DESCRIPTIONS={
  client_relations:'Privacy-first intake, identity recovery, quotations, client support and written responses.',
  academic_delivery:'Delivery capacity, project coordination, specialist allocation and accountable milestones.',
  specialist_network:'Applications, qualification checks, verified specialists, capacity and performance.',
  communications:'Authenticated messages, customer-initiated Telegram, consent and response quality.',
  quality_assurance:'Independent review, required corrections, document inspection and release evidence.',
  finance:'Verified financial records, quotations and reconciliation. Payment collection remains disabled.',
  governance:'Company policy, protected ownership, authority, audit evidence and security exceptions.'
};
export const departmentNames=Object.fromEntries(Object.entries(COMPANY_DEPARTMENTS).map(([k,v])=>[k,v.label]));
export const OPEN_STATES=new Set(['new','in_progress','waiting_for_customer','Open','In Progress','Waiting for Client','New Request','Awaiting Quote','Quote Sent','Quote Accepted','Awaiting Payment','Awaiting Assignment','Assigned','In Progress','Submitted for Review','Correction Required','Disputed','paused','pending']);
export const caseOpen=isOpenCompanyCase;
export const caseNeedsOwner=needsCompanyCaseOwner;
export const caseLate=isOverdueCompanyCase;
export const caseNeedsDecision=requiresManagementAttention;
export const caseKey=c=>c.kind+':'+c.ref;
export const caseUrl=c=>'/admin/case-desk?case='+encodeURIComponent(caseKey(c));
export const shortDate=v=>{if(!v)return 'Not set';const d=new Date(v);return Number.isNaN(d.getTime())?'Not set':d.toLocaleString(undefined,{day:'numeric',month:'short',hour:'2-digit',minute:'2-digit'});};
export const readyClient=c=>c?.status==='Active'&&Boolean(c?.email_verified_at)&&!isIpsQaFixtureClient(c);
export const readySpecialist=w=>w?.status==='Active'&&w?.application_status==='approved'&&Boolean(w?.email_verified_at)&&!isIpsQaFixtureEmail(w?.email);
export const eligibleStaff=m=>m?.company_role==='manager'||m?.company_role==='staff';
export function summarizeWork(cases){
  if(!Array.isArray(cases))return null;
  const open=cases.filter(caseOpen);
  return {open:open.length,decision:open.filter(caseNeedsDecision).length,
    overdue:open.filter(caseLate).length,unowned:open.filter(caseNeedsOwner).length,
    quotes:open.filter(c=>c.kind==='enquiry').length,
    support:open.filter(c=>c.kind==='support').length,
    projects:open.filter(c=>c.kind==='project').length,
    telegram:open.filter(c=>c.kind==='telegram').length};
}
export function departmentCoverage(team){
  if(!Array.isArray(team))return null;
  return Object.keys(COMPANY_DEPARTMENTS).map(id=>({id,label:departmentNames[id],
    managers:team.filter(m=>m.company_role==='manager'&&m.department===id&&m.status==='Active'),
    team:team.filter(m=>m.department===id&&m.company_role==='staff'&&m.status==='Active'),
    pending:team.filter(m=>m.department===id&&m.company_role==='manager'&&m.status==='Invited')}));
}
export function clientState(c){
  if(isIpsQaFixtureClient(c))return 'Evaluation identity';
  if(c.status!=='Active')return c.status||'Restricted';
  return c.email_verified_at?'Verified and active':'Verification required';
}
export function specialistState(w){
  if(isIpsQaFixtureEmail(w?.email))return 'Evaluation identity';
  if(w.status!=='Active')return w.status||'Not active';
  if(w.application_status!=='approved')return 'Awaiting approval';
  if(!w.email_verified_at)return 'Approved · verification pending';
  return 'Eligible';
}
