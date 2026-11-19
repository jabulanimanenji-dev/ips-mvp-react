import assert from 'node:assert/strict';
import {mkdir} from 'node:fs/promises';
import {chromium} from 'playwright';

// Strictly bound to the isolated CI container or to the separately hosted
// disposable IPS evaluation site; never run synthetic test logins in production.
const base=String(process.env.IPS_VISUAL_BASE_URL||'').replace(/\/$/,'');
if(!['http://127.0.0.1:18080','https://ips-academic-evaluation-20261119.onrender.com'].includes(base))
  throw Error('Visual review may only target the isolated IPS test environment.');
await mkdir('ips-brand-evidence',{recursive:true});
const browser=await chromium.launch({channel:'chrome',headless:true,args:['--no-sandbox']});
const reports=[];
function luminance(rgb){
  const values=rgb.match(/[\d.]+/g)?.slice(0,3).map(v=>Number(v)/255);
  if(values?.length!==3||values.some(v=>!Number.isFinite(v)))throw Error('Invalid color '+rgb);
  const channels=values.map(v=>v<=.04045?v/12.92:((v+.055)/1.055)**2.4);
  return .2126*channels[0]+.7152*channels[1]+.0722*channels[2];
}
function contrast(a,b){
  const l=luminance(a),r=luminance(b);
  return (Math.max(l,r)+.05)/(Math.min(l,r)+.05);
}
async function caseCheck(name,fn){
  try{await fn();reports.push({name,passed:true});console.log('PASS '+name);}
  catch(e){reports.push({name,passed:false,error:String(e)});console.error('FAIL '+name+' '+String(e));}
}
async function newPage(width=1440,height=900){
  const page=await browser.newPage({viewport:{width,height},deviceScaleFactor:1});
  page.setDefaultTimeout(18000);
  return page;
}
async function login(page,route,email,password,button){
  await page.goto(base+route,{waitUntil:'domcontentloaded'});
  await page.locator('input[type=email]').fill(email);
  await page.locator('input[type=password]').fill(password);
  await page.getByRole('button',{name:button}).click();
}
async function inspect(page,locator,foreground='color',background='backgroundColor'){
  return locator.evaluate((el,{foreground,background})=>{
    const text=getComputedStyle(el);
    const parent=getComputedStyle(el.parentElement);
    return {fg:text[foreground],bg:text[background],fallbackBg:parent[background]};
  },{foreground,background});
}
async function picture(page,name){await page.screenshot({path:'ips-brand-evidence/'+name+'.png',fullPage:true,animations:'disabled'});}
async function noHorizontalOverflow(page){
  const overflow=await page.evaluate(()=>({
    width:window.innerWidth,body:document.body.scrollWidth,html:document.documentElement.scrollWidth
  }));
  assert.ok(overflow.body<=overflow.width+5&&overflow.html<=overflow.width+5,
    'Unexpected page overflow '+JSON.stringify(overflow));
}
try{
  await caseCheck('Public academic homepage uses the IPS navy/ivory identity without overflow',async()=>{
    const page=await newPage();
    try{
      await page.goto(base+'/',{waitUntil:'domcontentloaded'});
      await page.locator('.ipsa-hero').waitFor();
      await noHorizontalOverflow(page);
      const root=await page.evaluate(()=>({
        brand:getComputedStyle(document.documentElement).getPropertyValue('--primary').trim(),
        c:getComputedStyle(document.querySelector('.ipsa-hero')).backgroundColor
      }));
      assert.equal(root.brand.toLowerCase(),'#183b53');
      assert.notEqual(root.c,'rgba(0, 0, 0, 0)');
      await picture(page,'01-academic-public-website');
    }finally{await page.close();}
  });
  await caseCheck('Client portal renders a private readable workspace and matching navigation',async()=>{
    const page=await newPage();
    try{
      await login(page,'/login','client.evaluation@example.org','EvalClient2026!',/open my workspace/i);
      await page.waitForURL(/\/client\//);
      await page.locator('.client-layout .ips-workspace-topbar').waitFor();
      await page.locator('.client-sidebar').waitFor();
      const bg=await page.locator('.client-sidebar').evaluate(el=>getComputedStyle(el).backgroundColor);
      assert.equal(bg,'rgb(20, 43, 61)');
      assert.ok(await page.getByText('Private · written communication').count()>=1);
      await noHorizontalOverflow(page);
      await picture(page,'02-client-overview');
      await page.goto(base+'/client/payments',{waitUntil:'domcontentloaded'});
      await page.getByText('My Payments & Refunds').first().waitFor();
      await picture(page,'03-client-payments');
    }finally{await page.close();}
  });
  await caseCheck('Approved specialist uses identical professional sidebar and accessible private header',async()=>{
    const page=await newPage();
    try{
      await login(page,'/writer/login','specialist.evaluation@example.org','EvalSpecialist2026!',/open my workspace/i);
      await page.waitForURL(/\/writer\/dashboard(?:[/?#]|$)/,{timeout:20000});
      await page.goto(base+'/writer/dashboard',{waitUntil:'domcontentloaded'});
      await page.locator('.writer-layout .ips-workspace-topbar').waitFor();
      const bg=await page.locator('.writer-sidebar').evaluate(el=>getComputedStyle(el).backgroundColor);
      assert.equal(bg,'rgb(20, 43, 61)');
      await noHorizontalOverflow(page);
      await picture(page,'04-specialist-dashboard');
      await page.goto(base+'/writer/earnings',{waitUntil:'domcontentloaded'});
      await page.getByText('My Payment Records').first().waitFor();
      await picture(page,'05-specialist-payments');
    }finally{await page.close();}
  });
  await caseCheck('Management Studio replaces washed-out magenta panels with WCAG AA readable surfaces',async()=>{
    const page=await newPage();
    try{
      await login(page,'/ips-evaluation-ops','admin.evaluation@example.org','EvalAdmin2026!','Sign In');
      await page.waitForURL(/\/admin\//,{timeout:20000});
      await page.goto(base+'/admin/cms',{waitUntil:'domcontentloaded'});
      await page.locator('.platform-studio-dashboard').waitFor({timeout:20000});
      const welcome=page.locator('.platform-studio-welcome').first();
      const cards=page.locator('.platform-studio-kpis button');
      assert.ok(await cards.count()>=3,'Missing IPS website management metrics');
      const bg=await welcome.evaluate(el=>getComputedStyle(el).backgroundColor);
      assert.equal(bg,'rgb(255, 255, 255)','Studio overview is no longer an opaque violet overlay');
      const stat=await inspect(page,cards.first());
      assert.equal(stat.bg,'rgb(255, 255, 255)');
      assert.ok(contrast(stat.fg,stat.bg)>=4.5,
        'Studio information must meet accessible contrast, got '+contrast(stat.fg,stat.bg).toFixed(2));
      const muted=await inspect(page,cards.first().locator('small').first());
      assert.ok(contrast(muted.fg,stat.bg)>=4.5,
        'Studio metric label contrast must meet 4.5:1; got '+contrast(muted.fg,stat.bg).toFixed(2));
      await noHorizontalOverflow(page);
      await picture(page,'06-management-studio');
      await page.goto(base+'/admin/dashboard',{waitUntil:'domcontentloaded'});
      await page.locator('.ips-metric-card').first().waitFor();
      assert.ok(await page.locator('.ips-metric-card').count()>=4);
      await picture(page,'07-management-dashboard');
      await page.goto(base+'/admin/enquiries',{waitUntil:'domcontentloaded'});
      await page.locator('.ips-contact-admin').waitFor();
      await picture(page,'08-management-quotation-queue');
    }finally{await page.close();}
  });
  await caseCheck('Client and management continue to use accessible dark mode when explicitly selected',async()=>{
    const page=await newPage();
    try{
      await login(page,'/ips-evaluation-ops','admin.evaluation@example.org','EvalAdmin2026!','Sign In');
      await page.waitForURL(/\/admin\//,{timeout:20000});
      await page.goto(base+'/admin/cms',{waitUntil:'domcontentloaded'});
      await page.locator('.platform-studio-kpis button').first().waitFor();
      await page.evaluate(()=>document.documentElement.setAttribute('data-theme','dark'));
      const card=page.locator('.platform-studio-kpis button').first();
      const {bg,fg}=await inspect(page,card);
      assert.ok(contrast(bg,fg)>=4.5,'Dark mode management metric must remain legible');
      await picture(page,'09-management-dark-mode');
    }finally{await page.close();}
  });
  await caseCheck('Evaluation environment safety label no longer obscures mobile workspace',async()=>{
    const page=await newPage(390,844);
    try{
      await page.goto(base+'/evaluation',{waitUntil:'domcontentloaded'});
      await page.locator('.ips-evaluation-banner').waitFor();
      const style=await page.locator('.ips-evaluation-banner').evaluate(el=>{
        const s=getComputedStyle(el);
        return {position:s.position,top:s.top,height:el.getBoundingClientRect().height};
      });
      assert.equal(style.position,'sticky');
      assert.ok(style.height<96,'Safety banner must stay compact on mobile');
      await noHorizontalOverflow(page);
      await picture(page,'10-mobile-evaluation-guide');
      await login(page,'/login','client.evaluation@example.org','EvalClient2026!',/open my workspace/i);
      await page.locator('.client-layout').waitFor();
      await noHorizontalOverflow(page);
      await picture(page,'11-mobile-client-workspace');
    }finally{await page.close();}
  });
}finally{await browser.close();}
const failures=reports.filter(r=>!r.passed);
if(failures.length){
  console.error('IPS_VISUAL_GOVERNANCE_FAILED '+JSON.stringify(failures));
  process.exitCode=1;
}else console.log('IPS_VISUAL_GOVERNANCE_PASS '+reports.length+' independent browser and contrast checks');
