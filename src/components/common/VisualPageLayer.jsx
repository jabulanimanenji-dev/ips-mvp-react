import React, { useEffect, useRef } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { useCMS } from '../../context/CMSContext';
import { PAGE_CATALOG, resolvePageDefinition } from '../../../shared/platformConfig';
import useNativeEditingRuntime from './NativeEditingRuntime';
import './visual-page-layer.css';

const ADMIN_ENTRY_PATH = (import.meta.env.VITE_ADMIN_ENTRY_PATH || '/ips-mission-control')
  .trim()
  .replace(/\/+$/, '');

const Media = ({ assetId, type, alt, className, style, posterAssetId }) => {
  if (!assetId) return null;
  const src = `/api/media/${encodeURIComponent(assetId)}`;
  return type === 'video'
    ? <video className={className} src={src} poster={posterAssetId ? `/api/media/${encodeURIComponent(posterAssetId)}` : undefined} style={style} muted autoPlay loop playsInline preload="metadata" aria-label={alt || 'Decorative video'} />
    : <img className={className} src={src} alt={alt || ''} style={style} loading="lazy" />;
};

const FloatingElement = ({ element }) => {
  if (!element.visible) return null;
  const style = {
    '--vb-x-desktop': element.placement.desktop.x,
    '--vb-y-desktop': `${element.placement.desktop.y}px`,
    '--vb-width-desktop': `${element.placement.desktop.width}px`,
    '--vb-height-desktop': `${element.placement.desktop.height}px`,
    '--vb-x-tablet': element.placement.tablet.x,
    '--vb-y-tablet': `${element.placement.tablet.y}px`,
    '--vb-width-tablet': `${element.placement.tablet.width}px`,
    '--vb-height-tablet': `${element.placement.tablet.height}px`,
    '--vb-x-mobile': element.placement.mobile.x,
    '--vb-y-mobile': `${element.placement.mobile.y}px`,
    '--vb-width-mobile': `${element.placement.mobile.width}px`,
    '--vb-height-mobile': `${element.placement.mobile.height}px`,
    zIndex: element.zIndex,
    borderRadius: element.borderRadius,
    background: element.backgroundColor || undefined,
    color: element.textColor || undefined
  };

  const className = `visual-page-element visual-page-element-${element.type} visual-show-${element.showOn}`;
  if (element.type === 'image' || element.type === 'video') {
    return <div className={className} style={style} data-preview-element-id={element.id}><Media assetId={element.assetId} type={element.type} alt={element.alt} /></div>;
  }
  if (element.type === 'button') {
    return (
      <Link className={`${className} btn btn-primary`} style={style} to={element.target || '/'} data-preview-element-id={element.id}>
        {element.text}
      </Link>
    );
  }
  return <div className={className} style={style} data-preview-element-id={element.id}>{element.text}</div>;
};

