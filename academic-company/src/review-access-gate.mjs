// This is a deliberately PUBLIC, fictional-data-only workspace inspection gate.
// A preview visitor must never gain access to production, staging, legacy
// customer information, paid settlements or external provider credentials.
export const EVAL_REVIEW_URL='https://ips-nyoro-frozen-review-20261123.onrender.com';
export const EVAL_REVIEW_HOST='ips-academic-review-fre.1w7baaf.mongodb.net';
export const EVAL_REVIEW_DB='ips_academic_sandbox';
export const DEMO_ROLES=Object.freeze([
 {role:'student',label:'Student / Researcher',id:'STU-DEMO-2026'},
 {role:'specialist',label:'Specialist',id:'SPC-DEMO-2026'},
 {role:'manager',label:'Client Relations Manager',id:'EMP-MANAGER-2026'},
 {role:'staff',label:'Client Relations Staff',id:'EMP-STAFF-2026'},
 {role:'root',label:'Nyoro · Root Admin',id:null}
]);
export function isPublicFictionalReview(env,config){
 if(config?.sandbox!==true||config?.prod!==false||config?.staging===true||
    env.NODE_ENV!=='test'||env.IPS_ACADEMIC_MODE!=='evaluation'||
    env.IPS_REVIEW_PERSISTENT_ATLAS!=='true'||
    env.IPS_REVIEW_PUBLIC_ENTRY!=='true'||
    env.IPS_ACADEMIC_TEST_SETTLEMENT==='true'||
    String(env.PUBLIC_APP_URL||'').replace(/\/$/,'')!==EVAL_REVIEW_URL||
    env.RESEND_API_KEY||env.TELEGRAM_BOT_TOKEN||env.STRIPE_SECRET_KEY||
    env.IPS_CLAMAV_HOST||env.R2_ENDPOINT)
   return false;
 let uri;
 try{uri=new URL(String(env.MONGODB_URI||''))}catch{return false}
 return uri.protocol==='mongodb+srv:'&&uri.hostname===EVAL_REVIEW_HOST&&
  uri.pathname==='/'+EVAL_REVIEW_DB&&!!uri.username&&
  !!uri.password&&decodeURIComponent(uri.password).length>=20&&
  !uri.hash&&uri.searchParams.get('tls')!=='false'&&
  uri.searchParams.get('ssl')!=='false';
}
