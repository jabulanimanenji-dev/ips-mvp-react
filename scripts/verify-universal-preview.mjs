import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { PAGE_CATALOG } from '../shared/platformConfig.js';
import {
  PREVIEW_DYNAMIC_PAGE_IDS,
  PREVIEW_RENDERED_PAGE_IDS,
  resolvePreviewPath
} from '../shared/platformPreview.js';

const scriptsDir = path.dirname(fileURLToPath(import.meta.url));
const projectDir = path.resolve(scriptsDir, '..');
const read = relative => readFile(path.join(projectDir, relative), 'utf8');

assert.equal(PAGE_CATALOG.length, 41, 'The governed page registry must contain 41 pages.');
assert.deepEqual(
  Object.fromEntries(['public', 'client', 'writer', 'admin'].map(portal => [portal, PAGE_CATALOG.filter(page => page.portal === portal).length])),
  { public: 7, client: 9, writer: 8, admin: 17 }
);

const catalogIds = PAGE_CATALOG.map(page => page.id).sort();
const renderedIds = [...PREVIEW_RENDERED_PAGE_IDS].sort();
assert.deepEqual(renderedIds, catalogIds, 'Every page-registry entry must have a safe preview renderer.');
assert.equal(new Set(PREVIEW_RENDERED_PAGE_IDS).size, 41, 'Preview renderer IDs must be unique.');
assert.equal(PREVIEW_DYNAMIC_PAGE_IDS.length, 6, 'Six detail screens require deterministic preview IDs.');

for (const page of PAGE_CATALOG) {
  const resolved = resolvePreviewPath(page.id, '/private-admin-preview');
  assert.ok(resolved.startsWith('/'), `${page.id} must resolve to an internal preview route.`);
  assert.doesNotMatch(resolved, /:\w+|@admin-entry/, `${page.id} must not retain an unresolved route parameter.`);
}

const [app, designer, frame, entry, fixtures, auth] = await Promise.all([
  read('src/preview/PlatformPreviewApp.jsx'),
  read('src/components/admin/PageDesignerV2.jsx'),
  read('src/components/admin/ResponsivePreviewFrame.jsx'),
  read('src/index.jsx'),
  read('src/preview/previewFixtures.js'),
  read('src/context/AuthContext.jsx')
]);

const expectedRoutes = [
  '/', '/services', '/quote', '/login', '/signup', '/join', '/become-a-provider',
  '/client', '/writer/login', '/writer', '/admin'
];
expectedRoutes.forEach(route => assert.ok(app.includes(`path="${route}"`), `Preview app is missing route ${route}.`));
[
  'ClientOverview', 'ClientOrderDetail', 'ClientOrderForm', 'ClientServices', 'ClientSupport',
  'WriterDashboard', 'WriterOrderDetail', 'ProviderServices',
  'AdminDashboard', 'AdminOrderDetail', 'AdminServices', 'AdminAccessManager', 'AdminSupportTickets',
  'ServiceJobDetail', 'ActionCenter', 'DirectMessaging', 'PlatformStudioPreviewSummary'
].forEach(component => assert.match(app, new RegExp(`<${component}\\b`), `Preview app does not render ${component}.`));

assert.doesNotMatch(designer, /next conversion batch/i);
assert.doesNotMatch(designer, /page-designer-static-frame/);
assert.match(designer, /pageId=\{pageId\}/);
assert.match(designer, /config=\{draft\}/);
assert.match(designer, /Sample preview only/);
assert.match(frame, /src="\/__platform-preview"/);
assert.match(frame, /ips-preview-update/);
assert.match(entry, /installPreviewSafetyRuntime/);
assert.match(entry, /isPlatformPreview/);
assert.match(fixtures, /url\.pathname\.startsWith\('\/api\/'\)/);
assert.match(fixtures, /window\.confirm = \(\) => false/);
assert.match(auth, /export function PreviewAuthProvider/);
assert.match(auth, /isSuperAdmin: true/);

console.log('Universal Platform Studio preview verification passed: all 41 pages are mapped to isolated, role-aware, sample-data renderers.');
