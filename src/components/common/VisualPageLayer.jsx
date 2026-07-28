import React from 'react';
import { Link, useLocation } from 'react-router-dom';
import { useCMS } from '../../context/CMSContext';
import { resolvePageDefinition } from '../../../shared/platformConfig';
import './visual-page-layer.css';

const ADMIN_ENTRY_PATH = (import.meta.env.VITE_ADMIN_ENTRY_PATH || '/ips-mission-control')
  .trim()
  .replace(/\/+$/, '');

const Media = ({ assetId, type, alt, className }) => {
  if (!assetId) return null;
  const src = `/api/media/${encodeURIComponent(assetId)}`;
  return type === 'video'
    ? <video className={className} src={src} muted autoPlay loop playsInline preload="metadata" aria-label={alt || 'Decorative video'} />
    : <img className={className} src={src} alt={alt || ''} loading="lazy" />;
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
    return <div className={className} style={style}><Media assetId={element.assetId} type={element.type} alt={element.alt} /></div>;
  }
  if (element.type === 'button') {
    return (
      <Link className={`${className} btn btn-primary`} style={style} to={element.target || '/'}>
        {element.text}
      </Link>
    );
  }
  return <div className={className} style={style}>{element.text}</div>;
};

export default function VisualPageLayer({ children }) {
  const location = useLocation();
  const { config } = useCMS();
  const page = resolvePageDefinition(location.pathname, ADMIN_ENTRY_PATH);
  const design = page ? config.pageDesigns?.[page.id] : null;

  if (!design?.enabled) return children;

  const background = design.background || {};
  const backgroundStyle = background.type === 'color'
    ? { background: background.color }
    : background.type === 'gradient'
      ? { background: `linear-gradient(135deg, ${background.gradientStart}, ${background.gradientEnd})` }
      : {};
  const contentStyle = {
    '--vb-padding-desktop': `${design.padding?.desktop || 0}px`,
    '--vb-padding-tablet': `${design.padding?.tablet || 0}px`,
    '--vb-padding-mobile': `${design.padding?.mobile || 0}px`,
    ...(design.contentMaxWidth ? { maxWidth: `${design.contentMaxWidth}px`, marginInline: 'auto' } : {})
  };

  return (
    <div
      className={`visual-page-layer visual-page-${page.id.replaceAll('.', '-')}`}
      style={{ minHeight: design.minHeight ? `${design.minHeight}px` : '100vh', ...backgroundStyle }}
      data-visual-page={page.id}
    >
      {(background.type === 'image' || background.type === 'video') && (
        <Media assetId={background.assetId} type={background.type} alt="" className="visual-page-background-media" />
      )}
      {background.overlayOpacity > 0 && (
        <div className="visual-page-background-overlay" style={{ background: background.overlayColor, opacity: background.overlayOpacity }} />
      )}
      <div className="visual-page-content" style={contentStyle}>{children}</div>
      <div className="visual-page-elements" aria-label="Page content blocks">
        {(design.elements || []).map(element => <FloatingElement key={element.id} element={element} />)}
      </div>
    </div>
  );
}
