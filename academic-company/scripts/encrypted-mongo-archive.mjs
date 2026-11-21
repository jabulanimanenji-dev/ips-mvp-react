// IPS Academic Services: encrypted MongoDB archive transport.
// Input/output is binary; no MongoDB URI or customer content is logged.
// Use with mongodump --archive and with mongorestore only into a NEW isolated db.
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import {pipeline} from 'node:stream/promises';

const MAGIC=Buffer.from('IPS-ACADEMIC-AES256GCM-v1\n');
const IV_BYTES=12,TAG_BYTES=16;
const command=process.argv[2],fileArg=process.argv[3];
const keyText=String(process.env.IPS_BACKUP_AES256_KEY||'').trim();
if(!['encrypt','decrypt'].includes(command)||!fileArg||
 !/^[0-9a-fA-F]{64}$/.test(keyText)){
 console.error('Usage: IPS_BACKUP_AES256_KEY=<64 hex chars> node scripts/encrypted-mongo-archive.mjs encrypt|decrypt ABSOLUTE_ARCHIVE_PATH');
 process.exit(2);
}
const key=Buffer.from(keyText,'hex');
const file=path.resolve(fileArg);
if(!path.isAbsolute(fileArg)||file.startsWith(path.resolve(process.cwd())+path.sep)){
 // Encrypted production archives must be stored outside the checked-out source.
 if(command==='encrypt'){
  console.error('Backup destination must be an absolute path outside the application source.');
  process.exit(2);
 }
}
async function encrypt(){
 const iv=crypto.randomBytes(IV_BYTES);
 const cipher=crypto.createCipheriv('aes-256-gcm',key,iv);
 const partial=file+'.part-'+crypto.randomBytes(8).toString('hex');
 if(fs.existsSync(file))throw Error('Refusing to overwrite an existing IPS backup.');
 fs.mkdirSync(path.dirname(file),{recursive:true,mode:0o700});
 const out=fs.createWriteStream(partial,{flags:'wx',mode:0o600});
 try{
  await new Promise((resolve,reject)=>out.write(Buffer.concat([MAGIC,iv]),e=>e?reject(e):resolve()));
  await pipeline(process.stdin,cipher,out,{end:false});
  await new Promise((resolve,reject)=>out.end(cipher.getAuthTag(),e=>e?reject(e):resolve()));
  fs.renameSync(partial,file);
  const st=fs.statSync(file);
  if(!st.size||!(st.mode&0o600))throw Error('Encrypted IPS archive is missing.');
  console.error('IPS_ENCRYPTED_ARCHIVE_CREATED '+JSON.stringify({bytes:st.size,algorithm:'AES-256-GCM',plaintextStored:false}));
 }catch(err){out.destroy();try{fs.unlinkSync(partial)}catch{}throw err}
}
async function decrypt(){
 const st=fs.statSync(file);
 const min=MAGIC.length+IV_BYTES+TAG_BYTES+1;
 if(st.size<min)throw Error('IPS encrypted archive is incomplete.');
 const fd=fs.openSync(file,'r');
 let iv,tag,magic;
 try{
  magic=Buffer.alloc(MAGIC.length);
  iv=Buffer.alloc(IV_BYTES);
  tag=Buffer.alloc(TAG_BYTES);
  if(fs.readSync(fd,magic,0,magic.length,0)!==magic.length||
     !crypto.timingSafeEqual(magic,MAGIC))throw Error('Unrecognized IPS encrypted archive format.');
  fs.readSync(fd,iv,0,IV_BYTES,MAGIC.length);
  fs.readSync(fd,tag,0,TAG_BYTES,st.size-TAG_BYTES);
 }finally{fs.closeSync(fd)}
 const decipher=crypto.createDecipheriv('aes-256-gcm',key,iv);
 decipher.setAuthTag(tag);
 const source=fs.createReadStream(file,{start:MAGIC.length+IV_BYTES,
  end:st.size-TAG_BYTES-1});
 await pipeline(source,decipher,process.stdout);
}
try{
 if(command==='encrypt')await encrypt();
 else await decrypt();
}catch{
 console.error('IPS encrypted archive processing FAILED (incorrect key, corrupted bytes, or destination unavailable).');
 process.exitCode=1;
}
