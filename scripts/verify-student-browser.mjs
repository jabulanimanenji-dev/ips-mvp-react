import { chromium } from 'playwright';
import assert from 'node:assert/strict';
import { mkdir } from 'node:fs/promises';

const base = process.env.BROWSER_BASE_URL || 'http://127.0.0.1:4173';
const browser = await chromium.launch({ channel: 'chrome', headless: true, args: ['--no-sandbox'] });
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
  await desktop.evaluate(async () => { const images = [...document.querySelectorAll('.ipsa img')]; images.forEach(img => { img.loading = 'eager'; }); await Promise.all(images.map(img => img.decode().catch(() => {}))); });
  await desktop.screenshot({path:'browser-evidence/desktop-home.png', fullPage:true, animations:'disabled'});

  await caseRun('hero and editorial photography', async () => {
    assert.equal(await desktop.locator('.ipsa-hero img').count(),1);
    assert.ok((await desktop.locator('.ipsa-hero img').getAttribute('src')).includes('images.unsplash.com'));
    assert.equal(await desktop.locator('.ipsa-site-header').count(),1);
    assert.equal(await desktop.locator('.ipsa-footer').count(),1);
  });
  await caseRun('WhatsApp and Telegram links show with accurate backend limitations', async () => {
    assert.equal(await desktop.locator('.ipsa-contact-link[href="https://wa.me/48794088714"]').count(),1);
    assert.equal(await desktop.locator('.ipsa-contact-link[href="mailto:contact@ipsglobalservice.com"]').count(),1);
    assert.equal(await desktop.locator('.ipsa-contact-link[href="https://t.me/IPScontactBot"]').count(),1);
    assert.ok(await desktop.getByText(/Telegram @IPScontactBot can be opened/i).isVisible());
  });
  await caseRun('guest callback form is available without an account and preview never fakes saved lead', async()=>{
    const form=desktop.locator('.ipsa-enquiry-form');
    assert.equal(await form.count(),1);
    await form.locator('input[autocomplete="name"]').fill('Visitor Test');
    await form.locator('input[type="email"]').fill('visitor@example.org');
    await form.locator('input[placeholder="What would you like help with?"]').fill('Research planning question');
    await form.locator('textarea').fill('Please contact me about research planning consultations.');
    await form.locator('input[type="checkbox"]').check();
    await form.getByRole('button',{name:/Prepare email to IPS/i}).click();
    const emailLink=form.locator('.ipsa-enquiry-fallback a[href^="mailto:contact@ipsglobalservice.com?subject="]');
    assert.equal(await emailLink.count(),1);
    const emailHref=await emailLink.getAttribute('href');
    assert.ok(decodeURIComponent(emailHref).includes('Visitor Test'));
    assert.ok(decodeURIComponent(emailHref).includes('Research planning question'));
    assert.ok(await form.getByText(/does not send or save the message automatically/i).isVisible());

    await form.locator('select').selectOption('whatsapp');
    await form.locator('input[type="tel"]').fill('+48794088714');
    await form.getByRole('button',{name:/Prepare WhatsApp message/i}).click();
    const link=form.locator('.ipsa-enquiry-fallback a[href^="https://wa.me/48794088714?text="]');
    assert.equal(await link.count(),1);
    const message=new URL(await link.getAttribute('href')).searchParams.get('text');
    assert.ok(message.includes('Visitor Test')&&message.includes('Research planning question'));
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
    assert.ok(await desktop.getByText('Review the proposed order experience').isVisible());
  });
  await caseRun('functional FAQ and subject navigation', async () => {
    await desktop.locator('.ipsa-faq summary').first().click();
    assert.ok(await desktop.locator('.ipsa-faq details').first().getAttribute('open') !== null);
    await desktop.getByRole('button',{name:'Nursing & Health Sciences'}).click();
    assert.ok(await desktop.locator('#request-support').isVisible());
  });
  await caseRun('secondary entry pages share IPS academic interior design',async()=>{
    const pages=[
      ['/login',/Sign in to request support/i,'client-login'],
      ['/signup',/Create your IPS account/i,'client-signup'],
      ['/writer/login',/Sign in to work with IPS/i,'provider-login']
    ];
    for(const [route,formLabel,suffix] of pages){
      await desktop.goto(base+route,{waitUntil:'domcontentloaded'});
      await desktop.locator('.ipsa-auth-shell').waitFor();
      assert.equal(await desktop.locator('.ipsa-auth-aside').count(),1);
      assert.equal(await desktop.locator('.ipsa-auth .ipsa-auth-field').count(),route==='/signup'?3:2);
      assert.equal(await desktop.getByRole('form',{name:formLabel}).count(),1);
      assert.ok(await desktop.locator('body').evaluate(el=>el.scrollWidth<=window.innerWidth+2));
      assert.equal(await desktop.locator('.ipsa-auth-submit').count(),1);
      assert.ok(await desktop.getByText(/Website design preview: account access is not active here/i).isVisible());
      await desktop.screenshot({path:'browser-evidence/'+suffix+'-desktop.png',fullPage:true,animations:'disabled'});
    }
    await desktop.goto(base+'/login',{waitUntil:'domcontentloaded'});
    assert.equal(await desktop.getByRole('navigation',{name:'Choose account type'}).getByText('Seeking support').count(),1);
    assert.equal(await desktop.getByRole('navigation',{name:'Choose account type'}).getByText('Working with IPS').count(),1);
    await desktop.goto(base+'/writer/login',{waitUntil:'domcontentloaded'});
    assert.equal(await desktop.getByRole('navigation',{name:'Choose account type'}).getByText('Seeking support').count(),1);
    assert.equal(await desktop.getByRole('navigation',{name:'Choose account type'}).getByText('Working with IPS').count(),1);
    await desktop.goto(base+'/join',{waitUntil:'domcontentloaded'});
    assert.equal(await desktop.locator('.ipsa-journey-card').count(),2);
    assert.ok(await desktop.getByText('I need academic support').isVisible());
    assert.ok(await desktop.getByText('I’d like to work with IPS').isVisible());
    assert.equal(await desktop.locator('.ipsa-interior-header').count(),1);
    assert.ok(await desktop.locator('body').evaluate(el=>el.scrollWidth<=window.innerWidth+2));
    await desktop.screenshot({path:'browser-evidence/choose-account-desktop.png',fullPage:true,animations:'disabled'});
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
  await mobile.evaluate(async () => { const images = [...document.querySelectorAll('.ipsa img')]; images.forEach(img => { img.loading = 'eager'; }); await Promise.all(images.map(img => img.decode().catch(() => {}))); });
  await mobile.screenshot({path:'browser-evidence/mobile-home.png',fullPage:true,animations:'disabled'});
  await caseRun('responsive student entry pages fit small viewports without clipped forms',async()=>{
    for(const route of ['/login','/signup','/writer/login','/join']){
      await mobile.goto(base+route,{waitUntil:'domcontentloaded'});
      await mobile.locator(route==='/join'?'.ipsa-journeys':'.ipsa-auth-shell').waitFor();
      assert.ok(await mobile.locator('body').evaluate(el=>el.scrollWidth<=window.innerWidth+2),route+' horizontal overflow');
      if(route!=='/join'){
        assert.ok(await mobile.locator('.ipsa-auth-field').last().isVisible());
        assert.equal(await mobile.locator('.ipsa-auth-aside').isVisible(),false);
      }
    }
    await mobile.goto(base+'/login',{waitUntil:'domcontentloaded'});
    await mobile.screenshot({path:'browser-evidence/client-login-mobile.png',fullPage:true,animations:'disabled'});
  });
  // image failures are evidence to investigate; external CDN availability may vary by environment.
  const imageState=await desktop.locator('.ipsa img').evaluateAll(images=>images.map(img=>({src:img.currentSrc,loaded:img.complete&&img.naturalWidth>0})));
  console.log('IMAGE_STATUS '+JSON.stringify(imageState));
  console.log('BROWSER_WARNINGS '+JSON.stringify(warnings.slice(0,15)));
  await desktop.close();await mobile.close();
} finally { await browser.close(); }
if(failures.length){console.error('BROWSER_FAILING_CASES '+JSON.stringify(failures));process.exitCode=1;}
else console.log('Student academic storefront browser interaction checks passed.');
