import React from 'react';
import { Link } from 'react-router-dom';
import { useCMS } from '../../context/CMSContext';
import useResponsiveDevice from '../../hooks/useResponsiveDevice';
import { getHeroDeviceSettings } from '../../../shared/heroResponsive.js';
import ConfigurableAction from '../common/ConfigurableAction';
import './hero.css';

const mediaUrl = value => value?.startsWith('media:')
  ? `/api/media/${encodeURIComponent(value.slice(6))}`
  : value;

const horizontalAlignment = value => ({
  left: 'flex-start',
  center: 'center',
  right: 'flex-end'
}[value] || 'center');

const verticalAlignment = value => ({
  start: 'flex-start',
  center: 'center',
  end: 'flex-end'
}[value] || 'center');

export default function Hero() {
  const { cms, config, previewDevice } = useCMS();
  const device = useResponsiveDevice(previewDevice);
  const hero = cms?.hero || {};
  const settings = getHeroDeviceSettings(hero, device);
  const actions = Object.values(config.buttons || {})
    .filter(button => ['heroPrimary', 'heroSecondary'].includes(button.id) && button.visible !== false)
    .filter(button => button.showOn === 'all' || button.showOn === device)
    .sort((a, b) => a.position - b.position);
  const background = mediaUrl(hero.backgroundMedia || '/images/hero-bg.jpg');
  const poster = mediaUrl(hero.posterMedia || hero.fallbackImage || '/images/hero-bg.jpg');
  const isVideo = hero.backgroundType === 'video';
  const trustItems = Array.isArray(hero.trustItems) ? hero.trustItems : [];
  const popular = Array.isArray(hero.popularSearches) ? hero.popularSearches : [];
  const orderFor = id => settings.elementOrder.indexOf(id);
  const show = id => settings.visibility[id] !== false;
  const alignItems = horizontalAlignment(settings.alignment);
  const sectionSize = settings.sectionHeightMode === 'exact'
    ? { height: settings.sectionMinHeight, minHeight: settings.sectionMinHeight, maxHeight: settings.sectionMinHeight }
    : settings.sectionHeightMode === 'viewport'
      ? { minHeight: '100svh' }
      : settings.sectionHeightMode === 'auto'
        ? { minHeight: 0 }
        : { minHeight: settings.sectionMinHeight };

  if (hero.visible === false) return null;

  return (
    <section
      className={`ips-hero ips-hero-${device}`}
      data-builder-section="hero"
      data-responsive-device={device}
      style={{
        background: isVideo ? 'var(--grad-hero)' : undefined,
        backgroundImage: !isVideo ? `url('${background}')` : undefined,
        backgroundSize: 'cover',
        backgroundPosition: `${settings.backgroundPositionX}% ${settings.backgroundPositionY}%`,
        backgroundRepeat: 'no-repeat',
        color: '#fff',
        ...sectionSize,
        paddingTop: settings.paddingTop,
        paddingBottom: settings.paddingBottom,
        justifyContent: verticalAlignment(settings.verticalAlignment)
      }}
    >
      {isVideo && background && (
        <video
          src={background}
          poster={poster}
          muted={hero.videoMuted !== false}
          autoPlay={hero.videoAutoplay !== false}
          loop={hero.videoLoop !== false}
          playsInline
          className="ips-hero-background-video"
          style={{ objectPosition: `${settings.backgroundPositionX}% ${settings.backgroundPositionY}%` }}
        />
      )}
      <div className="ips-hero-overlay" style={{ background: hero.overlayColor || '#35124c', opacity: hero.overlayOpacity ?? 0.72 }} />

      <div className="ips-hero-container" style={{ paddingInline: settings.horizontalPadding }}>
        <div
          className={`ips-hero-content align-${settings.alignment}`}
          style={{
            maxWidth: settings.contentMaxWidth,
            gap: settings.elementSpacing,
            alignItems,
            textAlign: settings.alignment
          }}
        >
          {show('badge') && hero.badge && (
            <div className="ips-hero-element" data-hero-element="badge" style={{ order: orderFor('badge') }}>
              <div className="badge ips-hero-badge" data-hero-diagnostic="text">{hero.badge}</div>
            </div>
          )}

          {show('eyebrow') && hero.eyebrow && (
            <div className="ips-hero-element ips-hero-eyebrow" data-hero-element="eyebrow" data-hero-diagnostic="text" style={{ order: orderFor('eyebrow') }}>
              {hero.eyebrow}
            </div>
          )}

          {show('headline') && (
            <div className="ips-hero-element" data-hero-element="headline" style={{ order: orderFor('headline') }}>
              <h1
                className="ips-hero-heading"
                data-hero-diagnostic="text"
                style={{ '--hero-heading-size': `${settings.headlineFontSize}px`, '--hero-heading-line-height': settings.headlineLineHeight }}
              >
                {hero.headline || 'Professional Services.'}
                {hero.highlightedText && <><br /><span style={{ color: hero.highlightColor || '#F3B37C' }}>{hero.highlightedText}</span></>}
              </h1>
            </div>
          )}

          {show('subheadline') && hero.subheadline && (
            <div className="ips-hero-element" data-hero-element="subheadline" style={{ order: orderFor('subheadline') }}>
              <p
                className="ips-hero-subheadline"
                data-hero-diagnostic="text"
                style={{ '--hero-subheadline-size': `${settings.subheadlineFontSize}px`, '--hero-subheadline-line-height': settings.subheadlineLineHeight }}
              >
                {hero.subheadline}
              </p>
            </div>
          )}

          {show('search') && hero.searchVisible !== false && (
            <div className="ips-hero-element ips-hero-search-wrap" data-hero-element="search" style={{ order: orderFor('search') }}>
              <form
                className={`ips-hero-search layout-${settings.searchLayout}`}
                action="/services"
                data-hero-diagnostic="box"
                style={{ alignItems: settings.searchLayout === 'column' ? (settings.searchButtonFullWidth ? 'stretch' : alignItems) : 'stretch' }}
              >
                <input name="q" aria-label="Search services" placeholder={hero.searchPlaceholder || 'What do you need help with today?'} />
                <button className={`btn btn-primary ${settings.searchButtonFullWidth ? 'is-full-width' : ''}`} type="submit">{hero.searchButtonLabel || 'Explore'}</button>
              </form>
            </div>
          )}

          {show('popular') && popular.length > 0 && (
            <div className="ips-hero-element ips-hero-popular" data-hero-element="popular" data-hero-diagnostic="text" style={{ order: orderFor('popular') }}>
              <span>Popular: </span>
              {popular.map((item, index) => (
                <React.Fragment key={`${item}-${index}`}>
                  {index > 0 && <span aria-hidden="true"> &middot; </span>}
                  <Link to={`/services?q=${encodeURIComponent(item)}`}>{item}</Link>
                </React.Fragment>
              ))}
            </div>
          )}

          {show('actions') && actions.length > 0 && (
            <div
              className={`ips-hero-element ips-hero-actions layout-${settings.buttonLayout} ${settings.buttonsFullWidth ? 'is-full-width' : ''}`}
              data-hero-element="actions"
              data-hero-diagnostic="box"
              style={{
                order: orderFor('actions'),
                justifyContent: settings.buttonLayout === 'row' ? alignItems : undefined,
                alignItems: settings.buttonLayout === 'column' ? (settings.buttonsFullWidth ? 'stretch' : alignItems) : 'center'
              }}
            >
              {actions.map(button => (
                <ConfigurableAction
                  key={button.id}
                  button={button}
                  className="btn-lg"
                  style={button.variant === 'ghost'
                    ? { color: '#fff', borderColor: 'rgba(255,255,255,.55)' }
                    : { fontWeight: 800 }}
                />
              ))}
            </div>
          )}

          {show('trust') && trustItems.length > 0 && (
            <div className="ips-hero-element ips-hero-trust" data-hero-element="trust" data-hero-diagnostic="text" style={{ order: orderFor('trust'), justifyContent: alignItems }}>
              {trustItems.map((item, index) => <span key={`${item}-${index}`}>✓ {item}</span>)}
            </div>
          )}
        </div>
      </div>
    </section>
  );
}
