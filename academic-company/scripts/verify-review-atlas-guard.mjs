import assert from 'node:assert/strict';
import {assertSyntheticReviewAtlas,REVIEW_ATLAS_HOST,REVIEW_DATABASE} from './review-atlas-guard.mjs';
const base='mongodb+srv://synthetic_review_rw:VeryLongSyntheticPrivatePassword_2026@'+
 REVIEW_ATLAS_HOST+'/'+REVIEW_DATABASE+'?retryWrites=true&w=majority&tls=true';
const result=assertSyntheticReviewAtlas(base);
assert.equal(result.syntheticOnly,true);
let checks=1;
for(const uri of [
 undefined,'','mongodb://127.0.0.1:27017/ips_academic_sandbox',
 'mongodb+srv://user:StrongPass1234567890123456@ips-academic-prod.bvaigrl.mongodb.net/ips_academic_sandbox',
 'mongodb+srv://user:StrongPass1234567890123456@'+REVIEW_ATLAS_HOST+'/ips_academic_services_2026',
 'mongodb+srv://user:StrongPass1234567890123456@'+REVIEW_ATLAS_HOST+'/ips',
 'mongodb+srv://user:short@'+REVIEW_ATLAS_HOST+'/'+REVIEW_DATABASE,
 base.replace('tls=true','tls=false'),
 base.replace(REVIEW_ATLAS_HOST,REVIEW_ATLAS_HOST+'.evil.example.org'),
 base.replace('mongodb+srv','mongodb'),
 base+'#account',
 'mongodb+srv://nobody@'+REVIEW_ATLAS_HOST+'/'+REVIEW_DATABASE
]){
 assert.throws(()=>assertSyntheticReviewAtlas(uri));
 checks++;
}
console.log('IPS_SYNTHETIC_REVIEW_ATLAS_BOUNDARY_PASS '+checks+' real guard checks');
