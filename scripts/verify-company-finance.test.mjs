import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
const read=path=>readFile(new URL('../'+path,import.meta.url),'utf8');

test('finance records are explicitly permission-scoped and never a public information endpoint',async()=>{
  const [service,student,server]=await Promise.all([
    read('services/companyFinance.js'),read('services/studentPayments.js'),read('server.js')]);
  assert.match(service,/hasAdminPermission\(req\.adminAccess,'payments\.view'\)/);
  assert.match(service,/session\.role!=='admin'/);
  assert.match(student,/hasAdminPermission\(req\.adminAccess,'payments\.view'\)/);
  assert.match(server,/registerCompanyFinanceRoutes\(app,\{requireSession\}\)/);
});

test('finance register uses real source queries and separates acceptance, collection and payout',async()=>{
  const [service,ui,app]=await Promise.all([
    read('services/companyFinance.js'),read('src/administration/FinanceDesk.jsx'),read('src/App.jsx')]);
  assert.match(service,/ServiceRequest\.find\(quoteQuery\)/);
  assert.match(service,/StudentPayment\.find\(\)/);
  assert.match(service,/SpecialistPayout\.find\(\)/);
  assert.match(service,/StudentRefund\.find\(\)/);
  assert.match(service,/client_accepted_quotes/);
  assert.match(service,/payments_requiring_review/);
  assert.match(service,/refunds_pending/);
  assert.match(service,/paymentLaunchState\(env\)\.pending/);
  assert.match(service,/client_email:\{\$not:/);
  assert.match(ui,/Finance without imaginary balances/);
  assert.match(ui,/financial_cases/);
  assert.match(ui,/Payment events/);
  assert.match(ui,/Specialist settlements/);
  assert.match(ui,/Refunds/);
  assert.match(app,/<FinanceDesk\/>/);
});
