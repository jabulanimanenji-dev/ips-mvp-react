import assert from 'node:assert/strict';
import {mkdir} from 'node:fs/promises';
import {chromium} from 'playwright';

// Synthetic identities are usable ONLY in this isolated Render evaluation,
// never on the published IPS domain or real customer database.
const base=String(process.env.IPS_VISUAL_BASE_URL||'').replace(/\/$/,'');
if(!['http://127.0.0.1:18080','https://ips-academic-evaluation-20261119.onrender.com'].includes(base))
  throw Error('Visual qualification must not run against real IPS customers.');
const credentials={
  client:process.env.IPS_EVAL_CLIENT_PASSWORD||'',
  specialist:process.env.IPS_EVAL_SPECIALIST_PASSWORD||'',
  root:process.env.IPS_EVAL_ADMIN_PASSWORD||''
};
const authenticated=Object.values(credentials).every(x=>x.length>=12);
const reports=[];
await mkdir('ips-brand-evidence',{recursive:true});
const browser=await chromium.launch({channel:'chrome',headless:true,args:['--no-sandbox']});
async function check(name,fn){
  let page;
  try{
    page=await browser.newPage({viewport:{width:1440,height:900}});
    page.setDefaultTimeout(22000);
    await fn(page);
    reports.push({name,passed:true});
    console.log('PASS '+name);
  }catch(error){
    reports.push({name,passed:false,reason:String(error)});
    console.error('FAIL '+name+' '+String(error));
  }finally{await page?.close().catch(()=>{});}
}
async function snapshot(page,name){
  await page.screenshot({path:'ips-brand-evidence/'+name+'.png',fullPage:true,animations:'disabled'});
}
async function noOverflow(page){
  const size=await page.evaluate(()=>({width:innerWidth,
    body:document.body.scrollWidth,html:document.documentElement.scrollWidth}));
  assert.ok(size.body<=size.width+6&&size.html<=size.width+6,
    'Horizontal overflow '+JSON.stringify(size));
}
async function login(page,route,email,password,button){
  await page.goto(base+route,{waitUntil:'domcontentloaded'});
  await page.locator('input[type=email]').fill(email);
  await page.locator('input[type=password]').fill(password);
  await page.getByRole('button',{name:button}).click();
  await page.waitForURL(/\/(admin|client|writer)\//,{timeout:24000});
}
try{
  await check('Public IPS homepage uses the correct premium navy/ivory visual identity',async page=>{
    await page.goto(base+'/',{waitUntil:'domcontentloaded'});
    await page.locator('.ipsa-hero').waitFor();
    const color=await page.evaluate(()=>getComputedStyle(document.documentElement).getPropertyValue('--primary').trim().toLowerCase());
    assert.equal(color,'#183b53');
    await noOverflow(page);
    await snapshot(page,'01-public-home');
  });
  await check('Private evaluation guide is explicit and contains five role choices, not passwords',async page=>{
    await page.goto(base+'/evaluation',{waitUntil:'domcontentloaded'});
    await page.getByText('ISOLATED DEMONSTRATION — NOT PRODUCTION').waitFor();
    assert.equal(await page.getByRole('link',{name:/Open .* Login/}).count(),5);
    const body=await page.locator('body').innerText();
    assert.ok(!body.includes('EvalClient2026!')&&!body.includes('EvalAdmin2026!'));
    await noOverflow(page);
    await snapshot(page,'02-five-role-evaluation-guide');
  });
  await check('New dark Administration Four login is readable and real, without white input glare',async page=>{
    await page.goto(base+'/ips-evaluation-ops',{waitUntil:'domcontentloaded'});
    const email=page.locator('input[type=email]');
    const password=page.locator('input[type=password]');
    await email.waitFor();await password.waitFor();
    const read=await email.evaluate(el=>({color:getComputedStyle(el).color,
      bg:getComputedStyle(el).backgroundColor,visible:el.getBoundingClientRect().height>15}));
    assert.ok(read.visible);
    assert.notEqual(read.bg,'rgba(0, 0, 0, 0)','Input surface must be a deliberate, readable color');
    await noOverflow(page);
    await snapshot(page,'03-dark-ips-root-login');
  });
  await check('Public and staff entry points remain accessible on 390px mobile',async page=>{
    await page.setViewportSize({width:390,height:844});
    await page.goto(base+'/evaluation',{waitUntil:'domcontentloaded'});
    await page.locator('.ips-evaluation-banner').waitFor();
    await noOverflow(page);
    await snapshot(page,'04-mobile-five-role-guide');
    await page.goto(base+'/ips-evaluation-ops',{waitUntil:'domcontentloaded'});
    await page.locator('input[type=password]').waitFor();
    await noOverflow(page);
    await snapshot(page,'05-mobile-administrator-login');
  });
  if(!authenticated){
    console.log('SKIP authenticated hosted visual checks: encrypted GitHub IPS evaluation credentials are not set. Real Docker + MongoDB + Chrome integration qualifies authenticated paths separately.');
  }else{
    await check('Real hosted Nyoro Root Admin uses a uniform dark accountable command centre',async page=>{
      await login(page,'/ips-evaluation-ops','nyoro.evaluation@example.org',credentials.root,'Sign In');
      await page.goto(base+'/admin/dashboard',{waitUntil:'domcontentloaded'});
      await page.locator('.ips4').waitFor();
      await page.locator('.ips4-panel').first().waitFor();
      await noOverflow(page);
      await snapshot(page,'06-root-company-command');
      await page.goto(base+'/admin/payments',{waitUntil:'domcontentloaded'});
      await page.getByText('Finance without imaginary balances').waitFor();
      await snapshot(page,'07-source-bound-finance');
      await page.goto(base+'/admin/external-chats',{waitUntil:'domcontentloaded'});
      await page.getByText('Telegram operations').waitFor();
      await snapshot(page,'08-dark-telegram');
    });
    await check('Hosted client sees private academic work without workspace overflow',async page=>{
      await login(page,'/login','client.evaluation@example.org',credentials.client,/open my workspace/i);
      await page.locator('.client-layout').waitFor();
      await page.getByRole('heading',{name:/My private updates/}).waitFor();
      await noOverflow(page);
      await snapshot(page,'09-real-client-workspace');
    });
    await check('Hosted specialist sees assigned tasks and a private inbox',async page=>{
      await login(page,'/writer/login','specialist.evaluation@example.org',credentials.specialist,/open my workspace/i);
      await page.locator('.writer-layout').waitFor();
      await page.getByRole('heading',{name:/My private updates/}).waitFor();
      await noOverflow(page);
      await snapshot(page,'10-real-specialist-workspace');
    });
  }
}finally{await browser.close();}
if(reports.some(x=>!x.passed)){
  console.error('IPS_VISUAL_GOVERNANCE_FAILED '+JSON.stringify(reports.filter(x=>!x.passed)));
  process.exitCode=1;
}else console.log('IPS_VISUAL_GOVERNANCE_PUBLIC_PASS '+reports.length+
  ' visual cases, authenticated hosted cases '+(authenticated?'enabled':'not configured'));
