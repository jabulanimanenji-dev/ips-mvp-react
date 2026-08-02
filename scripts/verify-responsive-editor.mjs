import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { DEFAULT_PLATFORM_CONFIG, normalisePlatformConfig } from '../shared/platformConfig.js';
import { HERO_ELEMENT_IDS } from '../shared/heroResponsive.js';
import { deviceForWidth } from '../shared/responsiveDevices.js';

const scriptsDir = path.dirname(fileURLToPath(import.meta.url));
const projectDir = path.resolve(scriptsDir, '..');
const read = relative => readFile(path.join(projectDir, relative), 'utf8');

const defaults = normalisePlatformConfig(DEFAULT_PLATFORM_CONFIG);
assert.equal(defaults.schemaVersion, 6);
assert.equal(defaults.content.hero.responsive.desktop.headlineFontSize, 74);
assert.equal(defaults.content.hero.responsive.tablet.headlineFontSize, 58);
assert.equal(defaults.content.hero.responsive.mobile.headlineFontSize, 42);
assert.equal(defaults.content.hero.responsive.mobile.sectionHeightMode, 'minimum');
assert.equal(defaults.content.hero.responsive.mobile.buttonLayout, 'column');
assert.equal(defaults.content.hero.responsive.mobile.buttonsFullWidth, true);
assert.equal(defaults.content.hero.responsive.mobile.visibility.eyebrow, false);
assert.deepEqual(defaults.content.hero.responsive.mobile.elementOrder, HERO_ELEMENT_IDS);
assert.equal(deviceForWidth(767), 'mobile');
assert.equal(deviceForWidth(768), 'tablet');
assert.equal(deviceForWidth(1024), 'tablet');
assert.equal(deviceForWidth(1025), 'desktop');

const constrained = normalisePlatformConfig({
  ...DEFAULT_PLATFORM_CONFIG,
  content: {
    hero: {
      responsive: {
        mobile: {
          headlineFontSize: 999,
          headlineLineHeight: -2,
          contentMaxWidth: 1,
          sectionHeightMode: 'impossible',
          sectionMinHeight: 99999,
          backgroundPositionX: -20,
          backgroundPositionY: 180,
          buttonLayout: 'diagonal',
          elementOrder: ['search', 'unsafe', 'search'],
          visibility: { badge: false }
        }
      }
    }
  },
  buttons: {
    ...DEFAULT_PLATFORM_CONFIG.buttons,
    heroPrimary: { ...DEFAULT_PLATFORM_CONFIG.buttons.heroPrimary, showOn: 'tablet' }
  }
});

const mobile = constrained.content.hero.responsive.mobile;
assert.equal(mobile.headlineFontSize, 120);
assert.equal(mobile.headlineLineHeight, .85);
assert.equal(mobile.contentMaxWidth, 240);
assert.equal(mobile.sectionHeightMode, 'minimum');
assert.equal(mobile.sectionMinHeight, 1600);
assert.equal(mobile.backgroundPositionX, 0);
assert.equal(mobile.backgroundPositionY, 100);
assert.equal(mobile.buttonLayout, 'column');
assert.equal(mobile.visibility.badge, false);
assert.equal(new Set(mobile.elementOrder).size, HERO_ELEMENT_IDS.length);
assert.equal(mobile.elementOrder[0], 'search');
assert.equal(constrained.buttons.heroPrimary.showOn, 'tablet');

const academic = new Map(defaults.serviceCatalog.services.filter(item => item.categoryId === 'academic').map(item => [item.id, item]));
assert.equal(academic.get('thesis-writing').startingPrice, 15);
assert.equal(academic.get('dissertation').startingPrice, 25);
assert.equal(academic.get('assignments').startingPrice, 12);
assert.equal(academic.get('phd-research').startingPrice, 40);
assert.equal(defaults.buttons.heroPrimary.target, '/quote');
assert.equal(defaults.buttons.heroSecondary.target, '#pricing');

const [designer, frame, hero, navbar, app, quote] = await Promise.all([
  read('src/components/admin/PageDesignerV2.jsx'),
  read('src/components/admin/ResponsivePreviewFrame.jsx'),
  read('src/components/public/Hero.jsx'),
  read('src/components/common/Navbar.jsx'),
  read('src/App.jsx'),
  read('src/pages/QuotePage.jsx')
]);

assert.match(designer, /DEVICE_PRESETS/);
assert.match(designer, /setOrientation/);
assert.match(designer, /setFitPreview\(false\)/);
assert.match(designer, /deviceForWidth/);
assert.match(designer, /runDiagnostics/);
assert.match(designer, /block-vertical/);
assert.match(designer, /element visibility & order/);
assert.match(frame, /__platform-preview/);
assert.match(frame, /ips-preview-update/);
assert.match(frame, /postMessage/);
assert.match(hero, /getHeroDeviceSettings/);
assert.match(hero, /backgroundPositionX/);
assert.match(hero, /sectionHeightMode/);
assert.match(navbar, /site-navbar-mobile-toggle/);
assert.match(navbar, /aria-expanded/);
assert.match(app, /path="\/quote"/);
assert.match(quote, /const calculation = useMemo/);
assert.match(quote, /case 'thesis'/);
assert.match(quote, /case 'assignment'/);
assert.match(quote, /case 'project'/);
assert.match(quote, /case 'oddjob'/);
assert.match(quote, /to="\/client\/order"/);

console.log('Responsive Platform Studio verification passed with isolated device preview, per-device hero settings, mobile navigation, diagnostics, and preserved academic pricing.');
