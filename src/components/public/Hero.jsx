import React from 'react';
import { useNavigate } from 'react-router-dom';
import { useCMS } from '../../context/CMSContext';

export default function Hero() {
  const { cms } = useCMS();
  const navigate = useNavigate();
  const hero = cms?.hero || {};

  const scrollToPricing = () => {
    const el = document.getElementById('pricing');
    if (el) el.scrollIntoView({ behavior: 'smooth' });
  };

  return (
    <section
      style={{
        backgroundImage: "url('/images/hero-bg.jpg')",
        backgroundSize: 'cover',
        backgroundPosition: 'center',
        backgroundRepeat: 'no-repeat',
        color: '#fff',
        padding: '6rem 0 5rem',
        position: 'relative',
        overflow: 'hidden'
      }}
    >
      {/* Dark overlay so text stays readable */}
      <div
        style={{
          position: 'absolute',
          inset: 0,
          background: 'rgba(0, 0, 0, 0.45)', // darken image; adjust 0.45 to taste
          zIndex: 1
        }}
      />

      <div className="container text-center" style={{ position: 'relative', zIndex: 2 }}>
        {hero.badge && (
          <div
            className="badge"
            style={{
              background: 'rgba(255,255,255,0.15)',
              color: '#fff',
              backdropFilter: 'blur(4px)',
              marginBottom: '1.5rem',
              display: 'inline-flex',
              alignItems: 'center',
              gap: '0.5rem'
            }}
          >
            {/* Icon added here */}
            <img
              src="/images/my-icon.png"
              alt="icon"
              style={{ width: 20, height: 20, objectFit: 'contain' }}
            />
            {hero.badge}
          </div>
        )}

        <h1
          style={{
            fontSize: 'clamp(2rem, 5vw, 3.2rem)',
            fontWeight: 800,
            lineHeight: 1.1,
            marginBottom: '1rem',
            maxWidth: 800,
            marginLeft: 'auto',
            marginRight: 'auto'
          }}
        >
          {hero.headline || 'Expert Academic Writing Services'}
        </h1>

        <p
          style={{
            fontSize: '1.1rem',
            opacity: 0.9,
            maxWidth: 640,
            margin: '0 auto 2rem',
            lineHeight: 1.6
          }}
        >
          {hero.subheadline || 'Original work. Full ownership. Confidential and secure.'}
        </p>

        <div className="flex items-center justify-center gap-4" style={{ flexWrap: 'wrap' }}>
          <button onClick={() => navigate('/quote')} className="btn btn-lg" style={{ background: '#fff', color: 'var(--primary)', fontWeight: 700 }}>
            {hero.ctaPrimary || 'Request a Quote'}
          </button>
          <button onClick={scrollToPricing} className="btn btn-ghost btn-lg" style={{ color: '#fff', borderColor: 'rgba(255,255,255,0.4)' }}>
            {hero.ctaSecondary || 'View Pricing'}
          </button>
        </div>
      </div>

      {/* Decorative subtle glow */}
      <div
        style={{
          position: 'absolute',
          top: '-10%',
          left: '-10%',
          width: '40%',
          height: '40%',
          background: 'radial-gradient(circle, rgba(255,255,255,0.12) 0%, transparent 70%)',
          pointerEvents: 'none',
          zIndex: 1
        }}
      />
      <div
        style={{
          position: 'absolute',
          bottom: '-10%',
          right: '-10%',
          width: '40%',
          height: '40%',
          background: 'radial-gradient(circle, rgba(255,255,255,0.10) 0%, transparent 70%)',
          pointerEvents: 'none',
          zIndex: 1
        }}
      />
    </section>
  );
}