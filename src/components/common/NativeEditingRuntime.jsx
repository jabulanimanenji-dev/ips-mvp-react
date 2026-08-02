import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { NATIVE_DEVICE_IDS } from '../../../shared/nativeEditing.js';

const EDITABLE_SELECTOR = [
  '[data-studio-key]',
  'header', 'nav', 'main', 'footer', 'section', 'article', 'aside',
  'form', 'fieldset', 'div',
  'table', 'thead', 'tbody', 'tfoot', 'tr', 'td', 'ul', 'ol', 'dl', 'dt', 'dd',
  'figure', 'figcaption', 'blockquote', 'pre', 'code', 'picture',
  'h1', 'h2', 'h3', 'h4', 'h5', 'h6',
  'p', 'span', 'small', 'strong', 'em', 'label', 'legend', 'summary',
  'button', 'a', 'li', 'th', 'caption', 'option',
  'input', 'textarea', 'select', 'img', 'video'
].join(',');

const TEXT_TAGS = new Set(['H1', 'H2', 'H3', 'H4', 'H5', 'H6', 'P', 'SPAN', 'SMALL', 'STRONG', 'EM', 'LABEL', 'LEGEND', 'SUMMARY', 'BUTTON', 'A', 'LI', 'TH', 'CAPTION', 'OPTION']);
const FIELD_TAGS = new Set(['INPUT', 'TEXTAREA', 'SELECT']);
const MEDIA_TAGS = new Set(['IMG', 'VIDEO']);
const ACTION_TAGS = new Set(['BUTTON', 'A']);

const STYLE_PROPERTIES = [
  'display', 'fontSize', 'lineHeight', 'fontWeight', 'letterSpacing', 'textAlign',
  'color', 'backgroundColor', 'backgroundImage', 'backgroundSize', 'backgroundPosition',
  'width', 'maxWidth', 'minHeight',
  'paddingTop', 'paddingRight', 'paddingBottom', 'paddingLeft',
  'marginTop', 'marginRight', 'marginBottom', 'marginLeft',
  'gap', 'borderRadius', 'flexDirection', 'gridTemplateColumns',
  'justifyContent', 'alignItems', 'objectFit', 'objectPosition', 'order', 'transform'
];

const originalValues = new WeakMap();

const deviceFromWidth = width => width <= 767 ? 'mobile' : width <= 1024 ? 'tablet' : 'desktop';

const hash = value => {
  let result = 2166136261;
  for (let index = 0; index < value.length; index += 1) {
    result ^= value.charCodeAt(index);
    result = Math.imul(result, 16777619);
  }
  return (result >>> 0).toString(36);
};

const cleanClassName = node => [...(node.classList || [])]
  .filter(name => !name.startsWith('is-') && !name.startsWith('has-') && !name.startsWith('studio-'))
  .filter(name => !/^(active|selected|open|closed|loading|disabled|error|success|warning|status-|priority-|badge-)/i.test(name))
  .slice(0, 2)
  .join('.');

const structuralPath = (node, root) => {
  const parts = [];
  let current = node;
  while (current && current !== root) {
    const explicit = current.getAttribute?.('data-studio-key');
    if (explicit && !current.hasAttribute('data-studio-generated-key')) {
      parts.unshift(`key:${explicit}`);
      break;
    }
    const tag = current.tagName?.toLowerCase() || 'node';
    const siblings = current.parentElement ? [...current.parentElement.children].filter(item => item.tagName === current.tagName) : [];
    const index = Math.max(0, siblings.indexOf(current));
    const section = current.getAttribute?.('data-builder-section');
    const name = current.getAttribute?.('name');
    const id = current.id;
    const classes = cleanClassName(current);
    const semantic = section ? `[section=${section}]` : id ? `#${id}` : name ? `[name=${name}]` : classes ? `.${classes}` : '';
    parts.unshift(`${tag}${semantic}:${index}`);
    current = current.parentElement;
  }
  return parts.join('>');
};

const kindFor = node => {
  if (MEDIA_TAGS.has(node.tagName)) return 'media';
  if (FIELD_TAGS.has(node.tagName)) return 'field';
  if (ACTION_TAGS.has(node.tagName)) return 'action';
  if (TEXT_TAGS.has(node.tagName)) return 'text';
  return 'container';
};

const directTextNodes = node => [...node.childNodes].filter(child => child.nodeType === Node.TEXT_NODE && child.nodeValue?.trim());
const directTextEditable = node => directTextNodes(node).length > 0;
const directTextValue = node => directTextNodes(node).map(child => child.nodeValue).join(' ').replace(/\s+/g, ' ').trim();

