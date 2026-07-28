import React, { useEffect, useMemo, useRef, useState } from 'react';
import { addToast } from '../common/Toast';
import { useCMS } from '../../context/CMSContext';
import { DEFAULT_CMS } from '../../utils/constants';
import {
  DEFAULT_PLATFORM_CONFIG,
  DASHBOARD_WIDGET_CATALOG,
  HOME_SECTION_CATALOG,
  PORTAL_LABELS,
  SAFE_ROUTE_OPTIONS,
  clonePlatformConfig,
  normalisePlatformConfig
} from '../../../shared/platformConfig';
import './admin-cms.css';

const TABS = [
  ['builder', 'Visual Builder'],
  ['theme', 'Theme Studio'],
  ['navigation', 'Navigation'],
  ['content', 'Content'],
  ['versions', 'Publish & History']
];

const apiRequest = async (url, options = {}) => {
  const response = await fetch(url, {
    credentials: 'same-origin',
    ...options,
    headers: { 'Content-Type': 'application/json', ...(options.headers || {}) }
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok || !data.success) throw new Error(data.error || 'The request could not be completed.');
  return data;
};

const mergeContent = content => ({
  ...DEFAULT_CMS,
  ...(content || {}),
  brand: { ...DEFAULT_CMS.brand, ...(content?.brand || {}) },
  hero: { ...DEFAULT_CMS.hero, ...(content?.hero || {}) },
  process: { ...DEFAULT_CMS.process, ...(content?.process || {}), steps: content?.process?.steps || DEFAULT_CMS.process.steps },
  pricing: { ...DEFAULT_CMS.pricing, ...(content?.pricing || {}) },
  about: { ...DEFAULT_CMS.about, ...(content?.about || {}) },
  footer: { ...DEFAULT_CMS.footer, ...(content?.footer || {}) }
});

const hydrate = config => {
  const normalised = normalisePlatformConfig(config || DEFAULT_PLATFORM_CONFIG);
  return { ...normalised, content: mergeContent(normalised.content) };
};

const move = (items, from, to) => {
  if (to < 0 || to >= items.length) return items;
  const next = [...items];
  const [item] = next.splice(from, 1);
  next.splice(to, 0, item);
  return next;
};

function Field({ label, value, onChange, type = 'text', min, max, step, help, multiline = false }) {
  const Element = multiline ? 'textarea' : 'input';
  return (
    <label className="phase12-field">
      <span>{label}</span>
      <Element
        className={multiline ? 'form-textarea' : 'form-input'}
        type={multiline ? undefined : type}
        value={value ?? ''}
        min={min}
        max={max}
        step={step}
        onChange={event => onChange(type === 'number' || type === 'range' ? Number(event.target.value) : event.target.value)}
      />
      {help && <small>{help}</small>}
    </label>
  );
}

function ColorField({ label, value, onChange }) {
  return (
    <label className="phase12-color-field">
      <span>{label}</span>
      <div>
        <input type="color" value={value || '#000000'} onChange={event => onChange(event.target.value)} />
        <input className="form-input" value={value || ''} onChange={event => onChange(event.target.value)} maxLength={7} />
      </div>
    </label>
  );
}

export default function AdminCMS() {
  const { refreshConfig } = useCMS();
  const [draft, setDraft] = useState(() => hydrate(DEFAULT_PLATFORM_CONFIG));
  const [published, setPublished] = useState(() => hydrate(DEFAULT_PLATFORM_CONFIG));
  const [baseline, setBaseline] = useState('');
  const [versions, setVersions] = useState([]);
  const [meta, setMeta] = useState({ draftVersion: 1, publishedVersion: 1, publishedAt: null });
  const [activeTab, setActiveTab] = useState('builder');
  const [portal, setPortal] = useState('public');
  const [selectedButton, setSelectedButton] = useState('heroPrimary');
  const [previewTheme, setPreviewTheme] = useState('dark');
  const [previewDevice, setPreviewDevice] = useState('desktop');
  const [publishNote, setPublishNote] = useState('');
  const [loading, setLoading] = useState(true);
  const [working, setWorking] = useState('');
  const [dragIndex, setDragIndex] = useState(null);
  const importInput = useRef(null);

  const dirty = useMemo(() => baseline && JSON.stringify(draft) !== baseline, [baseline, draft]);
  const sectionCatalog = useMemo(() => new Map(HOME_SECTION_CATALOG.map(item => [item.id, item])), []);
  const dashboardCatalog = useMemo(() => Object.fromEntries(
    Object.entries(DASHBOARD_WIDGET_CATALOG).map(([portalId, widgets]) => [
      portalId,
      new Map(widgets.map(widget => [widget.id, widget]))
    ])
  ), []);
  const portalButtons = useMemo(
    () => Object.values(draft.buttons || {}).filter(item => item.portal === portal).sort((a, b) => a.position - b.position),
    [draft.buttons, portal]
  );

  useEffect(() => {
    if (!portalButtons.some(item => item.id === selectedButton) && portalButtons[0]) {
      setSelectedButton(portalButtons[0].id);
    }
  }, [portalButtons, selectedButton]);

  const load = async () => {
    setLoading(true);
    try {
      const data = await apiRequest('/api/admin/platform-config');
      const nextDraft = hydrate(data.draft);
      setDraft(nextDraft);
      setPublished(hydrate(data.published));
      setBaseline(JSON.stringify(nextDraft));
      setVersions(data.revisions || []);
      setMeta({
        draftVersion: data.draftVersion,
        publishedVersion: data.publishedVersion,
        publishedAt: data.publishedAt,
        publishedBy: data.publishedBy,
        draftUpdatedBy: data.draftUpdatedBy
      });
    } catch (error) {
      addToast(error.message, 'error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  useEffect(() => {
    const warn = event => {
      if (!dirty) return;
      event.preventDefault();
      event.returnValue = '';
    };
    window.addEventListener('beforeunload', warn);
    return () => window.removeEventListener('beforeunload', warn);
  }, [dirty]);

  const updateContentSection = (section, patch) => {
    setDraft(previous => ({
      ...previous,
      content: {
        ...previous.content,
        [section]: { ...(previous.content?.[section] || {}), ...patch }
      }
    }));
  };

  const saveDraft = async () => {
    setWorking('save');
    try {
      const config = hydrate(normalisePlatformConfig(draft));
      const data = await apiRequest('/api/admin/platform-config/draft', {
        method: 'PUT',
        body: JSON.stringify({ config, expectedVersion: meta.draftVersion })
      });
      setDraft(config);
      setBaseline(JSON.stringify(config));
      setMeta(previous => ({ ...previous, draftVersion: data.draftVersion }));
      addToast('Draft saved. The live platform has not changed.', 'success');
    } catch (error) {
      addToast(error.message, 'error');
    } finally {
      setWorking('');
    }
  };

  const publish = async () => {
    if (!window.confirm('Publish this draft to every portal now? A rollback version will be kept.')) return;
    setWorking('publish');
    try {
      const config = hydrate(normalisePlatformConfig(draft));
      const data = await apiRequest('/api/admin/platform-config/publish', {
        method: 'POST',
        body: JSON.stringify({ config, note: publishNote, expectedVersion: meta.draftVersion })
      });
      setDraft(config);
      setPublished(config);
      setBaseline(JSON.stringify(config));
      setPublishNote('');
      setMeta(previous => ({ ...previous, publishedVersion: data.publishedVersion, publishedAt: data.publishedAt }));
      await refreshConfig();
      await load();
      addToast(`Version ${data.publishedVersion} is live.`, 'success');
    } catch (error) {
      addToast(error.message, 'error');
    } finally {
      setWorking('');
    }
  };

  const resetDraft = async source => {
    const label = source === 'defaults' ? 'factory defaults' : 'the current live version';
    if (!window.confirm(`Replace the draft with ${label}? The live platform will not change until you publish.`)) return;
    setWorking('reset');
    try {
      const data = await apiRequest('/api/admin/platform-config/reset-draft', {
        method: 'POST',
        body: JSON.stringify({ source })
      });
      const next = hydrate(data.draft);
      setDraft(next);
      setBaseline(JSON.stringify(next));
      setMeta(previous => ({ ...previous, draftVersion: data.draftVersion }));
      addToast(`Draft restored from ${label}.`, 'success');
    } catch (error) {
      addToast(error.message, 'error');
    } finally {
      setWorking('');
    }
  };

  const rollback = async version => {
    if (!window.confirm(`Roll back the live platform to version ${version}? This creates a new version and keeps the full history.`)) return;
    setWorking(`rollback-${version}`);
    try {
      const data = await apiRequest(`/api/admin/platform-config/rollback/${version}`, { method: 'POST', body: '{}' });
      await refreshConfig();
      await load();
      addToast(`Rollback published as version ${data.publishedVersion}.`, 'success');
    } catch (error) {
      addToast(error.message, 'error');
    } finally {
      setWorking('');
    }
  };

  const exportConfig = () => {
    const blob = new Blob([JSON.stringify(draft, null, 2)], { type: 'application/json' });
    const anchor = document.createElement('a');
    anchor.href = URL.createObjectURL(blob);
    anchor.download = `ips-platform-draft-v${meta.draftVersion}.json`;
    anchor.click();
    URL.revokeObjectURL(anchor.href);
  };

  const importConfig = event => {
    const file = event.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const imported = hydrate(normalisePlatformConfig(JSON.parse(reader.result)));
        setDraft(imported);
        addToast('Configuration imported into the draft. Review it before saving or publishing.', 'success');
      } catch {
        addToast('That file is not a valid IPS configuration.', 'error');
      }
    };
    reader.readAsText(file);
    event.target.value = '';
  };

  const updateLayout = (key, value) => setDraft(previous => ({
    ...previous,
    layouts: {
      ...previous.layouts,
      [portal]: { ...previous.layouts[portal], [key]: value }
    }
  }));

  const updateButton = (key, value) => setDraft(previous => ({
    ...previous,
    buttons: {
      ...previous.buttons,
      [selectedButton]: { ...previous.buttons[selectedButton], [key]: value }
    }
  }));

  const moveButton = direction => {
    const selected = draft.buttons[selectedButton];
    const ordered = Object.values(draft.buttons)
      .filter(item => item.portal === selected.portal && item.area === selected.area)
      .sort((a, b) => a.position - b.position);
    const index = ordered.findIndex(item => item.id === selectedButton);
    const target = index + direction;
    if (target < 0 || target >= ordered.length) return;
    const other = ordered[target];
    setDraft(previous => ({
      ...previous,
      buttons: {
        ...previous.buttons,
        [selectedButton]: { ...previous.buttons[selectedButton], position: other.position },
        [other.id]: { ...previous.buttons[other.id], position: previous.buttons[selectedButton].position }
      }
    }));
  };

  const moveSection = (index, direction) => {
    setDraft(previous => ({
      ...previous,
      homeSections: move(previous.homeSections, index, index + direction).map((item, order) => ({ ...item, order }))
    }));
  };

  const moveDashboardWidget = (index, direction) => {
    setDraft(previous => ({
      ...previous,
      dashboardWidgets: {
        ...previous.dashboardWidgets,
        [portal]: move(previous.dashboardWidgets[portal], index, index + direction).map((item, order) => ({ ...item, order }))
      }
    }));
  };

  const updateDashboardWidget = (id, patch) => {
    setDraft(previous => ({
      ...previous,
      dashboardWidgets: {
        ...previous.dashboardWidgets,
        [portal]: previous.dashboardWidgets[portal].map(item => item.id === id ? { ...item, ...patch } : item)
      }
    }));
  };

  const updateNavItem = (index, patch) => setDraft(previous => {
    const items = [...previous.navigation[portal]];
    items[index] = { ...items[index], ...patch };
    return { ...previous, navigation: { ...previous.navigation, [portal]: items } };
  });

  const moveNavItem = (index, direction) => setDraft(previous => ({
    ...previous,
    navigation: {
      ...previous.navigation,
      [portal]: move(previous.navigation[portal], index, index + direction)
    }
  }));

  const addNavItem = () => {
    const firstRoute = SAFE_ROUTE_OPTIONS[portal]?.[0]?.[0] || '/';
    setDraft(previous => ({
      ...previous,
      navigation: {
        ...previous.navigation,
        [portal]: [
          ...previous.navigation[portal],
          { id: `${portal}-custom-${Date.now()}`, label: 'New item', icon: '', target: firstRoute, visible: true }
        ]
      }
    }));
  };

  const removeNavItem = index => setDraft(previous => ({
    ...previous,
    navigation: {
      ...previous.navigation,
      [portal]: previous.navigation[portal].filter((_, itemIndex) => itemIndex !== index)
    }
  }));

  const previewPalette = draft.theme?.[previewTheme] || draft.theme.dark;
  const previewNav = (draft.navigation?.[portal] || []).filter(item => item.visible);
  const previewButtons = Object.values(draft.buttons || {}).sort((a, b) => a.position - b.position);
  const layout = draft.layouts?.[portal] || {};

  const renderPreview = () => {
    const frameStyle = {
      '--preview-primary': previewPalette.primary,
      '--preview-accent': previewPalette.accent,
      '--preview-bg': previewPalette.background,
      '--preview-surface': previewPalette.surface,
      '--preview-alt': previewPalette.surfaceAlt,
      '--preview-text': previewPalette.text,
      '--preview-muted': previewPalette.textMuted,
      '--preview-radius': `${draft.theme.cardRadius}px`,
      '--preview-button-radius': `${draft.theme.buttonRadius}px`,
      fontFamily: draft.theme.fontFamily === 'Georgia' ? 'Georgia, serif' : `${draft.theme.fontFamily}, sans-serif`
    };
    if (portal === 'public') {
      const heroButtons = previewButtons.filter(button => ['heroPrimary', 'heroSecondary'].includes(button.id) && button.visible);
      return (
        <div className="phase12-preview-page" style={frameStyle}>
          <div className="phase12-preview-public-nav">
            <strong>{draft.content.brand?.name || 'IPS'}</strong>
            <div>{previewNav.map(item => <span key={item.id}>{item.label}</span>)}</div>
          </div>
          <div className="phase12-preview-hero" style={{ background: `linear-gradient(135deg, ${draft.theme.gradientStart}, ${draft.theme.gradientEnd})` }}>
            <small>{draft.content.hero?.badge}</small>
            <h2>{draft.content.hero?.headline}</h2>
            <p>{draft.content.hero?.subheadline}</p>
            <div>
              {heroButtons.map(button => (
                <span
                  key={button.id}
                  className={`phase12-preview-button ${button.variant}`}
                  style={{ background: button.backgroundColor || undefined, color: button.textColor || undefined }}
                >
                  {button.icon} {button.label}
                </span>
              ))}
            </div>
          </div>
          <div className="phase12-preview-sections">
            {draft.homeSections.filter(section => section.visible && section.id !== 'hero').map(section => (
              <div key={section.id}><span>{sectionCatalog.get(section.id)?.label}</span><i /></div>
            ))}
          </div>
        </div>
      );
    }
    return (
      <div className="phase12-preview-portal" style={frameStyle}>
        <aside style={{ width: Math.min(190, (layout.sidebarWidth || 240) * 0.7) }}>
          <strong>IPS</strong>
          {previewNav.map(item => <span key={item.id}>{item.icon} {item.label}</span>)}
        </aside>
        <main style={{ padding: Math.max(12, (layout.contentPadding || 32) * 0.65) }}>
          <small>{PORTAL_LABELS[portal]}</small>
          <h2>{previewNav[0]?.label || 'Dashboard'}</h2>
          <div className="phase12-preview-dashboard-widgets">
            {(draft.dashboardWidgets?.[portal] || []).filter(widget => widget.visible).map(widget => (
              <div key={widget.id} className={widget.width}><span>{dashboardCatalog[portal]?.get(widget.id)?.label || widget.id}</span><i /><i /></div>
            ))}
          </div>
        </main>
      </div>
    );
  };

  if (loading) return <div className="phase12-loading">Loading the visual builder…</div>;

  const button = draft.buttons[selectedButton];

  return (
    <div className="phase12-shell">
      <div className="phase12-topbar">
        <div>
          <div className="phase12-eyebrow">Ultimate MVP · Phase 12</div>
          <h2>Platform Design Studio</h2>
          <p>Control layout, navigation, buttons, content and brand styling from one governed workspace.</p>
        </div>
        <div className="phase12-actions">
          <span className={`phase12-dirty ${dirty ? 'is-dirty' : ''}`}>{dirty ? 'Unsaved changes' : 'Draft saved'}</span>
          <button className="btn btn-secondary" onClick={saveDraft} disabled={Boolean(working)}>{working === 'save' ? 'Saving…' : 'Save Draft'}</button>
          <button className="btn btn-primary" onClick={() => setActiveTab('versions')}>Review & Publish</button>
        </div>
      </div>

      <div className="phase12-status-grid">
        <div><small>Draft</small><strong>v{meta.draftVersion}</strong><span>{meta.draftUpdatedBy || 'System'}</span></div>
        <div><small>Live</small><strong>v{meta.publishedVersion}</strong><span>{meta.publishedAt ? new Date(meta.publishedAt).toLocaleString() : 'Not published'}</span></div>
        <div><small>Safety</small><strong>Validated</strong><span>Safe routes · responsive limits · rollback</span></div>
      </div>

      <div className="phase12-tabs" role="tablist">
        {TABS.map(([id, label]) => (
          <button key={id} type="button" className={activeTab === id ? 'active' : ''} onClick={() => setActiveTab(id)}>{label}</button>
        ))}
      </div>

      {activeTab === 'builder' && (
        <div className="phase12-builder-grid">
          <section className="phase12-panel phase12-layer-panel">
            <div className="phase12-panel-heading"><span>Page layers</span><small>Move or hide</small></div>
            <label className="phase12-field">
              <span>Portal</span>
              <select className="form-select" value={portal} onChange={event => setPortal(event.target.value)}>
                {Object.entries(PORTAL_LABELS).map(([id, label]) => <option key={id} value={id}>{label}</option>)}
              </select>
            </label>
            {portal === 'public' ? (
              <div className="phase12-layer-list">
                {draft.homeSections.map((section, index) => (
                  <div key={section.id} className={!section.visible ? 'muted' : ''}>
                    <span className="phase12-drag-handle">⋮⋮</span>
                    <span><strong>{sectionCatalog.get(section.id)?.label}</strong><small>{sectionCatalog.get(section.id)?.description}</small></span>
                    <button type="button" title="Move up" onClick={() => moveSection(index, -1)} disabled={index === 0}>↑</button>
                    <button type="button" title="Move down" onClick={() => moveSection(index, 1)} disabled={index === draft.homeSections.length - 1}>↓</button>
                    <input type="checkbox" checked={section.visible} onChange={event => setDraft(previous => ({ ...previous, homeSections: previous.homeSections.map(item => item.id === section.id ? { ...item, visible: event.target.checked } : item) }))} />
                  </div>
                ))}
              </div>
            ) : (
              <div className="phase12-layer-list">
                {(draft.dashboardWidgets[portal] || []).map((item, index) => (
                  <div key={item.id} className={!item.visible ? 'muted' : ''}>
                    <span className="phase12-drag-handle">⋮⋮</span>
                    <span>
                      <strong>{dashboardCatalog[portal]?.get(item.id)?.label || item.id}</strong>
                      <small>
                        Width{' '}
                        <select value={item.width} onChange={event => updateDashboardWidget(item.id, { width: event.target.value })}>
                          <option value="standard">standard</option><option value="wide">wide</option><option value="full">full</option>
                        </select>
                      </small>
                    </span>
                    <button type="button" onClick={() => moveDashboardWidget(index, -1)} disabled={index === 0}>↑</button>
                    <button type="button" onClick={() => moveDashboardWidget(index, 1)} disabled={index === draft.dashboardWidgets[portal].length - 1}>↓</button>
                    <input type="checkbox" checked={item.visible} onChange={event => updateDashboardWidget(item.id, { visible: event.target.checked })} />
                  </div>
                ))}
              </div>
            )}
          </section>

          <section className="phase12-canvas-panel">
            <div className="phase12-canvas-toolbar">
              <div>
                <button type="button" className={previewDevice === 'desktop' ? 'active' : ''} onClick={() => setPreviewDevice('desktop')}>Desktop</button>
                <button type="button" className={previewDevice === 'mobile' ? 'active' : ''} onClick={() => setPreviewDevice('mobile')}>Mobile</button>
              </div>
              <div>
                <button type="button" className={previewTheme === 'light' ? 'active' : ''} onClick={() => setPreviewTheme('light')}>Light</button>
                <button type="button" className={previewTheme === 'dark' ? 'active' : ''} onClick={() => setPreviewTheme('dark')}>Dark</button>
              </div>
            </div>
            <div className={`phase12-canvas ${previewDevice}`}>{renderPreview()}</div>
            <p className="phase12-preview-note">Draft preview only. Nothing changes for users until you publish.</p>
          </section>

          <section className="phase12-panel phase12-inspector">
            <div className="phase12-panel-heading"><span>Inspector</span><small>{PORTAL_LABELS[portal]}</small></div>
            {portal !== 'public' && <Field label="Sidebar width" type="range" min={200} max={360} value={layout.sidebarWidth} onChange={value => updateLayout('sidebarWidth', value)} help={`${layout.sidebarWidth}px`} />}
            {portal === 'public' && (
              <>
                <Field label="Content width" type="range" min={900} max={1600} value={layout.contentWidth} onChange={value => updateLayout('contentWidth', value)} help={`${layout.contentWidth}px`} />
                <Field label="Section spacing" type="range" min={32} max={140} value={layout.sectionSpacing} onChange={value => updateLayout('sectionSpacing', value)} help={`${layout.sectionSpacing}px`} />
              </>
            )}
            <Field label="Content padding" type="range" min={12} max={64} value={layout.contentPadding} onChange={value => updateLayout('contentPadding', value)} help={`${layout.contentPadding}px`} />
            <label className="phase12-field">
              <span>Density</span>
              <select className="form-select" value={layout.density} onChange={event => updateLayout('density', event.target.value)}>
                <option value="compact">Compact</option>
                <option value="comfortable">Comfortable</option>
                <option value="spacious">Spacious</option>
              </select>
            </label>

            {button && button.portal === portal && (
              <div className="phase12-button-inspector">
                <h3>Button control</h3>
                <label className="phase12-field">
                  <span>Button</span>
                  <select className="form-select" value={selectedButton} onChange={event => setSelectedButton(event.target.value)}>
                    {portalButtons.map(item => <option key={item.id} value={item.id}>{item.label}</option>)}
                  </select>
                </label>
                <Field label="Label" value={button.label} onChange={value => updateButton('label', value)} />
                <Field label="Icon or short symbol" value={button.icon} onChange={value => updateButton('icon', value)} />
                <label className="phase12-field"><span>Destination</span><select className="form-select" value={button.target} onChange={event => updateButton('target', event.target.value)}>{SAFE_ROUTE_OPTIONS[portal].map(([target, label]) => <option key={target} value={target}>{label}</option>)}</select></label>
                <label className="phase12-field"><span>Style</span><select className="form-select" value={button.variant} onChange={event => updateButton('variant', event.target.value)}><option value="primary">Primary</option><option value="secondary">Secondary</option><option value="ghost">Outline</option><option value="gold">Gold</option></select></label>
                <label className="phase12-field"><span>Device visibility</span><select className="form-select" value={button.showOn} onChange={event => updateButton('showOn', event.target.value)}><option value="all">All devices</option><option value="desktop">Desktop only</option><option value="mobile">Mobile only</option></select></label>
                <div className="phase12-inline-fields"><ColorField label="Custom background" value={button.backgroundColor || '#A305A6'} onChange={value => updateButton('backgroundColor', value)} /><ColorField label="Custom text" value={button.textColor || '#FFFFFF'} onChange={value => updateButton('textColor', value)} /></div>
                <div className="phase12-reorder-buttons"><button type="button" onClick={() => moveButton(-1)}>Move earlier</button><button type="button" onClick={() => moveButton(1)}>Move later</button><label><input type="checkbox" checked={button.visible} onChange={event => updateButton('visible', event.target.checked)} /> Visible</label></div>
                <button type="button" className="phase12-clear-colors" onClick={() => setDraft(previous => ({ ...previous, buttons: { ...previous.buttons, [selectedButton]: { ...previous.buttons[selectedButton], backgroundColor: '', textColor: '' } } }))}>Use theme colors</button>
              </div>
            )}
          </section>
        </div>
      )}

      {activeTab === 'theme' && (
        <div className="phase12-theme-layout">
          <section className="phase12-panel">
            <div className="phase12-panel-heading"><span>Light palette</span><small>Public and portal light mode</small></div>
            <div className="phase12-color-grid">
              {Object.entries(draft.theme.light).map(([key, value]) => <ColorField key={key} label={key.replace(/([A-Z])/g, ' $1')} value={value} onChange={color => setDraft(previous => ({ ...previous, theme: { ...previous.theme, light: { ...previous.theme.light, [key]: color } } }))} />)}
            </div>
          </section>
          <section className="phase12-panel">
            <div className="phase12-panel-heading"><span>Dark palette</span><small>Dark surfaces and contrast</small></div>
            <div className="phase12-color-grid">
              {Object.entries(draft.theme.dark).map(([key, value]) => <ColorField key={key} label={key.replace(/([A-Z])/g, ' $1')} value={value} onChange={color => setDraft(previous => ({ ...previous, theme: { ...previous.theme, dark: { ...previous.theme.dark, [key]: color } } }))} />)}
            </div>
          </section>
          <section className="phase12-panel phase12-theme-global">
            <div className="phase12-panel-heading"><span>Global style</span><small>Shape, typography and gradient</small></div>
            <div className="phase12-inline-fields">
              <ColorField label="Gradient start" value={draft.theme.gradientStart} onChange={value => setDraft(previous => ({ ...previous, theme: { ...previous.theme, gradientStart: value } }))} />
              <ColorField label="Gradient end" value={draft.theme.gradientEnd} onChange={value => setDraft(previous => ({ ...previous, theme: { ...previous.theme, gradientEnd: value } }))} />
            </div>
            <label className="phase12-field"><span>Font family</span><select className="form-select" value={draft.theme.fontFamily} onChange={event => setDraft(previous => ({ ...previous, theme: { ...previous.theme, fontFamily: event.target.value } }))}>{['Inter', 'System', 'Georgia', 'Arial', 'Verdana'].map(font => <option key={font}>{font}</option>)}</select></label>
            <Field label="Button corner radius" type="range" min={0} max={40} value={draft.theme.buttonRadius} onChange={value => setDraft(previous => ({ ...previous, theme: { ...previous.theme, buttonRadius: value } }))} help={`${draft.theme.buttonRadius}px`} />
            <Field label="Card corner radius" type="range" min={0} max={40} value={draft.theme.cardRadius} onChange={value => setDraft(previous => ({ ...previous, theme: { ...previous.theme, cardRadius: value } }))} help={`${draft.theme.cardRadius}px`} />
          </section>
        </div>
      )}

      {activeTab === 'navigation' && (
        <section className="phase12-panel">
          <div className="phase12-panel-heading phase12-nav-heading">
            <span>Navigation Builder</span>
            <div><select className="form-select" value={portal} onChange={event => setPortal(event.target.value)}>{Object.entries(PORTAL_LABELS).map(([id, label]) => <option key={id} value={id}>{label}</option>)}</select><button className="btn btn-primary btn-sm" onClick={addNavItem}>Add item</button></div>
          </div>
          <p className="phase12-help">Drag rows or use the arrow controls. Destinations are restricted to safe platform routes.</p>
          <div className="phase12-nav-list">
            {(draft.navigation[portal] || []).map((item, index) => (
              <div
                key={item.id}
                draggable
                onDragStart={() => setDragIndex(index)}
                onDragOver={event => event.preventDefault()}
                onDrop={() => {
                  if (dragIndex == null) return;
                  setDraft(previous => ({ ...previous, navigation: { ...previous.navigation, [portal]: move(previous.navigation[portal], dragIndex, index) } }));
                  setDragIndex(null);
                }}
              >
                <span className="phase12-drag-handle">⋮⋮</span>
                <input className="form-input phase12-icon-input" value={item.icon} onChange={event => updateNavItem(index, { icon: event.target.value })} maxLength={8} aria-label="Icon" />
                <input className="form-input" value={item.label} onChange={event => updateNavItem(index, { label: event.target.value })} aria-label="Label" />
                <select className="form-select" value={item.target} disabled={item.id === 'admin-cms'} onChange={event => updateNavItem(index, { target: event.target.value })}>{SAFE_ROUTE_OPTIONS[portal].map(([target, label]) => <option key={target} value={target}>{label}</option>)}</select>
                <label className="phase12-visible-check"><input type="checkbox" checked={item.visible} disabled={item.id === 'admin-cms'} onChange={event => updateNavItem(index, { visible: event.target.checked })} /> Show</label>
                <div className="phase12-row-actions"><button type="button" onClick={() => moveNavItem(index, -1)} disabled={index === 0}>↑</button><button type="button" onClick={() => moveNavItem(index, 1)} disabled={index === draft.navigation[portal].length - 1}>↓</button><button type="button" className="danger" onClick={() => removeNavItem(index)} disabled={item.id === 'admin-cms'}>×</button></div>
              </div>
            ))}
          </div>
        </section>
      )}

      {activeTab === 'content' && (
        <div className="phase12-content-grid">
          <section className="phase12-panel">
            <div className="phase12-panel-heading"><span>Brand identity</span><small>Used across the platform</small></div>
            <Field label="Company name" value={draft.content.brand?.name} onChange={value => updateContentSection('brand', { name: value })} />
            <Field label="Tagline" value={draft.content.brand?.tagline} onChange={value => updateContentSection('brand', { tagline: value })} />
            <Field label="Support email" type="email" value={draft.content.brand?.email} onChange={value => updateContentSection('brand', { email: value })} />
            <Field label="WhatsApp" value={draft.content.brand?.whatsapp} onChange={value => updateContentSection('brand', { whatsapp: value })} />
          </section>
          <section className="phase12-panel">
            <div className="phase12-panel-heading"><span>Homepage hero</span><small>First impression</small></div>
            <Field label="Badge" value={draft.content.hero?.badge} onChange={value => updateContentSection('hero', { badge: value })} />
            <Field label="Headline" value={draft.content.hero?.headline} onChange={value => updateContentSection('hero', { headline: value })} multiline />
            <Field label="Subheadline" value={draft.content.hero?.subheadline} onChange={value => updateContentSection('hero', { subheadline: value })} multiline />
          </section>
          <section className="phase12-panel phase12-content-wide">
            <div className="phase12-panel-heading"><span>Service cards</span><button className="btn btn-primary btn-sm" onClick={() => setDraft(previous => ({ ...previous, content: { ...previous.content, services: [...(previous.content.services || []), { icon: 'S', title: 'New service', description: 'Describe the service.' }] } }))}>Add service</button></div>
            <div className="phase12-repeaters">
              {(draft.content.services || []).map((service, index) => (
                <div key={index}>
                  <Field label="Icon" value={service.icon} onChange={value => setDraft(previous => ({ ...previous, content: { ...previous.content, services: previous.content.services.map((item, itemIndex) => itemIndex === index ? { ...item, icon: value } : item) } }))} />
                  <Field label="Title" value={service.title} onChange={value => setDraft(previous => ({ ...previous, content: { ...previous.content, services: previous.content.services.map((item, itemIndex) => itemIndex === index ? { ...item, title: value } : item) } }))} />
                  <Field label="Description" value={service.description} onChange={value => setDraft(previous => ({ ...previous, content: { ...previous.content, services: previous.content.services.map((item, itemIndex) => itemIndex === index ? { ...item, description: value } : item) } }))} multiline />
                  <button type="button" className="phase12-remove" onClick={() => setDraft(previous => ({ ...previous, content: { ...previous.content, services: previous.content.services.filter((_, itemIndex) => itemIndex !== index) } }))}>Remove</button>
                </div>
              ))}
            </div>
          </section>
          <section className="phase12-panel phase12-content-wide">
            <div className="phase12-panel-heading"><span>How it works</span><small>Homepage customer journey</small></div>
            <div className="phase12-inline-fields">
              <Field label="Section label" value={draft.content.process?.label} onChange={value => updateContentSection('process', { label: value })} />
              <Field label="Headline" value={draft.content.process?.headline} onChange={value => updateContentSection('process', { headline: value })} />
            </div>
            <Field label="Subheadline" value={draft.content.process?.subheadline} onChange={value => updateContentSection('process', { subheadline: value })} multiline />
            <div className="phase12-repeaters">
              {(draft.content.process?.steps || []).map((step, index) => (
                <div key={index}>
                  <Field label="Number" value={step.number} onChange={value => updateContentSection('process', { steps: draft.content.process.steps.map((entry, itemIndex) => itemIndex === index ? { ...entry, number: value } : entry) })} />
                  <Field label="Title" value={step.title} onChange={value => updateContentSection('process', { steps: draft.content.process.steps.map((entry, itemIndex) => itemIndex === index ? { ...entry, title: value } : entry) })} />
                  <Field label="Description" value={step.description} onChange={value => updateContentSection('process', { steps: draft.content.process.steps.map((entry, itemIndex) => itemIndex === index ? { ...entry, description: value } : entry) })} multiline />
                </div>
              ))}
            </div>
          </section>
          <section className="phase12-panel phase12-content-wide">
            <div className="phase12-panel-heading"><span>FAQ</span><button className="btn btn-primary btn-sm" onClick={() => setDraft(previous => ({ ...previous, content: { ...previous.content, faq: [...(previous.content.faq || []), { q: 'New question', a: 'New answer' }] } }))}>Add FAQ</button></div>
            <div className="phase12-repeaters two">
              {(draft.content.faq || []).map((item, index) => (
                <div key={index}>
                  <Field label="Question" value={item.q} onChange={value => setDraft(previous => ({ ...previous, content: { ...previous.content, faq: previous.content.faq.map((entry, itemIndex) => itemIndex === index ? { ...entry, q: value } : entry) } }))} />
                  <Field label="Answer" value={item.a} onChange={value => setDraft(previous => ({ ...previous, content: { ...previous.content, faq: previous.content.faq.map((entry, itemIndex) => itemIndex === index ? { ...entry, a: value } : entry) } }))} multiline />
                  <button type="button" className="phase12-remove" onClick={() => setDraft(previous => ({ ...previous, content: { ...previous.content, faq: previous.content.faq.filter((_, itemIndex) => itemIndex !== index) } }))}>Remove</button>
                </div>
              ))}
            </div>
          </section>
          <section className="phase12-panel">
            <div className="phase12-panel-heading"><span>Pricing</span><small>Base rates and rush fees</small></div>
            <div className="phase12-inline-fields">
              {Object.entries(draft.content.pricing || {}).map(([key, value]) => (
                <Field
                  key={key}
                  label={key.replace(/([A-Z])/g, ' $1')}
                  type="number"
                  min={0}
                  value={value}
                  onChange={number => updateContentSection('pricing', { [key]: number })}
                />
              ))}
            </div>
          </section>
          <section className="phase12-panel">
            <div className="phase12-panel-heading"><span>About</span><small>Company story</small></div>
            <Field label="Headline" value={draft.content.about?.headline} onChange={value => updateContentSection('about', { headline: value })} />
            <Field label="Paragraph one" value={draft.content.about?.p1} onChange={value => updateContentSection('about', { p1: value })} multiline />
            <Field label="Paragraph two" value={draft.content.about?.p2} onChange={value => updateContentSection('about', { p2: value })} multiline />
            <div className="phase12-inline-fields">
              {[1, 2, 3].map(number => (
                <React.Fragment key={number}>
                  <Field label={`Stat ${number}`} value={draft.content.about?.[`stat${number}`]} onChange={value => updateContentSection('about', { [`stat${number}`]: value })} />
                  <Field label={`Stat ${number} label`} value={draft.content.about?.[`stat${number}Label`]} onChange={value => updateContentSection('about', { [`stat${number}Label`]: value })} />
                </React.Fragment>
              ))}
            </div>
          </section>
          <section className="phase12-panel phase12-content-wide">
            <div className="phase12-panel-heading"><span>Testimonials</span><button className="btn btn-primary btn-sm" onClick={() => setDraft(previous => ({ ...previous, content: { ...previous.content, testimonials: [...(previous.content.testimonials || []), { text: 'Client feedback', client: 'Client' }] } }))}>Add testimonial</button></div>
            <div className="phase12-repeaters two">
              {(draft.content.testimonials || []).map((item, index) => (
                <div key={index}>
                  <Field label="Quote" value={item.text} onChange={value => setDraft(previous => ({ ...previous, content: { ...previous.content, testimonials: previous.content.testimonials.map((entry, itemIndex) => itemIndex === index ? { ...entry, text: value } : entry) } }))} multiline />
                  <Field label="Attribution" value={item.client} onChange={value => setDraft(previous => ({ ...previous, content: { ...previous.content, testimonials: previous.content.testimonials.map((entry, itemIndex) => itemIndex === index ? { ...entry, client: value } : entry) } }))} />
                  <button type="button" className="phase12-remove" onClick={() => setDraft(previous => ({ ...previous, content: { ...previous.content, testimonials: previous.content.testimonials.filter((_, itemIndex) => itemIndex !== index) } }))}>Remove</button>
                </div>
              ))}
            </div>
          </section>
          <section className="phase12-panel">
            <div className="phase12-panel-heading"><span>Footer & trust</span><small>Contact and assurance</small></div>
            <Field label="Copyright" value={draft.content.footer?.copyright} onChange={value => updateContentSection('footer', { copyright: value })} />
            <Field label="Trust badges (one per line)" value={(draft.content.trustBadges || []).join('\n')} onChange={value => setDraft(previous => ({ ...previous, content: { ...previous.content, trustBadges: value.split('\n').filter(Boolean) } }))} multiline />
          </section>
        </div>
      )}

      {activeTab === 'versions' && (
        <div className="phase12-publish-layout">
          <section className="phase12-panel phase12-publish-card">
            <div className="phase12-eyebrow">Controlled release</div>
            <h2>Publish draft v{meta.draftVersion}</h2>
            <p>This updates the public site and all portal layouts. The current live version remains available for instant rollback.</p>
            <Field label="Release note" value={publishNote} onChange={setPublishNote} multiline help="Describe what changed so future administrators can understand this release." />
            <div className="phase12-publish-actions">
              <button className="btn btn-primary btn-lg" onClick={publish} disabled={Boolean(working)}>{working === 'publish' ? 'Publishing…' : 'Publish to Live'}</button>
              <button className="btn btn-secondary" onClick={saveDraft} disabled={Boolean(working)}>Save without publishing</button>
            </div>
            <div className="phase12-safety-list"><span>Validated internal destinations</span><span>Responsive size limits</span><span>Immutable version snapshot</span><span>Administrator audit event</span></div>
          </section>
          <section className="phase12-panel">
            <div className="phase12-panel-heading"><span>Version history</span><small>{versions.length} snapshots</small></div>
            <div className="phase12-version-list">
              {versions.map(version => (
                <div key={version._id || version.version}>
                  <span><strong>Version {version.version}</strong><small>{new Date(version.createdAt).toLocaleString()} · {version.publishedBy}</small>{version.note && <em>{version.note}</em>}</span>
                  {version.version === meta.publishedVersion ? <b>LIVE</b> : <button type="button" onClick={() => rollback(version.version)} disabled={Boolean(working)}>{working === `rollback-${version.version}` ? 'Restoring…' : 'Rollback'}</button>}
                </div>
              ))}
            </div>
          </section>
          <section className="phase12-panel phase12-tools-card">
            <div className="phase12-panel-heading"><span>Draft tools</span><small>Backup and recovery</small></div>
            <button className="btn btn-secondary" onClick={exportConfig}>Export draft JSON</button>
            <button className="btn btn-secondary" onClick={() => importInput.current?.click()}>Import JSON to draft</button>
            <button className="btn btn-secondary" onClick={() => resetDraft('published')} disabled={Boolean(working)}>Discard draft changes</button>
            <button className="btn btn-danger" onClick={() => resetDraft('defaults')} disabled={Boolean(working)}>Load factory defaults</button>
            <input ref={importInput} type="file" accept=".json,application/json" onChange={importConfig} hidden />
          </section>
        </div>
      )}
    </div>
  );
}
