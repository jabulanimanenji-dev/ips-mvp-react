import test from 'node:test';
import assert from 'node:assert/strict';
import {usernameValid,usernameKey,passwordValid,emailValid,validatePrivateQuote} from '../shared/privacyIdentity.js';
import {issueEmailChallenge,confirmEmailChallenge,publicAccount,verificationAvailable} from '../services/accountVerification.js';
import {quoteReferenceFromMessage,confirmQuoteMessengerContact} from '../services/quoteRequests.js';

const mailEnv={
  CONTACT_FROM_EMAIL:'support@ipsglobalservice.com',
  CONTACT_REPLY_TO_EMAIL:'contact@ipsglobalservice.com',
  CONTACT_RESEND_API_KEY:'ci-fake-no-real-email',
  EMAIL_VERIFICATION_SECRET:'ci-example-cryptographic-secret-32-chars-long'
};
const validQuote={
  username:'QuietResearcher',service:'research-methods',subject:'Nursing',
  message:'I would like professional support reviewing my research methods and study design.',
  preferred_channel:'email',email:'quietresearcher@example.org',contact_consent:true
};
const modelAccount=(email='quietresearcher@example.org')=>({
  email,email_verified_at:null,verification_attempts:0,
  async save(){this.saves=(this.saves||0)+1;}
});
test('student pseudonyms do not require legal names, remain unique case-insensitively',()=>{
  for(const x of ['QuietStudent','Researcher2026','A_bc','Private.Study','x-y'])assert.equal(usernameValid(x),true,x);
  for(const x of ['','a','Legal Name','@someone','admin','IPS','another/user'])assert.equal(usernameValid(x),false,x);
  assert.equal(usernameKey(' QuietResearcher '),'quietresearcher');
});
test('strong password rules include length, capital, number and symbol',()=>{
  assert.equal(passwordValid('CorrectPassword8!'),true);
  for(const value of ['Short1!','nouppercase9!','NoDigit@Here','NoSymbol9Here','',undefined])
    assert.equal(passwordValid(value),false,String(value));
});
test('email shape validation rejects bogus and non-deliverable test domains, but code proof is needed',()=>{
  assert.equal(emailValid('quietresearcher@example.org'),true);
  for(const x of ['someone@localhost','nobody@sample.invalid','user@test.example','bad@email','user@@example.org','not an email'])
    assert.equal(emailValid(x),false,x);
  assert.equal(verificationAvailable({}),false);
  assert.equal(verificationAvailable({...mailEnv,EMAIL_VERIFICATION_SECRET:'short'}),false);
  assert.equal(verificationAvailable(mailEnv),true);
});
test('private quotes are anonymous, written-only, and channel-specific',()=>{
  const ok=validatePrivateQuote(validQuote);
  assert.equal(ok.value.username,'QuietResearcher');
  assert.equal(ok.value.contact_verified,false);
  assert.equal(ok.value.verification_status,'awaiting_verification');
  assert.ok(validatePrivateQuote({...validQuote,contact_consent:false}).error);
  assert.ok(validatePrivateQuote({...validQuote,preferred_channel:'phone'}).error);
  assert.ok(validatePrivateQuote({...validQuote,preferred_channel:'signal'}).error);
  assert.ok(validatePrivateQuote({...validQuote,preferred_channel:'workspace'}).error);
  assert.equal(validatePrivateQuote({...validQuote,preferred_channel:'workspace',email:''},{signedIn:true}).value.contact_verified,true);
  assert.ok(validatePrivateQuote({...validQuote,preferred_channel:'telegram',email:'',telegram_username:''}).error);
  const telegram=validatePrivateQuote({...validQuote,preferred_channel:'telegram',email:'',telegram_username:'@QuietResearcher'}).value;
  assert.equal(telegram.telegram_username,'quietresearcher');
  assert.equal(telegram.contact_verified,false);
  assert.ok(validatePrivateQuote({...validQuote,preferred_channel:'whatsapp',email:'',phone:''}).error);
  assert.equal(validatePrivateQuote({...validQuote,preferred_channel:'whatsapp',email:'',phone:'+48123456789'}).value.email,'');
});
test('email ownership challenge is hashed, expiring and single-use',async()=>{
  const account=modelAccount(),codes=[];
  const at=new Date('2026-11-18T12:00:00.000Z');
  const send=async args=>{codes.push(args);return 'fake-email-id';};
  const issued=await issueEmailChallenge(account,{env:mailEnv,send,now:()=>at,codeFactory:()=>'12345678'});
  assert.equal(issued.verification_required,true);
  assert.equal(codes.length,1);
  assert.ok(codes[0].body.includes('12345678'));
  assert.ok(!JSON.stringify(account).includes('12345678'));
  assert.ok(account.verification_hash&&account.verification_hash.length===64);
  assert.equal((await confirmEmailChallenge(account,'99999999',{env:mailEnv,now:()=>at})).status,400);
  assert.equal(account.verification_attempts,1);
  const verified=await confirmEmailChallenge(account,'12345678',{env:mailEnv,now:()=>at});
  assert.equal(verified.success,true);
  assert.ok(account.email_verified_at);
  assert.equal(account.verification_hash,undefined);
  assert.equal((await confirmEmailChallenge(account,'12345678',{env:mailEnv,now:()=>at})).status,400);
  assert.equal(account.saves>=3,true);
});
test('verification links expire and provider failures cannot activate a mailbox',async()=>{
  const at=new Date('2026-11-18T12:00:00.000Z');
  const account=modelAccount();
  await issueEmailChallenge(account,{env:mailEnv,send:async()=> 'mock-provider',now:()=>at,codeFactory:()=>'12345678'});
  assert.equal((await confirmEmailChallenge(account,'12345678',{env:mailEnv,now:()=>new Date(at.getTime()+16*60000)})).status,400);
  const unavailable=modelAccount('contact@example.org');
  await assert.rejects(issueEmailChallenge(unavailable,{env:mailEnv,send:async()=>{throw Error('provider unavailable');},now:()=>at,codeFactory:()=>'33333333'}),/could not be sent/);
  assert.equal(unavailable.email_verified_at,null);
  assert.equal(unavailable.verification_hash,undefined);
});
test('masked public account never includes password or verification material',()=>{
  const output=publicAccount({username:'QuietResearcher',email:'quietresearcher@example.org',password:'secret',
    verification_hash:'digest',verification_attempts:2,notes:'private'});
  assert.equal(output.username,'QuietResearcher');
  assert.equal(output.password,undefined);
  assert.equal(output.verification_hash,undefined);
  assert.equal(output.notes,undefined);
});
test('signed messenger reference must match the exact customer-selected channel identity',async()=>{
  const quote='IPS-Q-ABCDEF0123456789AB';
  assert.equal(quoteReferenceFromMessage('Hello, '+quote),quote);
  assert.equal(quoteReferenceFromMessage('No reference'),null);
  const calls=[];
  const model={updateOne:async(filter,update)=>{calls.push({filter,update});return {modifiedCount:1};}};
  assert.equal(await confirmQuoteMessengerContact({channel:'telegram',body:quote,telegram_username:'quietresearcher',external_id:'12345'},{model}),true);
  assert.equal(calls[0].filter.telegram_username,'quietresearcher');
  assert.equal(calls[0].filter.preferred_channel,'telegram');
  assert.equal(await confirmQuoteMessengerContact({channel:'telegram',body:quote,telegram_username:'',external_id:'12345'},{model}),false);
  assert.equal(await confirmQuoteMessengerContact({channel:'email',body:quote},{model}),false);
  assert.equal(await confirmQuoteMessengerContact({channel:'whatsapp',body:quote,external_id:'48123456789'},{model}),true);
  assert.equal(calls[1].filter.phone,'+48123456789');
});
