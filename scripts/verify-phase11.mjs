import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  DEFAULT_PLATFORM_CONFIG,
  PAGE_CATALOG,
  normalisePlatformConfig,
  resolvePageDefinition
} from '../shared/platformConfig.js';
import {
  ADMIN_NAV_PERMISSIONS,
  ADMIN_PERMISSION_CATALOG,
  BUILT_IN_ADMIN_ROLES,
  hasAdminPermission,
  permissionForAdminRequest,
  rolePermissions
} from '../shared/adminPermissions.js';

const scriptsDir = path.dirname(fileURLToPath(import.meta.url));
const projectDir = path.resolve(scriptsDir, '..');
const read = relative => readFile(path.join(projectDir, relative), 'utf8');

const validated = normalisePlatformConfig(DEFAULT_PLATFORM_CONFIG);
assert.equal(validated.schemaVersion, 3);
assert.ok(PAGE_CATALOG.length >= 35);
assert.equal(Object.keys(validated.pageDesigns).length, PAGE_CATALOG.length);
assert.equal(resolvePageDefinition('/client/orders/ORDER-1').id, 'client.order-detail');
assert.equal(resolvePageDefinition('/hidden-admin', '/hidden-admin').id, 'admin.login');

const unsafe = normalisePlatformConfig({
  ...DEFAULT_PLATFORM_CONFIG,
  pageDesigns: {
    ...DEFAULT_PLATFORM_CONFIG.pageDesigns,
    'public.home': {
      background: { type: 'video', assetId: '../../danger.exe', overlayOpacity: 22 },
      elements: [{
        id: '<script>',
        type: 'iframe',
        text: '<script>alert(1)</script>',
        target: 'javascript:alert(1)',
        zIndex: 999,
        placement: {
          desktop: { x: -40, y: 99999, width: 99999, height: -1 }
        }
      }]
    }
  }
});
const unsafePage = unsafe.pageDesigns['public.home'];
assert.equal(unsafePage.background.overlayOpacity, 0.95);
assert.equal(unsafePage.background.assetId.includes('/'), false);
assert.equal(unsafePage.elements[0].type, 'text');
assert.equal(unsafePage.elements[0].target, '/');
assert.equal(unsafePage.elements[0].zIndex, 50);
assert.equal(unsafePage.elements[0].placement.desktop.x, 0);
assert.equal(unsafePage.elements[0].placement.desktop.y, 5000);
assert.equal(unsafePage.elements[0].placement.desktop.width, 1600);
assert.equal(unsafePage.elements[0].placement.desktop.height, 36);

assert.ok(ADMIN_PERMISSION_CATALOG.length >= 25);
assert.deepEqual(rolePermissions('superadmin'), ['*']);
assert.deepEqual(rolePermissions('custom', []), ['platform.access']);
assert.equal(hasAdminPermission({ permissions: ['orders.view'] }, 'orders.view'), true);
assert.equal(hasAdminPermission({ permissions: ['orders.view'] }, 'orders.manage'), false);
assert.equal(permissionForAdminRequest('GET', '/api/orders'), 'orders.view');
assert.equal(permissionForAdminRequest('PATCH', '/api/orders/1'), 'orders.manage');
assert.equal(permissionForAdminRequest('POST', '/api/admin/platform-config/publish'), 'design.publish');
assert.equal(permissionForAdminRequest('DELETE', '/api/admin/media/MEDIA-1'), 'media.manage');
assert.equal(permissionForAdminRequest('GET', '/api/media/MEDIA-1'), null);
assert.equal(ADMIN_NAV_PERMISSIONS['/admin/access'], 'administrators.manage');
assert.ok(BUILT_IN_ADMIN_ROLES.moderator.permissions.includes('messages.manage'));
assert.equal(BUILT_IN_ADMIN_ROLES.content.permissions.includes('design.publish'), false);

const [
  server,
  app,
  accessManager,
  designer,
  visualLayer,
  mediaModel
] = await Promise.all([
  read('server.js'),
  read('src/App.jsx'),
  read('src/components/admin/AdminAccessManager.jsx'),
  read('src/components/admin/PageDesignerV2.jsx'),
  read('src/components/common/VisualPageLayer.jsx'),
  read('models/MediaAsset.js')
]);

assert.match(server, /resolveAdminAccess/);
assert.match(server, /\/api\/admin\/change-password/);
assert.match(server, /\/api\/admin\/audit-logs/);
assert.match(server, /\/api\/admin\/media/);
assert.match(server, /sessionsRevoked: true/);
assert.match(app, /AdminAccessManager/);
assert.match(app, /VisualPageLayer/);
assert.match(app, /mustChangePassword/);
assert.match(accessManager, /Custom roles/);
assert.match(accessManager, /Reset password/);
assert.match(designer, /Drag a block anywhere/);
assert.match(designer, /Looping video/);
assert.match(visualLayer, /resolvePageDefinition/);
assert.match(mediaModel, /video\/webm/);

console.log(`Phase 11 verification passed: ${PAGE_CATALOG.length} pages, ${ADMIN_PERMISSION_CATALOG.length} permissions, responsive visual composition, governed media, and administrator hierarchy.`);
