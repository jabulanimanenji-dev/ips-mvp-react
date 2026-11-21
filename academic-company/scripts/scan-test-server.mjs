// Synthetic ClamAV protocol double. This is NOT a malware engine or live antivirus proof.
// Used to prove the application transmits the full bytes and rejects FOUND/ERROR replies.
import net from 'node:net';

export async function startFakeClamd(){
 const server=net.createServer(socket=>{
  let pending=Buffer.alloc(0),started=false,done=false,signature=false,bad=false,bytes=0;
  socket.on('data',input=>{
   if(done)return;
   pending=Buffer.concat([pending,input]);
   if(!started){
    if(pending.length<10)return;
    if(!pending.subarray(0,10).equals(Buffer.from('zINSTREAM'+String.fromCharCode(0)))){
     done=true;socket.end();return;
    }
    pending=pending.subarray(10);started=true;
   }
   while(pending.length>=4&&!done){
    const n=pending.readUInt32BE(0);
    if(n>65536){done=true;socket.end(Buffer.from('stream: invalid chunk ERROR'+String.fromCharCode(0)));return}
    if(pending.length<n+4)return;
    const block=pending.subarray(4,4+n);
    if(n===0){
     done=true;
     const verdict=bad?'stream: scanner unavailable ERROR':
      signature?'stream: Synthetic-Signature FOUND':'stream: OK';
     socket.end(Buffer.from(verdict+String.fromCharCode(0)));
     return;
    }
    bytes+=n;
    if(block.includes(Buffer.from('IPS_SYNTHETIC_EICAR_TEST')))signature=true;
    if(block.includes(Buffer.from('IPS_SYNTHETIC_SCAN_ERROR')))bad=true;
    pending=pending.subarray(n+4);
   }
  });
 });
 await new Promise((resolve,reject)=>{
  server.once('error',reject);
  server.listen(0,'127.0.0.1',resolve);
 });
 return {port:server.address().port,close:()=>new Promise(resolve=>server.close(resolve))};
}
