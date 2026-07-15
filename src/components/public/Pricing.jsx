import React from 'react';
import { useCMS } from '../../context/CMSContext';
import { fmtCur } from '../../utils/formatters';

export default function Pricing() {
  const { cms } = useCMS();
  const pricing = cms?.pricing || {};

  const tiers = [
    {
      name: 'Assignments',
      rate: pricing.assignment,
      unit: 'per page',
      description: 'Essays, reports, case studies, and coursework across all subjects.',
      cta: 'Get Started',
      featured: false
    },
    {
      name: 'Undergraduate',
      rate: pricing.undergraduate,
      unit: 'per page',
      description: 'Bachelor-level theses, research papers, and capstone projects.',
      cta: 'Request Quote',
      featured: true
    },
    {
      name: 'Master\'s',
      rate: pricing.masters,
      unit: 'per page',
      description: 'Graduate dissertations, literature reviews, and methodology chapters.',
      cta: 'Request Quote',
      featured: false
    },
    {
      name: 'PhD',
      rate: pricing.phd,
      unit: 'per page',
      description: 'Doctoral dissertations, journal articles, and advanced research.',
      cta: 'Request Quote',
      featured: false
    }
  ];

  return (
    <section id="pricing" className="section">
      <div className="container">
        <div className="section-header">
          <div className="label">Transparent Pricing</div>
          <h2 className="section-title">Simple, Upfront Rates</h2>
          <p className="section-subtitle">
            No hidden fees. Pay per milestone. Rush delivery available.
          </p>
        </div>

        <div className="grid grid-4 gap-6">
          {tiers.map((tier, idx) => (
            <div
              key={idx}
              className={`card text-center animate-fade-in-up ${tier.featured ? 'card-gradient-1' : ''}`}
              style={{
                animationDelay: `${idx * 0.1}s`,
                transform: tier.featured ? 'scale(1.02)' : undefined,
                boxShadow: tier.featured ? 'var(--shadow-glow-purple)' : undefined
              }}
            >
              <h3 style={{ fontSize: '1rem', fontWeight: 700, marginBottom: '0.5rem', opacity: 0.9 }}>
                {tier.name}
              </h3>
              <div style={{ fontSize: '2rem', fontWeight: 800, marginBottom: '0.25rem' }}>
                {fmtCur(tier.rate)}
              </div>
              <div style={{ fontSize: '0.8rem', opacity: 0.8, marginBottom: '1rem' }}>{tier.unit}</div>
              <p style={{ fontSize: '0.88rem', lineHeight: 1.6, marginBottom: '1.5rem', opacity: 0.9 }}>
                {tier.description}
              </p>
              <a href="/quote" className={`btn w-full ${tier.featured ? 'btn-gold' : 'btn-primary'}`}>
                {tier.cta}
              </a>
            </div>
          ))}
        </div>

        <div className="text-center" style={{ marginTop: '2rem' }}>
          <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>
            Rush fees: +{fmtCur(pricing.rush7day || 30)} for 7-day delivery · +{fmtCur(pricing.rush48hour || 50)} for 48-hour delivery
          </p>
          <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)', marginTop: '0.25rem' }}>
            Project flat rate: {fmtCur(pricing.projectFlat || 200)} · Odd jobs: {fmtCur(pricing.oddJobFlat || 100)}
          </p>
        </div>
      </div>
    </section>
  );
}
