export const HERO_DEVICE_IDS = ['desktop', 'tablet', 'mobile'];

export const HERO_ELEMENT_IDS = [
  'badge',
  'eyebrow',
  'headline',
  'subheadline',
  'search',
  'popular',
  'actions',
  'trust'
];

export const HERO_ELEMENT_LABELS = {
  badge: 'Badge',
  eyebrow: 'Eyebrow',
  headline: 'Headline',
  subheadline: 'Supporting text',
  search: 'Service search',
  popular: 'Popular searches',
  actions: 'Action buttons',
  trust: 'Trust items'
};

const allVisible = Object.fromEntries(HERO_ELEMENT_IDS.map(id => [id, true]));

export const HERO_RESPONSIVE_DEFAULTS = {
  desktop: {
    headlineFontSize: 74,
    headlineLineHeight: 1.02,
    subheadlineFontSize: 20,
    subheadlineLineHeight: 1.65,
    contentMaxWidth: 900,
    sectionHeightMode: 'minimum',
    sectionMinHeight: 620,
    paddingTop: 112,
    paddingBottom: 96,
    horizontalPadding: 24,
    elementSpacing: 18,
    alignment: 'center',
    verticalAlignment: 'center',
    backgroundPositionX: 50,
    backgroundPositionY: 50,
    buttonLayout: 'row',
    buttonsFullWidth: false,
    searchLayout: 'row',
    searchButtonFullWidth: false,
    visibility: { ...allVisible },
    elementOrder: [...HERO_ELEMENT_IDS]
  },
  tablet: {
    headlineFontSize: 58,
    headlineLineHeight: 1.06,
    subheadlineFontSize: 18,
    subheadlineLineHeight: 1.55,
    contentMaxWidth: 680,
    sectionHeightMode: 'minimum',
    sectionMinHeight: 700,
    paddingTop: 88,
    paddingBottom: 72,
    horizontalPadding: 28,
    elementSpacing: 16,
    alignment: 'center',
    verticalAlignment: 'center',
    backgroundPositionX: 50,
    backgroundPositionY: 50,
    buttonLayout: 'row',
    buttonsFullWidth: false,
    searchLayout: 'row',
    searchButtonFullWidth: false,
    visibility: { ...allVisible },
    elementOrder: [...HERO_ELEMENT_IDS]
  },
  mobile: {
    headlineFontSize: 42,
    headlineLineHeight: 1.08,
    subheadlineFontSize: 17,
    subheadlineLineHeight: 1.5,
    contentMaxWidth: 360,
    sectionHeightMode: 'minimum',
    sectionMinHeight: 720,
    paddingTop: 64,
    paddingBottom: 52,
    horizontalPadding: 20,
    elementSpacing: 14,
    alignment: 'center',
    verticalAlignment: 'center',
    backgroundPositionX: 50,
    backgroundPositionY: 50,
    buttonLayout: 'column',
    buttonsFullWidth: true,
    searchLayout: 'column',
    searchButtonFullWidth: true,
    visibility: {
      ...allVisible,
      eyebrow: false,
      trust: false
    },
    elementOrder: [...HERO_ELEMENT_IDS]
  }
};

const clamp = (value, min, max, fallback) => {
  const number = Number(value);
  return Number.isFinite(number) ? Math.min(max, Math.max(min, number)) : fallback;
};

const oneOf = (value, allowed, fallback) => allowed.includes(value) ? value : fallback;

const normaliseOrder = value => {
  const requested = Array.isArray(value) ? value : [];
  const result = [];
  requested.forEach(id => {
    if (HERO_ELEMENT_IDS.includes(id) && !result.includes(id)) result.push(id);
  });
  HERO_ELEMENT_IDS.forEach(id => {
    if (!result.includes(id)) result.push(id);
  });
  return result;
};

