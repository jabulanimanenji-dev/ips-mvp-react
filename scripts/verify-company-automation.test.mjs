import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {companyAutomationEnabled} from '../services/companyAutomation.js';

test('task automation automatically runs in production unless explicitly disabled',()=>{
  assert.equal(companyAutomationEnabled({NODE_ENV:'production'}),true);
  assert.equal(companyAutomationEnabled({NODE_ENV:'production',IPS_COMPANY_AUTOMATION_ENABLED:'false'}),false);
  assert.equal(companyAutomationEnabled({NODE_ENV:'development'}),false);
  assert.equal(companyAutomationEnabled({NODE_ENV:'development',IPS_COMPANY_AUTOMATION_ENABLED:'true'}),true);
});

test('the company worker is mounted with safe shutdown and notifications have durable idempotency',async()=>{
  const [server,model,company,alerts]=await Promise.all([
    readFile(new URL('../server.js',import.meta.url),'utf8'),
    readFile(new URL('../models/Notification.js',import.meta.url),'utf8'),
    readFile(new URL('../services/companyAutomation.js',import.meta.url),'utf8'),
    readFile(new URL('../src/administration/CompanyAlerts.jsx',import.meta.url),'utf8')
  ]);
  assert.match(server,/startCompanyAutomationWorker\(\)/);
  assert.match(server,/stopCompanyAutomationWorker\?\.\(\)/);
  assert.match(model,/dedupe_key/);
  assert.match(model,/unique:true,sparse:true/);
  assert.match(company,/setOnInsert/);
  assert.match(company,/task_status:'open'/);
  assert.match(alerts,/api\/notifications\/admin\//);
});
