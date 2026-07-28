import assert from 'node:assert/strict';
import { readdir, readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { DEFAULT_PLATFORM_CONFIG, normalisePlatformConfig } from '../shared/platformConfig.js';

const projectDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

const sourceFiles = [];
const walk = async directory => {
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    const target = path.join(directory, entry.name);
    if (entry.isDirectory()) await walk(target);
    else if (/\.(jsx?|mjs)$/.test(entry.name)) sourceFiles.push(target);
  }
};
await walk(path.join(projectDir, 'src'));
const frontend = (await Promise.all(sourceFiles.map(file => readFile(file, 'utf8')))).join('\n');
const server = await readFile(path.join(projectDir, 'server.js'), 'utf8');
const supportModel = await readFile(path.join(projectDir, 'models', 'SupportTicket.js'), 'utf8');

for (const forbidden of [
  'ips-orders',
  'ips-clients',
  'ips-admin-writers',
  'ips-admin-list',
  'ips-support-messages',
  'seedDemoData',
  'Use Demo Account',
  'ips-services.com/pay/',
  'DEMO_CLIENT'
]) {
  assert.equal(frontend.includes(forbidden), false, `Legacy browser/demo data path remains: ${forbidden}`);
}

for (const required of [
  "app.get('/api/admin/analytics'",
  "app.get('/api/admin/data-summary'",
  "app.get('/api/admin/export'",
  "app.get('/api/support-tickets'",
  "app.post('/api/support-tickets'",
  "app.post('/api/support-tickets/:id/messages'",
  "app.patch('/api/support-tickets/:id'"
]) {
  assert.equal(server.includes(required), true, `Missing Phase 9 endpoint: ${required}`);
}

assert.match(server, /Admin\.find\(\)\.select\('-password'\)/, 'Admin lists must never expose password hashes.');
assert.match(server, /Writer\.find\(\)\.select\('-password'\)/, 'Provider lists must never expose password hashes.');
assert.match(server, /Client\.find\(\)\.select\('-password'\)/, 'Client lists must never expose password hashes.');
assert.match(supportModel, /ticket_id/);
assert.match(supportModel, /Waiting for Client/);
assert.match(supportModel, /messages/);

const config = normalisePlatformConfig({
  ...DEFAULT_PLATFORM_CONFIG,
  navigation: {
    ...DEFAULT_PLATFORM_CONFIG.navigation,
    admin: DEFAULT_PLATFORM_CONFIG.navigation.admin.filter(item => item.id !== 'admin-support')
  }
});
assert.ok(config.navigation.admin.some(item => item.id === 'admin-support' && item.target === '/admin/support'));
assert.ok(DEFAULT_PLATFORM_CONFIG.schemaVersion >= 2);

console.log(`Phase 9 verification passed across ${sourceFiles.length} frontend source files.`);