const labelFor = node => {
  const requested = node.getAttribute('data-studio-label') || node.getAttribute('aria-label') || node.getAttribute('title');
  if (requested) return requested.trim().slice(0, 160);
  const text = directTextEditable(node) ? directTextValue(node) : '';
  if (text) return text.slice(0, 160);
  const placeholder = node.getAttribute('placeholder');
  if (placeholder) return placeholder.slice(0, 160);
  const classes = cleanClassName(node).replaceAll('.', ' ');
  return `${node.tagName.toLowerCase()}${classes ? ` · ${classes}` : ''}`;
};

const ensureOriginal = (node, descriptor) => {
  if (originalValues.has(node)) return originalValues.get(node);
  const style = Object.fromEntries(STYLE_PROPERTIES.map(property => [property, node.style[property] || '']));
  const original = {
    style,
    textNodes: descriptor.textEditable ? directTextNodes(node).map(textNode => ({ node: textNode, value: textNode.nodeValue })) : [],
    placeholder: node.getAttribute('placeholder'),
    alt: node.getAttribute('alt'),
    title: node.getAttribute('title'),
    href: node.getAttribute('href'),
    src: node.getAttribute('src'),
    poster: node.getAttribute('poster')
  };
  originalValues.set(node, original);
  return original;
};

const restoreAttribute = (node, name, value) => {
  if (value == null) node.removeAttribute(name);
  else node.setAttribute(name, value);
};

const publishCatalog = (pageId, descriptors) => {
  const detail = { pageId, elements: [...descriptors.values()] };
  window.dispatchEvent(new CustomEvent('ips-studio-catalog', { detail }));
  if (window.parent && window.parent !== window) {
    window.__IPS_STUDIO_CATALOG__ = detail;
    window.parent.postMessage({ type: 'ips-preview-native-catalog', ...detail }, window.location.origin);
  }
};

const pixel = value => value == null ? null : `${value}px`;

const applyLayout = (node, style, base) => {
  if (style.layout === 'block') {
    node.style.display = 'block';
    node.style.flexDirection = base.flexDirection;
    node.style.gridTemplateColumns = base.gridTemplateColumns;
  } else if (style.layout === 'flex-row' || style.layout === 'flex-column') {
    node.style.display = 'flex';
    node.style.flexDirection = style.layout === 'flex-row' ? 'row' : 'column';
    node.style.gridTemplateColumns = base.gridTemplateColumns;
  } else if (style.layout === 'grid') {
    node.style.display = 'grid';
    node.style.gridTemplateColumns = `repeat(${style.columns || 1}, minmax(0, 1fr))`;
    node.style.flexDirection = base.flexDirection;
  } else {
    node.style.display = base.display;
    node.style.flexDirection = base.flexDirection;
    node.style.gridTemplateColumns = base.gridTemplateColumns;
  }
};

const applyStyle = (node, style, order, visible, original) => {
  const base = original.style;
  STYLE_PROPERTIES.forEach(property => { node.style[property] = base[property]; });
  if (!visible) {
    node.style.setProperty('display', 'none', 'important');
    return;
  }

  applyLayout(node, style, base);
  const pixelFields = [
    'fontSize', 'letterSpacing', 'width', 'maxWidth', 'minHeight',
    'paddingTop', 'paddingRight', 'paddingBottom', 'paddingLeft',
    'marginTop', 'marginRight', 'marginBottom', 'marginLeft', 'gap', 'borderRadius'
  ];
  pixelFields.forEach(field => {
    if (style[field] != null) node.style[field] = pixel(style[field]);
  });
  if (style.lineHeight != null) node.style.lineHeight = String(style.lineHeight);
  ['fontWeight', 'textAlign', 'color', 'backgroundColor'].forEach(field => {
    if (style[field]) node.style[field] = style[field];
  });
  if (style.justifyContent && style.justifyContent !== 'inherit') node.style.justifyContent = style.justifyContent;
  if (style.alignItems && style.alignItems !== 'inherit') node.style.alignItems = style.alignItems;
  if (style.objectFit && style.objectFit !== 'inherit') node.style.objectFit = style.objectFit;
  if (style.objectPositionX != null || style.objectPositionY != null) {
    node.style.objectPosition = `${style.objectPositionX ?? 50}% ${style.objectPositionY ?? 50}%`;
    node.style.backgroundPosition = `${style.objectPositionX ?? 50}% ${style.objectPositionY ?? 50}%`;
  }
  if (order != null) node.style.order = String(order);
  const transforms = [];
  if (style.translateX != null || style.translateY != null) transforms.push(`translate(${style.translateX || 0}px, ${style.translateY || 0}px)`);
  if (style.scale != null) transforms.push(`scale(${style.scale})`);
  if (transforms.length) node.style.transform = `${base.transform || ''} ${transforms.join(' ')}`.trim();
};

