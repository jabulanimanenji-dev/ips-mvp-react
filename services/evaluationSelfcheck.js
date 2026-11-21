import assert from 'node:assert/strict';

// Runtime witness: full authenticated HTTP against the LIVE Express listener,
// but exclusively within the disposable Render evaluation container.
// Never enabled on production IPS or any real customer database.
export async function verifyIsolatedEvaluationRuntime({
  env=process.env,port=Number(process.env.PORT||8080),request=fetch
}={}){
  if(env.IPS_EVALUATION_MODE!=='true'||env.NODE_ENV!=='production')
    throw Error('Isolated runtime witness requires production-mode EVALUATION ONLY.');
  if(!Number.isInteger(port)||port<1||port>65535)
    throw Error('Invalid isolated evaluation port.');
  const base='http://127.0.0.1:'+port;
  const credentials=[
    ['client','/api/client/login','client.evaluation@example.org',env.IPS_EVAL_CLIENT_PASSWORD],
    ['specialist','/api/writer/login','specialist.evaluation@example.org',env.IPS_EVAL_SPECIALIST_PASSWORD],
    ['root','/api/admin/login',env.ADMIN_EMAIL,env.ADMIN_PASSWORD],
    ['manager','/api/admin/login','manager.client_relations@example.org',env.IPS_EVAL_MANAGER_PASSWORD],
    ['staff','/api/admin/login','staff.client_relations@example.org',env.IPS_EVAL_STAFF_PASSWORD],
    ['finance','/api/admin/login','manager.finance@example.org',env.IPS_EVAL_MANAGER_PASSWORD]
  ];
  if(credentials.some(x=>!x[2]||typeof x[3]!=='string'||x[3].length<12))
    throw Error('Evaluation-only credentials are missing.');
  async function call(path,{method='GET',body,cookie}={}){
    const response=await request(base+path,{
      method,headers:{
        ...(cookie?{Cookie:cookie}:{}),
        ...(body?{'Content-Type':'application/json'}:{})
      },
      ...(body?{body:JSON.stringify(body)}:{}),
      signal:AbortSignal.timeout(12000)
    });
    const data=await response.json().catch(()=>({}));
    return {status:response.status,data,response};
  }
  const health=await call('/api/health');
  assert.equal(health.status,200,'Isolated Express backend not ready');
  assert.equal(health.data.database,'connected','Real disposable MongoDB must be connected');
  assert.equal(health.data.storage,'local','Evaluation must never access private production R2');
  const accounts={};
  for(const [key,path,email,password] of credentials){
    const result=await call(path,{method:'POST',body:{email,password}});
    assert.equal(result.status,200,'Isolated login failed for '+key);
    assert.equal(Object.hasOwn(result.data,'token'),false,'Private JWT must not be exposed');
    const header=result.response.headers.get('set-cookie')||'';
    assert.match(header,/ips_session=[A-Za-z0-9._-]+/,'Missing signed '+key+' session');
    accounts[key]=header.split(';')[0];
  }
  const expect=async(label,path,role,status)=>{
    const result=await call(path,{cookie:accounts[role]});
    assert.equal(result.status,status,label);
    return result.data;
  };
  const quote=await expect('Client private quotations','/api/quote-requests/me','client',200);
  assert.ok(Array.isArray(quote.quotes)&&quote.quotes.some(x=>x.enquiry_id==='IPS-Q-E1A2B3C4D5E6F70809'));
  const assigned=await expect('Specialist assignments','/api/services','specialist',200);
  assert.ok(Array.isArray(assigned.requests)&&assigned.requests.some(x=>x.provider_id==='WID-EVAL-SPECIALIST-1'));
  await expect('Root organizational structure','/api/admin/company-team/roster','root',200);
  await expect('Delegated manager direct reports','/api/admin/company-team/roster','manager',200);
  await expect('Staff excluded from management operations','/api/admin/company-team/roster','staff',403);
  await expect('Root finance ledger','/api/admin/finance/operating-ledger','root',200);
  await expect('Finance-department ledger','/api/admin/finance/operating-ledger','finance',200);
  await expect('Non-finance manager denied finance','/api/admin/finance/operating-ledger','manager',403);
  await expect('Customer denied finance','/api/admin/finance/operating-ledger','client',403);
  await expect('Private customer notification','/api/notifications/client/CID-EVAL-PRIVATE-001','client',200);
  await expect('Root cannot read customer private notification','/api/notifications/client/CID-EVAL-PRIVATE-001','root',403);
  await expect('Private specialist notification','/api/notifications/writer/WID-EVAL-SPECIALIST-1','specialist',200);
  await expect('Client cannot read specialist notification','/api/notifications/writer/WID-EVAL-SPECIALIST-1','client',403);
  const payment=await call('/api/student-payments/config');
  assert.equal(payment.status,200);
  assert.equal(payment.data.enabled,false);
  assert.equal(payment.data.pending,true);
  return Object.freeze({ready:true,roles:6,departments:7,paymentCollection:false,
    privateNotificationIsolation:true});
}
