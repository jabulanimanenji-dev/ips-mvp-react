import React, { useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useCMS } from '../context/CMSContext';

export default function ClientOrderForm() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { cms } = useCMS();

  const [service, setService] = useState('thesis');
  const [level, setLevel] = useState('undergraduate');
  const [subject, setSubject] = useState('');
  const [topic, setTopic] = useState('');
  const [pages, setPages] = useState(10);
  const [deadline, setDeadline] = useState('');
  const [requirements, setRequirements] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  const today = new Date().toISOString().split('T')[0];

  const price = useMemo(() => {
    if (!deadline) return null;
    const days = Math.ceil((new Date(deadline) - new Date(today)) / (1000 * 60 * 60 * 24));
    if (days < 0) return { error: 'Deadline cannot be in the past.' };

    let base = 0;
    if (service === 'thesis') {
      const rate = cms.pricing[level] || 0;
      base = rate * pages;
    } else if (service === 'assignment') {
      const rate = cms.pricing.assignment || 0;
      base = rate * pages;
    } else if (service === 'project') {
      base = cms.pricing.projectFlat || 0;
    } else if (service === 'oddjob') {
      base = cms.pricing.oddJobFlat || 0;
    }

    let multiplier = 1;
    if (days <= 2) multiplier += (cms.pricing.rush48hour || 0) / 100;
    else if (days <= 7) multiplier += (cms.pricing.rush7day || 0) / 100;

    const total = Math.round(base * multiplier);
    return { days, base, multiplier, total };
  }, [service, level, pages, deadline, cms.pricing, today]);

  const milestones = useMemo(() => {
    if (!deadline || !price || price.error) return [];
    const end = new Date(deadline);
    const start = new Date();
    const totalDays = Math.max(1, Math.ceil((end - start) / (1000 * 60 * 60 * 24)));
    const interval = Math.floor(totalDays / 5);

    const labels = [
      'Outline & Research Plan',
      'Draft Section 1 (Introduction/Lit Review)',
      'Draft Section 2 (Methodology/Analysis)',
      'Draft Section 3 (Results/Discussion)',
      'Final Polish & Delivery'
    ];

    return labels.map((label, i) => {
      const d = new Date(start);
      d.setDate(d.getDate() + (interval * (i + 1)));
      if (d > end) d.setTime(end.getTime());
      return {
        label,
        dueDate: d.toISOString().split('T')[0],
        completed: false
      };
    });
  }, [deadline, price]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');

    if (!subject.trim() || !topic.trim() || !deadline) {
      setError('Please fill in all required fields.');
      return;
    }

    if (!user || !user._id) {
      setError('You must be logged in to place an order.');
      return;
    }

    setSubmitting(true);

    const orderPayload = {
      clientId: user._id,
      clientName: user.name,
      clientEmail: user.email,
      service,
      level: service === 'thesis' || service === 'assignment' ? level : null,
      subject,
      topic,
      pages: service === 'thesis' || service === 'assignment' ? pages : null,
      deadline,
      requirements,
      price: price?.total || 0,
      status: 'Pending',
      milestones,
      createdAt: new Date().toISOString()
    };

    try {
      const res = await fetch('/api/orders', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(orderPayload)
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.message || 'Failed to create order');
      }

      navigate('/client/orders');
    } catch (err) {
      setError(err.message);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="client-order-form" style={{ padding: '2rem 0' }}>
      <div className="container">
        <div className="section-header">
          <h1 className="section-title">Place Your Order</h1>
          <p className="section-subtitle">
            Fill in the details below. We&apos;ll match you with the best writer for your project.
          </p>
        </div>

        <div className="card" style={{ maxWidth: 720, margin: '0 auto', padding: '2rem' }}>
          {error && (
            <div className="alert alert-danger" style={{ marginBottom: '1rem', padding: '1rem', borderRadius: 'var(--radius-md)', background: 'rgba(220,38,38,0.08)', border: '1px solid rgba(220,38,38,0.25)', color: 'var(--danger)' }}>
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit} className="order-form">
            <div className="form-row" style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap' }}>
              <div className="form-group" style={{ flex: '1 1 45%', minWidth: 200 }}>
                <label className="form-label">Service Type *</label>
                <select className="form-select" value={service} onChange={(e) => setService(e.target.value)}>
                  <option value="thesis">Thesis / Dissertation</option>
                  <option value="assignment">Assignment / Coursework</option>
                  <option value="project">Research Project</option>
                  <option value="oddjob">Odd Job</option>
                </select>
              </div>

              {(service === 'thesis' || service === 'assignment') && (
                <div className="form-group" style={{ flex: '1 1 45%', minWidth: 200 }}>
                  <label className="form-label">Academic Level *</label>
                  <select className="form-select" value={level} onChange={(e) => setLevel(e.target.value)}>
                    <option value="undergraduate">Undergraduate</option>
                    <option value="masters">Master&apos;s</option>
                    <option value="phd">PhD</option>
                  </select>
                </div>
              )}
            </div>

            <div className="form-group">
              <label className="form-label">Subject / Discipline *</label>
              <input
                type="text"
                className="form-input"
                placeholder="e.g. Computer Science, Psychology, Business Management"
                value={subject}
                onChange={(e) => setSubject(e.target.value)}
                required
              />
            </div>

            <div className="form-group">
              <label className="form-label">Topic / Title *</label>
              <input
                type="text"
                className="form-input"
                placeholder="e.g. The Impact of AI on Modern Healthcare Systems"
                value={topic}
                onChange={(e) => setTopic(e.target.value)}
                required
              />
            </div>

            <div className="form-row" style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap' }}>
              {(service === 'thesis' || service === 'assignment') && (
                <div className="form-group" style={{ flex: '1 1 45%', minWidth: 200 }}>
                  <label className="form-label">Pages *</label>
                  <input
                    type="number"
                    className="form-input"
                    min={1}
                    max={500}
                    value={pages}
                    onChange={(e) => setPages(Math.max(1, parseInt(e.target.value || 0, 10)))}
                  />
                  <small style={{ color: 'var(--text-muted)', fontSize: '0.75rem' }}>
                    ~250 words per page
                  </small>
                </div>
              )}

              <div className="form-group" style={{ flex: '1 1 45%', minWidth: 200 }}>
                <label className="form-label">Deadline *</label>
                <input
                  type="date"
                  className="form-input"
                  min={today}
                  value={deadline}
                  onChange={(e) => setDeadline(e.target.value)}
                  required
                />
              </div>
            </div>

            <div className="form-group">
              <label className="form-label">Requirements & Instructions</label>
              <textarea
                className="form-input"
                rows={5}
                placeholder="Formatting style (APA, MLA, Chicago), specific sources, word count, any special instructions..."
                value={requirements}
                onChange={(e) => setRequirements(e.target.value)}
              />
            </div>

            {/* Live Price Estimate */}
            {price && !price.error && (
              <div className="price-display" style={{
                marginTop: '1.5rem',
                padding: '1.25rem',
                borderRadius: 'var(--radius-md)',
                background: 'rgba(122,75,168,0.06)',
                border: '1px solid var(--border-strong)'
              }}>
                <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                  Estimated Price
                </div>
                <div style={{ fontSize: '2rem', fontWeight: 800, color: 'var(--primary)' }}>
                  ${price.total}
                </div>
                <div style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
                  {price.days} day{price.days !== 1 ? 's' : ''} until deadline
                  {price.multiplier > 1 && ` • Rush fee applied`}
                </div>
              </div>
            )}

            {price && price.error && (
              <div className="error-display" style={{
                marginTop: '1rem',
                padding: '1rem',
                borderRadius: 'var(--radius-md)',
                background: 'rgba(220,38,38,0.08)',
                border: '1px solid rgba(220,38,38,0.25)',
                color: 'var(--danger)',
                fontSize: '0.9rem'
              }}>
                {price.error}
              </div>
            )}

            {/* Milestone Preview */}
            {milestones.length > 0 && (
              <div className="milestones-preview" style={{ marginTop: '1.5rem' }}>
                <h3 style={{ fontSize: '1rem', marginBottom: '0.75rem', color: 'var(--text-primary)' }}>
                  Auto-Generated Milestone Plan
                </h3>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                  {milestones.map((m, i) => (
                    <div key={i} style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '0.75rem',
                      padding: '0.6rem 0.75rem',
                      borderRadius: 'var(--radius-sm)',
                      background: 'var(--bg-surface)',
                      border: '1px solid var(--border-light)',
                      fontSize: '0.85rem'
                    }}>
                      <span style={{
                        width: 24,
                        height: 24,
                        borderRadius: '50%',
                        background: 'var(--primary)',
                        color: 'white',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        fontSize: '0.75rem',
                        fontWeight: 700,
                        flexShrink: 0
                      }}>{i + 1}</span>
                      <span style={{ flex: 1, color: 'var(--text-primary)' }}>{m.label}</span>
                      <span style={{ color: 'var(--text-muted)', fontSize: '0.8rem', whiteSpace: 'nowrap' }}>{m.dueDate}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            <div style={{ marginTop: '2rem' }}>
              <button
                type="submit"
                className="btn btn-primary btn-lg"
                disabled={submitting || !price || price.error}
                style={{ width: '100%' }}
              >
                {submitting ? 'Placing Order...' : 'Place Order'}
              </button>
              <p style={{ marginTop: '0.75rem', fontSize: '0.8rem', color: 'var(--text-muted)', textAlign: 'center' }}>
                By placing this order, you agree to our terms of service. No payment is charged until a writer is assigned.
              </p>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}