const legacyPosition = value => {
  const text = String(value || '').toLowerCase();
  return {
    x: text.includes('left') ? 0 : text.includes('right') ? 100 : 50,
    y: text.includes('top') ? 0 : text.includes('bottom') ? 100 : 50
  };
};

export function normaliseHeroResponsive(input = {}, legacyHero = {}) {
  const legacyFocalPoint = legacyPosition(legacyHero.backgroundPosition);

  return Object.fromEntries(HERO_DEVICE_IDS.map(device => {
    const fallback = HERO_RESPONSIVE_DEFAULTS[device];
    const source = input?.[device] || {};
    const useLegacy = device === 'desktop';
    const visibilitySource = source.visibility || {};

    return [device, {
      headlineFontSize: clamp(source.headlineFontSize, 24, 120, fallback.headlineFontSize),
      headlineLineHeight: clamp(source.headlineLineHeight, 0.85, 1.8, fallback.headlineLineHeight),
      subheadlineFontSize: clamp(source.subheadlineFontSize, 12, 42, fallback.subheadlineFontSize),
      subheadlineLineHeight: clamp(source.subheadlineLineHeight, 1, 2.2, fallback.subheadlineLineHeight),
      contentMaxWidth: clamp(source.contentMaxWidth ?? (useLegacy ? legacyHero.contentWidth : undefined), 240, 1400, fallback.contentMaxWidth),
      sectionHeightMode: oneOf(source.sectionHeightMode, ['auto', 'minimum', 'exact', 'viewport'], fallback.sectionHeightMode),
      sectionMinHeight: clamp(source.sectionMinHeight ?? (useLegacy ? legacyHero.height : undefined), 360, 1600, fallback.sectionMinHeight),
      paddingTop: clamp(source.paddingTop, 0, 320, fallback.paddingTop),
      paddingBottom: clamp(source.paddingBottom, 0, 320, fallback.paddingBottom),
      horizontalPadding: clamp(source.horizontalPadding, 0, 160, fallback.horizontalPadding),
      elementSpacing: clamp(source.elementSpacing, 0, 80, fallback.elementSpacing),
      alignment: oneOf(source.alignment ?? (useLegacy ? legacyHero.alignment : undefined), ['left', 'center', 'right'], fallback.alignment),
      verticalAlignment: oneOf(source.verticalAlignment, ['start', 'center', 'end'], fallback.verticalAlignment),
      backgroundPositionX: clamp(source.backgroundPositionX ?? (useLegacy ? legacyFocalPoint.x : undefined), 0, 100, fallback.backgroundPositionX),
      backgroundPositionY: clamp(source.backgroundPositionY ?? (useLegacy ? legacyFocalPoint.y : undefined), 0, 100, fallback.backgroundPositionY),
      buttonLayout: oneOf(source.buttonLayout, ['row', 'column'], fallback.buttonLayout),
      buttonsFullWidth: source.buttonsFullWidth == null ? fallback.buttonsFullWidth : source.buttonsFullWidth === true,
      searchLayout: oneOf(source.searchLayout, ['row', 'column'], fallback.searchLayout),
      searchButtonFullWidth: source.searchButtonFullWidth == null ? fallback.searchButtonFullWidth : source.searchButtonFullWidth === true,
      visibility: Object.fromEntries(HERO_ELEMENT_IDS.map(id => [
        id,
        visibilitySource[id] == null ? fallback.visibility[id] : visibilitySource[id] !== false
      ])),
      elementOrder: normaliseOrder(source.elementOrder || fallback.elementOrder)
    }];
  }));
}

export const getHeroDeviceSettings = (hero, device = 'desktop') => {
  const responsive = normaliseHeroResponsive(hero?.responsive, hero || {});
  return responsive[HERO_DEVICE_IDS.includes(device) ? device : 'desktop'];
};

export const cloneHeroResponsiveDefaults = () => normaliseHeroResponsive(HERO_RESPONSIVE_DEFAULTS);
