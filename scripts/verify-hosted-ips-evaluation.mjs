import assert from 'node:assert/strict';
import {mkdir} from 'node:fs/promises';
import {chromium} from 'playwright';

const base=String(process.env.IPS_HOSTED_EVALUATION_URL||'').replace(/\/$/,'');
if(base!=='https://ips-academic-evaluation-20261119.onrender.com')
  throw Error('Only the dedicated disposable IPS Render evaluation is eligible for hosted tests.');
const credentials={
  client:process.env.IPS_EVAL_CLIENT_PASSWORD||'',
  specialist:process.env.IPS_EVAL_SPECIALIST_PASSWORD||'',
  root:process.env.IPS_EVAL_ADMIN_PASSWORD||'',
  manager:process.env.IPS_EVAL_MANAGER_PASSWORD||'',
  staff:process.env.IPS_EVAL_STAFF_PASSWORD||''
};
const mayAuthenticate=Object.values(credentials).every(x=>x.length>=12);
const attempts=[];
const pause=ms=>new Promise(resolve=>setTimeout(resolve,ms));
async function test(name,fn){
  try{await fn();attempts.push({name,status:'pass'});console.log('PASS '+name);}
  catch(err){attempts.push({name,status:'fail',reason:String(err)});console.error('FAIL '+name+' '+String(err));}
}
async function api(path,{method='GET',body,cookie=''}={}){
  const response=await fetch(base+path,{method,cache:'no-store',
    headers:{...(cookie?{Cookie:cookie}:{}),...(body?{'Content-Type':'application/json'}:{})},
    ...(body?{body:JSON.stringify(body)}:{}),signal:AbortSignal.timeout(24000)});
  const data=await response.json().catch(()=>({}));
  return {response,data};
}
async function login(path,email,password){
  const {response,data}=await api(path,{method:'POST',body:{email,password}});
  assert.equal(response.status,200,JSON.stringify(data));
  assert.equal(Object.hasOwn(data,'token'),false,'Session must not be browser-readable');
  const cookie=response.headers.get('set-cookie')||'';
  assert.match(cookie,/ips_session=[A-Za-z0-9._-]+/);
  assert.match(cookie,/HttpOnly/i);
  assert.match(cookie,/Secure/i);
  assert.match(cookie,/SameSite=Strict/i);
  return cookie.split(';')[0];
}
await test('Actual hosted evaluation responds over HTTPS with connected, disposable MongoDB',async()=>{
  let ready=false;
  for(let attempt=0;attempt<38;attempt++){
    try{
      const {response,data}=await api('/api/health');
      if(response.status===200&&data.database==='connected'){
        assert.equal(data.storage,'local');
        ready=true;break;
      }
    }catch{}
    await pause(2500);
  }
  assert.equal(ready,true,'Hosted app did not provide verified MongoDB readiness');
});
await test('No card payments can be initiated in this hosted evaluation',async()=>{
  const {response,data}=await api('/api/student-payments/config');
  assert.equal(response.status,200);
  assert.equal(data.enabled,false);
  assert.equal(data.pending,true);
});
await test('Private company, researcher and specialist APIs refuse anonymous requests',async()=>{
  for(const path of [
    '/api/admin/finance/operating-ledger',
    '/api/admin/company-team/roster',
    '/api/contact-enquiries/admin/attention',
    '/api/quote-requests/me',
    '/api/specialist-payouts/me',
    '/api/notifications/client/CID-EVAL-PRIVATE-001'
  ]){
    const {response}=await api(path);
    assert.equal(response.status,401,path+' must reject unauthenticated requests');
  }
});
await mkdir('hosted-evaluation-evidence',{recursive:true});
const browser=await chromium.launch({channel:'chrome',headless:true,args:['--no-sandbox']});
const pages=[];
async function open(width=1280,height=840){
  const page=await browser.newPage({viewport:{width,height}});
  pages.push(page);
  page.setDefaultTimeout(20000);
  return page;
}
const screenshot=(page,name)=>page.screenshot({
  path:'hosted-evaluation-evidence/'+name+'.png',fullPage:true,animations:'disabled'});
