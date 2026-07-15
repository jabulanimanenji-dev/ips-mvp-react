import React, { useState, useMemo } from 'react';
import { Link } from 'react-router-dom';
import { useCMS } from '../context/CMSContext';
import { useTheme } from '../context/ThemeContext';

export default function QuotePage() {
  const { cms } = useCMS();
  const { theme } = useTheme();

  const [service, setService] = useState('thesis');
  const [level, setLevel] = useState('undergraduate');
  const [quantity, setQuantity] = useState(10);
  const [deadline, setDeadline] = useState('');

  const today = new Date().toISOString().split('T')[0];

  const calculation = useMemo(() => {
    if (!deadline) return null;
    const days = Math.ceil((new Date(deadline) - new Date(today)) / (1000 * 60 * 60 * 24));
    if (days < 0) return { error: 'Deadline cannot be in the past.' };

    let base = 0;
    let detailParts = [];

    if (service === 'thesis') {
      const rate = cms.pricing[level] || 0;
      base = rate * quantity;
      detailParts.push(`${level.charAt(0).toUpperCase() + level.slice(1)} thesis: ${quantity} page${quantity !== 1 ? 's' : ''} × $${rate}/page = $${base}`);
    } else if (service === 'assignment') {
      const rate = cms.pricing.assignment || 0;
      base = rate * quantity;
      detailParts.push(`Assignment: ${quantity} page${quantity !== 1 ? 's' : ''} × $${rate}/page = $${base}`);
    } else if (service === 'project') {
      base = cms.pricing.projectFlat || 0;
      detailParts.push(`Project report: flat fee = $${base}`);
    } else if (service === 'oddjob') {
      base = cms.pricing.oddJobFlat || 0;
      detailParts.push(`Odd job: flat fee = $${base}`);
    }

    let multiplier = 1;
    if (days <= 2) {
      multiplier += (cms.pricing.rush48hour || 0) / 100;
      detailParts.push(`Rush delivery (≤48h): +${cms.pricing.rush48hour || 0}%`);
    } else if (days <= 7) {
      multiplier += (cms.pricing.rush7day || 0) / 100;
      detailParts.push(`Rush delivery (≤7 days): +${cms.pricing.rush7day || 0}%`);
    } else {
      detailParts.push(`Standard delivery: no rush fee`);
    }

    const total = Math.round(base * multiplier);
    return { days, base, multiplier, total, detailParts };
  }, [service, level, quantity, deadline, cms.pricing, today]);

  const serviceLabel = {
    thesis: 'Thesis / Dissertation',
    assignment: 'Assignment / Coursework',
    project: 'Research Project',
    oddjob: 'Odd Job'
  };

  return (
    <div style={{ padding: '4rem 0' }}>
      <div className="container">
        <div className="section-header">
          <span className="label">Pricing Calculator</span>
          <h1 className="section-title" style={{ marginTop: '0.5rem' }}>Get an Instant Quote</h1>
          <p className="section-subtitle">
            Transparent pricing based on your service, academic level, and deadline.
          </p>
        </div>

        <div
          className="card"
          style={{
            maxWidth: 640,
            margin: '0 auto',
            padding: '2rem',
            background: theme === 'dark' ? 'var(--bg-surface)' : 'var(--bg-card)'
          }}
        >
          <div className="form-group">
            <label className="form-label">Service Type</label>
            <select className="form-select" value={service} onChange={(e) => setService(e.target.value)}>
              <option value="thesis">Thesis / Dissertation</option>
              <option value="assignment">Assignment / Coursework</option>
              <option value="project">Research Project</option>
              <option value="oddjob">Odd Job</option>
            </select>
          </div>

          {service === 'thesis' && (
            <div className="form-group">
              <label className="form-label">Academic Level</label>
              <select className="form-select" value={level} onChange={(e) => setLevel(e.target.value)}>
                <option value="undergraduate">Undergraduate</option>
                <option value="masters">Master&apos;s</option>
                <option value="phd">PhD</option>
              </select>
            </div>
          )}

          {service === 'assignment' && (
            <div className="form-group">
              <label className="form-label">Academic Level</label>
              <select className="form-select" value={level} onChange={(e) => setLevel(e.target.value)}>
                <option value="undergraduate">Undergraduate</option>
                <option value="masters">Master&apos;s</option>
                <option value="phd">PhD</option>
              </select>
            </div>
          )}

          {(service === 'thesis' || service === 'assignment') && (
            <div className="form-group">
              <label className="form-label">Number of Pages</label>
              <input
                type="number"
                className="form-input"
                min={1}
                max={500}
                value={quantity}
                onChange={(e) => setQuantity(Math.max(1, parseInt(e.target.value || 0, 10)))}
              />
              <small style={{ color: 'var(--text-muted)', fontSize: '0.75rem' }}>
                Estimated ~250 words per page
              </small>
            </div>
          )}

          <div className="form-group">
            <label className="form-label">Deadline</label>
            <input
              type="date"
              className="form-input"
              min={today}
              value={deadline}
              onChange={(e) => setDeadline(e.target.value)}
            />
          </div>

          {calculation && !calculation.error && (
            <div
              style={{
                marginTop: '1.5rem',
                padding: '1.25rem',
                borderRadius: 'var(--radius-md)',
                background: theme === 'dark' ? 'rgba(122,75,168,0.12)' : 'rgba(122,75,168,0.06)',
                border: '1px solid var(--border-strong)'
              }}
            >
              <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginBottom: '0.5rem' }}>
                {serviceLabel[service]} — {calculation.days} day{calculation.days !== 1 ? 's' : ''} until deadline
              </div>
              <div style={{ fontSize: '1.75rem', fontWeight: 800, color: 'var(--primary)', marginBottom: '0.75rem' }}>
                ${calculation.total}
              </div>
              <div style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', lineHeight: 1.6 }}>
                {calculation.detailParts.map((part, i) => (
                  <div key={i}>{part}</div>
                ))}
                <div style={{ marginTop: '0.5rem', fontWeight: 600, color: 'var(--text-primary)' }}>
                  Total: ${calculation.total}
                </div>
              </div>
            </div>
          )}

          {calculation && calculation.error && (
            <div
              style={{
                marginTop: '1.5rem',
                padding: '1rem',
                borderRadius: 'var(--radius-md)',
                background: 'rgba(220,38,38,0.08)',
                border: '1px solid rgba(220,38,38,0.25)',
                color: 'var(--danger)',
                fontSize: '0.9rem'
              }}
            >
              {calculation.error}
            </div>
          )}

          <div style={{ marginTop: '2rem', textAlign: 'center' }}>
            <Link to="/signup" className="btn btn-primary btn-lg" style={{ width: '100%' }}>
              Get Started
            </Link>
            <p style={{ marginTop: '0.75rem', fontSize: '0.8rem', color: 'var(--text-muted)' }}>
              No payment required to request a quote. Full ownership upon completion.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
