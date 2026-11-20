import test from 'node:test';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import {qualifyOwnerTelegramInbound} from '../services/telegramInboundEvidence.js';

const message='IPS production test — checking that messages reach IPS administration.';
const env={
  NODE_ENV:'production', IPS_PUBLICATION_STRICT:'true',
  IPS_TELEGRAM_INBOUND_CHECK_ID:'owner_20261120',
  IPS_TELEGRAM_INBOUND_CHECK_SHA256:crypto.createHash('sha256').update(message).digest('hex')
};
const now=()=>new Date('2026-11-20T17:00:00Z');
const fake=(records)=>({
  find(query){
    assert.equal(query.channel,'telegram');
    assert.equal(query.direction,'inbound');
    assert.ok(query.createdAt.$gte instanceof Date);
    return {select(fields){assert.equal(fields,'body');return {sort(){return {limit(n){assert.equal(n,500);return {lean:async()=>records};}}}}};
  }
});
test('opt-in diagnostic verifies persisted inbound Telegram message by SHA, not chat identities',async()=>{
  assert.deepEqual(await qualifyOwnerTelegramInbound({env,now,model:fake([{body:'irrelevant'},{body:message}])}),
    {run_id:'owner_20261120',matched:true,scanned:2});
  assert.deepEqual(await qualifyOwnerTelegramInbound({env,now,model:fake([{body:'irrelevant'}])}),
    {run_id:'owner_20261120',matched:false,scanned:1});
});
test('diagnostic never reads database without explicit production run ID',async()=>{
  const never={find(){throw Error('unexpected query');}};
  for(const vars of [
    {...env,IPS_TELEGRAM_INBOUND_CHECK_ID:''},
    {...env,NODE_ENV:'development'},
    {...env,IPS_EVALUATION_MODE:'true'},
    {...env,IPS_PUBLICATION_STRICT:'false'}
  ])assert.deepEqual(await qualifyOwnerTelegramInbound({env:vars,model:never}),{skipped:true});
});
test('invalid request cannot enter persisted-message scanner',async()=>{
  await assert.rejects(qualifyOwnerTelegramInbound({env:{...env,IPS_TELEGRAM_INBOUND_CHECK_SHA256:'bad'},model:fake([])}),/SHA-256/);
  await assert.rejects(qualifyOwnerTelegramInbound({env:{...env,IPS_TELEGRAM_INBOUND_CHECK_ID:'invalid!' },model:fake([])}),/bounded run ID/);
});
