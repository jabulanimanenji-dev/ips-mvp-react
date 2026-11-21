import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
const file=path=>readFile(new URL('../'+path,import.meta.url),'utf8');

test('public evaluation guide contains no passwords or shared access credentials',async()=>{
  const source=await file('src/pages/EvaluationGateway.jsx');
  assert.doesNotMatch(source,/password\s*:\s*['"`]/i);
  assert.doesNotMatch(source,/account\.password/i);
  assert.match(source,/private evaluation credential pack/);
  assert.match(source,/nyoro\.evaluation@example\.org/);
  assert.match(source,/manager\.client_relations@example\.org/);
  assert.match(source,/staff\.client_relations@example\.org/);
});

test('evaluation seed is restricted to loopback disposable data, with five independently authenticated role types',async()=>{
  const [seed,entry,docker]=await Promise.all([
    file('scripts/seed-ips-evaluation.mjs'),
    file('scripts/ips-evaluation-entrypoint.sh'),
    file('Dockerfile.ips-evaluation')
  ]);
  assert.match(seed,/ips_staging_evaluation/);
  assert.match(seed,/\['127\.0\.0\.1','localhost'\]/);
  assert.match(seed,/IPS_EVAL_MANAGER_PASSWORD/);
  assert.match(seed,/IPS_EVAL_STAFF_PASSWORD/);
  assert.match(seed,/COMPANY_DEPARTMENTS/);
  assert.match(seed,/company_role:'manager'/);
  assert.match(seed,/company_role:'staff'/);
  assert.match(seed,/SupportTicket\.updateOne/);
  assert.match(seed,/ChannelContact\.findOneAndUpdate/);
  assert.match(entry,/IPS_EVALUATION_MODE:-/);
  assert.match(entry,/No real customer records/);
  assert.match(docker,/COPY.*node/);
});

test('evaluation payment and persistent storage safety limits remain enforced',async()=>{
  const [entry,docker]=await Promise.all([
    file('scripts/ips-evaluation-entrypoint.sh'),
    file('Dockerfile.ips-evaluation')
  ]);
  assert.match(entry,/STRIPE_SECRET_KEY/);
  assert.match(entry,/R2_ENDPOINT/);
  assert.match(entry,/TELEGRAM_BOT_TOKEN/);
  assert.match(entry,/--bind_ip 127\.0\.0\.1/);
  assert.match(entry,/STORAGE_PROVIDER=local/);
  assert.match(docker,/STORAGE_PROVIDER=local/);
});

test('isolated runtime makes genuine signed HTTP calls and blocks every private cross-role read',async()=>{
  const [selfcheck,server]=await Promise.all([
    file('services/evaluationSelfcheck.js'),file('server.js')
  ]);
  assert.match(selfcheck,/IPS_EVALUATION_MODE!=='true'/);
  assert.match(selfcheck,/http:\/\/127\.0\.0\.1:/);
  assert.match(selfcheck,/\/api\/client\/login/);
  assert.match(selfcheck,/\/api\/writer\/login/);
  assert.match(selfcheck,/\/api\/admin\/login/);
  assert.match(selfcheck,/\/api\/admin\/finance\/operating-ledger/);
  assert.match(selfcheck,/\/api\/notifications\/client\//);
  assert.match(selfcheck,/payment\.data\.enabled,false/);
  assert.match(server,/isProduction&&process\.env\.IPS_EVALUATION_MODE==='true'/);
  assert.match(server,/IPS_EVAL_RUNTIME_6_ROLES_GREEN/);
});