const applyContent = (node, descriptor, content, original) => {
  if (descriptor.textEditable && original.textNodes.length) {
    const hasOverride = Object.prototype.hasOwnProperty.call(content, 'text');
    original.textNodes.forEach((entry, index) => {
      entry.node.nodeValue = hasOverride ? (index === 0 ? content.text : '') : entry.value;
    });
  }
  restoreAttribute(node, 'placeholder', Object.prototype.hasOwnProperty.call(content, 'placeholder') ? content.placeholder : original.placeholder);
  restoreAttribute(node, 'alt', Object.prototype.hasOwnProperty.call(content, 'alt') ? content.alt : original.alt);
  restoreAttribute(node, 'title', Object.prototype.hasOwnProperty.call(content, 'title') ? content.title : original.title);
  if (node.tagName === 'A') restoreAttribute(node, 'href', Object.prototype.hasOwnProperty.call(content, 'href') ? content.href : original.href);

  if (content.assetId) {
    const source = `/api/media/${encodeURIComponent(content.assetId)}`;
    if (MEDIA_TAGS.has(node.tagName)) node.setAttribute('src', source);
    else {
      node.style.backgroundImage = `url("${source}")`;
      node.style.backgroundSize = 'cover';
      node.style.backgroundPosition = node.style.backgroundPosition || '50% 50%';
    }
  } else if (MEDIA_TAGS.has(node.tagName)) restoreAttribute(node, 'src', original.src);
  if (node.tagName === 'VIDEO') restoreAttribute(node, 'poster', content.posterAssetId ? `/api/media/${encodeURIComponent(content.posterAssetId)}` : original.poster);
};

const descriptorFor = (node, root, pageId) => {
  const globalRoot = node.closest('[data-studio-global]');
  const globalScope = globalRoot?.getAttribute('data-studio-global')?.replace(/[^a-zA-Z0-9_.:-]/g, '-');
  const path = globalRoot
    ? (node === globalRoot ? 'root' : structuralPath(node, globalRoot))
    : structuralPath(node, root);
  const explicit = node.getAttribute('data-studio-key');
  const key = explicit && !node.hasAttribute('data-studio-generated-key')
    ? explicit
    : globalScope ? `global:${globalScope}:${hash(path)}` : `${pageId}:${hash(path)}`;
  const kind = kindFor(node);
  const protectedElement = node.closest('[data-studio-protected="true"]');
  const sourceText = directTextEditable(node) ? directTextValue(node) : '';
  const sourceSignature = hash(`${node.tagName}|${sourceText}|${node.getAttribute('placeholder') || ''}|${node.getAttribute('alt') || ''}|${node.getAttribute('href') || ''}`);
  return {
    key,
    sourceSignature,
    path,
    tag: node.tagName.toLowerCase(),
    kind,
    label: labelFor(node),
    editable: !protectedElement,
    protectedReason: protectedElement?.getAttribute('data-studio-protected-reason') || '',
    textEditable: directTextEditable(node),
    placeholderEditable: FIELD_TAGS.has(node.tagName),
    altEditable: node.tagName === 'IMG',
    linkEditable: node.tagName === 'A',
    mediaEditable: MEDIA_TAGS.has(node.tagName) || kind === 'container',
    video: node.tagName === 'VIDEO',
    current: {
      text: sourceText.slice(0, 5000),
      placeholder: node.getAttribute('placeholder') || '',
      alt: node.getAttribute('alt') || '',
      title: node.getAttribute('title') || '',
      href: node.getAttribute('href') || ''
    }
  };
};

