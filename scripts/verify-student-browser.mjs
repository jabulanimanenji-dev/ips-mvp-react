import { chromium } from 'playwright';
import assert from 'node:assert/strict';
import { mkdir } from 'node:fs/promises';

const base = process.env.BROWSER_BASE_URL || 'http://127.0.0.1:4173';
const browser = await chromium.launch({ headless: true, args: ['--no-sandbox'] });
const failures = [];
let warnings = [];
await mkdir('browser-evidence', {recursive:true});

async function caseRun(name, task) {
  try { await task(); console.log('PASS ' + name); }
  catch (error) { failures.push({name,error:String(error)}); console.error('FAIL ' + name + ' => ' + error); }
}

try {
  const desktop = await browser.newPage({ viewport: { width: 1440, height: 900 }, deviceScaleFactor: 1 });
  desktop.on('console', msg => { if (msg.type()==='error') warnings.push('desktop console: ' + msg.text()); });
  await desktop.goto(base, { waitUntil:'domcontentloaded', timeout:30000 });
  await desktop.getByRole('heading', { name: /Exceptional academic work starts/i }).waitFor({timeout:15000});
  await desktop.screenshot({path:'browser-evidence/desktop-home.png', fullPage:true, animations:'disabled'});

  await caseRun('hero and editorial photography', async () => {
    assert.equal(await desktop.locator('.ipsa-hero img').count(),1);
    assert.ok((await desktop.locator('.ipsa-hero img').getAttribute('src')).includes('images.unsplash.com'));
    assert.equal(await desktop.locator('.ipsa-site-header').count(),1);
    assert.equal(await desktop.locator('.ipsa-footer').count(),1);
  });
  await caseRun('six category filters and sixteen service products', async () => {
    assert.equal(await desktop.locator('.ipsa-tabs button').count(),6);
    assert.equal(await desktop.locator('.ipsa-service-card').count(),16);
    await desktop.getByRole('button',{name:'Methods & data',exact:true}).click();
    assert.ok(await desktop.locator('.ipsa-service-card').count() > 0);
    assert.ok(await desktop.locator('.ipsa-service-card').count() < 16);
    await desktop.getByRole('button',{name:'All services',exact:true}).click();
    assert.equal(await desktop.locator('.ipsa-service-card').count(),16);
  });
  await caseRun('live text search and clear', async () => {
    await desktop.getByRole('searchbox',{name:'Search services'}).fill('Viva');
    assert.equal(await desktop.locator('.ipsa-service-card').count(),1);
    await desktop.getByRole('searchbox',{name:'Search services'}).fill('not-a-real-offer-987');
    assert.equal(await desktop.getByText('No exact matches').count(),1);
    await desktop.getByRole('button',{name:'Show all services'}).click();
    assert.equal(await desktop.locator('.ipsa-service-card').count(),16);
  });
  await caseRun('service selection changes enquiry without inventing paid checkout', async () => {
    await desktop.getByRole('button',{name:'Request Statistics & SPSS / R / Python'}).click();
    assert.ok(desktop.url().includes('service=statistics-support'));
    assert.ok(await desktop.locator('.ipsa-login-prompt').isVisible());
    assert.equal(await desktop.getByRole('link',{name:/Create an account/}).count()>=1,true);
  });
  await caseRun('functional FAQ and subject navigation', async () => {
    await desktop.locator('.ipsa-faq summary').first().click();
    assert.ok(await desktop.locator('.ipsa-faq details').first().getAttribute('open') !== null);
    await desktop.getByRole('button',{name:'Nursing & Health Sciences'}).click();
    assert.ok(await desktop.locator('#request-support').isVisible());
  });
  const mobile = await browser.newPage({viewport:{width:390,height:844},deviceScaleFactor:1,isMobile:true,hasTouch:true});
  mobile.on('console', msg => { if(msg.type()==='error') warnings.push('mobile console: '+msg.text()); });
  await mobile.goto(base,{waitUntil:'domcontentloaded',timeout:30000});
  await mobile.getByRole('heading',{name:/Exceptional academic work starts/i}).waitFor({timeout:15000});
  await caseRun('mobile menu and no horizontal overflow',async()=>{
    const nav=mobile.getByRole('button',{name:'Open navigation'});
    await nav.click();
    assert.ok(await mobile.getByRole('navigation',{name:'Primary navigation'}).getByText('Academic services').isVisible());
    assert.ok(await mobile.locator('body').evaluate(n=>n.scrollWidth<=window.innerWidth+2));
  });
  await mobile.getByRole('button',{name:'Close navigation'}).click();
  await mobile.screenshot({path:'browser-evidence/mobile-home.png',fullPage:true,animations:'disabled'});
  // image failures are evidence to investigate; external CDN availability may vary by environment.
  const imageState=await desktop.locator('.ipsa img').evaluateAll(images=>images.map(img=>({src:img.currentSrc,loaded:img.complete&&img.naturalWidth>0})));
  console.log('IMAGE_STATUS '+JSON.stringify(imageState));
  console.log('BROWSER_WARNINGS '+JSON.stringify(warnings.slice(0,15)));
  await desktop.close();await mobile.close();
} finally { await browser.close(); }
if(failures.length){console.error('BROWSER_FAILING_CASES '+JSON.stringify(failures));process.exitCode=1;}
else console.log('Student academic storefront browser interaction checks passed.');
