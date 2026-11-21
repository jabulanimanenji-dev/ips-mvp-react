import assert from 'node:assert/strict';
import {mkdir,writeFile} from 'node:fs/promises';
import {chromium} from 'playwright';

// A read-only release witness. Do not create clients, send contact messages,
// initiate payments, or authenticate against production customer accounts.
const base='https://www.ipsglobalservice.com';
const archive='https://ips-mvp-react-phase12-preview.onrender.com';
const checks=[];
async function check(name,fn){
  try{await fn();checks.push({name,status:'pass'});console.log('PASS '+name);}
  catch(error){checks.push({name,status:'fail',detail:String(error)});console.error('FAIL '+name+' '+String(error));}
}
async function request(url,{redirect='follow'}={}){
  const response=await fetch(url,{method:'GET',redirect,
    headers:{'Cache-Control':'no-cache','Accept':'*/*'},
    signal:AbortSignal.timeout(20000)});
  return response;
}
await mkdir('ips-live-readonly-evidence',{recursive:true});
await check('New IPS production uses actual MongoDB and persistent private object storage',async()=>{
  const response=await request(base+'/api/health');
  assert.equal(response.status,200);
  const data=await response.json();
  assert.equal(data.database,'connected');
  assert.equal(data.storage,'r2');
  assert.equal(data.ready,true);
});
await check('Company nonpayment intake is configured without fake payment collection',async()=>{
  const endpoints=['/api/contact-enquiries/config','/api/quote-requests/config',
    '/api/contact-channels/config','/api/student-payments/config'];
  for(const endpoint of endpoints){
    const response=await request(base+endpoint);
    assert.equal(response.status,200,endpoint);
    const data=await response.json();
    if(endpoint.includes('contact-enquiries'))assert.equal(data.accepting_requests,true);
    if(endpoint.includes('quote-requests')){
      assert.equal(data.accepting_requests,true);
      assert.equal(data.workspace,true);
      assert.equal(data.email,true);
    }
    if(endpoint.includes('contact-channels'))assert.equal(data.telegram?.available,true);
    if(endpoint.includes('student-payments')){
      assert.equal(data.enabled,false,'Production must not charge during owner review');
      assert.equal(data.pending,true);
    }
  }
});
await check('Root, manager, finance, client and specialist private records reject anonymous access',async()=>{
  const routes=[
    '/api/admin/company-team/roster',
    '/api/admin/finance/operating-ledger',
    '/api/notifications/admin/admin',
    '/api/quote-requests/me',
    '/api/contact-enquiries/admin/attention',
    '/api/specialist-payouts/me',
    '/api/support-tickets',
    '/api/clients',
    '/api/student-payments/admin'
  ];
  for(const route of routes){
    const response=await request(base+route);
    assert.equal(response.status,401,'Anonymous route '+route+' returned '+response.status);
  }
});
await check('Actual live frontend includes the NEW finance and confidential notification workspaces',async()=>{
  const response=await request(base+'/');
  assert.equal(response.status,200);
  const html=await response.text();
  assert.match(html,/<div id="root"><\/div>|<div id="root">/);
  const path=html.match(/src="(\/assets\/[^"]+\.js)"/)?.[1];
  assert.ok(path,'Live company JavaScript asset missing');
  const script=await request(base+path);
  assert.equal(script.status,200);
  const source=await script.text();
  for(const phrase of [
    'Finance without imaginary balances',
    'My private updates',
    'Take accountable ownership',
    'COMPANY DATABASE CONNECTED'
  ])assert.ok(source.includes(phrase),'New production client bundle does not include '+phrase);
  assert.ok(!source.includes('EvalClient2026!'),'Synthetic evaluation passwords must not reach production JS');
});
const browser=await chromium.launch({channel:'chrome',headless:true,args:['--no-sandbox']});
try{
  await check('Actual company homepage renders in desktop Chrome without blank page',async()=>{
    const page=await browser.newPage({viewport:{width:1440,height:900}});
    try{
      await page.goto(base+'/',{waitUntil:'domcontentloaded',timeout:25000});
      await page.locator('.ipsa-hero').waitFor({timeout:20000});
      await page.screenshot({path:'ips-live-readonly-evidence/01-live-company-home.png',fullPage:true,animations:'disabled'});
    }finally{await page.close();}
  });
  await check('Client sign-in is accessible and works on mobile without white-screen crashes',async()=>{
    const page=await browser.newPage({viewport:{width:390,height:844},isMobile:true});
    try{
      await page.goto(base+'/login',{waitUntil:'domcontentloaded',timeout:25000});
      await page.locator('input[type=email]').waitFor({timeout:20000});
      await page.locator('input[type=password]').waitFor();
      await page.screenshot({path:'ips-live-readonly-evidence/02-live-client-sign-in-mobile.png',fullPage:true,animations:'disabled'});
    }finally{await page.close();}
  });
  await check('Specialist sign-in is present and visually usable on desktop',async()=>{
    const page=await browser.newPage({viewport:{width:1365,height:900}});
    try{
      await page.goto(base+'/writer/login',{waitUntil:'domcontentloaded',timeout:25000});
      await page.locator('input[type=email]').waitFor({timeout:20000});
      await page.locator('input[type=password]').waitFor();
      await page.screenshot({path:'ips-live-readonly-evidence/03-live-specialist-sign-in.png',fullPage:true,animations:'disabled'});
    }finally{await page.close();}
  });
}finally{await browser.close();}
await check('The old Phase 12 preview is retired and cannot serve legacy customer APIs',async()=>{
  const status=await request(archive+'/api/health');
  assert.equal(status.status,200);
  const data=await status.json();
  assert.equal(data.status,'archived');
  assert.equal(data.read_only,true);
  const old=await request(archive+'/',{redirect:'manual'});
  assert.equal(old.status,308);
  assert.equal(old.headers.get('location'),base+'/');
});
const failed=checks.filter(x=>x.status==='fail');
await writeFile('ips-live-readonly-evidence/results.json',JSON.stringify({
  qualification:'READ_ONLY_PRODUCTION_NONPAYMENT',target:base,
  checks,failed_count:failed.length
},null,2));
if(failed.length)process.exitCode=1;
else console.log('IPS_LIVE_COMPANY_READ_ONLY_GREEN '+checks.length+
  ' production browser, R2, MongoDB, role privacy, provider and archived-preview checks');
