import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { PAGE_CATALOG, PORTAL_LABELS } from '../../../shared/platformConfig';
import {
  HERO_DEVICE_IDS,
  HERO_ELEMENT_LABELS,
  HERO_RESPONSIVE_DEFAULTS,
  normaliseHeroResponsive
} from '../../../shared/heroResponsive.js';
import { deviceForWidth } from '../../../shared/responsiveDevices.js';
import { isDynamicPreviewPage, resolvePreviewPath } from '../../../shared/platformPreview.js';
import { createNativeOverride, NATIVE_DEVICE_IDS } from '../../../shared/nativeEditing.js';
import { DEFAULT_CMS } from '../../utils/constants';
import { addToast } from '../common/Toast';
import ResponsivePreviewFrame from './ResponsivePreviewFrame';
import './page-designer-v2.css';

const DEVICE_PRESETS = [
  { id: 'desktop-1440', label: 'Desktop · 1440 × 900', device: 'desktop', width: 1440, height: 900 },
  { id: 'desktop-1280', label: 'Laptop · 1280 × 800', device: 'desktop', width: 1280, height: 800 },
  { id: 'tablet-768', label: 'Tablet · 768 × 1024', device: 'tablet', width: 768, height: 1024 },
  { id: 'phone-320', label: 'Small phone · 320 × 568', device: 'mobile', width: 320, height: 568 },
  { id: 'phone-360', label: 'Android · 360 × 800', device: 'mobile', width: 360, height: 800 },
  { id: 'phone-375', label: 'iPhone · 375 × 812', device: 'mobile', width: 375, height: 812 },
  { id: 'phone-390', label: 'Modern iPhone · 390 × 844', device: 'mobile', width: 390, height: 844 },
  { id: 'phone-412', label: 'Large Android · 412 × 915', device: 'mobile', width: 412, height: 915 },
  { id: 'phone-430', label: 'Large iPhone · 430 × 932', device: 'mobile', width: 430, height: 932 }
];

const DEFAULT_PRESET = {
  desktop: DEVICE_PRESETS[0],
  tablet: DEVICE_PRESETS[2],
  mobile: DEVICE_PRESETS[6]
};

const request = async url => {
  const response = await fetch(url, { credentials: 'same-origin' });
  const data = await response.json().catch(() => ({}));
  if (!response.ok || !data.success) throw new Error(data.error || 'Media could not be loaded.');
  return data;
};

const newPlacement = {
  desktop: { x: 50, y: 120, width: 320, height: 72 },
  tablet: { x: 50, y: 120, width: 300, height: 72 },
  mobile: { x: 50, y: 120, width: 280, height: 72 }
};

const newElement = type => ({
  id: `element-${Date.now()}`,
  type,
  text: type === 'button' ? 'New button' : type === 'banner' ? 'New announcement' : 'New content',
  assetId: '',
  alt: '',
  target: '/',
  backgroundColor: type === 'text' ? '' : '#A305A6',
  textColor: '#FFFFFF',
  borderRadius: 12,
  zIndex: 5,
  visible: true,
  showOn: 'all',
  placement: JSON.parse(JSON.stringify(newPlacement))
});

const assetUrl = id => `/api/media/${encodeURIComponent(id)}`;
const clamp = (value, min, max) => Math.min(max, Math.max(min, Number(value) || min));
const rectsOverlap = (a, b) => a.left < b.right - 2 && a.right > b.left + 2 && a.top < b.bottom - 2 && a.bottom > b.top + 2;

function NumberField({ label, value, min, max, step = 1, onChange, suffix = 'px' }) {
  return (
    <label className="phase12-field">
      <span>{label}{suffix ? ` · ${value}${suffix}` : ''}</span>
      <input className="form-input" type="number" min={min} max={max} step={step} value={value} onChange={event => onChange(Number(event.target.value))} />
    </label>
  );
}

function OptionalNumberField({ label, value, min, max, step = 1, onChange, suffix = 'px' }) {
  return (
    <label className="phase12-field">
      <span>{label}{value != null && suffix ? ` · ${value}${suffix}` : ''}</span>
      <input
        className="form-input"
        type="number"
        min={min}
        max={max}
        step={step}
        value={value ?? ''}
        placeholder="Inherit"
        onChange={event => onChange(event.target.value === '' ? null : Number(event.target.value))}
      />
    </label>
  );
}

const mediaReference = assetId => assetId ? `media:${assetId}` : '';
const referencedAssetId = value => String(value || '').startsWith('media:') ? String(value).slice(6) : '';

