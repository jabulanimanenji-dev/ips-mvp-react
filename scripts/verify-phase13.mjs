import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  ADMIN_ENTRY_PATH_PLACEHOLDER,
  isConfiguredMongoUri,
  isValidAdminPassword,
  isValidSessionSecret,
  SESSION_SECRET_PLACEHOLDER,
  productionConfigurationErrors
} from '../shared/runtimeConfig.js';

const scriptsDir = path.dirname(fileURLToPath(import.meta.url));
const projectDir = path.resolve(scriptsDir, '..');
const readProjectFile = file => readFile(path.join(projectDir, file), 'utf8');

const validProductionEnvironment = {
  NODE_ENV: 'production',
  RENDER: 'true',
  MONGODB_URI: 'mongodb+srv://ips-user:strong-value@cluster.example.net/ips',
  ADMIN_EMAIL: 'admin@example.com',
  ADMIN_PASSWORD: 'AdminPass123',
  SESSION_SECRET: 'phase-13-production-session-secret-value',
  VITE_ADMIN_ENTRY_PATH: '/private-admin-entry',
  UPLOADS_DIR: '/var/data/ips-uploads'
};

assert.equal(isConfiguredMongoUri(validProductionEnvironment.MONGODB_URI), true);
assert.equal(isConfiguredMongoUri('mongodb+srv://USERNAME:PASSWORD@CLUSTER/DATABASE'), false);
assert.equal(isValidAdminPassword('AdminPass123'), true);
assert.equal(isValidAdminPassword('too-short'), false);
assert.equal(isValidSessionSecret(validProductionEnvironment.SESSION_SECRET, validProductionEnvironment.ADMIN_PASSWORD), true);
assert.equal(isValidSessionSecret(SESSION_SECRET_PLACEHOLDER, validProductionEnvironment.ADMIN_PASSWORD), false);
assert.equal(isValidSessionSecret(`${SESSION_SECRET_PLACEHOLDER} `, validProductionEnvironment.ADMIN_PASSWORD), false);
assert.equal(isValidSessionSecret(SESSION_SECRET_PLACEHOLDER.toUpperCase(), validProductionEnvironment.ADMIN_PASSWORD), false);
assert.equal(isValidSessionSecret(validProductionEnvironment.ADMIN_PASSWORD, validProductionEnvironment.ADMIN_PASSWORD), false);
assert.equal(
  isValidSessionSecret(`${validProductionEnvironment.ADMIN_PASSWORD}${' '.repeat(32)}`, validProductionEnvironment.ADMIN_PASSWORD),
  false
);
assert.deepEqual(productionConfigurationErrors(validProductionEnvironment), []);
assert.deepEqual(productionConfigurationErrors({ NODE_ENV: 'development' }), []);

const invalidErrors = productionConfigurationErrors({
  NODE_ENV: 'production',
  RENDER: 'true',
  MONGODB_URI: 'mongodb+srv://USERNAME:PASSWORD@CLUSTER/DATABASE',
  ADMIN_EMAIL: 'not-an-email',
  ADMIN_PASSWORD: 'weak',
  SESSION_SECRET: 'short',
  VITE_ADMIN_ENTRY_PATH: '/ips-mission-control',
  UPLOADS_DIR: 'uploads'
});
for (const key of [
  'MONGODB_URI',
  'ADMIN_EMAIL',
  'ADMIN_PASSWORD',
  'SESSION_SECRET',
  'VITE_ADMIN_ENTRY_PATH',
  'UPLOADS_DIR'
]) {
  assert.equal(invalidErrors.some(error => error.includes(key)), true, `${key} must be validated.`);
}

for (const uploadsDir of ['/tmp/ips-uploads', 'C:\\ips-uploads']) {
  const errors = productionConfigurationErrors({ ...validProductionEnvironment, UPLOADS_DIR: uploadsDir });
  assert.equal(errors.some(error => error.includes('UPLOADS_DIR')), true, `Render must reject ${uploadsDir}.`);
}
assert.equal(
  productionConfigurationErrors({
    ...validProductionEnvironment,
    SESSION_SECRET: SESSION_SECRET_PLACEHOLDER
  }).some(error => error.includes('SESSION_SECRET')),
  true
);
assert.equal(
  productionConfigurationErrors({
    ...validProductionEnvironment,
    SESSION_SECRET: validProductionEnvironment.ADMIN_PASSWORD
  }).some(error => error.includes('SESSION_SECRET')),
  true
);
assert.equal(
  productionConfigurationErrors({
    ...validProductionEnvironment,
    VITE_ADMIN_ENTRY_PATH: ADMIN_ENTRY_PATH_PLACEHOLDER
  }).some(error => error.includes('VITE_ADMIN_ENTRY_PATH')),
  true
);

const [packageSource, renderConfig, gitignore, nodeVersion, serverSource, sessionVerifier, envExampleSource] = await Promise.all([
  readProjectFile('package.json'),
  readProjectFile('render.yaml'),
  readProjectFile('.gitignore'),
  readProjectFile('.node-version'),
  readProjectFile('server.js'),
  readProjectFile('scripts/verify-session-guards.mjs'),
  readProjectFile('.env.example')
]);
const packageJson = JSON.parse(packageSource);
const exampleEnvironment = Object.fromEntries(
  envExampleSource
    .split(/\r?\n/)
    .filter(line => /^[A-Za-z_][A-Za-z0-9_]*=/.test(line))
    .map(line => {
      const separator = line.indexOf('=');
      return [line.slice(0, separator), line.slice(separator + 1)];
    })
);
const exampleErrors = productionConfigurationErrors({
  ...exampleEnvironment,
  NODE_ENV: 'production',
  RENDER: 'true',
  UPLOADS_DIR: '/var/data/ips-uploads'
});
assert.equal(exampleErrors.some(error => error.includes('SESSION_SECRET')), true);
assert.equal(exampleErrors.some(error => error.includes('VITE_ADMIN_ENTRY_PATH')), true);

assert.equal(packageJson.scripts.start, 'node server.js');
assert.match(packageJson.scripts.check, /verify:phase13/);
assert.match(renderConfig, /branch:\s*main/);
assert.match(renderConfig, /buildCommand:\s*npm ci --include=dev && npm run check/);
assert.match(renderConfig, /startCommand:\s*npm start/);
assert.match(renderConfig, /healthCheckPath:\s*\/api\/health/);
assert.match(gitignore, /^\.env\.\*$/m);
assert.match(gitignore, /^!\.env\.example$/m);
assert.equal(nodeVersion.trim(), '24.14.1');
assert.match(serverSource, /assertProductionConfiguration\(process\.env\)/);
assert.match(serverSource, /res\.status\(ready \? 200 : 503\)/);
assert.match(serverSource, /process\.once\('SIGTERM'/);
assert.match(serverSource, /await mongoose\.connect/);
assert.match(sessionVerifier, /UPLOADS_DIR:\s*verificationUploadsDir/);

console.log('Phase 13 production deployment verification passed.');
