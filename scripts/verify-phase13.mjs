import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  ADMIN_ENTRY_PATH_PLACEHOLDER,
  isConfiguredMongoUri,
  isValidAdminPassword,
  isValidR2BucketName,
  isValidR2Endpoint,
  isValidR2Prefix,
  isValidSessionSecret,
  SESSION_SECRET_PLACEHOLDER,
  productionConfigurationErrors
} from '../shared/runtimeConfig.js';

const scriptsDir = path.dirname(fileURLToPath(import.meta.url));
const projectDir = path.resolve(scriptsDir, '..');
const readProjectFile = file => readFile(path.join(projectDir, file), 'utf8');

const commonProductionEnvironment = {
  NODE_ENV: 'production',
  RENDER: 'true',
  MONGODB_URI: 'mongodb+srv://ips-user:strong-value@cluster.example.net/ips',
  ADMIN_EMAIL: 'admin@example.com',
  ADMIN_PASSWORD: 'AdminPass123',
  SESSION_SECRET: 'phase-13-production-session-secret-value',
  VITE_ADMIN_ENTRY_PATH: '/private-admin-entry'
};
const validLocalProductionEnvironment = {
  ...commonProductionEnvironment,
  STORAGE_PROVIDER: 'local',
  UPLOADS_DIR: '/var/data/ips-uploads'
};
const validR2ProductionEnvironment = {
  ...commonProductionEnvironment,
  STORAGE_PROVIDER: 'r2',
  R2_ENDPOINT: 'https://0123456789abcdef0123456789abcdef.eu.r2.cloudflarestorage.com',
  R2_BUCKET_NAME: 'ips-production-files',
  R2_ACCESS_KEY_ID: '0123456789abcdef0123456789abcdef',
  R2_SECRET_ACCESS_KEY: '0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef',
  R2_PREFIX: 'production',
  R2_REQUEST_TIMEOUT_MS: '60000'
};

assert.equal(isConfiguredMongoUri(commonProductionEnvironment.MONGODB_URI), true);
assert.equal(isConfiguredMongoUri('mongodb+srv://USERNAME:PASSWORD@CLUSTER/DATABASE'), false);
assert.equal(isValidAdminPassword('AdminPass123'), true);
assert.equal(isValidAdminPassword('too-short'), false);
assert.equal(isValidSessionSecret(commonProductionEnvironment.SESSION_SECRET, commonProductionEnvironment.ADMIN_PASSWORD), true);
assert.equal(isValidSessionSecret(SESSION_SECRET_PLACEHOLDER, commonProductionEnvironment.ADMIN_PASSWORD), false);
assert.equal(isValidSessionSecret(`${SESSION_SECRET_PLACEHOLDER} `, commonProductionEnvironment.ADMIN_PASSWORD), false);
assert.equal(isValidSessionSecret(SESSION_SECRET_PLACEHOLDER.toUpperCase(), commonProductionEnvironment.ADMIN_PASSWORD), false);
assert.equal(isValidSessionSecret(commonProductionEnvironment.ADMIN_PASSWORD, commonProductionEnvironment.ADMIN_PASSWORD), false);
assert.equal(
  isValidSessionSecret(`${commonProductionEnvironment.ADMIN_PASSWORD}${' '.repeat(32)}`, commonProductionEnvironment.ADMIN_PASSWORD),
  false
);
assert.equal(isValidR2Endpoint(validR2ProductionEnvironment.R2_ENDPOINT), true);
assert.equal(isValidR2Endpoint('https://0123456789abcdef0123456789abcdef.r2.cloudflarestorage.com'), true);
assert.equal(isValidR2Endpoint('http://0123456789abcdef0123456789abcdef.r2.cloudflarestorage.com'), false);
assert.equal(isValidR2Endpoint('https://r2.example.com'), false);
assert.equal(isValidR2Endpoint('https://0123456789abcdef0123456789abcdef.r2.cloudflarestorage.com:444'), false);
assert.equal(isValidR2Endpoint(`${validR2ProductionEnvironment.R2_ENDPOINT}/bucket`), false);
assert.equal(isValidR2BucketName(validR2ProductionEnvironment.R2_BUCKET_NAME), true);
assert.equal(isValidR2BucketName('-invalid-bucket'), false);
assert.equal(isValidR2BucketName('Invalid_Bucket'), false);
assert.equal(isValidR2Prefix('production/media'), true);
assert.equal(isValidR2Prefix('../production'), false);
assert.equal(isValidR2Prefix('/production'), false);

