import assert from 'node:assert/strict';
import {summarizeLegacyBoundary,legacyIdentityDecision,oldServiceDecision} from '../src/legacy-reconciliation.mjs';

const report=summarizeLegacyBoundary({
 clients:[{status:'Active',count:148,email:'confidential@example.test',password:'not-for-new-platform'}],
 writers:[{application_status:'approved',count:39},{application_status:'more_information',count:1}],
 admins:[{status:'Active',count:34},{status:'Suspended',count:1}],
 orders:[{market_id:'TEST',service_type:'Physical Goods',status:'New',count:4}],
 servicerequests:[{family:'professional',category:'Finance & Accounting',status:'Assigned',count:3}],
 invoices:[{status:'SENT',payment_status:'PENDING_VERIFICATION',count:2}],
 supporttickets:[{status:'Open',count:1}],
 platformfiles:[{state:'released',visibility:'admin_writer',count:1}],
 channelmessages:[{direction:'inbound',status:'received',count:3},{direction:'outbound',status:'sent',count:1}],
 joins:{orderClient:{matched:4,unmatched:0},serviceRequestClient:{matched:3,unmatched:0},
  invoiceOrder:{matched:0,unmatched:2},fileOrder:{matched:0,unmatched:1},
  messageContact:{matched:4,unmatched:0}}
});
assert.equal(report.noPersonalDataIncluded,true);
assert.equal(report.productionMigrationApproved,false);
assert.equal(report.collections.orders[0].decision,'quarantine_test');
assert.equal(report.collections.servicerequests[0].decision,'out_of_scope_legacy');
assert.equal(report.collections.clients[0].count,148);
assert.equal(report.references.invoiceOrder.unmatched,2);
assert.equal(report.references.messageContact.matched,4);
assert.equal(report.identities.existingPasswordTrusted,false);
assert.equal(report.identities.autoImport,false);
assert.equal(report.identities.specialistCredentialsRequireFreshReview,true);
assert.equal(report.identities.rootOrManagerPermissionsAutomaticallyCarriedOver,false);
assert.equal(oldServiceDecision({service_type:'Academic Services'}),'requires_documented_reconciliation');
assert.equal(oldServiceDecision({service_type:'Physical Goods'}),'out_of_scope_legacy');
assert.equal(legacyIdentityDecision().verifiedEmailChallengeRequired,true);
assert.ok(!JSON.stringify(report).includes('confidential@example.test'));
assert.ok(!JSON.stringify(report).includes('not-for-new-platform'));
const injected=summarizeLegacyBoundary({
 orders:[{market_id:'secret client info',service_type:'Smith 1234',status:'Jane Doe 2026',count:1}],
 clients:[{status:'someone@example.com',count:2}]});
assert.ok(!JSON.stringify(injected).includes('Jane Doe'));
assert.ok(!JSON.stringify(injected).includes('someone@example.com'));
assert.ok(injected.collections.orders[0].group.market_id.includes('redacted'));
console.log('IPS_LEGACY_MIGRATION_BOUNDARY_GREEN 17 checks; no fake academic migration, no passwords, no accidental disclosure');
