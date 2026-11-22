// IPS owner scenario register: reject accidental omissions and premature green claims.
// A passed aggregate CI run does NOT authorize marking 409 independent scenarios done.
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const text=readFileSync('../GOVERNANCE/IPS_COMPANY_SCENARIO_ACCEPTANCE_V1.csv','utf8');
const counts={V:16,C:20,Q:20,O:17,P:12,S:20,A:20,W:24,QA:16,D:18,M:25,
 U:18,DP:7,H:20,R:26,F:18,X:24,T:24,L:26,SV:16,PAY:22};
const lines=text.trimEnd().split('\n');
assert.equal(lines.length,410,'Header plus exactly 409 owner scenarios required');
assert.ok(lines[0].includes('scenario_id')&&lines[0].includes('status'));
const seen=new Set(),groups=Object.fromEntries(Object.keys(counts).map(x=>[x,0]));
for(const [n,line] of lines.slice(1).entries()){
 const fields=[...line.matchAll(/"((?:[^"]|"")*)"/g)].map(m=>m[1].replaceAll('""','"'));
 assert.equal(fields.length,7,'Malformed CSV at scenario row '+n);
 const [id,area,scenario,klass,status,evidence,owner]=fields;
 const match=id.match(/^([A-Z]+)(\d{2})$/);
 assert.ok(match&&Object.hasOwn(counts,match[1]),'Unrecognized scenario '+id);
 const prefix=match[1],num=Number(match[2]);
 assert.ok(num>=1&&num<=counts[prefix],'Scenario outside governed range '+id);
 assert.ok(!seen.has(id),'Duplicate scenario '+id);seen.add(id);groups[prefix]++;
 assert.ok(area&&scenario.length>9&&klass&&evidence&&owner,'Missing acceptance semantics for '+id);
 assert.equal(status,prefix==='PAY'?'PAYMENT_DEFERRED':'NOT_INDIVIDUALLY_ADMITTED',
  'Individual acceptance must not be invented by a bulk CI run: '+id);
}
for(const [id,expected] of Object.entries(counts))assert.equal(groups[id],expected);
console.log('IPS_409_SCENARIO_AUTHORITY_PASS 409 individually identified scenarios, no false production acceptance');
