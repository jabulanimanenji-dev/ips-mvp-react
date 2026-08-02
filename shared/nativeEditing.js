export const NATIVE_EDITOR_VERSION = 1;

export const NATIVE_DEVICE_IDS = ['desktop', 'tablet', 'mobile'];

export const NATIVE_ELEMENT_KINDS = [
  'container',
  'text',
  'action',
  'field',
  'media'
];

export const NATIVE_STYLE_FIELDS = [
  'fontSize',
  'lineHeight',
  'fontWeight',
  'letterSpacing',
  'textAlign',
  'color',
  'backgroundColor',
  'width',
  'maxWidth',
  'minHeight',
  'paddingTop',
  'paddingRight',
  'paddingBottom',
  'paddingLeft',
  'marginTop',
  'marginRight',
  'marginBottom',
  'marginLeft',
  'gap',
  'borderRadius',
  'layout',
  'columns',
  'justifyContent',
  'alignItems',
  'objectFit',
  'objectPositionX',
  'objectPositionY',
  'translateX',
  'translateY',
  'scale'
];

export const emptyNativeEditing = () => ({
  version: NATIVE_EDITOR_VERSION,
  overrides: {}
});

const cleanText = (value, max = 600) => String(value ?? '')
  .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/g, '')
  .slice(0, max);

const cleanId = (value, max = 220) => cleanText(value, max).replace(/[^a-zA-Z0-9_.:-]/g, '-');
const cleanColor = value => /^#[0-9a-f]{6}$/i.test(String(value || '')) ? String(value) : '';
const clampOptional = (value, min, max) => {
  if (value === '' || value == null) return null;
  const number = Number(value);
  return Number.isFinite(number) ? Math.min(max, Math.max(min, number)) : null;
};

const cleanLink = value => {
  const link = cleanText(value, 500).trim();
  if (!link) return '';
  if (/^(\/|#)[A-Za-z0-9/_?&=#.%+:-]*$/.test(link)) return link;
  if (/^(https?:\/\/|mailto:|tel:)[^\s<>"']+$/i.test(link)) return link;
  return '';
};

const STYLE_NUMBER_RULES = {
  fontSize: [8, 180],
  lineHeight: [.6, 3],
  letterSpacing: [-8, 30],
  width: [20, 2400],
  maxWidth: [20, 2400],
  minHeight: [0, 3000],
  paddingTop: [0, 500],
  paddingRight: [0, 500],
  paddingBottom: [0, 500],
  paddingLeft: [0, 500],
  marginTop: [-500, 500],
  marginRight: [-500, 500],
  marginBottom: [-500, 500],
  marginLeft: [-500, 500],
  gap: [0, 240],
  borderRadius: [0, 300],
  columns: [1, 12],
  objectPositionX: [0, 100],
  objectPositionY: [0, 100],
  translateX: [-1200, 1200],
  translateY: [-1200, 1200],
  scale: [.2, 4]
};

const STYLE_ENUM_RULES = {
  fontWeight: ['300', '400', '500', '600', '700', '800', '900'],
  textAlign: ['left', 'center', 'right', 'justify'],
  layout: ['inherit', 'block', 'flex-row', 'flex-column', 'grid'],
  justifyContent: ['inherit', 'start', 'center', 'end', 'space-between', 'space-around', 'space-evenly'],
  alignItems: ['inherit', 'start', 'center', 'end', 'stretch'],
  objectFit: ['inherit', 'cover', 'contain', 'fill', 'none']
};

const normaliseNativeStyle = input => {
  const style = {};
  if (!input || typeof input !== 'object') return style;

  ['color', 'backgroundColor'].forEach(key => {
    const value = cleanColor(input[key]);
    if (value) style[key] = value;
  });

  Object.entries(STYLE_NUMBER_RULES).forEach(([key, [min, max]]) => {
    const value = clampOptional(input[key], min, max);
    if (value != null) style[key] = key === 'columns' ? Math.round(value) : value;
  });

  Object.entries(STYLE_ENUM_RULES).forEach(([key, allowed]) => {
    if (allowed.includes(String(input[key]))) style[key] = String(input[key]);
  });

  return style;
};

const normaliseNativeContent = input => {
  const content = {};
  if (!input || typeof input !== 'object') return content;
  if (Object.prototype.hasOwnProperty.call(input, 'text')) content.text = cleanText(input.text, 5000);
  if (Object.prototype.hasOwnProperty.call(input, 'placeholder')) content.placeholder = cleanText(input.placeholder, 500);
  if (Object.prototype.hasOwnProperty.call(input, 'alt')) content.alt = cleanText(input.alt, 500);
  if (Object.prototype.hasOwnProperty.call(input, 'title')) content.title = cleanText(input.title, 500);
  if (Object.prototype.hasOwnProperty.call(input, 'href')) content.href = cleanLink(input.href);
  if (Object.prototype.hasOwnProperty.call(input, 'assetId')) content.assetId = cleanId(input.assetId, 100);
  if (Object.prototype.hasOwnProperty.call(input, 'posterAssetId')) content.posterAssetId = cleanId(input.posterAssetId, 100);
  return content;
};

export const normaliseNativeOverride = (input, fallbackKey = '') => {
  const key = cleanId(input?.key || fallbackKey);
  if (!key) return null;
  const visibility = {};
  const order = {};
  const styles = {};

  NATIVE_DEVICE_IDS.forEach(device => {
    visibility[device] = input?.visibility?.[device] !== false;
    const requestedOrder = clampOptional(input?.order?.[device], -99, 99);
    order[device] = requestedOrder == null ? null : Math.round(requestedOrder);
    styles[device] = normaliseNativeStyle(input?.styles?.[device]);
  });

  return {
    key,
    sourceSignature: cleanId(input?.sourceSignature, 100),
    label: cleanText(input?.label || 'Page element', 160),
    tag: cleanText(input?.tag || '', 24).toLowerCase().replace(/[^a-z0-9-]/g, ''),
    kind: NATIVE_ELEMENT_KINDS.includes(input?.kind) ? input.kind : 'container',
    content: normaliseNativeContent(input?.content),
    visibility,
    order,
    styles
  };
};

export const normaliseNativeEditing = input => {
  const overrides = {};
  const rawOverrides = input?.overrides && typeof input.overrides === 'object' ? input.overrides : {};
  Object.entries(rawOverrides).slice(0, 800).forEach(([key, value]) => {
    const override = normaliseNativeOverride(value, key);
    if (override) overrides[override.key] = override;
  });
  return { version: NATIVE_EDITOR_VERSION, overrides };
};

export const createNativeOverride = descriptor => normaliseNativeOverride({
  key: descriptor?.key,
  sourceSignature: descriptor?.sourceSignature,
  label: descriptor?.label,
  tag: descriptor?.tag,
  kind: descriptor?.kind,
  content: {},
  visibility: Object.fromEntries(NATIVE_DEVICE_IDS.map(device => [device, true])),
  order: Object.fromEntries(NATIVE_DEVICE_IDS.map(device => [device, null])),
  styles: Object.fromEntries(NATIVE_DEVICE_IDS.map(device => [device, {}]))
}, descriptor?.key);
