// One-time read-only production acceptance witness, invoked only by an
// explicit bounded Render run ID. Uses server-only root credentials, never
// writes customer records, and never prints private body data or tokens.
const isEnabled=env=>env.NODE_ENV==='production'&&
  String(env.IPS_EVALUATION_MODE||'').toLowerCase()!=='true'&&
  /^[A-Za-z0-9_-]{8,64}$/.test(String(env.IPS_COMPANY_LIVE_WITNESS_RUN_ID||''));

const resultCode=response=>Number(response?.status)||0;
export async function verifyCompanyLiveWitness({env=process.env,port=Number(env.PORT||8080),request=fetch}={}){
  if(!isEnabled(env))return {skipped:true};
  if(!Number.isInteger(port)||port<1||port>65535)throw Error('Invalid live witness port.');
  const email=String(env.ADMIN_EMAIL||'').trim().toLowerCase();
  const password=String(env.ADMIN_PASSWORD||'');
  if(!email.includes('@')||password.length<10)throw Error('Actual Root credentials unavailable for internal witness.');
  const base='http://127.0.0.1:'+port;
  const send=async(path,cookie='',options={})=>request(base+path,{
    method:options.method||'GET',
    headers:{...(cookie?{Cookie:cookie}:{}),...(options.body?{'Content-Type':'application/json'}:{})},
    ...(options.body?{body:JSON.stringify(options.body)}:{}),
    signal:AbortSignal.timeout(24000)
  });
  const response=await send('/api/admin/login','',{method:'POST',body:{email,password}});
  if(resultCode(response)!==200)
    throw Error('The deployed Root Admin could not complete authenticated internal sign-in: HTTP '+resultCode(response));
  const cookieHeader=response.headers.get('set-cookie')||'';
  if(!/^ips_session=[A-Za-z0-9_.-]+;/.test(cookieHeader)||!/HttpOnly/i.test(cookieHeader))
    throw Error('Live Root login did not issue an HttpOnly signed session.');
  const cookie=cookieHeader.split(';')[0];
  const loginBody=await response.json();
  if(loginBody?.admin?.name!=='Nyoro'||loginBody?.admin?.isRoot!==true)
    throw Error('Production Root identity must be Nyoro, never a legacy owner role.');
  const checks=[
    ['Root identity','/api/admin/me',200],
    ['Seven-department roster','/api/admin/company-team/roster',200],
    ['Private finance ledger','/api/admin/finance/operating-ledger',200],
    ['Customer account directory','/api/clients',200],
    ['Specialist account directory','/api/writers',200],
    ['Live academic service cases','/api/services',200],
    ['Protected customer enquiry decisions','/api/contact-enquiries/admin/attention',200],
    ['Private support management','/api/support-tickets',200],
    ['Root company alerts','/api/notifications/admin/admin',200],
    ['Root cannot read a customer private quotation','/api/quote-requests/me',403],
    ['Root cannot read an individual customer inbox','/api/notifications/client/CID-NOT-ROOT',403],
    ['Root cannot read an individual specialist inbox','/api/notifications/writer/WID-NOT-ROOT',403]
  ];
  for(const [label,path,expected] of checks){
    const result=await send(path,cookie);
    const actual=resultCode(result);
    await result.body?.cancel?.();
    if(actual!==expected)
      throw Error(label+' check failed: HTTP '+actual+' instead of '+expected);
  }
  const status=await send('/api/student-payments/config');
  if(resultCode(status)!==200)throw Error('Payment launch policy is not available.');
  const pay=await status.json();
  if(pay.enabled!==false||pay.pending!==true)
    throw Error('Production payment collection must remain disabled until authorized integration.');
  const anonymous=await send('/api/admin/finance/operating-ledger');
  await anonymous.body?.cancel?.();
  if(resultCode(anonymous)!==401)
    throw Error('Finance data exposed to a browser without authenticated session.');
  return Object.freeze({run_id:String(env.IPS_COMPANY_LIVE_WITNESS_RUN_ID),
    root:'Nyoro',checks:checks.length+2,real_authenticated_backend:true,
    no_customer_writes:true,private_customer_inboxes_denied:true,payments_disabled:true});
}
