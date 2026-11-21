import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {canReadNotificationInbox} from '../shared/notificationAccess.js';

const client={role:'client',id:'CID-ACCOUNT-A'};
const writer={role:'writer',id:'WID-SPECIALIST-A'};
const manager={role:'admin',id:'ADM-MANAGER-A'};
const root={role:'admin',id:'owner@example.org'};

test('clients and specialists may read only their own private inbox',()=>{
  assert.equal(canReadNotificationInbox(client,'client',client.id),true);
  assert.equal(canReadNotificationInbox(client,'client','CID-ACCOUNT-B'),false);
  assert.equal(canReadNotificationInbox(client,'writer',writer.id),false);
  assert.equal(canReadNotificationInbox(writer,'writer',writer.id),true);
  assert.equal(canReadNotificationInbox(writer,'writer','WID-SPECIALIST-B'),false);
  assert.equal(canReadNotificationInbox(writer,'client',client.id),false);
});

test('administrators cannot obtain client, specialist, or other staff notifications',()=>{
  for(const actor of [manager,root]){
    for(const [role,id] of [['client',client.id],['writer',writer.id]])
      assert.equal(canReadNotificationInbox(actor,role,id,{isRoot:true}),false,role);
  }
  assert.equal(canReadNotificationInbox(manager,'admin',manager.id,{isRoot:false}),true);
  assert.equal(canReadNotificationInbox(manager,'admin',root.id,{isRoot:false}),false);
  assert.equal(canReadNotificationInbox(root,'admin',root.id,{isRoot:true}),true);
});

test('legacy company broadcast inbox requires actual root authority',()=>{
  assert.equal(canReadNotificationInbox(root,'admin','admin',{isRoot:true}),true);
  assert.equal(canReadNotificationInbox(root,'admin','admin',{isRoot:false}),false);
  assert.equal(canReadNotificationInbox(manager,'admin','admin',{isRoot:false}),false);
  assert.equal(canReadNotificationInbox({role:'admin',id:'admin'},'admin','admin',{isRoot:false}),false);
});

test('missing, forged and malformed inbox targets are rejected',()=>{
  for(const role of ['other','',null])assert.equal(canReadNotificationInbox(client,role,client.id),false);
  for(const id of ['',null,undefined])assert.equal(canReadNotificationInbox(client,'client',id),false);
  assert.equal(canReadNotificationInbox(null,'client',client.id),false);
  assert.equal(canReadNotificationInbox({role:'admin',id:''},'admin','admin',{isRoot:true}),true);
  // Root authority is asserted by the signed server principal, not session id.
});

test('server routes call the shared notification authorization policy',async()=>{
  const server=await readFile(new URL('../server.js',import.meta.url),'utf8');
  assert.match(server,/canReadNotificationInbox\(session,req\.params\.role,req\.params\.id,req\.adminAccess\)/);
});

test('notification acknowledgement is individually authorized and never requires customer-message privileges',async()=>{
  const [server,permissions,alerts]=await Promise.all([
    readFile(new URL('../server.js',import.meta.url),'utf8'),
    readFile(new URL('../shared/adminPermissions.js',import.meta.url),'utf8'),
    readFile(new URL('../src/administration/CompanyAlerts.jsx',import.meta.url),'utf8')
  ]);
  assert.match(server,/app\.patch\('\/api\/notifications\/:role\/:id\/:notificationId\/read'/);
  assert.match(server,/canReadNotificationInbox\(session,role,id,req\.adminAccess\)/);
  assert.match(server,/recipient_role:role,recipient_id:id/);
  assert.match(permissions,/path\.startsWith\('\/api\/notifications'\)\) return 'dashboard\.view'/);
  assert.match(alerts,/Acknowledge/);
  assert.match(alerts,/company_case_unowned/);
});