export default function PageDesignerV2({ draft, setDraft, onOpenMedia }) {
  const [portal, setPortal] = useState('public');
  const pages = useMemo(() => PAGE_CATALOG.filter(page => page.portal === portal), [portal]);
  const [pageId, setPageId] = useState('public.home');
  const [device, setDevice] = useState('desktop');
  const [previewState, setPreviewState] = useState('normal');
  const [viewportSize, setViewportSize] = useState({ width: 1440, height: 900 });
  const [fitPreview, setFitPreview] = useState(true);
  const [zoom, setZoom] = useState(100);
  const [stageWidth, setStageWidth] = useState(900);
  const [assets, setAssets] = useState([]);
  const [selectedElementId, setSelectedElementId] = useState('');
  const [selectedNativeKey, setSelectedNativeKey] = useState('');
  const [nativeCatalog, setNativeCatalog] = useState([]);
  const [nativeSearch, setNativeSearch] = useState('');
  const [newType, setNewType] = useState('button');
  const [draggingId, setDraggingId] = useState('');
  const [selectedSection, setSelectedSection] = useState('hero');
  const [previewDocument, setPreviewDocument] = useState(null);
  const [previewPageHeight, setPreviewPageHeight] = useState(0);
  const [diagnostics, setDiagnostics] = useState([]);
  const stage = useRef(null);
  const canvas = useRef(null);

  useEffect(() => {
    if (!pages.some(page => page.id === pageId)) setPageId(pages[0]?.id || 'public.home');
  }, [pages, pageId]);

  useEffect(() => {
    request('/api/admin/media')
      .then(data => setAssets(data.assets || []))
      .catch(error => addToast(error.message, 'error'));
  }, []);

  useEffect(() => {
    if (!stage.current) return undefined;
    const measure = () => setStageWidth(Math.max(320, stage.current?.clientWidth || 900));
    const observer = new ResizeObserver(measure);
    observer.observe(stage.current);
    measure();
    return () => observer.disconnect();
  }, []);

  const design = draft.pageDesigns?.[pageId];
  const elements = design?.elements || [];
  const selectedElement = elements.find(element => element.id === selectedElementId);
  const selectedNativeDescriptor = nativeCatalog.find(element => element.key === selectedNativeKey) || null;
  const selectedNativeIsGlobal = selectedNativeKey.startsWith('global:');
  const selectedNativeOverrides = selectedNativeIsGlobal
    ? draft.globalNativeEditing?.overrides || {}
    : design?.nativeEditing?.overrides || {};
  const selectedNativeOverride = selectedNativeKey
    ? selectedNativeOverrides[selectedNativeKey] || createNativeOverride(selectedNativeDescriptor)
    : null;
  const rawHero = draft.content?.hero || {};
  const hero = {
    ...DEFAULT_CMS.hero,
    ...rawHero,
    responsive: normaliseHeroResponsive(rawHero.responsive || DEFAULT_CMS.hero.responsive, rawHero)
  };
  const heroSettings = hero.responsive[device];
  const isHomePage = pageId === 'public.home';
  const pageRecord = PAGE_CATALOG.find(page => page.id === pageId);
  const pageLabel = pageRecord?.label;
  const previewPath = resolvePreviewPath(pageId, (import.meta.env.VITE_ADMIN_ENTRY_PATH || '/ips-mission-control').trim().replace(/\/+$/, ''));
  const selectedPlacement = selectedElement?.placement?.[device];
  const fitScale = Math.min(1, Math.max(.25, (stageWidth - 40) / viewportSize.width));
  const previewScale = fitPreview ? fitScale : clamp(zoom / 100, .25, 1.5);
  const matchingPreset = DEVICE_PRESETS.find(preset => preset.device === device && preset.width === viewportSize.width && preset.height === viewportSize.height);
  const orientation = viewportSize.width > viewportSize.height ? 'landscape' : 'portrait';
  const visibleElements = design?.enabled
    ? elements.filter(element => element.visible && (element.showOn === 'all' || element.showOn === device))
    : [];
  const overlayHeight = Math.max(
    viewportSize.height,
    previewPageHeight,
    design?.minHeight || 0,
    ...visibleElements.map(element => (element.placement?.[device]?.y || 0) + (element.placement?.[device]?.height || 0))
  );

  const updateDesign = patch => setDraft(previous => ({
    ...previous,
    pageDesigns: {
      ...previous.pageDesigns,
      [pageId]: { ...previous.pageDesigns[pageId], ...patch }
    }
  }));

  const updateHero = patch => setDraft(previous => ({
    ...previous,
    content: {
      ...previous.content,
      hero: { ...(previous.content?.hero || {}), ...patch }
    }
  }));

  const updateHeroDevice = patch => setDraft(previous => {
    const currentHero = previous.content?.hero || {};
    const responsive = normaliseHeroResponsive(currentHero.responsive || DEFAULT_CMS.hero.responsive, currentHero);
    return {
      ...previous,
      content: {
        ...previous.content,
        hero: {
          ...currentHero,
          responsive: {
            ...responsive,
            [device]: { ...responsive[device], ...patch }
          }
        }
      }
    };
  });

  const updateHeroList = (field, value) => updateHero({
    [field]: value.split('\n').map(item => item.trim()).filter(Boolean)
  });

  const updateBackground = patch => updateDesign({
    background: { ...design.background, ...patch }
  });

  const updateResponsiveBackground = patch => updateBackground({
    responsive: {
      ...(design.background.responsive || {}),
      [device]: { ...(design.background.responsive?.[device] || {}), ...patch }
    }
  });

  const updateSeo = patch => updateDesign({
    seo: { ...(design.seo || {}), ...patch }
  });

  const updateNativeOverride = patch => {
    if (!selectedNativeKey || !selectedNativeDescriptor?.editable) return;
    const current = selectedNativeOverrides[selectedNativeKey] || createNativeOverride(selectedNativeDescriptor);
    if (selectedNativeIsGlobal) {
      setDraft(previous => ({
        ...previous,
        globalNativeEditing: {
          version: 1,
          overrides: {
            ...(previous.globalNativeEditing?.overrides || {}),
            [selectedNativeKey]: { ...current, ...patch }
          }
        }
      }));
      return;
    }
    updateDesign({
      nativeEditing: {
        version: 1,
        overrides: {
          ...(design.nativeEditing?.overrides || {}),
          [selectedNativeKey]: { ...current, ...patch }
        }
      }
    });
  };

  const updateNativeContent = patch => updateNativeOverride({
    content: { ...(selectedNativeOverride?.content || {}), ...patch }
  });

  const updateNativeStyle = patch => updateNativeOverride({
    styles: {
      ...(selectedNativeOverride?.styles || {}),
      [device]: { ...(selectedNativeOverride?.styles?.[device] || {}), ...patch }
    }
  });

  const updateNativeVisibility = visible => updateNativeOverride({
    visibility: { ...(selectedNativeOverride?.visibility || {}), [device]: visible }
  });

  const updateNativeOrder = value => updateNativeOverride({
    order: { ...(selectedNativeOverride?.order || {}), [device]: value }
  });

  const resetNativeOverride = () => {
    if (!selectedNativeKey) return;
    setDraft(previous => {
      if (selectedNativeIsGlobal) {
        const overrides = { ...(previous.globalNativeEditing?.overrides || {}) };
        delete overrides[selectedNativeKey];
        return { ...previous, globalNativeEditing: { version: 1, overrides } };
      }
      const currentDesign = previous.pageDesigns?.[pageId] || {};
      const overrides = { ...(currentDesign.nativeEditing?.overrides || {}) };
      delete overrides[selectedNativeKey];
      return {
        ...previous,
        pageDesigns: {
          ...previous.pageDesigns,
          [pageId]: { ...currentDesign, nativeEditing: { version: 1, overrides } }
        }
      };
    });
    addToast('This element now inherits its original application design.', 'success');
  };

  const updateElement = (id, patch) => updateDesign({
    elements: elements.map(element => element.id === id ? { ...element, ...patch } : element)
  });

  const updateElementPlacement = (id, patch) => {
    const element = elements.find(item => item.id === id);
    if (!element) return;
    updateElement(id, {
      placement: {
        ...element.placement,
        [device]: { ...element.placement[device], ...patch }
      }
    });
  };

  const addElement = () => {
    const element = newElement(newType);
    updateDesign({ elements: [...elements, element] });
    setSelectedElementId(element.id);
    setSelectedNativeKey('');
  };

  const removeElement = id => {
    updateDesign({ elements: elements.filter(element => element.id !== id) });
    if (selectedElementId === id) setSelectedElementId('');
  };

  const duplicatePage = () => {
    const targets = PAGE_CATALOG.filter(page => page.portal === portal && page.id !== pageId);
    const targetId = window.prompt(`Copy this design to which page ID?\n${targets.map(page => `${page.id} — ${page.label}`).join('\n')}`);
    if (!targets.some(page => page.id === targetId)) return;
    const copied = JSON.parse(JSON.stringify(design));
    copied.id = targetId;
    copied.nativeEditing = {
      version: 1,
      overrides: Object.fromEntries(Object.entries(copied.nativeEditing?.overrides || {}).map(([key, override]) => {
        const nextKey = key.startsWith(`${pageId}:`) ? `${targetId}${key.slice(pageId.length)}` : key;
        return [nextKey, { ...override, key: nextKey }];
      }))
    };
    setDraft(previous => ({
      ...previous,
      pageDesigns: { ...previous.pageDesigns, [targetId]: copied }
    }));
    addToast(`Design copied to ${targetId}.`, 'success');
  };

  const applyPreset = preset => {
    setDevice(preset.device);
    setViewportSize({ width: preset.width, height: preset.height });
  };

  const switchDevice = nextDevice => applyPreset(DEFAULT_PRESET[nextDevice]);

  const setOrientation = nextOrientation => {
    const isLandscape = viewportSize.width > viewportSize.height;
    if ((nextOrientation === 'landscape') !== isLandscape) {
      const nextSize = { width: viewportSize.height, height: viewportSize.width };
      setViewportSize(nextSize);
      setDevice(deviceForWidth(nextSize.width));
    }
  };

  const startWidthResize = event => {
    event.preventDefault();
    const startX = event.clientX;
    const startWidth = viewportSize.width;
    const lockedScale = previewScale;
    if (fitPreview) {
      setZoom(Math.round(lockedScale * 100));
      setFitPreview(false);
    }
    const move = moveEvent => {
      const nextWidth = Math.round(clamp(startWidth + ((moveEvent.clientX - startX) / lockedScale), 280, 1600));
      setViewportSize(previous => ({ ...previous, width: nextWidth }));
      setDevice(deviceForWidth(nextWidth));
    };
    const stop = () => {
      window.removeEventListener('pointermove', move);
      window.removeEventListener('pointerup', stop);
    };
    window.addEventListener('pointermove', move);
    window.addEventListener('pointerup', stop);
  };

  const dropElement = event => {
    event.preventDefault();
    if (!draggingId || !canvas.current) return;
    const rect = canvas.current.getBoundingClientRect();
    const x = Math.max(0, Math.min(100, ((event.clientX - rect.left) / rect.width) * 100));
    const canvasScale = 1;
    const y = Math.max(0, (event.clientY - rect.top) / canvasScale);
    updateElementPlacement(draggingId, { x: Math.round(x * 10) / 10, y: Math.round(y) });
    setDraggingId('');
  };

  const moveHeroElement = (id, direction) => {
    const order = [...heroSettings.elementOrder];
    const index = order.indexOf(id);
    const target = index + direction;
    if (index < 0 || target < 0 || target >= order.length) return;
    [order[index], order[target]] = [order[target], order[index]];
    updateHeroDevice({ elementOrder: order });
  };

  const resetHeroDevice = () => {
    updateHeroDevice(JSON.parse(JSON.stringify(HERO_RESPONSIVE_DEFAULTS[device])));
    addToast(`${device} hero layout reset to the IPS responsive default.`, 'success');
  };

  const handlePreviewDocument = useCallback(documentValue => setPreviewDocument(documentValue), []);
  const handleNativeCatalog = useCallback(catalog => setNativeCatalog(Array.isArray(catalog) ? catalog : []), []);

  const runDiagnostics = useCallback(() => {
    const issues = [];
    const seen = new Set();
    canvas.current?.querySelectorAll('[data-builder-issue]').forEach(node => node.removeAttribute('data-builder-issue'));
    const addIssue = issue => {
      if (seen.has(issue.id)) return;
      seen.add(issue.id);
      issues.push(issue);
    };

    if (previewDocument) {
      previewDocument.querySelectorAll('[data-builder-issue]').forEach(node => node.removeAttribute('data-builder-issue'));
      const previewRoot = previewDocument.querySelector('.ips-platform-preview');
      const rootRect = previewRoot?.getBoundingClientRect();
      const documentWidth = previewRoot?.clientWidth || previewDocument.documentElement.clientWidth || viewportSize.width;
      const descendantRects = previewRoot && rootRect
        ? [...previewRoot.querySelectorAll('header,main,footer,section,[data-builder-section],.visual-page-element')]
          .filter(node => node.getClientRects().length > 0)
          .map(node => node.getBoundingClientRect())
        : [];
      const descendantRight = previewRoot && rootRect
        ? Math.max(0, ...descendantRects.map(rect => rect.right - rootRect.left))
        : 0;
      const descendantLeft = previewRoot && rootRect
        ? Math.min(0, ...descendantRects.map(rect => rect.left - rootRect.left))
        : 0;
      const scrollWidth = Math.max(
        previewRoot?.scrollWidth || 0,
        previewDocument.documentElement.scrollWidth,
        previewDocument.body?.scrollWidth || 0,
        descendantRight
      );
      if (scrollWidth > documentWidth + 2) {
        addIssue({ id: 'horizontal-document', type: 'horizontal', message: `Page is ${Math.ceil(scrollWidth - documentWidth)}px wider than the preview.` });
      }
      if (descendantLeft < -2) {
        addIssue({ id: 'horizontal-document-left', type: 'horizontal', message: `Page content extends ${Math.ceil(Math.abs(descendantLeft))}px beyond the left edge.` });
      }

      const heroNode = previewDocument.querySelector('.ips-hero');
      if (heroNode) {
        const heroRect = heroNode.getBoundingClientRect();
        const diagnosticNodes = [...heroNode.querySelectorAll('[data-hero-diagnostic]')].filter(node => node.getClientRects().length > 0);
        diagnosticNodes.forEach((node, index) => {
          const rect = node.getBoundingClientRect();
          const clipped = node.scrollWidth > node.clientWidth + 1 || node.scrollHeight > node.clientHeight + 1;
          const outside = rect.left < heroRect.left - 2 || rect.right > heroRect.right + 2 || rect.top < heroRect.top - 2 || rect.bottom > heroRect.bottom + 2;
          if (clipped || outside) {
            node.setAttribute('data-builder-issue', 'true');
            addIssue({ id: `clipped-${index}`, type: 'clipped', message: `${node.closest('[data-hero-element]')?.getAttribute('data-hero-element') || 'Hero content'} is clipped or outside the section.` });
          }
        });

        const heroElements = [...heroNode.querySelectorAll(':scope .ips-hero-content > [data-hero-element]')].filter(node => node.getClientRects().length > 0);
        heroElements.forEach((node, index) => {
          heroElements.slice(index + 1).forEach(other => {
            if (rectsOverlap(node.getBoundingClientRect(), other.getBoundingClientRect())) {
              node.setAttribute('data-builder-issue', 'true');
              other.setAttribute('data-builder-issue', 'true');
              const first = node.getAttribute('data-hero-element');
              const second = other.getAttribute('data-hero-element');
              addIssue({ id: `overlap-${first}-${second}`, type: 'overlap', message: `${HERO_ELEMENT_LABELS[first] || first} overlaps ${HERO_ELEMENT_LABELS[second] || second}.` });
            }
          });
        });
      }

      const navbar = previewDocument.querySelector('.site-navbar-inner');
      if (navbar && navbar.scrollWidth > navbar.clientWidth + 1) {
        navbar.setAttribute('data-builder-issue', 'true');
        addIssue({ id: 'navbar-clipped', type: 'clipped', message: 'Navigation content is wider than the selected device.' });
      }

      const configuredNativeKeys = new Set([
        ...Object.keys(design?.nativeEditing?.overrides || {}),
        ...Object.keys(draft.globalNativeEditing?.overrides || {})
      ]);
      const configuredNativeNodes = [...previewDocument.querySelectorAll('[data-studio-key]')]
        .filter(node => configuredNativeKeys.has(node.getAttribute('data-studio-key')))
        .filter(node => node.getClientRects().length > 0);
      configuredNativeNodes.forEach((node, index) => {
        const rect = node.getBoundingClientRect();
        const clipped = node.scrollWidth > node.clientWidth + 2 || node.scrollHeight > node.clientHeight + 2;
        const outside = rect.right > documentWidth + 2 || rect.left < -2;
        if (clipped || outside) {
          node.setAttribute('data-builder-issue', 'true');
          addIssue({ id: `native-clipped-${index}`, type: 'clipped', message: `${node.getAttribute('data-studio-kind') || 'Edited element'} “${node.getAttribute('aria-label') || node.textContent?.trim().slice(0, 45) || node.tagName.toLowerCase()}” is clipped or outside the viewport.` });
        }
      });
      configuredNativeNodes.forEach((node, index) => {
        configuredNativeNodes.slice(index + 1).forEach(other => {
          if (node.parentElement !== other.parentElement) return;
          if (rectsOverlap(node.getBoundingClientRect(), other.getBoundingClientRect())) {
            node.setAttribute('data-builder-issue', 'true');
            other.setAttribute('data-builder-issue', 'true');
            addIssue({ id: `native-overlap-${index}-${configuredNativeNodes.indexOf(other)}`, type: 'overlap', message: 'Two customized sibling elements overlap. Adjust their movement, width, order, or parent layout.' });
          }
        });
      });

      [...previewDocument.querySelectorAll('img')].forEach((image, index) => {
        if (!image.hasAttribute('alt')) addIssue({ id: `image-alt-${index}`, type: 'accessibility', message: 'A visible image is missing an accessibility description.' });
      });
      [...previewDocument.querySelectorAll('input,textarea,select')].forEach((field, index) => {
        const labelled = field.getAttribute('aria-label') || field.getAttribute('aria-labelledby') || field.id && previewDocument.querySelector(`label[for="${field.id}"]`) || field.closest('label');
        if (!labelled) addIssue({ id: `field-label-${index}`, type: 'accessibility', message: `A ${field.tagName.toLowerCase()} field has no accessible label.` });
      });
      const headings = [...previewDocument.querySelectorAll('h1,h2,h3,h4,h5,h6')].filter(node => node.getClientRects().length > 0);
      headings.forEach((heading, index) => {
        if (!index) return;
        const previousLevel = Number(headings[index - 1].tagName.slice(1));
        const level = Number(heading.tagName.slice(1));
        if (level > previousLevel + 1) addIssue({ id: `heading-order-${index}`, type: 'accessibility', message: `Heading hierarchy skips from H${previousLevel} to H${level}.` });
      });
    }

    const canvasRect = canvas.current?.getBoundingClientRect();
    const canvasScale = 1;
    const visibleBlocks = elements
      .filter(element => design.enabled && element.visible && (element.showOn === 'all' || element.showOn === device))
      .map(element => {
        const placement = element.placement[device];
        const renderedBlock = canvas.current?.querySelector(`[data-preview-element-id="${element.id}"]`);
        if (renderedBlock && canvasRect) {
          const rect = renderedBlock.getBoundingClientRect();
          return {
            element,
            renderedBlock,
            left: (rect.left - canvasRect.left) / canvasScale,
            right: (rect.right - canvasRect.left) / canvasScale,
            top: (rect.top - canvasRect.top) / canvasScale,
            bottom: (rect.bottom - canvasRect.top) / canvasScale
          };
        }
        const left = (placement.x / 100 * viewportSize.width) - (placement.width / 2);
        return { element, renderedBlock, left, right: left + placement.width, top: placement.y, bottom: placement.y + placement.height };
      });

    visibleBlocks.forEach((entry, index) => {
      if (entry.left < 0 || entry.right > viewportSize.width) {
        addIssue({ id: `block-horizontal-${entry.element.id}`, type: 'horizontal', message: `${entry.element.text || entry.element.type} extends outside the ${viewportSize.width}px canvas.` });
      }
      const availableHeight = overlayHeight;
      if (entry.top < 0 || entry.bottom > availableHeight) {
        addIssue({ id: `block-vertical-${entry.element.id}`, type: 'clipped', message: `${entry.element.text || entry.element.type} extends outside the editable page area.` });
      }
      if (entry.renderedBlock && (entry.renderedBlock.scrollWidth > entry.renderedBlock.clientWidth + 1 || entry.renderedBlock.scrollHeight > entry.renderedBlock.clientHeight + 1)) {
        entry.renderedBlock.setAttribute('data-builder-issue', 'true');
        addIssue({ id: `block-content-${entry.element.id}`, type: 'clipped', message: `${entry.element.text || entry.element.type} contains clipped text or media.` });
      }
      visibleBlocks.slice(index + 1).forEach(other => {
        if (rectsOverlap(entry, other)) {
          entry.renderedBlock?.setAttribute('data-builder-issue', 'true');
          other.renderedBlock?.setAttribute('data-builder-issue', 'true');
          addIssue({ id: `block-overlap-${entry.element.id}-${other.element.id}`, type: 'overlap', message: `${entry.element.text || entry.element.type} overlaps ${other.element.text || other.element.type}.` });
        }
      });
    });

    setDiagnostics(issues);
  }, [previewDocument, viewportSize, elements, device, design?.enabled, design?.nativeEditing, draft.globalNativeEditing, overlayHeight]);

  useEffect(() => {
    const timer = window.setTimeout(runDiagnostics, 180);
    if (!previewDocument) return () => window.clearTimeout(timer);
    const target = previewDocument.querySelector('.ips-hero') || previewDocument.documentElement;
    const observer = new ResizeObserver(() => window.requestAnimationFrame(runDiagnostics));
    observer.observe(target);
    return () => {
      window.clearTimeout(timer);
      observer.disconnect();
    };
  }, [runDiagnostics, previewDocument, draft, device, viewportSize.width, viewportSize.height]);

  useEffect(() => {
    if (!previewDocument) {
      setPreviewPageHeight(viewportSize.height);
      return undefined;
    }
    const measure = () => {
      const pageLayer = previewDocument.querySelector(`[data-visual-page="${pageId}"]`);
      const themeWrapper = previewDocument.querySelector('.cms-preview-theme');
      let measured = pageLayer ? Math.max(pageLayer.scrollHeight, pageLayer.offsetHeight) : 0;
      if (!measured && themeWrapper) {
        const wrapperRect = themeWrapper.getBoundingClientRect();
        const contentBottom = Math.max(
          wrapperRect.bottom,
          ...[...themeWrapper.children]
            .filter(node => !node.classList.contains('page-designer-overlay-canvas'))
            .map(node => node.getBoundingClientRect().bottom)
        );
        measured = contentBottom - wrapperRect.top;
      }
      const nextHeight = Math.max(viewportSize.height, Math.ceil(measured));
      setPreviewPageHeight(previous => Math.abs(previous - nextHeight) > 1 ? nextHeight : previous);
    };
      const target = previewDocument.querySelector(`[data-visual-page="${pageId}"]`)
      || previewDocument.querySelector('.cms-preview-theme');
    const observer = new ResizeObserver(() => window.requestAnimationFrame(measure));
    if (target) observer.observe(target);
    const frame = window.requestAnimationFrame(measure);
    return () => {
      window.cancelAnimationFrame(frame);
      observer.disconnect();
    };
  }, [previewDocument, pageId, viewportSize.height, draft]);

  if (!design) return <div className="phase12-panel">This page design is unavailable. Reload the builder.</div>;

  const imageAssets = assets.filter(asset => asset.media_type === 'image');
  const videoAssets = assets.filter(asset => asset.media_type === 'video');
  const backgroundAssets = design.background.type === 'video' ? videoAssets : imageAssets;
  const responsivePageBackground = design.background.responsive?.[device] || { type: 'inherit', assetId: '', posterAssetId: '', positionX: 50, positionY: 50 };
  const responsiveBackgroundAssets = responsivePageBackground.type === 'video' ? videoAssets : imageAssets;
  const filteredNativeCatalog = nativeCatalog
    .filter(element => !nativeSearch.trim() || `${element.label} ${element.kind} ${element.tag}`.toLowerCase().includes(nativeSearch.trim().toLowerCase()))
    .slice(0, 200);
  const nativeStyle = selectedNativeOverride?.styles?.[device] || {};
  const nativeContent = selectedNativeOverride?.content || {};
  const nativeContentValue = field => Object.prototype.hasOwnProperty.call(nativeContent, field)
    ? nativeContent[field]
    : selectedNativeDescriptor?.current?.[field] || '';
  const nativeMediaAssets = selectedNativeDescriptor?.video ? videoAssets : imageAssets;
  const backgroundStyle = design.background.type === 'color'
    ? { background: design.background.color }
    : design.background.type === 'gradient'
      ? { background: `linear-gradient(135deg, ${design.background.gradientStart}, ${design.background.gradientEnd})` }
      : {};
  const renderOverlayCanvas = inFrame => !design.enabled ? null : (
    <div
      ref={canvas}
      className={`page-designer-overlay-canvas ${inFrame ? 'is-in-frame' : ''} ${draggingId ? 'is-dragging' : ''}`}
      style={{
        width: viewportSize.width,
        height: inFrame ? overlayHeight : viewportSize.height,
        transform: inFrame ? undefined : `scale(${previewScale})`
      }}
      onDragOver={event => event.preventDefault()}
      onDrop={dropElement}
    >
      {!inFrame && ['image', 'video'].includes(design.background.type) && design.background.assetId && (
        design.background.type === 'video'
          ? <video className="page-designer-background" src={assetUrl(design.background.assetId)} muted autoPlay loop playsInline />
          : <img className="page-designer-background" src={assetUrl(design.background.assetId)} alt="" />
      )}
      {!inFrame && design.background.overlayOpacity > 0 && <div className="page-designer-overlay" style={{ background: design.background.overlayColor, opacity: design.background.overlayOpacity }} />}
      {visibleElements.map(element => {
        const placement = element.placement[device];
        const elementStyle = {
          left: `${placement.x}%`,
          top: placement.y,
          width: placement.width,
          minHeight: placement.height,
          ...(['image', 'video'].includes(element.type) ? { height: placement.height } : {}),
          transform: 'translateX(-50%)',
          zIndex: element.zIndex,
          borderRadius: element.borderRadius,
          background: element.backgroundColor || 'var(--bg-card)',
          color: element.textColor || 'var(--text-primary)'
        };
        return (
          <div
            key={element.id}
            data-preview-element-id={element.id}
            draggable
            onDragStart={() => setDraggingId(element.id)}
            onDragEnd={() => setDraggingId('')}
            onClick={() => setSelectedElementId(element.id)}
            className={`page-designer-element ${selectedElementId === element.id ? 'selected' : ''} type-${element.type}`}
            style={elementStyle}
          >
            {element.type === 'image' && element.assetId ? <img src={assetUrl(element.assetId)} alt={element.alt} /> :
              element.type === 'video' && element.assetId ? <video src={assetUrl(element.assetId)} muted autoPlay loop playsInline /> :
                element.text}
          </div>
        );
      })}
    </div>
  );

  return (
    <div className="page-designer-shell">
      <section className="phase12-panel page-designer-controls">
        <div className="phase12-panel-heading"><span>Page registry</span><small>{PAGE_CATALOG.length} editable interfaces</small></div>
        <label className="phase12-field"><span>Portal</span><select className="form-select" value={portal} onChange={event => { setPortal(event.target.value); setSelectedElementId(''); setSelectedNativeKey(''); setNativeCatalog([]); }}>{Object.entries(PORTAL_LABELS).map(([id, label]) => <option key={id} value={id}>{label}</option>)}</select></label>
        <label className="phase12-field"><span>Page</span><select className="form-select" value={pageId} onChange={event => { setPageId(event.target.value); setSelectedElementId(''); setSelectedNativeKey(''); setNativeCatalog([]); }}>{pages.map(page => <option key={page.id} value={page.id}>{page.label}</option>)}</select></label>
        <label className="page-designer-check"><input type="checkbox" checked={design.enabled} onChange={event => updateDesign({ enabled: event.target.checked })} /> Apply this page's Studio design on the live site</label>
        <p className="phase12-preview-note">The canvas stays editable either way. Turn this on when this page's background, native edits and custom blocks are ready to be published.</p>
        <div className="page-designer-coverage-summary">
          <strong>{nativeCatalog.filter(element => element.editable).length}</strong><span>editable elements detected</span>
          <strong>{Object.keys(design.nativeEditing?.overrides || {}).length + Object.keys(draft.globalNativeEditing?.overrides || {}).length}</strong><span>saved presentation overrides</span>
        </div>

        <div className="page-designer-section">
          <div className="phase12-panel-heading"><h4>Background</h4><button type="button" className="btn btn-ghost btn-sm" onClick={onOpenMedia}>Media Library</button></div>
          <select className="form-select" value={design.background.type} onChange={event => updateBackground({ type: event.target.value, assetId: '', posterAssetId: '' })}>
            <option value="theme">Theme default</option><option value="color">Solid colour</option><option value="gradient">Gradient</option><option value="image">Image</option><option value="video">Looping video</option>
          </select>
          {design.background.type === 'color' && <input type="color" value={design.background.color} onChange={event => updateBackground({ color: event.target.value })} />}
          {design.background.type === 'gradient' && <div className="page-designer-color-row"><input type="color" value={design.background.gradientStart} onChange={event => updateBackground({ gradientStart: event.target.value })} /><input type="color" value={design.background.gradientEnd} onChange={event => updateBackground({ gradientEnd: event.target.value })} /></div>}
          {['image', 'video'].includes(design.background.type) && (
            <select className="form-select" value={design.background.assetId} onChange={event => updateBackground({ assetId: event.target.value })}>
              <option value="">Select media…</option>{backgroundAssets.map(asset => <option key={asset.asset_id} value={asset.asset_id}>{asset.original_name}</option>)}
            </select>
          )}
          {design.background.type === 'video' && <label className="phase12-field"><span>Video poster / fallback</span><select className="form-select" value={design.background.posterAssetId || ''} onChange={event => updateBackground({ posterAssetId: event.target.value })}><option value="">No poster</option>{imageAssets.map(asset => <option key={asset.asset_id} value={asset.asset_id}>{asset.original_name}</option>)}</select></label>}
          {['image', 'video'].includes(design.background.type) && <><label className="phase12-field"><span>Main horizontal focal point Â· {design.background.positionX ?? 50}%</span><input type="range" min="0" max="100" value={design.background.positionX ?? 50} onChange={event => updateBackground({ positionX: Number(event.target.value) })} /></label><label className="phase12-field"><span>Main vertical focal point Â· {design.background.positionY ?? 50}%</span><input type="range" min="0" max="100" value={design.background.positionY ?? 50} onChange={event => updateBackground({ positionY: Number(event.target.value) })} /></label></>}
          <details className="page-designer-background-responsive">
            <summary>{device} background override</summary>
            <label className="phase12-field"><span>Media type</span><select className="form-select" value={responsivePageBackground.type} onChange={event => updateResponsiveBackground({ type: event.target.value, assetId: '', posterAssetId: '' })}><option value="inherit">Inherit page background</option><option value="image">Device-specific image</option><option value="video">Device-specific looping video</option></select></label>
            {responsivePageBackground.type !== 'inherit' && <label className="phase12-field"><span>{device} media</span><select className="form-select" value={responsivePageBackground.assetId} onChange={event => updateResponsiveBackground({ assetId: event.target.value })}><option value="">Use main page media</option>{responsiveBackgroundAssets.map(asset => <option key={asset.asset_id} value={asset.asset_id}>{asset.original_name}</option>)}</select></label>}
            {responsivePageBackground.type === 'video' && <label className="phase12-field"><span>Video poster</span><select className="form-select" value={responsivePageBackground.posterAssetId} onChange={event => updateResponsiveBackground({ posterAssetId: event.target.value })}><option value="">No poster</option>{imageAssets.map(asset => <option key={asset.asset_id} value={asset.asset_id}>{asset.original_name}</option>)}</select></label>}
            {responsivePageBackground.type !== 'inherit' && <><label className="phase12-field"><span>Horizontal focal point · {responsivePageBackground.positionX}%</span><input type="range" min="0" max="100" value={responsivePageBackground.positionX} onChange={event => updateResponsiveBackground({ positionX: Number(event.target.value) })} /></label><label className="phase12-field"><span>Vertical focal point · {responsivePageBackground.positionY}%</span><input type="range" min="0" max="100" value={responsivePageBackground.positionY} onChange={event => updateResponsiveBackground({ positionY: Number(event.target.value) })} /></label></>}
          </details>
          <label className="phase12-field"><span>Overlay opacity · {Math.round(design.background.overlayOpacity * 100)}%</span><input type="range" min="0" max=".95" step=".05" value={design.background.overlayOpacity} onChange={event => updateBackground({ overlayOpacity: Number(event.target.value) })} /></label>
          <input type="color" value={design.background.overlayColor} onChange={event => updateBackground({ overlayColor: event.target.value })} title="Overlay colour" />
        </div>

        <div className="page-designer-section">
          <h4>Page frame</h4>
          <label className="phase12-field"><span>Minimum height (0 = automatic)</span><input className="form-input" type="number" min="0" max="6000" value={design.minHeight} onChange={event => updateDesign({ minHeight: Number(event.target.value) })} /></label>
          <label className="phase12-field"><span>Content max width (0 = full)</span><input className="form-input" type="number" min="0" max="2400" value={design.contentMaxWidth} onChange={event => updateDesign({ contentMaxWidth: Number(event.target.value) })} /></label>
          {HERO_DEVICE_IDS.map(screen => <label className="phase12-field" key={screen}><span>{screen} page padding</span><input className="form-input" type="number" min="0" max="240" value={design.padding[screen]} onChange={event => updateDesign({ padding: { ...design.padding, [screen]: Number(event.target.value) } })} /></label>)}
        </div>

        <details className="page-designer-section page-designer-page-seo">
          <summary>Search & sharing</summary>
          <label className="phase12-field"><span>SEO title</span><input className="form-input" maxLength="120" value={design.seo?.title || ''} onChange={event => updateSeo({ title: event.target.value })} placeholder={`${pageLabel} | IPS`} /></label>
          <label className="phase12-field"><span>Meta description</span><textarea className="form-textarea" maxLength="320" value={design.seo?.description || ''} onChange={event => updateSeo({ description: event.target.value })} /></label>
          <label className="phase12-field"><span>Social sharing image</span><select className="form-select" value={design.seo?.socialImageAssetId || ''} onChange={event => updateSeo({ socialImageAssetId: event.target.value })}><option value="">Use platform default</option>{imageAssets.map(asset => <option key={asset.asset_id} value={asset.asset_id}>{asset.original_name}</option>)}</select></label>
          <label className="page-designer-check"><input type="checkbox" checked={design.seo?.indexable !== false} onChange={event => updateSeo({ indexable: event.target.checked })} /> Include this page in search engines</label>
        </details>

        <button type="button" className="btn btn-secondary" onClick={duplicatePage}>Copy design to another page</button>
      </section>

      <section className="page-designer-stage-panel">
        <div className="page-designer-toolbar">
          <div><strong>{pageLabel}</strong><small>{pageId} · {viewportSize.width} × {viewportSize.height}</small></div>
          <div className="page-designer-toolbar-actions">
            {HERO_DEVICE_IDS.map(screen => <button type="button" key={screen} className={device === screen ? 'active' : ''} onClick={() => switchDevice(screen)}>{screen}</button>)}
            <button
              type="button"
              disabled={isDynamicPreviewPage(pageId)}
              title={isDynamicPreviewPage(pageId) ? 'This preview uses safe sample data. Open a real record from its list page.' : 'Open the published route in a new tab'}
              onClick={() => window.open(previewPath, '_blank', 'noopener,noreferrer')}
            >{isDynamicPreviewPage(pageId) ? 'Sample preview only' : 'Open live page'}</button>
          </div>
        </div>

        <div className="page-designer-device-controls">
          <label><span>Preview state</span><select value={previewState} onChange={event => { setPreviewState(event.target.value); setSelectedNativeKey(''); setNativeCatalog([]); }}><option value="normal">Populated</option><option value="empty">Empty</option><option value="error">Error</option><option value="loading">Loading</option></select></label>
          <label><span>Device preset</span><select value={matchingPreset?.id || 'custom'} onChange={event => { const preset = DEVICE_PRESETS.find(item => item.id === event.target.value); if (preset) applyPreset(preset); }}><option value="custom">Custom size</option>{DEVICE_PRESETS.map(preset => <option key={preset.id} value={preset.id}>{preset.label}</option>)}</select></label>
          <label><span>Width</span><input type="number" min="280" max="1600" value={viewportSize.width} onChange={event => { const width = clamp(event.target.value, 280, 1600); setViewportSize(previous => ({ ...previous, width })); setDevice(deviceForWidth(width)); }} /></label>
          <label><span>Height</span><input type="number" min="480" max="1400" value={viewportSize.height} onChange={event => setViewportSize(previous => ({ ...previous, height: clamp(event.target.value, 480, 1400) }))} /></label>
          <div className="page-designer-segmented" aria-label="Orientation">
            <button type="button" className={orientation === 'portrait' ? 'active' : ''} onClick={() => setOrientation('portrait')}>Portrait</button>
            <button type="button" className={orientation === 'landscape' ? 'active' : ''} onClick={() => setOrientation('landscape')}>Landscape</button>
          </div>
          <label className="page-designer-fit-toggle"><input type="checkbox" checked={fitPreview} onChange={event => setFitPreview(event.target.checked)} /> Fit</label>
          {!fitPreview && <label><span>Zoom</span><input type="range" min="25" max="150" value={zoom} onChange={event => setZoom(Number(event.target.value))} /><small>{zoom}%</small></label>}
        </div>

        <div ref={stage} className="page-designer-viewport">
          <div className="page-designer-device-composition" style={{ ...backgroundStyle, width: viewportSize.width * previewScale, height: viewportSize.height * previewScale }}>
            <ResponsivePreviewFrame
              width={viewportSize.width}
              height={viewportSize.height}
              scale={previewScale}
              title={`${pageLabel} ${device} preview`}
              config={draft}
              pageId={pageId}
              device={device}
              previewState={previewState}
              selectedElementId={selectedElementId}
              selectedNativeKey={selectedNativeKey}
              onDocument={handlePreviewDocument}
              onHeight={height => setPreviewPageHeight(Math.max(viewportSize.height, height))}
              onSection={section => setSelectedSection(section || pageId)}
              onElement={elementId => { setSelectedElementId(elementId || ''); setSelectedNativeKey(''); }}
              onNativeElement={key => { setSelectedNativeKey(key || ''); setSelectedElementId(''); }}
              onNativeCatalog={handleNativeCatalog}
            />
            <button type="button" className="page-designer-resize-handle" aria-label="Drag to resize preview width" onPointerDown={startWidthResize}><span /></button>
          </div>
        </div>

        <div className={`page-designer-diagnostics ${diagnostics.length ? 'has-issues' : 'is-clear'}`}>
          <div><strong>{diagnostics.length ? `${diagnostics.length} responsive issue${diagnostics.length === 1 ? '' : 's'}` : 'Responsive check passed'}</strong><small>{device} · {viewportSize.width} × {viewportSize.height}</small></div>
          <button type="button" onClick={runDiagnostics}>Check again</button>
          {diagnostics.length > 0 && <ul>{diagnostics.map(issue => <li key={issue.id}><span>{issue.type}</span>{issue.message}</li>)}</ul>}
        </div>
        <p className="phase12-preview-note">The preview runs at real CSS pixels inside an isolated viewport. Draft changes appear immediately; the public page stays unchanged until you publish.</p>
      </section>

      <section className="phase12-panel page-designer-inspector">
        <div className="phase12-panel-heading"><span>Layers & inspector</span><small>{nativeCatalog.length} interface elements · {elements.length}/40 blocks</small></div>
        <details className="page-designer-native-layers" open>
          <summary>Native page interface</summary>
          <label className="phase12-field"><span>Find text, field, media or container</span><input className="form-input" value={nativeSearch} onChange={event => setNativeSearch(event.target.value)} placeholder="Search this page…" /></label>
          <div className="page-designer-native-layer-list">
            {filteredNativeCatalog.map(element => (
              <button
                type="button"
                key={element.key}
                className={selectedNativeKey === element.key ? 'selected' : ''}
                onClick={() => { setSelectedNativeKey(element.key); setSelectedElementId(''); }}
              >
                <span>{element.kind}</span><strong>{element.label}</strong><small>{element.tag}{element.editable ? '' : ' · protected'}</small>
              </button>
            ))}
            {!filteredNativeCatalog.length && <p className="phase12-preview-note">The preview is loading its editable interface. If this remains empty, reload Platform Studio once.</p>}
          </div>
        </details>
        <div className="phase12-panel-heading page-designer-custom-layer-heading"><span>Custom overlay blocks</span><small>Optional additions</small></div>
        <div className="page-designer-add">
          <select className="form-select" value={newType} onChange={event => setNewType(event.target.value)}>{['button', 'text', 'image', 'video', 'banner', 'card'].map(type => <option key={type}>{type}</option>)}</select>
          <button className="btn btn-primary" type="button" onClick={addElement} disabled={elements.length >= 40}>Add block</button>
        </div>
        <div className="page-designer-layer-list">
          {elements.map(element => (
            <button type="button" key={element.id} className={selectedElementId === element.id ? 'selected' : ''} onClick={() => { setSelectedElementId(element.id); setSelectedNativeKey(''); }}>
              <span>{element.type}</span><strong>{element.text || element.alt || element.id}</strong><small>z{element.zIndex}</small>
            </button>
          ))}
        </div>

        {selectedNativeDescriptor && (
          <div className="page-designer-native-editor">
            <div className="phase12-panel-heading"><span>Selected interface element</span><small>{selectedNativeDescriptor.kind} · {selectedNativeDescriptor.tag}</small></div>
            <div className="page-designer-selected-header">
              <strong className="page-designer-selected-label">{selectedNativeDescriptor.label}{selectedNativeIsGlobal ? ' · Global component' : ''}</strong>
              {selectedNativeDescriptor.editable && <button type="button" className="btn btn-ghost btn-sm" onClick={resetNativeOverride}>Reset selected element</button>}
            </div>
            {!selectedNativeDescriptor.editable ? (
              <div className="page-designer-protected-note">
                <strong>Protected application element</strong>
                <p>{selectedNativeDescriptor.protectedReason || 'Its operational value or behaviour is controlled by the application. Presentation can only be changed from its owning system setting.'}</p>
              </div>
            ) : (
              <>
                <details className="page-designer-inspector-group" open>
                  <summary>Content & media</summary>
                  {selectedNativeDescriptor.textEditable && <label className="phase12-field"><span>Visible text</span><textarea className="form-textarea" value={nativeContentValue('text')} onChange={event => updateNativeContent({ text: event.target.value })} /></label>}
                  {selectedNativeDescriptor.placeholderEditable && <label className="phase12-field"><span>Placeholder</span><input className="form-input" value={nativeContentValue('placeholder')} onChange={event => updateNativeContent({ placeholder: event.target.value })} /></label>}
                  {selectedNativeDescriptor.altEditable && <label className="phase12-field"><span>Image description (alt text)</span><input className="form-input" value={nativeContentValue('alt')} onChange={event => updateNativeContent({ alt: event.target.value })} /></label>}
                  <label className="phase12-field"><span>Tooltip / accessible title</span><input className="form-input" value={nativeContentValue('title')} onChange={event => updateNativeContent({ title: event.target.value })} /></label>
                  {selectedNativeDescriptor.linkEditable && <label className="phase12-field"><span>Safe link destination</span><input className="form-input" value={nativeContentValue('href')} onChange={event => updateNativeContent({ href: event.target.value })} placeholder="/page or https://…" /></label>}
                  {selectedNativeDescriptor.mediaEditable && <label className="phase12-field"><span>{selectedNativeDescriptor.kind === 'media' ? 'Replace media' : 'Background image'}</span><select className="form-select" value={nativeContent.assetId || ''} onChange={event => updateNativeContent({ assetId: event.target.value })}><option value="">Use original / none</option>{nativeMediaAssets.map(asset => <option key={asset.asset_id} value={asset.asset_id}>{asset.original_name}</option>)}</select></label>}
                  {selectedNativeDescriptor.mediaEditable && <button type="button" className="btn btn-ghost btn-sm" onClick={onOpenMedia}>Upload or manage media</button>}
                  {selectedNativeDescriptor.video && <label className="phase12-field"><span>Video poster / fallback</span><select className="form-select" value={nativeContent.posterAssetId || ''} onChange={event => updateNativeContent({ posterAssetId: event.target.value })}><option value="">Use original / none</option>{imageAssets.map(asset => <option key={asset.asset_id} value={asset.asset_id}>{asset.original_name}</option>)}</select></label>}
                  {!selectedNativeDescriptor.textEditable && selectedNativeDescriptor.kind === 'text' && <p className="phase12-preview-note">This item contains nested formatted content. Select its visible child text in the canvas to edit it without destroying formatting.</p>}
                </details>

                <details className="page-designer-inspector-group" open>
                  <summary>{device} visibility, position & order</summary>
                  <div className="page-designer-device-pills">{NATIVE_DEVICE_IDS.map(screen => <button type="button" key={screen} className={device === screen ? 'active' : ''} onClick={() => switchDevice(screen)}>{screen}</button>)}</div>
                  <label className="page-designer-check"><input type="checkbox" checked={selectedNativeOverride?.visibility?.[device] !== false} onChange={event => updateNativeVisibility(event.target.checked)} /> Show on {device}</label>
                  <OptionalNumberField label="Order within its layout" min={-99} max={99} suffix="" value={selectedNativeOverride?.order?.[device]} onChange={updateNativeOrder} />
                  <div className="page-designer-number-grid">
                    <OptionalNumberField label="Move horizontally" min={-1200} max={1200} value={nativeStyle.translateX} onChange={value => updateNativeStyle({ translateX: value })} />
                    <OptionalNumberField label="Move vertically" min={-1200} max={1200} value={nativeStyle.translateY} onChange={value => updateNativeStyle({ translateY: value })} />
                    <OptionalNumberField label="Scale" min={.2} max={4} step={.05} suffix="×" value={nativeStyle.scale} onChange={value => updateNativeStyle({ scale: value })} />
                  </div>
                </details>

                <details className="page-designer-inspector-group">
                  <summary>Typography & colour</summary>
                  <div className="page-designer-number-grid">
                    <OptionalNumberField label="Font size" min={8} max={180} value={nativeStyle.fontSize} onChange={value => updateNativeStyle({ fontSize: value })} />
                    <OptionalNumberField label="Line height" min={.6} max={3} step={.05} suffix="" value={nativeStyle.lineHeight} onChange={value => updateNativeStyle({ lineHeight: value })} />
                    <OptionalNumberField label="Letter spacing" min={-8} max={30} step={.1} value={nativeStyle.letterSpacing} onChange={value => updateNativeStyle({ letterSpacing: value })} />
                  </div>
                  <label className="phase12-field"><span>Font weight</span><select className="form-select" value={nativeStyle.fontWeight || ''} onChange={event => updateNativeStyle({ fontWeight: event.target.value || null })}><option value="">Inherit</option>{['300', '400', '500', '600', '700', '800', '900'].map(value => <option key={value} value={value}>{value}</option>)}</select></label>
                  <label className="phase12-field"><span>Text alignment</span><select className="form-select" value={nativeStyle.textAlign || ''} onChange={event => updateNativeStyle({ textAlign: event.target.value || null })}><option value="">Inherit</option><option value="left">Left</option><option value="center">Centre</option><option value="right">Right</option><option value="justify">Justify</option></select></label>
                  <label className="phase12-field"><span>Text colour</span><input className="form-input" value={nativeStyle.color || ''} onChange={event => updateNativeStyle({ color: event.target.value })} placeholder="#FFFFFF (blank = inherit)" /></label>
                  <label className="phase12-field"><span>Background colour</span><input className="form-input" value={nativeStyle.backgroundColor || ''} onChange={event => updateNativeStyle({ backgroundColor: event.target.value })} placeholder="#00010D (blank = inherit)" /></label>
                </details>

                <details className="page-designer-inspector-group">
                  <summary>Size & layout</summary>
                  <label className="phase12-field"><span>Layout</span><select className="form-select" value={nativeStyle.layout || 'inherit'} onChange={event => updateNativeStyle({ layout: event.target.value })}><option value="inherit">Inherit</option><option value="block">Block</option><option value="flex-row">Flex row</option><option value="flex-column">Flex column</option><option value="grid">Grid</option></select></label>
                  {nativeStyle.layout === 'grid' && <OptionalNumberField label="Grid columns" min={1} max={12} suffix="" value={nativeStyle.columns} onChange={value => updateNativeStyle({ columns: value })} />}
                  <div className="page-designer-number-grid">
                    <OptionalNumberField label="Width" min={20} max={2400} value={nativeStyle.width} onChange={value => updateNativeStyle({ width: value })} />
                    <OptionalNumberField label="Maximum width" min={20} max={2400} value={nativeStyle.maxWidth} onChange={value => updateNativeStyle({ maxWidth: value })} />
                    <OptionalNumberField label="Minimum height" min={0} max={3000} value={nativeStyle.minHeight} onChange={value => updateNativeStyle({ minHeight: value })} />
                    <OptionalNumberField label="Gap" min={0} max={240} value={nativeStyle.gap} onChange={value => updateNativeStyle({ gap: value })} />
                    <OptionalNumberField label="Corner radius" min={0} max={300} value={nativeStyle.borderRadius} onChange={value => updateNativeStyle({ borderRadius: value })} />
                  </div>
                  <label className="phase12-field"><span>Horizontal distribution</span><select className="form-select" value={nativeStyle.justifyContent || 'inherit'} onChange={event => updateNativeStyle({ justifyContent: event.target.value })}>{['inherit', 'start', 'center', 'end', 'space-between', 'space-around', 'space-evenly'].map(value => <option key={value} value={value}>{value}</option>)}</select></label>
                  <label className="phase12-field"><span>Vertical alignment</span><select className="form-select" value={nativeStyle.alignItems || 'inherit'} onChange={event => updateNativeStyle({ alignItems: event.target.value })}>{['inherit', 'start', 'center', 'end', 'stretch'].map(value => <option key={value} value={value}>{value}</option>)}</select></label>
                </details>

                <details className="page-designer-inspector-group">
                  <summary>Spacing</summary>
                  <h5>Padding</h5>
                  <div className="page-designer-number-grid">{['Top', 'Right', 'Bottom', 'Left'].map(side => { const key = `padding${side}`; return <OptionalNumberField key={key} label={side} min={0} max={500} value={nativeStyle[key]} onChange={value => updateNativeStyle({ [key]: value })} />; })}</div>
                  <h5>Margin</h5>
                  <div className="page-designer-number-grid">{['Top', 'Right', 'Bottom', 'Left'].map(side => { const key = `margin${side}`; return <OptionalNumberField key={key} label={side} min={-500} max={500} value={nativeStyle[key]} onChange={value => updateNativeStyle({ [key]: value })} />; })}</div>
                  {(selectedNativeDescriptor.kind === 'media' || nativeContent.assetId) && <><h5>Media crop & focal point</h5><label className="phase12-field"><span>Fit</span><select className="form-select" value={nativeStyle.objectFit || 'inherit'} onChange={event => updateNativeStyle({ objectFit: event.target.value })}>{['inherit', 'cover', 'contain', 'fill', 'none'].map(value => <option key={value} value={value}>{value}</option>)}</select></label><label className="phase12-field"><span>Horizontal focal point · {nativeStyle.objectPositionX ?? 50}%</span><input type="range" min="0" max="100" value={nativeStyle.objectPositionX ?? 50} onChange={event => updateNativeStyle({ objectPositionX: Number(event.target.value) })} /></label><label className="phase12-field"><span>Vertical focal point · {nativeStyle.objectPositionY ?? 50}%</span><input type="range" min="0" max="100" value={nativeStyle.objectPositionY ?? 50} onChange={event => updateNativeStyle({ objectPositionY: Number(event.target.value) })} /></label></>}
                </details>
                <p className="phase12-preview-note">Only presentation and safe copy are editable. Authentication, permissions, record values and action behaviour remain protected application logic.</p>
              </>
            )}
          </div>
        )}

        {isHomePage && (
          <div className="page-designer-hero-editor">
            <div className="phase12-panel-heading"><span>Live section</span><small>{selectedSection}</small></div>
            {selectedSection === 'hero' ? <>
              <details className="page-designer-inspector-group" open>
                <summary>Hero content</summary>
                <label className="page-designer-check"><input type="checkbox" checked={hero.visible !== false} onChange={event => updateHero({ visible: event.target.checked })} /> Show hero</label>
                <label className="phase12-field"><span>Badge</span><input className="form-input" value={hero.badge || ''} onChange={event => updateHero({ badge: event.target.value })} /></label>
                <label className="phase12-field"><span>Eyebrow</span><input className="form-input" value={hero.eyebrow || ''} onChange={event => updateHero({ eyebrow: event.target.value })} /></label>
                <label className="phase12-field"><span>Main headline</span><textarea className="form-textarea" value={hero.headline || ''} onChange={event => updateHero({ headline: event.target.value })} /></label>
                <label className="phase12-field"><span>Highlighted headline</span><input className="form-input" value={hero.highlightedText || ''} onChange={event => updateHero({ highlightedText: event.target.value })} /></label>
                <label className="phase12-field"><span>Supporting text</span><textarea className="form-textarea" value={hero.subheadline || ''} onChange={event => updateHero({ subheadline: event.target.value })} /></label>
                <label className="phase12-field"><span>Search placeholder</span><input className="form-input" value={hero.searchPlaceholder || ''} onChange={event => updateHero({ searchPlaceholder: event.target.value })} /></label>
                <label className="phase12-field"><span>Popular searches (one per line)</span><textarea className="form-textarea" value={(hero.popularSearches || []).join('\n')} onChange={event => updateHeroList('popularSearches', event.target.value)} /></label>
                <label className="phase12-field"><span>Trust items (one per line)</span><textarea className="form-textarea" value={(hero.trustItems || []).join('\n')} onChange={event => updateHeroList('trustItems', event.target.value)} /></label>
              </details>

              <details className="page-designer-inspector-group">
                <summary>Media & overlay</summary>
                <button type="button" className="btn btn-ghost btn-sm" onClick={onOpenMedia}>Upload or manage media</button>
                <div className="page-designer-color-row"><label>Highlight <input type="color" value={hero.highlightColor || '#F3B37C'} onChange={event => updateHero({ highlightColor: event.target.value })} /></label><label>Overlay <input type="color" value={hero.overlayColor || '#35124C'} onChange={event => updateHero({ overlayColor: event.target.value })} /></label></div>
                <label className="phase12-field"><span>Background type</span><select className="form-select" value={hero.backgroundType || 'image'} onChange={event => updateHero({ backgroundType: event.target.value })}><option value="image">Image</option><option value="video">Looping video</option></select></label>
                <label className="phase12-field"><span>Choose background from Media Library</span><select className="form-select" value={referencedAssetId(hero.backgroundMedia)} onChange={event => updateHero({ backgroundMedia: mediaReference(event.target.value) })}><option value="">Use URL / default</option>{(hero.backgroundType === 'video' ? videoAssets : imageAssets).map(asset => <option key={asset.asset_id} value={asset.asset_id}>{asset.original_name}</option>)}</select></label>
                <label className="phase12-field"><span>Background URL or media reference</span><input className="form-input" value={hero.backgroundMedia || ''} onChange={event => updateHero({ backgroundMedia: event.target.value })} placeholder="media:ASSET_ID or /path/file.mp4" /></label>
                <label className="phase12-field"><span>Choose poster / fallback image</span><select className="form-select" value={referencedAssetId(hero.posterMedia)} onChange={event => updateHero({ posterMedia: mediaReference(event.target.value) })}><option value="">Use URL / none</option>{imageAssets.map(asset => <option key={asset.asset_id} value={asset.asset_id}>{asset.original_name}</option>)}</select></label>
                <label className="phase12-field"><span>Poster URL or media reference</span><input className="form-input" value={hero.posterMedia || ''} onChange={event => updateHero({ posterMedia: event.target.value })} /></label>
                <label className="phase12-field"><span>Overlay opacity · {Math.round((hero.overlayOpacity ?? .72) * 100)}%</span><input type="range" min="0" max=".95" step=".05" value={hero.overlayOpacity ?? .72} onChange={event => updateHero({ overlayOpacity: Number(event.target.value) })} /></label>
              </details>

              <details className="page-designer-inspector-group" open>
                <summary>{device} responsive layout</summary>
                <div className="page-designer-device-pills">{HERO_DEVICE_IDS.map(screen => <button type="button" key={screen} className={device === screen ? 'active' : ''} onClick={() => switchDevice(screen)}>{screen}</button>)}</div>
                <h5>Typography</h5>
                <NumberField label="Headline size" min={24} max={120} value={heroSettings.headlineFontSize} onChange={value => updateHeroDevice({ headlineFontSize: value })} />
                <NumberField label="Headline line height" min={0.85} max={1.8} step={0.01} suffix="" value={heroSettings.headlineLineHeight} onChange={value => updateHeroDevice({ headlineLineHeight: value })} />
                <NumberField label="Supporting text size" min={12} max={42} value={heroSettings.subheadlineFontSize} onChange={value => updateHeroDevice({ subheadlineFontSize: value })} />
                <NumberField label="Supporting line height" min={1} max={2.2} step={0.05} suffix="" value={heroSettings.subheadlineLineHeight} onChange={value => updateHeroDevice({ subheadlineLineHeight: value })} />

                <h5>Size & spacing</h5>
                <NumberField label="Content max width" min={240} max={1400} value={heroSettings.contentMaxWidth} onChange={value => updateHeroDevice({ contentMaxWidth: value })} />
                <label className="phase12-field"><span>Section height mode</span><select className="form-select" value={heroSettings.sectionHeightMode} onChange={event => updateHeroDevice({ sectionHeightMode: event.target.value })}><option value="auto">Automatic</option><option value="minimum">Minimum height</option><option value="exact">Exact height</option><option value="viewport">Full viewport</option></select></label>
                {heroSettings.sectionHeightMode !== 'auto' && heroSettings.sectionHeightMode !== 'viewport' && <NumberField label={heroSettings.sectionHeightMode === 'exact' ? 'Exact section height' : 'Section minimum height'} min={360} max={1600} value={heroSettings.sectionMinHeight} onChange={value => updateHeroDevice({ sectionMinHeight: value })} />}
                <NumberField label="Top spacing" min={0} max={320} value={heroSettings.paddingTop} onChange={value => updateHeroDevice({ paddingTop: value })} />
                <NumberField label="Bottom spacing" min={0} max={320} value={heroSettings.paddingBottom} onChange={value => updateHeroDevice({ paddingBottom: value })} />
                <NumberField label="Side spacing" min={0} max={160} value={heroSettings.horizontalPadding} onChange={value => updateHeroDevice({ horizontalPadding: value })} />
                <NumberField label="Element gap" min={0} max={80} value={heroSettings.elementSpacing} onChange={value => updateHeroDevice({ elementSpacing: value })} />

                <h5>Alignment</h5>
                <label className="phase12-field"><span>Horizontal alignment</span><select className="form-select" value={heroSettings.alignment} onChange={event => updateHeroDevice({ alignment: event.target.value })}><option value="left">Left</option><option value="center">Center</option><option value="right">Right</option></select></label>
                <label className="phase12-field"><span>Vertical alignment</span><select className="form-select" value={heroSettings.verticalAlignment} onChange={event => updateHeroDevice({ verticalAlignment: event.target.value })}><option value="start">Top</option><option value="center">Centre</option><option value="end">Bottom</option></select></label>

                <h5>Background focal point</h5>
                <label className="phase12-field"><span>{device} background type</span><select className="form-select" value={heroSettings.backgroundType || 'inherit'} onChange={event => updateHeroDevice({ backgroundType: event.target.value })}><option value="inherit">Inherit main hero media</option><option value="image">Device-specific image</option><option value="video">Device-specific looping video</option></select></label>
                {heroSettings.backgroundType !== 'inherit' && <label className="phase12-field"><span>{device} background media</span><select className="form-select" value={referencedAssetId(heroSettings.backgroundMedia)} onChange={event => updateHeroDevice({ backgroundMedia: mediaReference(event.target.value) })}><option value="">Use main hero media</option>{(heroSettings.backgroundType === 'video' ? videoAssets : imageAssets).map(asset => <option key={asset.asset_id} value={asset.asset_id}>{asset.original_name}</option>)}</select></label>}
                {heroSettings.backgroundType === 'video' && <label className="phase12-field"><span>{device} video poster</span><select className="form-select" value={referencedAssetId(heroSettings.posterMedia)} onChange={event => updateHeroDevice({ posterMedia: mediaReference(event.target.value) })}><option value="">Use main poster</option>{imageAssets.map(asset => <option key={asset.asset_id} value={asset.asset_id}>{asset.original_name}</option>)}</select></label>}
                <label className="phase12-field"><span>Horizontal · {heroSettings.backgroundPositionX}%</span><input type="range" min="0" max="100" value={heroSettings.backgroundPositionX} onChange={event => updateHeroDevice({ backgroundPositionX: Number(event.target.value) })} /></label>
                <label className="phase12-field"><span>Vertical · {heroSettings.backgroundPositionY}%</span><input type="range" min="0" max="100" value={heroSettings.backgroundPositionY} onChange={event => updateHeroDevice({ backgroundPositionY: Number(event.target.value) })} /></label>

                <h5>Buttons & search</h5>
                <label className="phase12-field"><span>Button layout</span><select className="form-select" value={heroSettings.buttonLayout} onChange={event => updateHeroDevice({ buttonLayout: event.target.value })}><option value="row">Side by side</option><option value="column">Stacked</option></select></label>
                <label className="page-designer-check"><input type="checkbox" checked={heroSettings.buttonsFullWidth} onChange={event => updateHeroDevice({ buttonsFullWidth: event.target.checked })} /> Full-width action buttons</label>
                <label className="phase12-field"><span>Search layout</span><select className="form-select" value={heroSettings.searchLayout} onChange={event => updateHeroDevice({ searchLayout: event.target.value })}><option value="row">Input and button in a row</option><option value="column">Stacked input and button</option></select></label>
                <label className="page-designer-check"><input type="checkbox" checked={heroSettings.searchButtonFullWidth} onChange={event => updateHeroDevice({ searchButtonFullWidth: event.target.checked })} /> Full-width search button</label>
                <button type="button" className="btn btn-ghost" onClick={resetHeroDevice}>Reset {device} layout</button>
              </details>

              <details className="page-designer-inspector-group" open>
                <summary>{device} element visibility & order</summary>
                <div className="page-designer-hero-order-list">
                  {heroSettings.elementOrder.map((id, index) => (
                    <div key={id}>
                      <label><input type="checkbox" checked={heroSettings.visibility[id] !== false} onChange={event => updateHeroDevice({ visibility: { ...heroSettings.visibility, [id]: event.target.checked } })} /> <span>{HERO_ELEMENT_LABELS[id]}</span></label>
                      <div><button type="button" onClick={() => moveHeroElement(id, -1)} disabled={index === 0} aria-label={`Move ${HERO_ELEMENT_LABELS[id]} up`}>↑</button><button type="button" onClick={() => moveHeroElement(id, 1)} disabled={index === heroSettings.elementOrder.length - 1} aria-label={`Move ${HERO_ELEMENT_LABELS[id]} down`}>↓</button></div>
                    </div>
                  ))}
                </div>
              </details>
              <p className="phase12-preview-note">Each device keeps its own typography, spacing, focal point, visibility and order. Hero button labels and destinations remain editable under Navigation / Buttons.</p>
            </> : <p className="phase12-preview-note">{selectedSection} is selected. Click its visible text, media, button or container in the canvas to edit it with the universal inspector above.</p>}
          </div>
        )}

        {selectedElement ? (
          <div className="page-designer-element-fields">
            <label className="phase12-field"><span>Block type</span><select className="form-select" value={selectedElement.type} onChange={event => updateElement(selectedElement.id, { type: event.target.value })}>{['button', 'text', 'image', 'video', 'banner', 'card'].map(type => <option key={type}>{type}</option>)}</select></label>
            {!['image', 'video'].includes(selectedElement.type) && <label className="phase12-field"><span>Text</span><textarea className="form-textarea" value={selectedElement.text} onChange={event => updateElement(selectedElement.id, { text: event.target.value })} /></label>}
            {selectedElement.type === 'button' && <label className="phase12-field"><span>Safe destination</span><input className="form-input" value={selectedElement.target} onChange={event => updateElement(selectedElement.id, { target: event.target.value })} /></label>}
            {['image', 'video'].includes(selectedElement.type) && (
              <>
                <label className="phase12-field"><span>Media</span><select className="form-select" value={selectedElement.assetId} onChange={event => updateElement(selectedElement.id, { assetId: event.target.value })}><option value="">Select…</option>{assets.filter(asset => asset.media_type === selectedElement.type).map(asset => <option key={asset.asset_id} value={asset.asset_id}>{asset.original_name}</option>)}</select></label>
                <label className="phase12-field"><span>Accessibility description</span><input className="form-input" value={selectedElement.alt} onChange={event => updateElement(selectedElement.id, { alt: event.target.value })} /></label>
              </>
            )}
            <div className="page-designer-color-row"><label>Background <input type="color" value={selectedElement.backgroundColor || '#A305A6'} onChange={event => updateElement(selectedElement.id, { backgroundColor: event.target.value })} /></label><label>Text <input type="color" value={selectedElement.textColor || '#FFFFFF'} onChange={event => updateElement(selectedElement.id, { textColor: event.target.value })} /></label></div>
            <label className="phase12-field"><span>Visible on</span><select className="form-select" value={selectedElement.showOn} onChange={event => updateElement(selectedElement.id, { showOn: event.target.value })}><option value="all">All devices</option><option value="desktop">Desktop only</option><option value="tablet">Tablet only</option><option value="mobile">Mobile only</option></select></label>
            <div className="page-designer-number-grid">
              {['x', 'y', 'width', 'height'].map(key => <label className="phase12-field" key={key}><span>{device} {key}{key === 'x' ? ' (%)' : ' (px)'}</span><input className="form-input" type="number" value={selectedPlacement?.[key] ?? 0} onChange={event => updateElementPlacement(selectedElement.id, { [key]: Number(event.target.value) })} /></label>)}
              <label className="phase12-field"><span>Layer (z)</span><input className="form-input" type="number" min="1" max="50" value={selectedElement.zIndex} onChange={event => updateElement(selectedElement.id, { zIndex: Number(event.target.value) })} /></label>
              <label className="phase12-field"><span>Corner radius</span><input className="form-input" type="number" min="0" max="80" value={selectedElement.borderRadius} onChange={event => updateElement(selectedElement.id, { borderRadius: Number(event.target.value) })} /></label>
            </div>
            <label className="page-designer-check"><input type="checkbox" checked={selectedElement.visible} onChange={event => updateElement(selectedElement.id, { visible: event.target.checked })} /> Visible</label>
            <button type="button" className="btn btn-danger" onClick={() => removeElement(selectedElement.id)}>Remove block</button>
          </div>
        ) : <p style={{ color: 'var(--text-muted)' }}>Select a layer or add a block to edit its content and responsive position.</p>}
      </section>
    </div>
  );
}
