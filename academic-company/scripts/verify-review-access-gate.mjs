import assert from 'node:assert/strict';
import {isPublicFictionalReview,DEMO_ROLES,EVAL_REVIEW_HOST,
 EVAL_REVIEW_URL,EVAL_REVIEW_DB} from '../src/review-access-gate.mjs';
const sandbox={sandbox:true,prod:false,staging:false};
const make=()=>({
 NODE_ENV:'test',IPS_ACADEMIC_MODE:'evaluation',
 IPS_REVIEW_PERSISTENT_ATLAS:'true',IPS_REVIEW_PUBLIC_ENTRY:'true',
 IPS_ACADEMIC_TEST_SETTLEMENT:'false',PUBLIC_APP_URL:EVAL_REVIEW_URL,
 MONGODB_URI:'mongodb+srv://fictional-user:fictional-pass-very-long-12345@'+
  EVAL_REVIEW_HOST+'/'+EVAL_REVIEW_DB+'?tls=true'
});
let checked=0;
const expect=(env,config,yes)=>{assert.equal(isPublicFictionalReview(env,config),yes);checked++};
expect(make(),sandbox,true);
const mutations=[
 e=>{e.NODE_ENV='production'},
 e=>{e.IPS_ACADEMIC_MODE='staging'},
 e=>{e.IPS_REVIEW_PERSISTENT_ATLAS='false'},
 e=>{delete e.IPS_REVIEW_PUBLIC_ENTRY},
 e=>{e.IPS_ACADEMIC_TEST_SETTLEMENT='true'},
 e=>{e.PUBLIC_APP_URL='https://ipsglobalservice.com'},
 e=>{e.PUBLIC_APP_URL='http://127.0.0.1:18122'},
 e=>{e.MONGODB_URI='mongodb://127.0.0.1:27017/ips_academic_sandbox'},
 e=>{e.MONGODB_URI=e.MONGODB_URI.replace(EVAL_REVIEW_HOST,'ips-academic-prod.other.net')},
 e=>{e.MONGODB_URI=e.MONGODB_URI.replace(EVAL_REVIEW_DB,'ips_academic_services_2026')},
 e=>{e.MONGODB_URI=e.MONGODB_URI.replace('tls=true','tls=false')},
 e=>{e.MONGODB_URI=e.MONGODB_URI.replace('fictional-pass-very-long-12345','short')},
 e=>{e.RESEND_API_KEY='re_test_real_but_not_wanted'},
 e=>{e.TELEGRAM_BOT_TOKEN='live_bot_token_not_wanted'},
 e=>{e.STRIPE_SECRET_KEY='sk_test_no_charging'},
 e=>{e.IPS_CLAMAV_HOST='10.0.0.1'},
 e=>{e.R2_ENDPOINT='https://private-archive.example.org'}
];
for(const mutate of mutations){const e=make();mutate(e);expect(e,sandbox,false)}
expect(make(),{sandbox:false,staging:false,prod:true},false);
expect(make(),{sandbox:false,staging:true,prod:true},false);
expect(make(),{sandbox:true,staging:true,prod:true},false);
assert.equal(DEMO_ROLES.length,5);
assert.equal(new Set(DEMO_ROLES.map(x=>x.role)).size,5);
console.log('IPS_REAL_REVIEW_ACCESS_BOUNDARY_PASS '+checked+
 ' positive/negative environment boundaries; exactly five fictional workspaces');