assert.deepEqual(productionConfigurationErrors(validLocalProductionEnvironment), []);
assert.deepEqual(productionConfigurationErrors(validR2ProductionEnvironment), []);
assert.deepEqual(productionConfigurationErrors({ NODE_ENV: 'development' }), []);
const { STORAGE_PROVIDER: omittedStorageProvider, ...productionWithoutStorageProvider } = validLocalProductionEnvironment;
assert.equal(omittedStorageProvider, 'local');
assert.equal(
  productionConfigurationErrors(productionWithoutStorageProvider).some(error => error.includes('STORAGE_PROVIDER')),
  true
);

const invalidErrors = productionConfigurationErrors({
  NODE_ENV: 'production',
  RENDER: 'true',
  MONGODB_URI: 'mongodb+srv://USERNAME:PASSWORD@CLUSTER/DATABASE',
  ADMIN_EMAIL: 'not-an-email',
  ADMIN_PASSWORD: 'weak',
  SESSION_SECRET: 'short',
  VITE_ADMIN_ENTRY_PATH: '/ips-mission-control',
  STORAGE_PROVIDER: 'filesystem'
});
for (const key of [
  'MONGODB_URI',
  'ADMIN_EMAIL',
  'ADMIN_PASSWORD',
  'SESSION_SECRET',
  'VITE_ADMIN_ENTRY_PATH',
  'STORAGE_PROVIDER'
]) {
  assert.equal(invalidErrors.some(error => error.includes(key)), true, `${key} must be validated.`);
}

for (const uploadsDir of ['/tmp/ips-uploads', 'C:\\ips-uploads']) {
  const errors = productionConfigurationErrors({ ...validLocalProductionEnvironment, UPLOADS_DIR: uploadsDir });
  assert.equal(errors.some(error => error.includes('UPLOADS_DIR')), true, `Render must reject ${uploadsDir}.`);
}
assert.equal(
  productionConfigurationErrors({
    ...validLocalProductionEnvironment,
    UPLOADS_DIR: ' /var/data/ips-uploads'
  }).some(error => error.includes('UPLOADS_DIR')),
  true
);
assert.deepEqual(
  productionConfigurationErrors({
    ...validLocalProductionEnvironment,
    RENDER: 'false',
    UPLOADS_DIR: path.resolve(projectDir, 'persistent-uploads')
  }),
  []
);
assert.equal(
  productionConfigurationErrors({
    ...validR2ProductionEnvironment,
    UPLOADS_DIR: 'relative-path-that-r2-does-not-use'
  }).some(error => error.includes('UPLOADS_DIR')),
  false
);
assert.equal(
  productionConfigurationErrors({
    ...validLocalProductionEnvironment,
    R2_ENDPOINT: 'not-used-by-local-storage',
    R2_BUCKET_NAME: 'INVALID_LOCAL_VALUE'
  }).some(error => error.includes('R2_')),
  false
);

for (const [key, value] of Object.entries({
  R2_ENDPOINT: 'https://r2.example.com',
  R2_BUCKET_NAME: 'Invalid_Bucket',
  R2_ACCESS_KEY_ID: 'replace-with-access-key',
  R2_SECRET_ACCESS_KEY: 'replace-with-secret-key',
  R2_PREFIX: '../production',
  R2_REQUEST_TIMEOUT_MS: '999'
})) {
  const errors = productionConfigurationErrors({ ...validR2ProductionEnvironment, [key]: value });
  assert.equal(errors.some(error => error.includes(key)), true, `${key} must be validated for R2 storage.`);
}
for (const key of ['R2_ENDPOINT', 'R2_BUCKET_NAME', 'R2_ACCESS_KEY_ID', 'R2_SECRET_ACCESS_KEY']) {
  const errors = productionConfigurationErrors({ ...validR2ProductionEnvironment, [key]: '' });
  assert.equal(errors.some(error => error.includes(key)), true, `${key} must be required for R2 storage.`);
}
assert.equal(
  productionConfigurationErrors({
    ...validLocalProductionEnvironment,
    SESSION_SECRET: SESSION_SECRET_PLACEHOLDER
  }).some(error => error.includes('SESSION_SECRET')),
  true
);
assert.equal(
  productionConfigurationErrors({
    ...validLocalProductionEnvironment,
    SESSION_SECRET: validLocalProductionEnvironment.ADMIN_PASSWORD
  }).some(error => error.includes('SESSION_SECRET')),
  true
);
assert.equal(
  productionConfigurationErrors({
    ...validLocalProductionEnvironment,
    VITE_ADMIN_ENTRY_PATH: ADMIN_ENTRY_PATH_PLACEHOLDER
  }).some(error => error.includes('VITE_ADMIN_ENTRY_PATH')),
  true
);

