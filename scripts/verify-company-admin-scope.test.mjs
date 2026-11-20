import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {deliverExternalMessage} from '../services/contactChannels.js';
import {
  IPS_COMPANY_ADMIN_NAV,isIpsQaFixtureEmail,isIpsQaFixtureAdmin,isIpsQaFixtureClient
} from '../shared/ipsCompanyScope.js';
import {
  canReplyToPublicTelegramSupport,isSubstantiveTelegramInbound,safePublicSupportReply,
  TELEGRAM_GENERAL_SUPPORT_WINDOW_MS
} from '../services/telegramSupportPolicy.js';

const now=Date.UTC(2026,10,20,16,30);
const telegram={channel:'telegram',status:'open'};
const inbound={body:'IPS production test — checking that messages reach IPS administration.',createdAt:new Date(now-120000)};
test('IPS admin navigation excludes imported platform/marketplace controls',async()=>{
  const paths=IPS_COMPANY_ADMIN_NAV.map(x=>x.target);
  assert.ok(paths.includes('/admin/enquiries'));
  assert.ok(paths.includes('/admin/external-chats'));
  assert.ok(paths.includes('/admin/services'));
  assert.ok(paths.includes('/admin/access'));
  assert.equal(new Set(paths).size,paths.length);
  assert.equal(paths.includes('/admin/cms'),false);
  assert.equal(paths.includes('/admin/orders'),false);
  const names=IPS_COMPANY_ADMIN_NAV.map(x=>x.label).join(' ').toLowerCase();
  for(const term of ['open marketplace','integration fabric','governance health','platform studio','odd job'])
    assert.equal(names.includes(term),false);
  assert.ok(IPS_COMPANY_ADMIN_NAV.every(x=>Boolean(x.permission&&x.group)));
  const app=await readFile(new URL('../src/App.jsx',import.meta.url),'utf8');
  assert.match(app,/path="cms" element=\{<Navigate to="\/admin\/dashboard"/);
  assert.match(app,/path="orders" element=\{<Navigate to="\/admin\/services"/);
  const dashboard=await readFile(new URL('../src/components/admin/AdminDashboard.jsx',import.meta.url),'utf8');
  assert.equal(dashboard.includes('ConfigurableActionGroup'),false);
  assert.equal(dashboard.includes('DashboardZone'),false);
});
test('archived test-domain clients and test-role admins are distinguishable from real IPS accounts',()=>{
  for(const address of ['tour-client-123@ips.test','demo@test.ips','client.evaluation@example.org'])
    assert.equal(isIpsQaFixtureEmail(address),true);
  for(const address of ['real-client@gmail.com','private@ipsglobalservice.com','researcher@university.ac.uk'])
    assert.equal(isIpsQaFixtureEmail(address),false);
  assert.equal(isIpsQaFixtureAdmin({id:'ADM-TEST-KENYA-OPERATIONS',email:'staff@ipsglobalservice.com'}),true);
  assert.equal(isIpsQaFixtureAdmin({id:'ADM-REAL-1',email:'support@ipsglobalservice.com'}),false);
  assert.equal(isIpsQaFixtureClient({client_id:'CID-001',email:'marketplace-buyer-49@ips.test'}),true);
  assert.equal(isIpsQaFixtureClient({client_id:'CID-002',email:'client@university.edu'}),false);
});
test('genuine customer-initiated Telegram support may receive one bounded staff reply',()=>{
  assert.equal(canReplyToPublicTelegramSupport(telegram,{inbound,now}),true);
  assert.equal(canReplyToPublicTelegramSupport(telegram,{
    inbound,outbound:{createdAt:new Date(now-60000)},now
  }),false);
  assert.equal(canReplyToPublicTelegramSupport(telegram,{
    inbound:{...inbound,createdAt:new Date(now-TELEGRAM_GENERAL_SUPPORT_WINDOW_MS-1000)},now
  }),false);
  assert.equal(canReplyToPublicTelegramSupport({...telegram,status:'closed'},{inbound,now}),false);
  assert.equal(canReplyToPublicTelegramSupport({channel:'whatsapp',status:'open'},{inbound,now}),false);
  assert.equal(isSubstantiveTelegramInbound('/start'),false);
  assert.equal(isSubstantiveTelegramInbound('/link ABCDEFGHIJKLMNOPQRST'),false);
  assert.equal(isSubstantiveTelegramInbound('STOP'),false);
  assert.equal(isSubstantiveTelegramInbound('Please help with a quote'),true);
});
test('general support replies cannot carry links, quote references or private records',()=>{
  assert.equal(safePublicSupportReply('Hello. Thanks for contacting IPS. Please use your private workspace for academic project information.'),true);
  assert.equal(safePublicSupportReply(''),false);
  assert.equal(safePublicSupportReply('X'.repeat(651)),false);
  assert.equal(safePublicSupportReply('See https://phishing.test/anything'),false);
  assert.equal(safePublicSupportReply('Your quote IPS-Q-ABCDEF0123456789AB is ready'),false);
  assert.equal(safePublicSupportReply('Secret card 1234 5678 1234 5678'),false);
});

test('real Telegram sendMessage transport requires actual provider acceptance before marking success',async()=>{
  const requests=[];
  const request=async (url,opts)=>{
    requests.push({url,opts});
    return {ok:true,status:200,json:async()=>({ok:true,result:{message_id:301}})};
  };
  const sent=await deliverExternalMessage({channel:'telegram',external_id:'123456789'},
    'IPS supports general academic enquiries.',{
      request,env:{TELEGRAM_BOT_TOKEN:'ci-bot-token-not-production'}
    });
  assert.equal(sent,'tg:sent:301');
  assert.equal(requests.length,1);
  assert.equal(requests[0].url,'https://api.telegram.org/botci-bot-token-not-production/sendMessage');
  assert.equal(requests[0].opts.method,'POST');
  assert.deepEqual(JSON.parse(requests[0].opts.body),
    {chat_id:'123456789',text:'IPS supports general academic enquiries.'});
  await assert.rejects(deliverExternalMessage({channel:'telegram',external_id:'12345'},'Support reply',{
    env:{TELEGRAM_BOT_TOKEN:'ci-token'},request:async()=>({ok:false,status:401,json:async()=>({ok:false})})
  }),/Telegram rejected the reply/);
  await assert.rejects(deliverExternalMessage({channel:'telegram',external_id:'12345'},'Support reply',{
    env:{},request:async()=>{throw Error('Never call')}
  }),/not configured/);
  assert.equal(requests.length,1);
});
