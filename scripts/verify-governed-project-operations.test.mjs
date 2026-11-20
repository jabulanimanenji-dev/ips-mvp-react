import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {COMPANY_DEPARTMENTS,permittedCompanyPermissions} from '../shared/companyGovernance.js';
import {canTransitionService,allowedAdminServiceStatuses,PAYMENT_REQUIRED_SERVICE_STATES} from '../shared/serviceTransitions.js';

const project=(status='New Request',payment_status='unpaid',quote=null)=>({
 category:'Academic Support',status,payment_status,quote
});
test('quality assurance may manage projects without specialist-directory permission',()=>{
 const qa=permittedCompanyPermissions('quality_assurance','manager');
 assert.ok(qa.includes('services.manage'));
 assert.equal(qa.includes('providers.view'),false);
});
test('staff can only choose permitted next states, and cannot bypass verified payment',()=>{
 assert.deepEqual(allowedAdminServiceStatuses(project()),['New Request','Under Review','Clarification Required','Awaiting Assignment','Cancelled']);
 assert.deepEqual(allowedAdminServiceStatuses(project('Under Review')),['Under Review','Clarification Required','Cancelled','On Hold']);
 assert.ok(allowedAdminServiceStatuses(project('Under Review','unpaid',{total:219})).includes('Quoted'));
 assert.equal(allowedAdminServiceStatuses(project('Quoted','unpaid',{total:219})).includes('Quote Accepted'),false);
 assert.equal(allowedAdminServiceStatuses(project('Quote Accepted','unpaid',{total:219})).includes('Quote Accepted'),true);
 assert.equal(allowedAdminServiceStatuses(project('Quote Accepted','unpaid',{total:219})).includes('Assigned'),false);
 assert.equal(allowedAdminServiceStatuses(project('Quote Accepted','paid',{total:219})).includes('Assigned'),true);
 for(const state of PAYMENT_REQUIRED_SERVICE_STATES)
   assert.equal(allowedAdminServiceStatuses(project('Awaiting Assignment')).includes(state),false);
});
test('unstarted assignment can be withdrawn; active-work reassignment is separately blocked',()=>{
 assert.equal(canTransitionService('Assigned','Awaiting Assignment','admin'),true);
 assert.equal(canTransitionService('Assigned','Awaiting Assignment','writer'),false);
 assert.equal(canTransitionService('In Progress','Awaiting Assignment','admin'),false);
 assert.equal(canTransitionService('Completed','Assigned','admin'),false);
});
test('server and browser use the same service transition authority, not duplicated client rules',async()=>{
 const [server,ui]=await Promise.all([
  readFile(new URL('../server.js',import.meta.url),'utf8'),
  readFile(new URL('../src/components/admin/AdminServices.jsx',import.meta.url),'utf8')
 ]);
 assert.match(server,/import \{canTransitionService,PAYMENT_REQUIRED_SERVICE_STATES\} from '\.\/shared\/serviceTransitions\.js'/);
 assert.doesNotMatch(server,/const serviceTransitions =/);
 assert.match(server,/Only the client can accept an academic quotation/);
 assert.match(server,/Active specialist work must be escalated before reassignment/);
 assert.match(ui,/if\(canSeeSpecialists\)/);
 assert.match(ui,/allowedAdminServiceStatuses\(j\)/);
 assert.match(ui,/Payment required before assignment/);
 assert.match(ui,/disabled=\{!canEditQuote\}/);
 assert.doesNotMatch(ui,/\{STATES\.map/);
});
