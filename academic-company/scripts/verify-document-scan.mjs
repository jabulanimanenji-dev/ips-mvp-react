import assert from 'node:assert/strict';
import {inspectAcademicFile} from '../src/document-scan.mjs';
import {startFakeClamd} from './scan-test-server.mjs';

const sample=Buffer.from('IPS academic editorial feedback file, private and permitted.');
let testCount=0;
const check=async(name,fn)=>{await fn();testCount++;console.log('PASS IPS FILE SCAN '+name)};
const fake=await startFakeClamd();
const env={IPS_CLAMAV_HOST:'127.0.0.1',IPS_CLAMAV_PORT:String(fake.port)};
try{
 await check('Synthetic review cannot masquerade as a real malware scan',async()=>{
  const r=await inspectAcademicFile(sample,{env:{},sandbox:true});
  assert.equal(r.allowed,true);assert.equal(r.status,'synthetic_not_scanned');
 });
 await check('Production refuses missing malware-scanning service',async()=>{
  const r=await inspectAcademicFile(sample,{env:{},sandbox:false});
  assert.equal(r.allowed,false);assert.equal(r.http,503);
 });
 await check('Full ClamAV-style INSTREAM protocol permits benign documents',async()=>{
  const r=await inspectAcademicFile(sample,{env,sandbox:false});
  assert.equal(r.allowed,true);assert.equal(r.status,'clean');assert.equal(r.scanner,'clamav');
 });
 await check('Positive synthetic signature is rejected before file persistence',async()=>{
  const r=await inspectAcademicFile(Buffer.from('Safe header IPS_SYNTHETIC_EICAR_TEST test payload'),
   {env,sandbox:false});
  assert.equal(r.allowed,false);assert.equal(r.status,'malware_blocked');assert.equal(r.http,422);
 });
 await check('Malformed or failed scanner response blocks uploads',async()=>{
  const r=await inspectAcademicFile(Buffer.from('Safe header IPS_SYNTHETIC_SCAN_ERROR test payload'),
   {env,sandbox:false});
  assert.equal(r.allowed,false);assert.equal(r.http,503);
 });
 await check('Oversized upload is rejected prior to external scanning',async()=>{
  const r=await inspectAcademicFile(Buffer.alloc(20*1024*1024+1,65),{env,sandbox:false});
  assert.equal(r.allowed,false);assert.equal(r.http,400);
 });
 await check('Scanner outage fails closed rather than storing unverified academic content',async()=>{
  const r=await inspectAcademicFile(sample,{env:{...env,IPS_CLAMAV_PORT:'1'},sandbox:false});
  assert.equal(r.allowed,false);assert.equal(r.http,503);
 });
 console.log('IPS_ACADEMIC_CLAMAV_PROTOCOL_GATE_GREEN '+testCount+
  ' isolated safety checks against synthetic protocol double; not a genuine AV engine');
}catch(e){console.error('IPS_ACADEMIC_SCANNER_CHECK_FAILED',e);process.exitCode=1}
finally{await fake.close()}
