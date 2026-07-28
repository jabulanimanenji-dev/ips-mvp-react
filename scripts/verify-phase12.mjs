import assert from 'node:assert/strict';
import {
  DEFAULT_PLATFORM_CONFIG,
  HOME_SECTION_CATALOG,
  normalisePlatformConfig
} from '../shared/platformConfig.js';

const validated = normalisePlatformConfig(DEFAULT_PLATFORM_CONFIG);
assert.equal(validated.homeSections.length, HOME_SECTION_CATALOG.length);
assert.equal(validated.dashboardWidgets.admin.length, 5);
assert.ok(Object.keys(validated.buttons).length >= 14);

const unsafe = normalisePlatformConfig({
  ...DEFAULT_PLATFORM_CONFIG,
  theme: {
    ...DEFAULT_PLATFORM_CONFIG.theme,
    light: { ...DEFAULT_PLATFORM_CONFIG.theme.light, primary: 'javascript:alert(1)' }
  },
  navigation: {
    ...DEFAULT_PLATFORM_CONFIG.navigation,
    public: [{ id: 'unsafe', label: 'Unsafe', target: 'javascript:alert(1)', visible: true }]
  },
  content: { __proto__: { polluted: true }, hero: { headline: 'Safe content' } }
});

assert.equal(unsafe.theme.light.primary, DEFAULT_PLATFORM_CONFIG.theme.light.primary);
assert.equal(unsafe.navigation.public[0].target, '/');
assert.equal({}.polluted, undefined);
assert.equal(unsafe.content.hero.headline, 'Safe content');

const constrained = normalisePlatformConfig({
  ...DEFAULT_PLATFORM_CONFIG,
  layouts: {
    ...DEFAULT_PLATFORM_CONFIG.layouts,
    admin: { sidebarWidth: 9999, contentPadding: -50, density: 'invalid' }
  }
});
assert.equal(constrained.layouts.admin.sidebarWidth, 360);
assert.equal(constrained.layouts.admin.contentPadding, 12);
assert.equal(constrained.layouts.admin.density, 'comfortable');

console.log('Phase 12 configuration verification passed.');
