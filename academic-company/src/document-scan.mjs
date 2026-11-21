// IPS Academic Services malware gate. Production never accepts unscanned documents.
// ClamAV protocol: null-terminated zINSTREAM with network-order byte lengths.
import net from 'node:net';

const supportedMax=20*1024*1024;
const labels={clean:'clean',sandbox:'synthetic_not_scanned'};
export const scanConfiguration=env=>{
 const host=String(env.IPS_CLAMAV_HOST||'').trim();
 const port=Number(env.IPS_CLAMAV_PORT||3310);
 if(host&&!/^[A-Za-z0-9._-]{1,200}$/.test(host))throw Error('IPS malware scanner hostname is invalid');
 if(host&&(!Number.isInteger(port)||port<1||port>65535))throw Error('IPS malware scanner port is invalid');
 return {host,port};
};
export async function inspectAcademicFile(buffer,{env=process.env,sandbox=false}={}){
 if(!Buffer.isBuffer(buffer)||buffer.length<12||buffer.length>supportedMax)
  return {allowed:false,status:'rejected',http:400,error:'Invalid academic document size.'};
 const {host,port}=scanConfiguration(env);
 if(!host){
  if(sandbox)return {allowed:true,status:labels.sandbox,scanner:'none'};
  return {allowed:false,status:'scanner_unavailable',http:503,
   error:'Secure document screening is temporarily unavailable. Please try again later.'};
 }
 try{
  const response=await new Promise((resolve,reject)=>{
   const socket=net.createConnection({host,port});
   let complete=false,reply='';
   const finish=(error,value)=>{
    if(complete)return;
    complete=true;socket.destroy();
    if(error)reject(error);else resolve(value);
   };
   socket.setTimeout(18000,()=>finish(Error('scanner timeout')));
   socket.once('error',err=>finish(err));
   socket.on('data',chunk=>{
    reply+=chunk.toString('utf8');
    if(reply.length>1024)return finish(Error('scanner protocol overflow'));
    const end=reply.indexOf('\\0');
    if(end!==-1)finish(null,reply.slice(0,end));
   });
   socket.once('close',()=>{if(!complete)finish(Error('scanner disconnected'))});
   socket.once('connect',()=>{
    socket.write(Buffer.from('zINSTREAM\\0'));
    for(let offset=0;offset<buffer.length;offset+=65536){
     const block=buffer.subarray(offset,Math.min(offset+65536,buffer.length));
     const header=Buffer.allocUnsafe(4);header.writeUInt32BE(block.length);
     socket.write(header);socket.write(block);
    }
    socket.write(Buffer.alloc(4));
   });
  });
  if(/^stream: OK$/.test(response))return {allowed:true,status:labels.clean,scanner:'clamav'};
  if(/^stream: .{1,180} FOUND$/.test(response))
   return {allowed:false,status:'malware_blocked',http:422,
    error:'This document failed IPS security screening and cannot be uploaded.'};
  return {allowed:false,status:'scanner_unavailable',http:503,
   error:'Document screening could not confirm safety. Please try again later.'};
 }catch{
  return {allowed:false,status:'scanner_unavailable',http:503,
   error:'Secure document screening is temporarily unavailable. Please try again later.'};
 }
}