export default function VisualPageLayer({ children, pageId, suppressElements = false }) {
  const location = useLocation();
  const { config, previewDevice } = useCMS();
  const page = pageId ? PAGE_CATALOG.find(item => item.id === pageId) || { id: pageId, label: 'IPS' } : resolvePageDefinition(location.pathname, ADMIN_ENTRY_PATH);
  const design = page ? config.pageDesigns?.[page.id] : null;
  const contentRef = useRef(null);
  const designEnabled = design?.enabled !== false;
  const studioPreview = Boolean(previewDevice);
  const { device: activeDevice } = useNativeEditingRuntime({
    rootRef: contentRef,
    pageId: page?.id || 'unregistered',
    editing: {
      version: 1,
      overrides: designEnabled || studioPreview ? {
        ...(config.globalNativeEditing?.overrides || {}),
        ...(design?.nativeEditing?.overrides || {})
      } : {}
    },
    previewDevice
  });

  useEffect(() => {
    if (!page || previewDevice) return;
    const seo = design?.seo || {};
    document.title = seo.title || `${page.label || 'IPS'} | IPS`;
    const setMeta = (selector, attributes, value) => {
      let node = document.head.querySelector(selector);
      if (!node) {
        node = document.createElement('meta');
        Object.entries(attributes).forEach(([name, attributeValue]) => node.setAttribute(name, attributeValue));
        document.head.appendChild(node);
      }
      node.setAttribute('content', value || '');
    };
    setMeta('meta[name="description"]', { name: 'description' }, seo.description || '');
    setMeta('meta[name="robots"]', { name: 'robots' }, seo.indexable === false ? 'noindex, nofollow' : 'index, follow');
    setMeta('meta[property="og:title"]', { property: 'og:title' }, seo.title || page.label || 'IPS');
    setMeta('meta[property="og:description"]', { property: 'og:description' }, seo.description || '');
    setMeta('meta[property="og:image"]', { property: 'og:image' }, seo.socialImageAssetId ? `/api/media/${encodeURIComponent(seo.socialImageAssetId)}` : '');
  }, [design?.seo, page, previewDevice]);

  if (!design || (!designEnabled && !studioPreview)) return children;

  const background = designEnabled ? design.background || {} : { type: 'theme', responsive: {} };
  const responsiveBackground = background.responsive?.[activeDevice] || {};
  const backgroundType = responsiveBackground.type && responsiveBackground.type !== 'inherit' ? responsiveBackground.type : background.type;
  const backgroundAssetId = responsiveBackground.assetId || background.assetId;
  const usesResponsiveBackground = responsiveBackground.type && responsiveBackground.type !== 'inherit';
  const backgroundPosterAssetId = usesResponsiveBackground ? responsiveBackground.posterAssetId || background.posterAssetId : background.posterAssetId;
  const backgroundPositionX = usesResponsiveBackground ? responsiveBackground.positionX ?? 50 : background.positionX ?? 50;
  const backgroundPositionY = usesResponsiveBackground ? responsiveBackground.positionY ?? 50 : background.positionY ?? 50;
  const backgroundStyle = backgroundType === 'color'
    ? { background: background.color }
    : backgroundType === 'gradient'
      ? { background: `linear-gradient(135deg, ${background.gradientStart}, ${background.gradientEnd})` }
      : {};
  const contentStyle = {
    '--vb-padding-desktop': `${designEnabled ? design.padding?.desktop || 0 : 0}px`,
    '--vb-padding-tablet': `${designEnabled ? design.padding?.tablet || 0 : 0}px`,
    '--vb-padding-mobile': `${designEnabled ? design.padding?.mobile || 0 : 0}px`,
    ...(designEnabled && design.contentMaxWidth ? { maxWidth: `${design.contentMaxWidth}px`, marginInline: 'auto' } : {})
  };

  return (
    <div
      className={`visual-page-layer visual-page-${page.id.replaceAll('.', '-')} ${backgroundType !== 'theme' ? 'visual-page-has-custom-background' : ''} ${previewDevice ? 'is-studio-preview' : ''}`}
      style={{ minHeight: designEnabled && design.minHeight ? `${design.minHeight}px` : '100vh', ...backgroundStyle }}
      data-visual-page={page.id}
    >
      {designEnabled && (backgroundType === 'image' || backgroundType === 'video') && (
        <Media
          assetId={backgroundAssetId}
          posterAssetId={backgroundPosterAssetId}
          type={backgroundType}
          alt=""
          className="visual-page-background-media"
          style={{ objectPosition: `${backgroundPositionX}% ${backgroundPositionY}%` }}
        />
      )}
      {designEnabled && background.overlayOpacity > 0 && (
        <div className="visual-page-background-overlay" style={{ background: background.overlayColor, opacity: background.overlayOpacity }} />
      )}
      <div ref={contentRef} className="visual-page-content" style={contentStyle}>{children}</div>
      {designEnabled && !suppressElements && <div className="visual-page-elements" aria-label="Page content blocks">
        {(design.elements || []).map(element => <FloatingElement key={element.id} element={element} />)}
      </div>}
    </div>
  );
}
