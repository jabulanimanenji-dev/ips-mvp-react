import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { DEFAULT_PLATFORM_CONFIG, PAGE_CATALOG, normalisePlatformConfig } from '../shared/platformConfig.js';

const scriptsDir = path.dirname(fileURLToPath(import.meta.url));
const projectDir = path.resolve(scriptsDir, '..');
const read = relative => readFile(path.join(projectDir, relative), 'utf8');

const defaults = normalisePlatformConfig(DEFAULT_PLATFORM_CONFIG);
assert.equal(defaults.schemaVersion, 6);
assert.equal(PAGE_CATALOG.length, 41);
assert.equal(Object.keys(defaults.pageDesigns).length, 41);
assert.ok(PAGE_CATALOG.every(page => defaults.pageDesigns[page.id]?.nativeEditing?.version === 1));
assert.ok(PAGE_CATALOG.every(page => defaults.pageDesigns[page.id]?.background?.responsive?.mobile?.positionX === 50));
assert.ok(PAGE_CATALOG.every(page => defaults.pageDesigns[page.id]?.background?.positionX === 50));
assert.equal(defaults.globalNativeEditing.version, 1);

const pageId = 'admin.login';
const unsafe = normalisePlatformConfig({
  ...DEFAULT_PLATFORM_CONFIG,
  pageDesigns: {
    ...DEFAULT_PLATFORM_CONFIG.pageDesigns,
    [pageId]: {
      ...DEFAULT_PLATFORM_CONFIG.pageDesigns[pageId],
      nativeEditing: {
        overrides: {
          'admin.login:test': {
            key: 'admin.login:test',
            label: 'Test action',
            tag: 'a',
            kind: 'action',
            content: { text: 'Safe label', href: 'javascript:alert(1)' },
            visibility: { desktop: true, tablet: true, mobile: false },
            order: { desktop: 999, tablet: null, mobile: -999 },
            styles: { desktop: { fontSize: 999, color: '#ffffff', layout: 'grid', columns: 99 } }
          }
        }
      }
    }
  }
});

const override = unsafe.pageDesigns[pageId].nativeEditing.overrides['admin.login:test'];
assert.equal(override.content.text, 'Safe label');
assert.equal(override.content.href, '');
assert.equal(override.visibility.mobile, false);
assert.equal(override.order.desktop, 99);
assert.equal(override.order.mobile, -99);
assert.equal(override.styles.desktop.fontSize, 180);
assert.equal(override.styles.desktop.columns, 12);
assert.equal(override.styles.desktop.color, '#ffffff');

const [runtime, layer, designer, frame, preview, styles, navbar, footer] = await Promise.all([
  read('src/components/common/NativeEditingRuntime.jsx'),
  read('src/components/common/VisualPageLayer.jsx'),
  read('src/components/admin/PageDesignerV2.jsx'),
  read('src/components/admin/ResponsivePreviewFrame.jsx'),
  read('src/preview/PlatformPreviewApp.jsx'),
  read('src/components/common/visual-page-layer.css'),
  read('src/components/common/Navbar.jsx'),
  read('src/components/common/Footer.jsx')
]);

assert.match(runtime, /EDITABLE_SELECTOR/);
assert.match(runtime, /data-studio-key/);
assert.match(runtime, /global:/);
assert.match(runtime, /ips-preview-native-catalog/);
assert.match(runtime, /MutationObserver/);
assert.match(runtime, /textEditable/);
assert.match(layer, /globalNativeEditing/);
assert.match(layer, /visual-page-has-custom-background/);
assert.match(layer, /meta\[name="description"\]/);
assert.match(layer, /!designEnabled && !studioPreview/);
assert.match(designer, /Native page interface/);
assert.match(designer, /Selected interface element/);
assert.match(designer, /Choose background from Media Library/);
assert.match(designer, /background override/);
assert.match(designer, /editable interfaces/);
assert.match(designer, /Preview state/);
assert.match(designer, /Apply this page's Studio design on the live site/);
assert.match(frame, /ips-preview-native-element/);
assert.match(frame, /ips-preview-native-catalog/);
assert.match(preview, /selectedNativeKey/);
assert.match(preview, /previewState/);
assert.match(styles, /visual-page-has-custom-background/);
assert.match(navbar, /data-studio-global="public-header"/);
assert.match(footer, /data-studio-global="public-footer"/);

console.log('Universal page editor verification passed: all 41 governed interfaces share safe native content, media, responsive layout, global component, SEO, and preview-selection controls.');
