import test from 'node:test';
import assert from 'node:assert/strict';
import {qualifyCompanyTelegramWebhook} from '../services/telegramLaunch.js';

const env = {
  NODE_ENV: 'production',
  IPS_PUBLICATION_STRICT: 'true',
  PUBLIC_APP_URL: 'https://www.ipsglobalservice.com',
  TELEGRAM_BOT_USERNAME: 'IPScontactBot',
  TELEGRAM_BOT_TOKEN: '123456789:exampleCIOnlyToken0000000000000000',
  TELEGRAM_WEBHOOK_SECRET: 'ci_only_telegram_secret_20261120'
};
const callback = 'https://www.ipsglobalservice.com/api/channels/telegram/webhook';

function response(result, ok = true, status = 200) {
  return {ok, status, json: async()=>({ok, result})};
}
function fakeProvider({otherWebhook = '', wrongBot = false, rejectMethod = ''} = {}) {
  const calls = [];
  let url = otherWebhook;
  return {
    calls,
    request: async (address,options) => {
      const method = address.split('/').at(-1);
      calls.push({method,address,options});
      if (rejectMethod === method) return response(null,false,401);
      switch (method) {
        case 'getMe':
          return response({is_bot:true,username:wrongBot?'OtherBot':'IPScontactBot'});
        case 'getWebhookInfo':
          return response({url});
        case 'setWebhook':{
          const data=JSON.parse(options.body);
          assert.equal(data.url,callback);
          assert.equal(data.secret_token,env.TELEGRAM_WEBHOOK_SECRET);
          assert.deepEqual(data.allowed_updates,['message']);
          assert.equal(data.drop_pending_updates,false);
          assert.equal(data.max_connections,5);
          url=data.url;
          return response(true);
        }
        default:throw Error('Unexpected Telegram method');
      }
    }
  };
}
test('strict release authenticates actual BotFather bot and registers signed company callback',async()=>{
  const provider=fakeProvider();
  const result=await qualifyCompanyTelegramWebhook({env,request:provider.request});
  assert.deepEqual(result,{connected:true,bot:'IPScontactBot',webhook_url:callback});
  assert.deepEqual(provider.calls.map(c=>c.method),
    ['getMe','getWebhookInfo','setWebhook','getWebhookInfo']);
  assert.equal(provider.calls.every(c=>c.options.method==='POST'),true);
  assert.equal(provider.calls.every(c=>c.address.startsWith('https://api.telegram.org/bot')),true);
  assert.equal(JSON.stringify(result).includes(env.TELEGRAM_BOT_TOKEN),false);
  assert.equal(JSON.stringify(result).includes(env.TELEGRAM_WEBHOOK_SECRET),false);
});
test('strict release does not take over a webhook already serving another system',async()=>{
  const provider=fakeProvider({otherWebhook:'https://elsewhere.example/telegram'});
  await assert.rejects(qualifyCompanyTelegramWebhook({env,request:provider.request}),
    /different webhook/);
  assert.deepEqual(provider.calls.map(c=>c.method),['getMe','getWebhookInfo']);
});
test('reused company webhook receives the current secret again without dropping updates',async()=>{
  const provider=fakeProvider({otherWebhook:callback});
  assert.equal((await qualifyCompanyTelegramWebhook({env,request:provider.request})).connected,true);
  assert.equal(provider.calls.some(c=>c.method==='setWebhook'),true);
});
test('invalid bot token, stale bot, rejected provider and unsupported secret fail closed',async()=>{
  await assert.rejects(qualifyCompanyTelegramWebhook({env:{...env,TELEGRAM_BOT_TOKEN:'abc'},request:fakeProvider().request}),/token/);
  await assert.rejects(qualifyCompanyTelegramWebhook({env:{...env,TELEGRAM_WEBHOOK_SECRET:'bad!secret'},request:fakeProvider().request}),/webhook secret/);
  await assert.rejects(qualifyCompanyTelegramWebhook({env:{...env,PUBLIC_APP_URL:'https://evil.example'},request:fakeProvider().request}),/company HTTPS/);
  await assert.rejects(qualifyCompanyTelegramWebhook({env,request:fakeProvider({wrongBot:true}).request}),/does not belong/);
  await assert.rejects(qualifyCompanyTelegramWebhook({env,request:fakeProvider({rejectMethod:'setWebhook'}).request}),/provider rejected/);
  await assert.rejects(qualifyCompanyTelegramWebhook({env,request:async()=>{throw Error('network failure')} }),/provider did not respond/);
});
test('development and isolated evaluation cannot register a Telegram webhook',async()=>{
  const never=async()=>{throw Error('Forbidden network access')};
  assert.deepEqual(await qualifyCompanyTelegramWebhook({env:{...env,NODE_ENV:'development'},request:never}),{skipped:true});
  assert.deepEqual(await qualifyCompanyTelegramWebhook({env:{...env,IPS_EVALUATION_MODE:'true'},request:never}),{skipped:true});
  assert.deepEqual(await qualifyCompanyTelegramWebhook({env:{...env,IPS_PUBLICATION_STRICT:'false'},request:never}),{skipped:true});
});
