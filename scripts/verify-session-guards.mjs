import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { readFile } from 'node:fs/promises';
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

const port = 18880 + Math.floor(Math.random() * 100);
const server = spawn(process.execPath, ['server.js'], {
  cwd: projectDir,
  env: {
    ...process.env,
    PORT: String(port),
    MONGODB_URI: 'mongodb://USERNAME:PASSWORD@CLUSTER/DATABASE',
    NODE_ENV: 'development',
    SESSION_SECRET: 'session-guard-verification-secret-32-characters'
  },
  stdio: ['ignore', 'pipe', 'pipe']
});

let stdout = '';
let stderr = '';
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
  server.once('exit', code => {
    clearTimeout(timeout);
    reject(new Error(`Server exited before verification with code ${code}.\n${stdout}\n${stderr}`));
  });
});

try {
  await waitForServer;

  const protectedRequests = [
    ['GET', '/api/clients'],
    ['POST', '/api/orders'],
    ['GET', '/api/actions'],
    ['PATCH', '/api/actions/test-action'],
    ['GET', '/api/admin/inbox'],
    ['GET', '/api/admin/platform-config']
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
  assert.equal((await health.json()).server, 'online');
  assert.equal(server.exitCode, null, `Server crashed during unauthorized request checks.\n${stderr}`);

  console.log(`Session guard verification passed for ${protectedRequests.length} protected requests.`);
} finally {
  server.kill();
}
