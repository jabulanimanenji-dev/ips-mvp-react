import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const scriptsDir = path.dirname(fileURLToPath(import.meta.url));
const projectDir = path.resolve(scriptsDir, '..');
const serverSource = await readFile(path.join(projectDir, 'server.js'), 'utf8');

assert.equal(
  /if\s*\(!session\s*\|\|/.test(serverSource),
  false,
  'Protected routes must return immediately after requireSession sends a 401 response.'
);

const waitForExit = (child, timeoutMs) => {
  if (child.exitCode !== null || child.signalCode) return Promise.resolve(true);
  return new Promise(resolve => {
    const onExit = () => {
      clearTimeout(timeout);
      resolve(true);
    };
    const timeout = setTimeout(() => {
      child.off('exit', onExit);
      resolve(false);
    }, timeoutMs);
    child.once('exit', onExit);
  });
};

const stopServer = async child => {
  if (!child?.pid || child.exitCode !== null || child.signalCode) return;
  if (!child.kill('SIGTERM')) {
    throw new Error('The verification server could not be asked to shut down.');
  }
  if (await waitForExit(child, 5000)) return;

  child.kill('SIGKILL');
  const forcedExitCompleted = await waitForExit(child, 5000);
  if (!forcedExitCompleted) {
    throw new Error('The verification server remained alive after a forced shutdown.');
  }
  throw new Error('The verification server did not shut down gracefully within five seconds.');
};

const port = 18880 + Math.floor(Math.random() * 100);
const verificationUploadsDir = await mkdtemp(path.join(tmpdir(), 'ips-session-guard-'));
let server;
let stdout = '';
let stderr = '';

try {
  server = spawn(process.execPath, ['server.js'], {
    cwd: projectDir,
    env: {
      ...process.env,
      PORT: String(port),
      MONGODB_URI: 'mongodb://USERNAME:PASSWORD@CLUSTER/DATABASE',
      NODE_ENV: 'development',
      SESSION_SECRET: 'session-guard-verification-secret-32-characters',
      STORAGE_PROVIDER: 'local',
      UPLOADS_DIR: verificationUploadsDir
    },
    stdio: ['ignore', 'pipe', 'pipe']
  });

  server.stdout.on('data', chunk => { stdout += chunk.toString(); });
  server.stderr.on('data', chunk => { stderr += chunk.toString(); });

  const waitForServer = new Promise((resolve, reject) => {
    const timeout = setTimeout(() => reject(new Error(`Server did not start.\n${stdout}\n${stderr}`)), 10000);
    const check = () => {
      if (stdout.includes('Server running on port')) {
        clearTimeout(timeout);
        resolve();
      }
    };
    server.stdout.on('data', check);
    server.once('error', error => {
      clearTimeout(timeout);
      reject(new Error(`Server could not be launched: ${error.message}`));
    });
    server.once('exit', code => {
      clearTimeout(timeout);
      reject(new Error(`Server exited before verification with code ${code}.\n${stdout}\n${stderr}`));
    });
  });

  await waitForServer;

  const protectedRequests = [
    ['GET', '/api/clients'],
    ['POST', '/api/orders'],
    ['GET', '/api/actions'],
    ['PATCH', '/api/actions/test-action'],
    ['GET', '/api/admin/inbox'],
    ['GET', '/api/admin/platform-config'],
    ['GET', '/api/admin/analytics'],
    ['GET', '/api/admin/data-summary'],
    ['GET', '/api/admin/export'],
    ['GET', '/api/admin/me'],
    ['POST', '/api/admin/change-password'],
    ['GET', '/api/admins'],
    ['GET', '/api/admin-roles'],
    ['GET', '/api/admin/permissions'],
    ['GET', '/api/admin/audit-logs'],
    ['GET', '/api/admin/media'],
    ['POST', '/api/admin/media'],
    ['GET', '/api/admin/service-engine'],
    ['PUT', '/api/admin/service-engine/settings'],
    ['POST', '/api/admin/service-engine/categories'],
    ['PATCH', '/api/admin/service-engine/categories/test-category'],
    ['DELETE', '/api/admin/service-engine/categories/test-category'],
    ['POST', '/api/admin/service-engine/categories/test-category/pause'],
    ['POST', '/api/admin/service-engine/services'],
    ['PATCH', '/api/admin/service-engine/services/test-service'],
    ['DELETE', '/api/admin/service-engine/services/test-service'],
    ['POST', '/api/admin/service-engine/services/test-service/publish'],
    ['POST', '/api/admin/service-engine/templates'],
    ['PATCH', '/api/admin/service-engine/templates/test-template'],
    ['DELETE', '/api/admin/service-engine/templates/test-template'],
    ['POST', '/api/admin/service-engine/services/test-service/apply-template'],
    ['PUT', '/api/admin/service-engine/services/test-service/questions'],
    ['POST', '/api/admin/service-engine/services/test-service/questions/copy'],
    ['POST', '/api/admin/service-engine/question-sets'],
    ['PATCH', '/api/admin/service-engine/question-sets/test-set'],
    ['DELETE', '/api/admin/service-engine/question-sets/test-set'],
    ['POST', '/api/admin/service-engine/question-sets/from-service'],
    ['POST', '/api/admin/service-engine/services/test-service/apply-question-set'],
    ['GET', '/api/admin/service-engine/audit'],
    ['GET', '/api/support-tickets'],
    ['POST', '/api/support-tickets']
  ];

  for (const [method, route] of protectedRequests) {
    const response = await fetch(`http://127.0.0.1:${port}${route}`, {
      method,
      headers: { 'Content-Type': 'application/json' },
      body: ['POST', 'PUT', 'PATCH'].includes(method) ? '{}' : undefined
    });
    assert.equal(response.status, 401, `${method} ${route} must return exactly one 401 response.`);
    const payload = await response.json();
    assert.equal(payload.success, false);
  }

  const health = await fetch(`http://127.0.0.1:${port}/api/health`);
  assert.equal(health.status, 200);
  const healthPayload = await health.json();
  assert.equal(healthPayload.server, 'online');
  assert.equal(healthPayload.ready, true);

  const publicCatalog = await fetch(`http://127.0.0.1:${port}/api/service-catalog`);
  assert.equal(publicCatalog.status, 200, 'The public service catalogue must remain available without MongoDB in development.');
  const publicCatalogPayload = await publicCatalog.json();
  const catalog = publicCatalogPayload.catalog || publicCatalogPayload;
  assert.equal(publicCatalogPayload.success, true);
  assert.equal(publicCatalogPayload.fallback, true);
  assert.ok(Array.isArray(catalog.categories), 'The public catalogue fallback must include categories.');
  assert.ok(Array.isArray(catalog.services), 'The public catalogue fallback must include services.');
  assert.equal(server.exitCode, null, `Server crashed during unauthorized request checks.\n${stderr}`);

  console.log(`Session guard verification passed for ${protectedRequests.length} protected requests and the public catalogue fallback.`);
} finally {
  try {
    await stopServer(server);
  } finally {
    await rm(verificationUploadsDir, { recursive: true, force: true });
  }
}
