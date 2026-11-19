import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {
  DEFAULT_PLATFORM_CONFIG,LEGACY_IPS_THEME_DEFAULTS,
  migrateLegacyIpsPalette,normalisePlatformConfig
} from '../shared/platformConfig.js';

test('canonical IPS public and three-workspace palette does not use old magenta or washed backgrounds',()=>{
  const {theme}=normalisePlatformConfig(DEFAULT_PLATFORM_CONFIG);
  assert.equal(theme.light.primary.toLowerCase(),'#183b53');
  assert.equal(theme.light.primaryDark.toLowerCase(),'#112c42');
  assert.equal(theme.light.background.toLowerCase(),'#f5f6f5');
  assert.equal(theme.light.surface.toLowerCase(),'#ffffff');
  assert.equal(theme.dark.primary.toLowerCase(),'#a8cbdf');
  assert.equal(theme.dark.background.toLowerCase(),'#101d28');
  assert.equal(theme.gradientStart.toLowerCase(),'#102a43');
  assert.equal(theme.gradientEnd.toLowerCase(),'#24465c');
});
test('persisted original IPS magenta CMS theme is migrated before JavaScript injects root CSS variables',()=>{
  const original={theme:{
    light:{...LEGACY_IPS_THEME_DEFAULTS.light},
    dark:{...LEGACY_IPS_THEME_DEFAULTS.dark},
    gradientStart:LEGACY_IPS_THEME_DEFAULTS.gradientStart,
    gradientEnd:LEGACY_IPS_THEME_DEFAULTS.gradientEnd
  }};
  const result=normalisePlatformConfig(original);
  const expected=normalisePlatformConfig(DEFAULT_PLATFORM_CONFIG);
  assert.deepEqual(result.theme.light,expected.theme.light);
  assert.deepEqual(result.theme.dark,expected.theme.dark);
  assert.equal(result.theme.gradientStart,expected.theme.gradientStart);
  assert.equal(result.theme.gradientEnd,expected.theme.gradientEnd);
  assert.notEqual(result.theme.light.primary.toLowerCase(),'#a305a6');
});
test('existing professional nonlegacy CMS color edits are retained and user settings do not get overwritten',()=>{
  const custom=normalisePlatformConfig({theme:{
    light:{...LEGACY_IPS_THEME_DEFAULTS.light,primary:'#274e66',accent:'#987246'},
    dark:{...LEGACY_IPS_THEME_DEFAULTS.dark,background:'#152333'},
    gradientStart:'#152c40'
  }});
  assert.equal(custom.theme.light.primary.toLowerCase(),'#274e66');
  assert.equal(custom.theme.light.accent.toLowerCase(),'#987246');
  assert.equal(custom.theme.dark.background.toLowerCase(),'#152333');
  assert.equal(custom.theme.light.surfaceAlt.toLowerCase(),'#f1f4f5');
  assert.equal(custom.theme.gradientStart.toLowerCase(),'#152c40');
  assert.equal(custom.theme.gradientEnd.toLowerCase(),'#24465c');
  assert.deepEqual(
    migrateLegacyIpsPalette(LEGACY_IPS_THEME_DEFAULTS.light,'light',DEFAULT_PLATFORM_CONFIG.theme.light),
    DEFAULT_PLATFORM_CONFIG.theme.light
  );
});
test('all supported portal surfaces import or inherit the same IPS company design system',()=>{
  const index=readFileSync(new URL('../src/index.jsx',import.meta.url),'utf8');
  const css=readFileSync(new URL('../src/styles/ips-brand-system.css',import.meta.url),'utf8');
  const root=readFileSync(new URL('../src/components/common/visual-page-layer.css',import.meta.url),'utf8');
  assert.match(index,/import '\.\/styles\/ips-brand-system\.css'/);
  for(const name of ['.admin-layout','.client-layout','.writer-layout','.phase12-shell',
    '.service-engine-shell','.page-designer-shell','.ips-eval-guide'])
    assert.ok(css.includes(name),'Missing company-level visual governance for '+name);
  assert.doesNotMatch(root,/\.visual-page-has-custom-background\s*>\s*\.visual-page-content\s*>\s*\*\s*\{/);
  assert.match(css,/\.ipsa-workspace \.platform-studio-kpis button/);
  assert.match(css,/\.ips-workspace-topbar/);
});
