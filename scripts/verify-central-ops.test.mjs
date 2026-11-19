import test from 'node:test';
import assert from 'node:assert/strict';
import {permissionForAdminRequest,hasAdminPermission,rolePermissions} from '../shared/adminPermissions.js';
import {revokeQuoteChannel} from '../services/contactChannels.js';
import {validatePrivateQuote} from '../shared/privacyIdentity.js';

test('private quote staff messages require a dedicated support management permission',()=>{
  const path='/api/quote-requests/admin/IPS-Q-1234567890ABCDEF12/workspace-reply';
  assert.equal(permissionForAdminRequest('POST',path),'support.manage');
  for(const role of ['content','finance','auditor'])
    assert.equal(hasAdminPermission({permissions:rolePermissions(role)},'support.manage'),false,role);
  assert.equal(hasAdminPermission({permissions:rolePermissions('support')},'support.manage'),true);
});

test('long-but-valid academic disciplines remain separately recorded from bounded service subject',()=>{
  const discipline='N'.repeat(160);
  const checked=validatePrivateQuote({username:'PrivateResearcher',service:'statistics-support',
    subject:discipline,message:'I want careful research methods and data analysis support for my thesis.',
    preferred_channel:'workspace',contact_consent:true},{signedIn:true});
  assert.ok(checked.value);
  assert.equal(checked.value.subject.length,160);
  assert.equal(checked.value.service,'statistics-support');
  assert.equal(checked.value.subject.startsWith('N'),true);
});

test('disconnecting messenger revokes verified quotation and exact contact permission',async()=>{
  const calls=[];
  const model={updateMany:async(filter,change)=>{
    calls.push({filter,change});return {modifiedCount:2};
  }};
  const result=await revokeQuoteChannel({
    channel:'telegram',clientId:'CID-PRIVATE-1',contactIds:['507f1f77bcf86cd799439011'],model
  });
  assert.equal(result.modifiedCount,2);
  const {filter,change}=calls[0];
  assert.equal(filter.request_type,'quote');
  assert.equal(filter.preferred_channel,'telegram');
  assert.equal(filter.contact_verified,true);
  assert.equal(filter.$or.length,2);
  assert.equal(filter.$or[0].client_id,'CID-PRIVATE-1');
  assert.deepEqual(filter.$or[1].contact_thread_id.$in,['507f1f77bcf86cd799439011']);
  assert.equal(change.$set.contact_consent,false);
  assert.equal(change.$set.contact_verified,false);
  assert.equal(change.$unset.contact_thread_id,'');
  assert.equal(change.$unset.contact_verified_at,'');
  assert.equal((await revokeQuoteChannel({channel:'whatsapp',model})).modifiedCount,0);
  await assert.rejects(revokeQuoteChannel({channel:'signal',model}),/Unsupported/);
  assert.equal(calls.length,1);
});