const [
  packageSource,
  renderConfig,
  gitignore,
  nodeVersion,
  serverSource,
  sessionVerifier,
  storageVerifier,
  envExampleSource
] = await Promise.all([
  readProjectFile('package.json'),
  readProjectFile('render.yaml'),
  readProjectFile('.gitignore'),
  readProjectFile('.node-version'),
  readProjectFile('server.js'),
  readProjectFile('scripts/verify-session-guards.mjs'),
  readProjectFile('scripts/verify-storage.mjs'),
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
  STORAGE_PROVIDER: 'r2',
  R2_ENDPOINT: validR2ProductionEnvironment.R2_ENDPOINT,
  R2_BUCKET_NAME: validR2ProductionEnvironment.R2_BUCKET_NAME,
  R2_ACCESS_KEY_ID: validR2ProductionEnvironment.R2_ACCESS_KEY_ID,
  R2_SECRET_ACCESS_KEY: validR2ProductionEnvironment.R2_SECRET_ACCESS_KEY,
  R2_PREFIX: validR2ProductionEnvironment.R2_PREFIX
});
assert.equal(exampleErrors.some(error => error.includes('SESSION_SECRET')), true);
assert.equal(exampleErrors.some(error => error.includes('VITE_ADMIN_ENTRY_PATH')), true);

assert.equal(packageJson.scripts.start, 'node server.js');
assert.match(packageJson.scripts.check, /verify:phase13/);
assert.equal(packageJson.scripts['verify:storage'], 'node scripts/verify-storage.mjs');
assert.match(packageJson.scripts.check, /verify:storage/);
assert.match(renderConfig, /branch:\s*main/);
assert.match(renderConfig, /buildCommand:\s*npm ci --include=dev && npm run check/);
assert.match(renderConfig, /startCommand:\s*npm start/);
assert.match(renderConfig, /healthCheckPath:\s*\/api\/health/);
assert.match(renderConfig, /key:\s*STORAGE_PROVIDER\s*\r?\n\s*value:\s*r2/);
assert.doesNotMatch(renderConfig, /^\s*disk:\s*$/m);
assert.doesNotMatch(renderConfig, /key:\s*UPLOADS_DIR/);
assert.match(gitignore, /^\.env\.\*$/m);
assert.match(gitignore, /^!\.env\.example$/m);
assert.equal(nodeVersion.trim(), '24.14.1');
assert.match(serverSource, /assertProductionConfiguration\(process\.env\)/);
assert.match(serverSource, /createObjectStorage/);
assert.match(serverSource, /res\.status\(ready \? 200 : 503\)/);
assert.match(serverSource, /process\.once\('SIGTERM'/);
assert.match(serverSource, /await mongoose\.connect/);
assert.match(sessionVerifier, /STORAGE_PROVIDER:\s*'local'/);
assert.match(sessionVerifier, /UPLOADS_DIR:\s*verificationUploadsDir/);
assert.match(storageVerifier, /STORAGE_PROVIDER:\s*'local'/);
assert.match(storageVerifier, /STORAGE_PROVIDER:\s*'r2'/);
assert.match(envExampleSource, /^STORAGE_PROVIDER=local$/m);
for (const key of ['R2_ENDPOINT', 'R2_BUCKET_NAME', 'R2_ACCESS_KEY_ID', 'R2_SECRET_ACCESS_KEY', 'R2_PREFIX']) {
  assert.match(envExampleSource, new RegExp(`^# ${key}=`, 'm'), `.env.example must document ${key}.`);
}

console.log('Phase 13 local and R2 production configuration verification passed.');
