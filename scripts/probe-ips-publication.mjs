// Read-only IPS publishing audit against the actual company domain.
// Sends no customer credentials, writes no data, and never prints private keys.
// The previous production version may lack newly introduced endpoints: report
// those as not-qualified rather than claiming the new edition is live.
const sites=['https://www.ipsglobalservice.com','https://ips-mvp-react.onrender.com'];
const routeNames=[
  ['backend','/api/health'],
  ['enquiries','/api/contact-enquiries/config'],
  ['private_quotes','/api/quote-requests/config'],
  ['messaging','/api/contact-channels/config'],
  ['payments','/api/student-payments/config']
];
const mode=process.env.IPS_PROBE_MODE||'baseline';
async function read(path,site){
  const res=await fetch(site+path,{method:'GET',redirect:'follow',
    headers:{Accept:'application/json','Cache-Control':'no-cache'},
    signal:AbortSignal.timeout(12000)});
  const body=await res.json().catch(()=>({}));
  return {http:res.status,body};
}
let resolvedSite=null,features={};
for(const site of sites){
  try{
    const {http,body}=await read('/api/health',site);
    if(http===200&&body?.database==='connected'){
      resolvedSite=site;features.backend={available:true,storage:body.storage||'unknown'};
      break;
    }
  }catch{}
}
if(!resolvedSite){
  console.error('PUBLICATION_AUDIT_BLOCKED: Company production hostname and Render fallback do not report a connected database.');
  process.exitCode=1;
}else{
  for(const [name,path] of routeNames.slice(1)){
    try{
      const {http,body}=await read(path,resolvedSite);
      if(name==='enquiries')
        features[name]={endpoint:http===200,accepting:body.accepting_requests===true,
          delivery_ready:body.email_replies_configured===true};
      else if(name==='private_quotes')
        features[name]={endpoint:http===200,accepting:body.accepting_requests===true,
          verified_email:body.email===true,workspace:body.workspace===true,
          telegram:body.telegram===true,whatsapp:body.whatsapp===true};
      else if(name==='messaging')
        features[name]={endpoint:http===200,telegram:body.telegram?.available===true,
          whatsapp:body.whatsapp?.available===true,
          whatsapp_mode:body.whatsapp?.mode||'unavailable',
          whatsapp_manual:body.whatsapp?.manual_confirmation===true};
      else if(name==='payments')
        features[name]={endpoint:http===200,enabled:body.enabled===true,pending:body.pending===true};
    }catch{features[name]={endpoint:false,error:'public endpoint inaccessible'};}
  }
  console.log('IPS_DOMAIN_AUDIT '+JSON.stringify({site:resolvedSite,features}));
  const operational=features.backend?.available&&features.backend.storage==='r2'&&
    features.enquiries?.accepting&&features.enquiries?.delivery_ready&&
    features.private_quotes?.accepting&&features.private_quotes?.verified_email&&
    features.private_quotes?.workspace&&features.private_quotes?.telegram&&
    features.private_quotes?.whatsapp&&features.messaging?.telegram&&features.messaging?.whatsapp&&
    features.messaging?.whatsapp_mode==='direct'&&features.messaging?.whatsapp_manual;
  const paymentPending=features.payments?.endpoint&&features.payments.pending&&
    !features.payments.enabled;
  if(mode==='publication'&&(!operational||!paymentPending)){
    console.error('IPS_PUBLICATION_NOT_QUALIFIED: Independent nonpayment delivery, storage or payment-disabled evidence is missing.');
    process.exitCode=1;
  }
  if(mode==='baseline')console.log('PASS READ_ONLY_PREPUBLICATION_PROBE: production status captured; no live users, payment or provider accounts altered.');
  if(mode==='publication'&&operational&&paymentPending)
    console.log('PASS IPS_NONPAYMENT_PUBLICATION_CONFIGURATION: Email, Telegram and manual direct WhatsApp contact, database, storage and explicit payment hold enabled (provider delivery still requires end-to-end receipt tests).');
}
