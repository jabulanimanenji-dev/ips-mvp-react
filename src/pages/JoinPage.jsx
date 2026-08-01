import React from 'react';
import { Link } from 'react-router-dom';
import { useCMS } from '../context/CMSContext';

export default function JoinPage() {
  const { cms, config } = useCMS();
  const join = cms.join || {};
  const features = config.features || {};
  const options = [
    {
      id: 'client',
      enabled: features.clientRegistration !== false,
      eyebrow: join.clientEyebrow || 'For clients',
      title: join.clientTitle || 'I need a service',
      description: join.clientDescription || 'Create a client account to request services, manage orders, exchange files and track progress.',
      button: join.clientButton || 'Create client account',
      target: '/signup'
    },
    {
      id: 'provider',
      enabled: features.providerApplications !== false,
      eyebrow: join.providerEyebrow || 'For service providers',
      title: join.providerTitle || 'I provide services',
      description: join.providerDescription || 'Apply to join the IPS provider network. Professional experience and a CV are optional.',
      button: join.providerButton || 'Apply as a provider',
      target: '/become-a-provider'
    }
  ];

  return (
    <section style={{ padding: 'clamp(3rem, 8vw, 7rem) 1rem', minHeight: '70vh' }}>
      <div style={{ width: 'min(1080px, 100%)', margin: '0 auto' }}>
        <div style={{ textAlign: 'center', maxWidth: 760, margin: '0 auto 2.5rem' }}>
          <div className="badge badge-review">{join.badge || 'Choose your IPS journey'}</div>
          <h1 style={{ fontSize: 'clamp(2.2rem, 6vw, 4.4rem)', margin: '1rem 0', lineHeight: 1.03 }}>{join.headline || 'How would you like to join IPS?'}</h1>
          <p style={{ color: 'var(--text-secondary)', fontSize: '1.05rem' }}>{join.subheadline || 'Select the account type that matches what you want to do.'}</p>
        </div>

        <div className="grid grid-2 gap-4">
          {options.map(option => (
            <article key={option.id} className="card" style={{ padding: 'clamp(1.5rem, 4vw, 2.5rem)', display: 'flex', flexDirection: 'column', minHeight: 320 }}>
              <div style={{ color: 'var(--primary)', fontSize: '.75rem', fontWeight: 800, letterSpacing: '.12em', textTransform: 'uppercase' }}>{option.eyebrow}</div>
              <h2 style={{ fontSize: 'clamp(1.65rem, 4vw, 2.4rem)', margin: '.7rem 0' }}>{option.title}</h2>
              <p style={{ color: 'var(--text-secondary)', lineHeight: 1.75, flex: 1 }}>{option.description}</p>
              {option.enabled ? (
                <Link to={option.target} className={`btn ${option.id === 'client' ? 'btn-primary' : 'btn-secondary'}`}>{option.button}</Link>
              ) : (
                <div className="toast" style={{ position: 'static', maxWidth: 'none' }}>{join.closedMessage || 'This registration option is temporarily unavailable.'}</div>
              )}
            </article>
          ))}
        </div>
      </div>
    </section>
  );
}
