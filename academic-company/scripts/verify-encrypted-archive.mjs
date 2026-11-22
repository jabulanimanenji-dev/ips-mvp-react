// Disposable encrypted archive acceptance. Never uses real IPS database credentials.
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {spawn} from 'node:child_process';

const dir=fs.mkdtempSync(path.join(os.tmpdir(),'ips-backup-ci-'));
const source=Buffer.concat([Buffer.from('IPS ACADEMIC PRIVATE TEST ARCHIVE\n'),crypto.randomBytes(2*1024*1024)]);
const key=crypto.randomBytes(32).toString('hex');
const wrongKey=crypto.randomBytes(32).toString('hex');
const cli=new URL('./encrypted-mongo-archive.mjs',import.meta.url).pathname;
async function run(mode,destination,input=Buffer.alloc(0),secret=key){
 const child=spawn(process.execPath,[cli,mode,destination],{env:{...process.env,IPS_BACKUP_AES256_KEY:secret},
  stdio:['pipe','pipe','pipe']});
 const output=[],errors=[];
 child.stdout.on('data',d=>output.push(d));
 child.stderr.on('data',d=>errors.push(d));
 child.stdin.on('error',()=>{});
 child.stdin.end(input);
 const exit=await new Promise((resolve,reject)=>{
  child.once('error',reject);child.once('close',resolve);
 });
 return {exit,output:Buffer.concat(output),stderr:Buffer.concat(errors).toString('utf8')};
}
try{
 const dst=path.join(dir,'academic-db.mongo-aes256gcm');
 const enc=await run('encrypt',dst,source);
 assert.equal(enc.exit,0,enc.stderr);
 const saved=fs.readFileSync(dst);
 assert.ok(saved.length>=source.length+40);
 assert.ok(!saved.includes(Buffer.from('IPS ACADEMIC PRIVATE TEST ARCHIVE')));
 assert.equal(fs.statSync(dst).mode&0o077,0,'Backup must not be readable by group or others');
 const dec=await run('decrypt',dst);
 assert.equal(dec.exit,0,dec.stderr);
 assert.ok(dec.output.equals(source));
 const duplicate=await run('encrypt',dst,source);
 assert.notEqual(duplicate.exit,0,'Existing archive must never be overwritten');
 const bad=await run('decrypt',dst,Buffer.alloc(0),wrongKey);
 assert.notEqual(bad.exit,0,'Wrong backup key must not authenticate');
 assert.equal(bad.output.length,0,'Wrong-key archives must not release ANY plaintext before rejection');
 const altered=path.join(dir,'corrupted.mongo-aes256gcm');
 const changed=Buffer.from(saved);
 changed[Math.floor(changed.length/2)]^=0x81;
 fs.writeFileSync(altered,changed,{mode:0o600});
 const tampered=await run('decrypt',altered);
 assert.notEqual(tampered.exit,0,'Corrupted archive must never authenticate');
 assert.equal(tampered.output.length,0,'Tampered archives must not release ANY plaintext before rejection');
 assert.ok(!fs.readdirSync(dir).some(x=>x.includes('.part-')));
 console.log('IPS_ENCRYPTED_MONGO_BACKUP_GREEN 9 checks; 2 MiB binary, authenticate-before-release, wrong-key and tamper emit zero plaintext, no overwrite or plaintext file');
}finally{fs.rmSync(dir,{recursive:true,force:true})}