try{
  await test('Public evaluation guide lists five roles without publishing passwords',async()=>{
    const page=await open();
    await page.goto(base+'/evaluation',{waitUntil:'domcontentloaded'});
    await page.getByText('ISOLATED DEMONSTRATION — NOT PRODUCTION').waitFor();
    await page.getByRole('heading',{name:'Evaluate the complete working interface.'}).waitFor();
    assert.equal(await page.getByRole('link',{name:/Open .* Login/}).count(),5);
    assert.equal(await page.getByText('Test password',{exact:true}).count(),0);
    const text=await page.locator('body').innerText();
    assert.equal(text.includes('EvalClient2026!'),false);
    assert.equal(text.includes('EvalAdmin2026!'),false);
    await screenshot(page,'01-five-role-public-guide');
  });
  await test('Real hosted client, specialist and administrator sign-in pages work',async()=>{
    const routes=[
      ['/login','client-login'],
      ['/writer/login','specialist-login'],
      ['/ips-evaluation-ops','nyoro-admin-login']
    ];
    for(const [route,name] of routes){
      const page=await open();
      await page.goto(base+route,{waitUntil:'domcontentloaded'});
      await page.locator('input[type=email]').waitFor();
      await page.locator('input[type=password]').waitFor();
      await screenshot(page,'02-'+name);
    }
  });
  await test('Mobile evaluation guide and sign-in remain usable without horizontal overflow',async()=>{
    const page=await open(390,844);
    await page.goto(base+'/evaluation',{waitUntil:'domcontentloaded'});
    await page.getByText('ISOLATED DEMONSTRATION — NOT PRODUCTION').waitFor();
    const overflow=await page.evaluate(()=>({
      width:innerWidth,body:document.body.scrollWidth,html:document.documentElement.scrollWidth
    }));
    assert.ok(overflow.body<=overflow.width+6&&overflow.html<=overflow.width+6,JSON.stringify(overflow));
    await screenshot(page,'03-mobile-guide');
  });
  if(!mayAuthenticate){
    console.log('SKIP authenticated hosted browser/HTTP checks: independent GitHub encrypted IPS evaluation secrets are not configured. Local MongoDB+Docker tests still authenticate all five roles.');
  }else{
    let client,specialist,root,manager,staff,finance;
    await test('Five real HTTPS roles authenticate to isolated IPS backend',async()=>{
      client=await login('/api/client/login','client.evaluation@example.org',credentials.client);
      specialist=await login('/api/writer/login','specialist.evaluation@example.org',credentials.specialist);
      root=await login('/api/admin/login','nyoro.evaluation@example.org',credentials.root);
      manager=await login('/api/admin/login','manager.client_relations@example.org',credentials.manager);
      staff=await login('/api/admin/login','staff.client_relations@example.org',credentials.staff);
      finance=await login('/api/admin/login','manager.finance@example.org',credentials.manager);
      assert.ok(client&&specialist&&root&&manager&&staff&&finance);
    });
    if(client&&specialist&&root&&manager&&staff&&finance){
      await test('Live customer, specialist, Root and departmental authority are isolated',async()=>{
        assert.equal((await api('/api/quote-requests/me',{cookie:client})).response.status,200);
        assert.equal((await api('/api/services',{cookie:specialist})).response.status,200);
        assert.equal((await api('/api/admin/company-team/roster',{cookie:manager})).response.status,200);
        assert.equal((await api('/api/admin/company-team/roster',{cookie:staff})).response.status,403);
        assert.equal((await api('/api/admin/finance/operating-ledger',{cookie:root})).response.status,200);
        assert.equal((await api('/api/admin/finance/operating-ledger',{cookie:finance})).response.status,200);
        assert.equal((await api('/api/admin/finance/operating-ledger',{cookie:manager})).response.status,403);
        assert.equal((await api('/api/notifications/client/CID-EVAL-PRIVATE-001',{cookie:root})).response.status,403);
        assert.equal((await api('/api/notifications/client/CID-EVAL-PRIVATE-001',{cookie:client})).response.status,200);
      });
      for(const [route,email,password,button,name] of [
        ['/login','client.evaluation@example.org',credentials.client,/open my workspace/i,'04-client'],
        ['/writer/login','specialist.evaluation@example.org',credentials.specialist,/open my workspace/i,'05-specialist'],
        ['/ips-evaluation-ops','nyoro.evaluation@example.org',credentials.root,'Sign In','06-root']
      ]){
        await test('Authenticated Chrome role '+name,async()=>{
          const page=await open();
          await page.goto(base+route,{waitUntil:'domcontentloaded'});
          await page.locator('input[type=email]').fill(email);
          await page.locator('input[type=password]').fill(password);
          await page.getByRole('button',{name:button}).click();
          await page.waitForURL(/\/(client|writer|admin)\//,{timeout:24000});
          await screenshot(page,name+'-authenticated');
        });
      }
    }
  }
}finally{
  await Promise.all(pages.map(p=>p.close().catch(()=>{})));
  await browser.close();
}
const failures=attempts.filter(x=>x.status==='fail');
if(failures.length){
  console.error('IPS_HOSTED_EVALUATION_FAILED '+JSON.stringify(failures));
  process.exitCode=1;
}else console.log('IPS_HOSTED_EVALUATION_PUBLIC_PASS '+attempts.length+
  ' checks; authenticated hosted role qualification '+(mayAuthenticate?'enabled':'not configured'));