export default function useNativeEditingRuntime({ rootRef, pageId, editing, previewDevice }) {
  const nodesRef = useRef(new Map());
  const descriptorsRef = useRef(new Map());
  const editingRef = useRef(editing);
  const [liveDevice, setLiveDevice] = useState(() => deviceFromWidth(typeof window === 'undefined' ? 1440 : window.innerWidth));
  const device = NATIVE_DEVICE_IDS.includes(previewDevice) ? previewDevice : liveDevice;

  editingRef.current = editing;

  const overrides = useMemo(() => editing?.overrides || {}, [editing]);

  useEffect(() => {
    if (NATIVE_DEVICE_IDS.includes(previewDevice)) return undefined;
    const resize = () => setLiveDevice(deviceFromWidth(window.innerWidth));
    window.addEventListener('resize', resize);
    return () => window.removeEventListener('resize', resize);
  }, [previewDevice]);

  useEffect(() => {
    const root = rootRef.current;
    if (!root) return undefined;
    let frame = 0;

    const scan = () => {
      frame = 0;
      const nodes = [root, ...root.querySelectorAll(EDITABLE_SELECTOR)]
        .filter((node, index, list) => list.indexOf(node) === index)
        .filter(node => !node.closest('[data-studio-ignore="true"]'))
        .filter(node => !['SCRIPT', 'STYLE', 'SVG', 'PATH', 'NOSCRIPT'].includes(node.tagName))
        .slice(0, 800);
      const nextNodes = new Map();
      const nextDescriptors = new Map();
      nodes.forEach(node => {
        const authoredKey = node.hasAttribute('data-studio-key') && !node.hasAttribute('data-studio-generated-key');
        const descriptor = descriptorFor(node, root, pageId);
        if (!authoredKey) {
          node.setAttribute('data-studio-key', descriptor.key);
          node.setAttribute('data-studio-generated-key', 'true');
        }
        node.setAttribute('data-studio-kind', descriptor.kind);
        node.setAttribute('data-studio-editable', String(descriptor.editable));
        nextNodes.set(descriptor.key, node);
        nextDescriptors.set(descriptor.key, descriptor);
        ensureOriginal(node, descriptor);
      });
      nodesRef.current = nextNodes;
      descriptorsRef.current = nextDescriptors;
      publishCatalog(pageId, nextDescriptors);
      Object.entries(editingRef.current?.overrides || {}).forEach(([key, override]) => {
        const node = nextNodes.get(key);
        const descriptor = nextDescriptors.get(key);
        if (!node || !descriptor || !descriptor.editable) return;
        const original = ensureOriginal(node, descriptor);
        applyStyle(node, override.styles?.[device] || {}, override.order?.[device], override.visibility?.[device] !== false, original);
        applyContent(node, descriptor, !override.sourceSignature || override.sourceSignature === descriptor.sourceSignature ? override.content || {} : {}, original);
      });
    };

    const schedule = () => {
      if (frame) return;
      frame = window.requestAnimationFrame(scan);
    };
    const republishCatalog = event => {
      if (event.origin !== window.location.origin || event.data?.type !== 'ips-preview-request-native-catalog') return;
      if (event.data?.pageId && event.data.pageId !== pageId) return;
      if (descriptorsRef.current.size) publishCatalog(pageId, descriptorsRef.current);
      else schedule();
    };
    scan();
    const observer = new MutationObserver(schedule);
    observer.observe(root, { childList: true, subtree: true });
    window.addEventListener('message', republishCatalog);
    return () => {
      observer.disconnect();
      window.removeEventListener('message', republishCatalog);
      if (frame) window.cancelAnimationFrame(frame);
      nodesRef.current.forEach((node, key) => {
        const descriptor = descriptorsRef.current.get(key);
        const original = originalValues.get(node);
        if (!original || !descriptor) return;
        applyContent(node, descriptor, {}, original);
        STYLE_PROPERTIES.forEach(property => { node.style[property] = original.style[property]; });
        if (node.hasAttribute('data-studio-generated-key')) {
          node.removeAttribute('data-studio-key');
          node.removeAttribute('data-studio-generated-key');
        }
        node.removeAttribute('data-studio-kind');
        node.removeAttribute('data-studio-editable');
        node.classList.remove('is-studio-selected');
      });
      nodesRef.current.clear();
      descriptorsRef.current.clear();
    };
  }, [device, pageId, rootRef]);

  useLayoutEffect(() => {
    nodesRef.current.forEach((node, key) => {
      const descriptor = descriptorsRef.current.get(key);
      const original = originalValues.get(node);
      if (!descriptor || !original) return;
      const override = overrides[key];
      if (!override || !descriptor.editable) {
        applyContent(node, descriptor, {}, original);
        applyStyle(node, {}, null, true, original);
        return;
      }
      applyStyle(node, override.styles?.[device] || {}, override.order?.[device], override.visibility?.[device] !== false, original);
      applyContent(node, descriptor, !override.sourceSignature || override.sourceSignature === descriptor.sourceSignature ? override.content || {} : {}, original);
    });
    if (descriptorsRef.current.size) {
      publishCatalog(pageId, descriptorsRef.current);
    }
  }, [device, overrides, pageId]);

  return { device };
}
