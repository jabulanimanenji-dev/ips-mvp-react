// Actual browser acceptance of PUBLIC REVIEW deployment, not a local mock.
// Only fictional records are accessed; never logs passwords or real customer data.
import assert from 'node:assert/strict';
import {chromium} from 'playwright';
import {mkdir} from 'node:fs/promises';
import {setTimeout as sleep} from 'node:timers/promises';
import {EVAL_REVIEW_URL,DEMO_ROLES} from '../src/review-access-gate.mjs';
const origin=EVAL_REVIEW_URL;
const output='academic-browser-evidence/review-workspaces';
let browser;
try{
 const duration=9*60*1000,deadline=Date.now()+duration;
 let ready=false,reason='';
 while(Date.now()<deadline){
  try{
   const [health,roles]=await Promise.all([
    fetch(origin+'/api/health',{signal:AbortSignal.timeout(20000)}),
    fetch(origin+'/api/review/roles',{signal:AbortSignal.timeout(20000)})
   ]);
   if(health.status===200&&roles.status===200){
    const h=await health.json(),r=await roles.json();
    assert.equal(h.environment,'ISOLATED_ACADEMIC_REVIEW');
    assert.equal(h.payments,'integration-pending');
    assert.equal(r.fictionalOnly,true);
    assert.equal(r.roles.length,5);
    assert.deepEqual(r.roles.map(x=>x.role),DEMO_ROLES.map(x=>x.role));
    ready=true;break;
   }
   reason='Health '+health.status+', review roles '+roles.status;
  }catch(e){reason=String(e).slice(0,180)}
  await sleep(4000);
 }
 assert.ok(ready,'Live fictional review was not accessible: '+reason);
 browser=await chromium.launch({channel:'chrome',headless:true,args:['--no-sandbox']});
 await mkdir(output,{recursive:true});
 const page=await browser.newPage({viewport:{width:1450,height:970}});
 await page.goto(origin+'/',{waitUntil:'domcontentloaded'});
 await page.locator('.review-entry-role').first().waitFor({timeout:30000});
 assert.equal(await page.locator('.review-entry-role').count(),5);
 let i=0;
 for(const {role,label} of DEMO_ROLES){
  const choice=page.locator('.review-entry-role[data-id="'+role+'"]');
  if(i){await page.getByRole('button',{name:'Switch review workspace'}).click();await choice.waitFor()}
  await choice.click();
  await page.locator('.workspace').waitFor({timeout:18000});
  const result=await page.evaluate(async()=>{const r=await fetch('/api/session');return {status:r.status,data:await r.json()}});
  assert.equal(result.status,200,'Session not created for '+role);
  assert.equal(result.data.account.role,role,'Incorrect actual workroom actor for '+role);
  assert.equal(await page.locator('.sidebar').count(),1,'Real IPS workspace UI missing for '+role);
  assert.equal(await page.locator('.review-entry-role').count(),0,'Chooser should not obscure entered workroom');
  if(role==='root'){
   await page.locator('.sidebar').getByRole('button',{name:'Students',exact:true}).click();
   await page.locator('table.directory-table').waitFor({timeout:15000});
   await page.locator('.sidebar').getByRole('button',{name:'Specialists',exact:true}).click();
   await page.locator('table.directory-table').waitFor({timeout:15000});
  }
  await page.screenshot({path:output+'/'+String(++i).padStart(2,'0')+'-'+role+'.png',
   fullPage:true,animations:'disabled'});
  console.log('IPS_LIVE_ROLE_REVIEW_PASS '+role+' — '+label+', authenticated real workroom');
 }
 await page.setViewportSize({width:390,height:850});
 await page.getByRole('button',{name:'Switch review workspace'}).click();
 const overflow=await page.evaluate(()=>document.documentElement.scrollWidth-innerWidth);
 assert.ok(overflow<=7,'Review chooser must fit mobile viewport (overflow '+overflow+')');
 await page.screenshot({path:output+'/06-mobile-switcher.png',fullPage:true});
 console.log('IPS_LIVE_REVIEW_FIVE_ROLES_GREEN; functioning source, genuine sessions and responsive role switcher verified against deployed free IPS.');
}catch(err){
 console.error('IPS_LIVE_REVIEW_ROLE_ACCESS_FAIL',err?.stack||String(err));
 process.exitCode=1;
}finally{try{await browser?.close()}catch{}}
