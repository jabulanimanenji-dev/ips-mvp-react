// IPS legacy boundary: classify old company records without treating tests,
// physical-goods contracts, unknown professional services or payment flags as
// accepted IPS Academic Services orders. No identity or secret is copied here.
export const oldServiceDecision=record=>{
 if(record?.market_id==='TEST')return 'quarantine_test';
 const kind=String(record?.service_type||record?.family||'').trim().toLowerCase();
 if(!kind)return 'unverified_service';
 if(['physical goods','professional','generic project','freight','transport'].includes(kind))
  return 'out_of_scope_legacy';
 // Even apparent academic records need owner, consent, legal and scope review.
 return 'requires_documented_reconciliation';
};
export const legacyIdentityDecision=()=>({
 autoImport:false,existingPasswordTrusted:false,verifiedEmailChallengeRequired:true,
 specialistCredentialsRequireFreshReview:true,
 rootOrManagerPermissionsAutomaticallyCarriedOver:false
});
const safeInt=n=>Number.isSafeInteger(n)&&n>=0?n:0;
const allow={
 market_id:new Set(['TEST','PRODUCTION']),
 service_type:new Set(['Physical Goods','Academic Services','academic','professional']),
 family:new Set(['professional','academic','academics']),
 category:new Set(['Finance & Accounting','D.2.1H Testing','Audit Verification','Academic Services']),
 status:new Set(['New','New Request','In Progress','Assigned','SENT','Open','Active','Suspended','closed','sent','received']),
 payment_status:new Set(['PENDING_VERIFICATION','UNPAID','PAID','REFUNDED']),
 application_status:new Set(['approved','more_information','rejected','pending']),
 direction:new Set(['inbound','outbound'])
};
export function summarizeLegacyBoundary(input){
 // Only aggregated category names, statuses and counts are accepted here.
 // This module intentionally does not accept raw customer/account documents.
 const safeGroups=(name,arr)=>arr.map(row=>{
  const values={};
  for(const key of ['market_id','service_type','family','category','status','payment_status',
   'application_status','direction']){
   if(Object.hasOwn(row,key)){
    const v=String(row[key]||'unknown');
    values[key]=allow[key]?.has(v)?v:'[redacted-unverified-label]';
   }
  }
  return {group:values,count:safeInt(row.count),
   ...(name==='orders'?{decision:oldServiceDecision(values)}:
      name==='servicerequests'?{decision:oldServiceDecision(values)}:{})};
 });
 const collections={};
 for(const name of ['clients','writers','admins','orders','servicerequests','invoices',
  'supporttickets','platformfiles','channelmessages']){
  const groups=Array.isArray(input?.[name])?input[name]:[];
  collections[name]=safeGroups(name,groups);
 }
 const joins=input?.joins||{};
 const refs={};
 for(const name of ['orderClient','serviceRequestClient','invoiceOrder','fileOrder','messageContact']){
  const r=joins[name]||{};
  refs[name]={matched:safeInt(r.matched),unmatched:safeInt(r.unmatched)};
 }
 return {
  company:'IPS Academic Services',
  source:'legacy_ips_aggregate_readonly',
  noPersonalDataIncluded:true,productionMigrationApproved:false,
  identities:legacyIdentityDecision(),
  collections,references:refs,
  conclusion:'Legacy history is retained but NOT automatically imported as genuine academic orders, payments, verified identities or Specialist authority.'
 };
}
