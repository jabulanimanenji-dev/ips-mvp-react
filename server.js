// Superseded IPS Phase 12 preview — archival redirect only.
// Original source is frozen at:
// archive/legacy-ips-20261121/phase-11-visual-builder-2-admin-hierarchy
//
// This historical preview must not connect to customer databases, read credentials,
// expose obsolete administration endpoints or send external provider messages.
import http from 'node:http';

const replacement='https://www.ipsglobalservice.com/';
const port=Number(process.env.PORT||8080);
if(!Number.isInteger(port)||port<1||port>65535)throw Error('Invalid preview port');
const server=http.createServer((request,response)=>{
  response.setHeader('Cache-Control','no-store');
  response.setHeader('Referrer-Policy','no-referrer');
  response.setHeader('X-Content-Type-Options','nosniff');
  response.setHeader('X-Robots-Tag','noindex,nofollow,noarchive');
  if((request.method==='GET'||request.method==='HEAD')&&
    request.url?.split('?')[0]==='/api/health'){
    response.writeHead(200,{'Content-Type':'application/json; charset=utf-8'});
    if(request.method==='HEAD')return response.end();
    return response.end(JSON.stringify({success:true,status:'archived',
      legacy_preview:true,new_application:replacement,read_only:true}));
  }
  if(request.method==='GET'||request.method==='HEAD'){
    response.writeHead(308,{'Location':replacement,'Content-Type':'text/plain; charset=utf-8'});
    return response.end(request.method==='HEAD'?'':'This historical IPS preview is archived. Open '+replacement);
  }
  response.writeHead(410,{'Content-Type':'application/json; charset=utf-8'});
  response.end(JSON.stringify({success:false,error:'Historical IPS API retired. Use the current IPS Company Operating System.'}));
});
server.listen(port,'0.0.0.0',()=>console.log('IPS historical Phase 12 preview archived; read-only redirect active on port '+port));
for(const signal of ['SIGTERM','SIGINT'])process.once(signal,()=>server.close(()=>process.exit(0)));
