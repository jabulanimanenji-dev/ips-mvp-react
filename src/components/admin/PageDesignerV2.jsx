import React, { useEffect, useMemo, useRef, useState } from 'react';
import { PAGE_CATALOG, PORTAL_LABELS } from '../../../shared/platformConfig';
import { addToast } from '../common/Toast';
import './page-designer-v2.css';

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

export default function PageDesignerV2({ draft, setDraft }) {
  const [portal, setPortal] = useState('public');
  const pages = useMemo(() => PAGE_CATALOG.filter(page => page.portal === portal), [portal]);
  const [pageId, setPageId] = useState('public.home');
  const [device, setDevice] = useState('desktop');
  const [assets, setAssets] = useState([]);
  const [selectedElementId, setSelectedElementId] = useState('');
  const [newType, setNewType] = useState('button');
  const [draggingId, setDraggingId] = useState('');
  const canvas = useRef(null);

  useEffect(() => {
    if (!pages.some(page => page.id === pageId)) setPageId(pages[0]?.id || 'public.home');
  }, [pages, pageId]);

  useEffect(() => {
    request('/api/admin/media')
      .then(data => setAssets(data.assets || []))
      .catch(error => addToast(error.message, 'error'));
  }, []);

  const design = draft.pageDesigns?.[pageId];
  const elements = design?.elements || [];
  const selectedElement = elements.find(element => element.id === selectedElementId);

  const updateDesign = patch => setDraft(previous => ({
    ...previous,
    pageDesigns: {
      ...previous.pageDesigns,
      [pageId]: { ...previous.pageDesigns[pageId], ...patch }
    }
  }));

  const updateBackground = patch => updateDesign({
    background: { ...design.background, ...patch }
  });

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
  };

  const removeElement = id => {
    updateDesign({ elements: elements.filter(element => element.id !== id) });
    if (selectedElementId === id) setSelectedElementId('');
  };

  const duplicatePage = () => {
    const targets = PAGE_CATALOG.filter(page => page.portal === portal && page.id !== pageId);
    const targetId = window.prompt(`Copy this design to which page ID?\n${targets.map(page => `${page.id} — ${page.label}`).join('\n')}`);
    if (!targets.some(page => page.id === targetId)) return;
    setDraft(previous => ({
      ...previous,
      pageDesigns: {
        ...previous.pageDesigns,
        [targetId]: { ...JSON.parse(JSON.stringify(design)), id: targetId }
      }
    }));
    addToast(`Design copied to ${targetId}.`, 'success');
  };

  const dropElement = event => {
    event.preventDefault();
    if (!draggingId || !canvas.current) return;
    const rect = canvas.current.getBoundingClientRect();
    const x = Math.max(0, Math.min(100, ((event.clientX - rect.left) / rect.width) * 100));
    const y = Math.max(0, event.clientY - rect.top);
    updateElementPlacement(draggingId, { x: Math.round(x * 10) / 10, y: Math.round(y) });
    setDraggingId('');
  };

  if (!design) return <div className="phase12-panel">This page design is unavailable. Reload the builder.</div>;

  const imageAssets = assets.filter(asset => asset.media_type === 'image');
  const videoAssets = assets.filter(asset => asset.media_type === 'video');
  const backgroundAssets = design.background.type === 'video' ? videoAssets : imageAssets;
  const selectedPlacement = selectedElement?.placement?.[device];
  const pageLabel = PAGE_CATALOG.find(page => page.id === pageId)?.label;

  const backgroundStyle = design.background.type === 'color'
    ? { background: design.background.color }
    : design.background.type === 'gradient'
      ? { background: `linear-gradient(135deg, ${design.background.gradientStart}, ${design.background.gradientEnd})` }
      : {};

  return (
    <div className="page-designer-shell">
      <section className="phase12-panel page-designer-controls">
        <div className="phase12-panel-heading"><span>Page registry</span><small>{PAGE_CATALOG.length} editable screens</small></div>
        <label className="phase12-field"><span>Portal</span><select className="form-select" value={portal} onChange={event => setPortal(event.target.value)}>{Object.entries(PORTAL_LABELS).map(([id, label]) => <option key={id} value={id}>{label}</option>)}</select></label>
        <label className="phase12-field"><span>Page</span><select className="form-select" value={pageId} onChange={event => { setPageId(event.target.value); setSelectedElementId(''); }}>{pages.map(page => <option key={page.id} value={page.id}>{page.label}</option>)}</select></label>
        <label className="page-designer-check"><input type="checkbox" checked={design.enabled} onChange={event => updateDesign({ enabled: event.target.checked })} /> Enable custom page design</label>

        <div className="page-designer-section">
          <h4>Background</h4>
          <select className="form-select" value={design.background.type} onChange={event => updateBackground({ type: event.target.value, assetId: '' })}>
            <option value="theme">Theme default</option><option value="color">Solid colour</option><option value="gradient">Gradient</option><option value="image">Image</option><option value="video">Looping video</option>
          </select>
          {design.background.type === 'color' && <input type="color" value={design.background.color} onChange={event => updateBackground({ color: event.target.value })} />}
          {design.background.type === 'gradient' && <div className="page-designer-color-row"><input type="color" value={design.background.gradientStart} onChange={event => updateBackground({ gradientStart: event.target.value })} /><input type="color" value={design.background.gradientEnd} onChange={event => updateBackground({ gradientEnd: event.target.value })} /></div>}
          {['image', 'video'].includes(design.background.type) && (
            <select className="form-select" value={design.background.assetId} onChange={event => updateBackground({ assetId: event.target.value })}>
              <option value="">Select media…</option>{backgroundAssets.map(asset => <option key={asset.asset_id} value={asset.asset_id}>{asset.original_name}</option>)}
            </select>
          )}
          <label className="phase12-field"><span>Overlay opacity · {Math.round(design.background.overlayOpacity * 100)}%</span><input type="range" min="0" max=".95" step=".05" value={design.background.overlayOpacity} onChange={event => updateBackground({ overlayOpacity: Number(event.target.value) })} /></label>
          <input type="color" value={design.background.overlayColor} onChange={event => updateBackground({ overlayColor: event.target.value })} title="Overlay colour" />
        </div>

        <div className="page-designer-section">
          <h4>Page frame</h4>
          <label className="phase12-field"><span>Minimum height (0 = automatic)</span><input className="form-input" type="number" min="0" max="6000" value={design.minHeight} onChange={event => updateDesign({ minHeight: Number(event.target.value) })} /></label>
          <label className="phase12-field"><span>Content max width (0 = full)</span><input className="form-input" type="number" min="0" max="2400" value={design.contentMaxWidth} onChange={event => updateDesign({ contentMaxWidth: Number(event.target.value) })} /></label>
          {['desktop', 'tablet', 'mobile'].map(screen => <label className="phase12-field" key={screen}><span>{screen} page padding</span><input className="form-input" type="number" min="0" max="240" value={design.padding[screen]} onChange={event => updateDesign({ padding: { ...design.padding, [screen]: Number(event.target.value) } })} /></label>)}
        </div>

        <button type="button" className="btn btn-secondary" onClick={duplicatePage}>Copy design to another page</button>
      </section>

      <section className="page-designer-stage-panel">
        <div className="page-designer-toolbar">
          <div><strong>{pageLabel}</strong><small>{pageId}</small></div>
          <div>{['desktop', 'tablet', 'mobile'].map(screen => <button type="button" key={screen} className={device === screen ? 'active' : ''} onClick={() => setDevice(screen)}>{screen}</button>)}</div>
        </div>
        <div className={`page-designer-viewport ${device}`}>
          <div ref={canvas} className="page-designer-canvas" style={{ ...backgroundStyle, minHeight: Math.max(620, design.minHeight || 0) }} onDragOver={event => event.preventDefault()} onDrop={dropElement}>
            {['image', 'video'].includes(design.background.type) && design.background.assetId && (
              design.background.type === 'video'
                ? <video className="page-designer-background" src={assetUrl(design.background.assetId)} muted autoPlay loop playsInline />
                : <img className="page-designer-background" src={assetUrl(design.background.assetId)} alt="" />
            )}
            {design.background.overlayOpacity > 0 && <div className="page-designer-overlay" style={{ background: design.background.overlayColor, opacity: design.background.overlayOpacity }} />}
            <div className="page-designer-safe-area"><span>Existing {pageLabel} interface</span><small>Custom blocks layer above this protected application content.</small></div>
            {elements.filter(element => element.visible && (element.showOn === 'all' || element.showOn === device)).map(element => {
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
                  draggable
                  onDragStart={() => setDraggingId(element.id)}
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
        </div>
        <p className="phase12-preview-note">Drag a block anywhere on the canvas. Position and size are saved separately for desktop, tablet, and mobile.</p>
      </section>

      <section className="phase12-panel page-designer-inspector">
        <div className="phase12-panel-heading"><span>Layers & inspector</span><small>{elements.length}/40 blocks</small></div>
        <div className="page-designer-add">
          <select className="form-select" value={newType} onChange={event => setNewType(event.target.value)}>{['button', 'text', 'image', 'video', 'banner', 'card'].map(type => <option key={type}>{type}</option>)}</select>
          <button className="btn btn-primary" type="button" onClick={addElement} disabled={elements.length >= 40}>Add block</button>
        </div>
        <div className="page-designer-layer-list">
          {elements.map(element => (
            <button type="button" key={element.id} className={selectedElementId === element.id ? 'selected' : ''} onClick={() => setSelectedElementId(element.id)}>
              <span>{element.type}</span><strong>{element.text || element.alt || element.id}</strong><small>z{element.zIndex}</small>
            </button>
          ))}
        </div>

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
