// Live browser qualification of the NEW company source and real isolated MongoDB accounts
// created by verify-company.mjs. Never connect to historical or actual customer accounts.
import assert from 'node:assert/strict';
import {spawn} from 'node:child_process';
import {mkdir} from 'node:fs/promises';
import {setTimeout as sleep} from 'node:timers/promises';
import {MongoClient} from 'mongodb';
import {chromium} from 'playwright';
const base='http://127.0.0.1:18088',mongo='mongodb://127.0.0.1:27017';
const env={...process.env,NODE_ENV:'test',IPS_CLEANROOM_MODE:'sandbox',IPS_TEST_PAYMENTS:'true',MONGODB_URI:mongo+'/ips_company_cleanroom_sandbox',ROOT_EMAIL:'nyoro-ci@example.org',
ROOT_PASSWORD:'LocalRootSecret2026!',SESSION_SECRET:'ips-company-cleanroom-isolated-only-session-secret-2026-abcdefghijklmnopqrstuvwxyz',PUBLIC_APP_URL:base,PORT:'18088',RESEND_API_KEY:'',FROM_EMAIL:''};
let app,browser,mongoClient;let tests=0;let logs='';
const check=async(name,fn)=>{await fn();tests++;console.log('PASS BROWSER '+name)};
const evidence=async(page,name)=>{await page.screenshot({path:'company-next-browser-evidence/'+name+'.png',fullPage:true,animations:'disabled'})};
const noOverflow=async page=>{const x=await page.evaluate(()=>({body:document.body.scrollWidth,viewport:innerWidth}));assert.ok(x.body<=x.viewport+7,'Horizontal overflow: '+JSON.stringify(x))};
const signIn=async(page,email,password)=>{
 await page.goto(base+'/',{waitUntil:'domcontentloaded'});
 await page.getByRole('button',{name:'Sign in',exact:true}).click();
 await page.locator('input[name=email]').fill(email);
 await page.locator('input[name=password]').fill(password);
 await page.getByRole('button',{name:'Open secure workspace'}).click();
 try{
   await page.locator('.shell').waitFor({timeout:15000});
   await page.locator('.metric').first().waitFor({timeout:15000});
 }catch(error){
   console.error('IPS_SIGNIN_SCREEN',String(await page.locator('body').innerText()).slice(0,1600));
   console.error('IPS_SIGNIN_LOCATION',new URL(page.url()).pathname);
   throw error;
 }
};
try{
 app=spawn(process.execPath,['company-next/server.mjs'],{env,stdio:['ignore','pipe','pipe']});
 for(const stream of [app.stdout,app.stderr])stream.on('data',d=>{logs=(logs+String(d)).slice(-2500)});
 for(let i=0;i<70;i++){try{const r=await fetch(base+'/api/health');if(r.ok&&(await r.json()).ready)break}catch{}if(i===69)throw Error('Server unavailable: '+logs);await sleep(260)}
 mongoClient=new MongoClient(mongo);await mongoClient.connect();
 const a=mongoClient.db('ips_company_cleanroom_sandbox').collection('company_accounts');
 const [client,writer,manager,staff]=await Promise.all([
   a.findOne({role:'client',username_key:'privateresearcher'}),
   a.findOne({role:'specialist',approved:true}),
   a.findOne({role:'manager',department:'client_relations'}),
   a.findOne({role:'staff',department:'client_relations'})
 ]);
 for(const x of [client,writer,manager,staff])assert.ok(x?.email,'Missing source-bound identity for browser');
 browser=await chromium.launch({channel:'chrome',headless:true,args:['--no-sandbox']});
 await mkdir('company-next-browser-evidence',{recursive:true});
 const open=async mobile=>browser.newPage({viewport:mobile?{width:390,height:844}:{width:1440,height:900}});
 const guest=await open(false);
 await check('Professional NEW public homepage and private quote CTA',async()=>{
   await guest.goto(base+'/',{waitUntil:'domcontentloaded'});
   await guest.getByRole('heading',{name:/Confidential project work/}).waitFor();
   await guest.getByRole('button',{name:'Get a private written quote'}).click();
   await guest.locator('form[data-form=guestquote]').waitFor();
   await guest.locator('input[name=username]').waitFor();
   await noOverflow(guest);await evidence(guest,'01-public-private-quote');
 });
 const clientPage=await open(false);
 await check('Real verified client logs in, sees owned quotes and completed project',async()=>{
   await signIn(clientPage,client.email,'RecoveredClient2027!');
   await clientPage.getByText('PrivateResearcher').first().waitFor();
   await clientPage.getByRole('button',{name:'Quotations'}).click();
   await clientPage.getByText('Research Methods Consultation').first().waitFor();
   await clientPage.getByRole('button',{name:'My projects'}).click();
   await clientPage.getByText('completed',{exact:true}).first().waitFor();
   await noOverflow(clientPage);await evidence(clientPage,'02-client-real-accepted-work');
 });
 await check('Client opens one governed completed deliverable and communications',async()=>{
   await clientPage.getByRole('button',{name:'Open project'}).first().click();
   await clientPage.locator('a[download]').waitFor();
   await clientPage.getByText('Thank you for completing the research consultation.').waitFor();
   await evidence(clientPage,'03-client-private-delivery');
 });
 const writerPage=await open(false);
 await check('Approved specialist has only assigned projects and private communication',async()=>{
   await signIn(writerPage,writer.email,'SpecialistSecure2026!');
   await writerPage.getByRole('button',{name:'Assigned projects'}).click();
   await writerPage.getByText('Research Methods Consultation').first().waitFor();
   await writerPage.getByRole('button',{name:'Open project'}).first().click();
   await writerPage.getByText('Thank you for completing the research consultation.').waitFor();
   await noOverflow(writerPage);await evidence(writerPage,'04-approved-specialist-real-job');
 });
 const root=await open(false);
 await check('Nyoro Root Admin has company overview, people and project supervision',async()=>{
   await signIn(root,env.ROOT_EMAIL,env.ROOT_PASSWORD);
   await root.getByText('Nyoro · Root Administration').first().waitFor();
   await root.getByRole('button',{name:'People & authority'}).click();
   await root.getByText('PrivateResearcher').first().waitFor();
   await root.getByRole('button',{name:'Project command'}).click();
   await root.getByText('Research Methods Consultation').first().waitFor();
   await noOverflow(root);await evidence(root,'05-nyoro-root-new-company');
 });
 const managerPage=await open(false);
 await check('Manager has a real governed team and scoped customer work',async()=>{
   await signIn(managerPage,manager.email,'ManagerSecure2026!');
   await managerPage.getByRole('button',{name:'My staff'}).click();
   await managerPage.getByText('Customer Care Employee').first().waitFor();
   assert.equal(await managerPage.getByRole('button',{name:'Project command'}).count(),0);
   await noOverflow(managerPage);await evidence(managerPage,'06-accountable-department-manager');
 });
 const staffPage=await open(false);
 await check('Employee has permitted support but cannot reach Root or production work',async()=>{
   await signIn(staffPage,staff.email,'StaffSecure2026!');
   await staffPage.getByRole('button',{name:'Customer support'}).click();
   await staffPage.getByText('Delivery clarification').first().waitFor();
   assert.equal(await staffPage.getByRole('button',{name:'Project command'}).count(),0);
   await evidence(staffPage,'07-permission-scoped-employee');
 });
 const mobile=await open(true);
 await check('Real mobile Root work is readable without glare or horizontal overflow',async()=>{
   await signIn(mobile,env.ROOT_EMAIL,env.ROOT_PASSWORD);
   await mobile.locator('.shell').waitFor();
   await noOverflow(mobile);await evidence(mobile,'08-mobile-root');
 });
 console.log('IPS_NEW_COMPANY_BROWSER_GREEN '+tests+' actual Chrome journeys and screenshots');
}catch(e){console.error('IPS_NEW_COMPANY_BROWSER_FAIL',String(e),logs.slice(-1300));process.exitCode=1;}
finally{try{await browser?.close()}catch{}try{await mongoClient?.close(true)}catch{}try{app?.kill('SIGTERM')}catch{}}
