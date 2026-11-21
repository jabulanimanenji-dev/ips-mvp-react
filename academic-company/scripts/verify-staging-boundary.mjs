// Verifies runtime separation without contacting or mutating live provider accounts.
import assert from 'node:assert/strict';
import {ensureRuntime} from '../src/security.mjs';
const base={
 MONGODB_URI:'mongodb://127.0.0.1:27017/fictional-staging',
 SESSION_SECRET:'IPS_Staging_Fictional_Secret_For_Isolated_Verification_2026',
 ROOT_EMAIL:'root.staging@example.org',
 ROOT_PASSWORD:'AcademicStagingRoot2026!',
 PUBLIC_APP_URL:'https://ips-test.example.org',
 NODE_ENV:'production',RESEND_API_KEY:'synthetic-do-not-send',
 FROM_EMAIL:'ips-staging@example.org'
};
const stage={...base,IPS_ACADEMIC_MODE:'staging',
 IPS_STAGING_ALLOWED_EMAILS:'test.student@example.org,test.specialist@example.org',
 IPS_STAGING_DISTINCT_TELEGRAM_BOT_CONFIRMED:'true',
 TELEGRAM_BOT_TOKEN:'fake-staging-no-live-bot',
 IPS_TELEGRAM_BOT_USERNAME:'IPSTestBot2026'};
const c=ensureRuntime(stage);
assert.equal(c.staging,true);assert.equal(c.prod,true);
assert.equal(c.production,false);assert.equal(c.sandbox,false);
assert.equal(c.dbName,'ips_academic_staging');
assert.deepEqual(c.allowedStagingEmails,['test.student@example.org','test.specialist@example.org']);
assert.equal(ensureRuntime({...stage,IPS_ACADEMIC_MODE:'production'}).dbName,'ips_academic_services_2026');
assert.equal(ensureRuntime({...stage,IPS_ACADEMIC_MODE:'production'}).production,true);
assert.equal(ensureRuntime({...base,IPS_ACADEMIC_MODE:'evaluation',NODE_ENV:'test',PUBLIC_APP_URL:'http://127.0.0.1:18122'}).dbName,'ips_academic_sandbox');
const rejects=[
 {...stage,IPS_STAGING_ALLOWED_EMAILS:''},
 {...stage,IPS_STAGING_ALLOWED_EMAILS:'bad'},
 {...stage,IPS_STAGING_ALLOWED_EMAILS:'same@example.org,same@example.org'},
 {...stage,IPS_STAGING_DISTINCT_TELEGRAM_BOT_CONFIRMED:'false'},
 {...stage,IPS_TELEGRAM_BOT_USERNAME:'@IPScontactBot'},
 {...stage,PUBLIC_APP_URL:'http://unprotected.example.org'},
 {...stage,NODE_ENV:'test'},
 {...stage,IPS_ACADEMIC_MODE:'unknown'}
];
for(const item of rejects)assert.throws(()=>ensureRuntime(item),/IPS academic|Academic production|staging/i);
console.log('IPS_ACADEMIC_ISOLATED_REAL_PROVIDER_STAGING_GREEN 11 positive and negative runtime assertions');
