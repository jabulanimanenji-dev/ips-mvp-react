// Autonomous Windows-specific acceptance: no customer CMD, ZIP, FFmpeg,
// paid Render resources, production database or user babysitting.
// Runs the REAL IPS app, full MongoDB lifecycle and real Edge browser on a
// temporary GitHub-hosted Windows machine. A single failure keeps CI RED.
import assert from 'node:assert/strict';
import {spawn} from 'node:child_process';
import {setTimeout as delay} from 'node:timers/promises';
import net from 'node:net';
import {MongoMemoryServer} from 'mongodb-memory-server-core';

if(process.platform!=='win32')throw Error('Windows-only IPS qualification must run on windows-latest.');
const version='7.0.14';
const root=process.cwd();
const stages=[
  {name:'Real MongoDB academic business, security and recovery lifecycle',
   script:'scripts/verify-lifecycle.mjs',timeout:12*60*1000},
  {name:'Real Microsoft Edge visual Student, Specialist, staff, Manager and Nyoro journeys',
   script:'scripts/verify-browser.mjs',timeout:12*60*1000}
];
let mongod;
function portListening(port){
 return new Promise(resolve=>{
  const socket=net.connect({host:'127.0.0.1',port});
  socket.once('connect',()=>{socket.destroy();resolve(true)});
  socket.once('error',()=>resolve(false));
  socket.setTimeout(700,()=>{socket.destroy();resolve(false)});
 });
}
async function portReleased(port){
 for(let i=0;i<35;i++){
  if(!(await portListening(port)))return;
  await delay(350);
 }
 throw Error('Previous test application has not released loopback port '+port+
  '; refusing to run a second competing IPS server');
}
async function runStage({name,script,timeout}){
 await portReleased(18122);
 console.log('IPS_WINDOWS_EDGE_START: '+name);
 const env={...process.env,
  NODE_ENV:'test',
  IPS_BROWSER_CHANNEL:script.includes('browser')?'msedge':'chrome',
  PLAYWRIGHT_BROWSERS_PATH:process.env.PLAYWRIGHT_BROWSERS_PATH||undefined,
  IPS_ACADEMIC_MODE:'evaluation',
  MONGODB_URI:'mongodb://127.0.0.1:27017/ips_academic_sandbox'};
 const child=spawn(process.execPath,[script],{
  cwd:root,env,windowsHide:true,stdio:'inherit'});
 const result=await new Promise((resolve,reject)=>{
  let finished=false;
  const timer=setTimeout(()=>{
   if(finished)return;
   child.kill();
   reject(new Error('IPS Windows qualification timed out after '+timeout+'ms: '+name));
  },timeout);
  child.once('error',error=>{if(finished)return;finished=true;clearTimeout(timer);reject(error)});
  child.once('exit',(code,signal)=>{
   if(finished)return;finished=true;clearTimeout(timer);
   resolve({code,signal});
  });
 });
 assert.equal(result.code,0,'IPS Windows stage failed: '+name+
  ' (exit '+result.code+', signal '+String(result.signal)+')');
 await portReleased(18122);
 console.log('IPS_WINDOWS_EDGE_PASS: '+name);
}
try{
 if(await portListening(27017))
  throw Error('Refusing to use an existing MongoDB on port 27017; this job requires its own disposable database');
 console.log('IPS_WINDOWS_EDGE_BOOT MongoDB '+version+', loopback only; no external databases or tokens');
 mongod=await MongoMemoryServer.create({
  instance:{port:27017,ip:'127.0.0.1',storageEngine:'wiredTiger',
   dbName:'ips_academic_sandbox'},
  binary:{version,downloadDir:process.env.MONGOMS_DOWNLOAD_DIR||undefined},
  spawn:{detached:false}
 });
 const uri=mongod.getUri('ips_academic_sandbox');
 assert.equal(new URL(uri).hostname,'127.0.0.1','MongoDB test must be localhost only');
 assert.equal(new URL(uri).port,'27017');
 for(const stage of stages)await runStage(stage);
 console.log('IPS_WINDOWS_EDGE_FULL_COMPANY_QA_GREEN: genuine MongoDB 7 and real Microsoft Edge browser, no FFmpeg/recording prerequisite');
}catch(error){
 console.error('IPS_WINDOWS_EDGE_FULL_COMPANY_QA_FAIL',error?.stack||String(error));
 process.exitCode=1;
}finally{
 await mongod?.stop().catch(e=>{
  console.error('IPS_WINDOWS_EDGE_MONGODB_CLEANUP_FAIL',e?.message||String(e));
  process.exitCode=1;
 });
}
