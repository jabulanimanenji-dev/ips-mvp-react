import assert from 'node:assert/strict';
import {mkdir} from 'node:fs/promises';
import {chromium} from 'playwright';

const base=String(process.env.IPS_HOSTED_EVALUATION_URL||'').replace(/\/$/,'');
if(base!=='https://ips-academic-evaluation-20261119.onrender.com')
  throw Error('Host qualification may only target the isolated Render IPS evaluation URL.');
const pause=ms=>new Promise(ok=>setTimeout(ok,ms));
const failures=[];
async function test(name,fn){
  try{await fn();console.log('PASS '+name);}
  catch(err){failures.push({name,message:String(err)});console.error('FAIL '+name+' '+String(err));}
}
async function api(path,{method='GET',body,cookie=''}={}){
  const r=await fetch(base+path,{
    method,cache:'no-store',headers:{
      ...(cookie?{Cookie:cookie}:{}),
      ...(body?{'Content-Type':'application/json'}:{})
    },
    ...(body?{body:JSON.stringify(body)}:{}),
    signal:AbortSignal.timeout(20000)
  });
  const data=await r.json().catch(()=>({}));
  return {response:r,data};
}
async function login(path,email,password){
  const {response,data}=await api(path,{method:'POST',body:{email,password}});
  assert.equal(response.status,200,JSON.stringify(data));
  assert.ok(!Object.hasOwn(data,'token'),'Signed login proof must be HttpOnly, not browser-readable');
  const fullCookie=response.headers.get('set-cookie')||'';
  assert.match(fullCookie,/ips_session=[A-Za-z0-9._-]+/);
  assert.match(fullCookie,/HttpOnly/);
  assert.match(fullCookie,/Secure/);
  assert.match(fullCookie,/SameSite=Strict/);
  return fullCookie.split(';')[0];
}
const available=async()=>{
  for(let i=0;i<55;i++){
    try{
      const {response,data}=await api('/api/health');
      if(response.status===200&&data.database==='connected')return;
    }catch{}
    await pause(3000);
  }
  throw Error('The hosted IPS evaluation server has not returned genuine MongoDB readiness.');
};
await test('Render public HTTPS evaluation has a connected real MongoDB backend',available);
let customer,specialist,manager;
await test('Private researcher logs into distinct verified customer session',async()=>{
  customer=await login('/api/client/login','client.evaluation@example.org','EvalClient2026!');
  const {response,data}=await api('/api/quote-requests/me',{cookie:customer});
  assert.equal(response.status,200);
  assert.ok(data.quotes.some(q=>q.enquiry_id==='IPS-Q-E1A2B3C4D5E6F70809'));
});
await test('Approved specialist authenticates and sees only authorized synthetic work',async()=>{
  specialist=await login('/api/writer/login','specialist.evaluation@example.org','EvalSpecialist2026!');
  const {response,data}=await api('/api/services',{cookie:specialist});
  assert.equal(response.status,200,JSON.stringify(data));
  assert.ok(data.requests.some(q=>q.provider_id==='WID-EVAL-SPECIALIST-1'));
  const payout=await api('/api/specialist-payouts/me',{cookie:specialist});
  assert.equal(payout.response.status,200);
  assert.ok(payout.data.payouts.some(p=>p.status==='approved'));
});
await test('Authenticated IPS administration manages private review attention',async()=>{
  manager=await login('/api/admin/login','admin.evaluation@example.org','EvalAdmin2026!');
  const {response,data}=await api('/api/contact-enquiries/admin/attention',{cookie:manager});
  assert.equal(response.status,200,JSON.stringify(data));
  assert.ok(data.unassigned_requests>=1);
});
await test('Cross-role access is denied on real hosted backend',async()=>{
  assert.equal((await api('/api/quote-requests/me',{cookie:specialist})).response.status,403);
  assert.equal((await api('/api/specialist-payouts/me',{cookie:customer})).response.status,403);
  assert.equal((await api('/api/contact-enquiries/admin/attention',{cookie:customer})).response.status,403);
  assert.equal((await api('/api/quote-requests/me')).response.status,401);
});
await mkdir('hosted-evaluation-evidence',{recursive:true});
const browser=await chromium.launch({channel:'chrome',headless:true,args:['--no-sandbox']});
const pages=[];
const page=async(width=1280,height=840)=>{
  const p=await browser.newPage({viewport:{width,height}});
  pages.push(p);return p;
};
const screenshot=async(p,name)=>p.screenshot({path:'hosted-evaluation-evidence/'+name+'.png',fullPage:true,animations:'disabled'});
try{
  await test('Public evaluation guide and three transparent sample identities render in real Chrome',async()=>{
    const p=await page();
    await p.goto(base+'/evaluation',{waitUntil:'domcontentloaded'});
    await p.getByText('ISOLATED DEMONSTRATION — NOT PRODUCTION').waitFor({timeout:20000});
    await p.getByRole('heading',{name:'Evaluate the complete working interface.'}).waitFor();
    assert.equal(await p.getByRole('link',{name:/Open .* Login/}).count(),3);
    await screenshot(p,'01-public-evaluation-guide');
  });
  await test('Hosted customer enters their real, private, verified project workspace',async()=>{
    const p=await page();
    await p.goto(base+'/login',{waitUntil:'domcontentloaded'});
    await p.locator('input[type=email]').fill('client.evaluation@example.org');
    await p.locator('input[type=password]').fill('EvalClient2026!');
    await p.getByRole('button',{name:/open my workspace/i}).click();
    await p.waitForURL(/\/client\/overview/,{timeout:20000});
    await p.getByText('Private Quote Messages').waitFor({timeout:20000});
    await screenshot(p,'02-verified-client-workspace');
    await p.goto(base+'/client/payments',{waitUntil:'domcontentloaded'});
    await p.getByText('My Payments & Refunds').first().waitFor({timeout:20000});
    await screenshot(p,'03-client-transaction-ledger');
  });
  await test('Hosted specialist opens their authorized work and own payout ledger',async()=>{
    const p=await page();
    await p.goto(base+'/writer/login',{waitUntil:'domcontentloaded'});
    await p.locator('input[type=email]').fill('specialist.evaluation@example.org');
    await p.locator('input[type=password]').fill('EvalSpecialist2026!');
    await p.getByRole('button',{name:/open my workspace/i}).click();
    await p.waitForURL(/\/writer\/dashboard(?:[/?#]|$)/,{timeout:20000});
    await p.goto(base+'/writer/dashboard',{waitUntil:'domcontentloaded'});
    await p.locator('.writer-layout').waitFor({timeout:20000});
    await screenshot(p,'04-approved-specialist-workspace');
    await p.goto(base+'/writer/earnings',{waitUntil:'domcontentloaded'});
    await p.getByText('My Payment Records').waitFor({timeout:20000});
    await screenshot(p,'05-specialist-approved-payouts');
  });
  await test('Hosted IPS manager opens real Mission Control and private quotation queue',async()=>{
    const p=await page();
    await p.goto(base+'/ips-evaluation-ops',{waitUntil:'domcontentloaded'});
    await p.locator('input[type=email]').fill('admin.evaluation@example.org');
    await p.locator('input[type=password]').fill('EvalAdmin2026!');
    await p.getByRole('button',{name:'Sign In'}).click();
    await p.waitForURL(/\/admin\//,{timeout:20000});
    await p.goto(base+'/admin/enquiries',{waitUntil:'domcontentloaded'});
    await p.locator('.ips-contact-admin').waitFor({timeout:20000});
    await screenshot(p,'06-ips-administrator-quotation-queue');
    await p.goto(base+'/admin/payments',{waitUntil:'domcontentloaded'});
    await p.getByText('Verified Specialist Payments').waitFor({timeout:20000});
    await screenshot(p,'07-ips-management-finance');
  });
  await test('Evaluation guide and confidentiality banner work on mobile viewport',async()=>{
    const p=await page(390,844);
    await p.goto(base+'/evaluation',{waitUntil:'domcontentloaded'});
    await p.getByText('ISOLATED DEMONSTRATION — NOT PRODUCTION').waitFor({timeout:20000});
    assert.equal(await p.locator('body').evaluate(el=>el.scrollWidth>window.innerWidth+6),false);
    await screenshot(p,'08-mobile-evaluation-guide');
  });
}finally{await Promise.all(pages.map(p=>p.close().catch(()=>{})));await browser.close();}
if(failures.length){
  console.error('HOSTED_IPS_EVALUATION_FAILED '+JSON.stringify(failures));
  process.exitCode=1;
}else console.log('PASS Hosted IPS all three role workspaces, privacy separation, finance, mobile browser and screenshots');
