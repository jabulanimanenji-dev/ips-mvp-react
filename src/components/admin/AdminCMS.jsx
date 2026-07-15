import React, { useState, useEffect } from 'react';
import { useCMS } from '../../context/CMSContext';
import { addToast } from '../common/Toast';

export default function AdminCMS() {
  const { cms, saveCMS, resetCMS, exportCMS } = useCMS();
  const [draft, setDraft] = useState(cms);

  useEffect(() => { setDraft(cms); }, [cms]);

  const updateBrand = (field, value) => setDraft(prev => ({ ...prev, brand: { ...prev.brand, [field]: value } }));
  const updateHero = (field, value) => setDraft(prev => ({ ...prev, hero: { ...prev.hero, [field]: value } }));
  const updateService = (idx, field, value) => setDraft(prev => {
    const services = [...prev.services];
    services[idx] = { ...services[idx], [field]: value };
    return { ...prev, services };
  });
  const updatePricing = (field, value) => setDraft(prev => ({ ...prev, pricing: { ...prev.pricing, [field]: Number(value) || 0 } }));
  const updateFAQ = (idx, field, value) => setDraft(prev => {
    const faq = [...prev.faq];
    faq[idx] = { ...faq[idx], [field]: value };
    return { ...prev, faq };
  });
  const updateTestimonial = (idx, field, value) => setDraft(prev => {
    const testimonials = [...prev.testimonials];
    testimonials[idx] = { ...testimonials[idx], [field]: value };
    return { ...prev, testimonials };
  });
  const updateAbout = (field, value) => setDraft(prev => ({ ...prev, about: { ...prev.about, [field]: value } }));
  const updateTrustBadge = (idx, value) => setDraft(prev => {
    const trustBadges = [...prev.trustBadges];
    trustBadges[idx] = value;
    return { ...prev, trustBadges };
  });
  const updateFooter = (field, value) => setDraft(prev => ({ ...prev, footer: { ...prev.footer, [field]: value } }));

  const handleSave = () => { saveCMS(draft); addToast('CMS changes saved! Public website updated.', 'success'); };
  const handleReset = () => { resetCMS(); };
  const handleExport = () => { exportCMS(); addToast('CMS config exported as JSON.', 'success'); };
  const handlePreview = () => { window.open('/', '_blank'); addToast('Opening public site preview...', 'info'); };

  const sectionTitle = (text) => (
    <div style={{ fontSize: '1rem', fontWeight: 700, color: 'var(--accent-gold)', marginBottom: '1rem', paddingBottom: '0.5rem', borderBottom: '1px solid var(--border)' }}>{text}</div>
  );

  return (
    <div>
      <div className="flex justify-between items-center" style={{ marginBottom: '1.25rem', flexWrap: 'wrap', gap: '1rem' }}>
        <div>
          <h2 style={{ fontSize: '1.4rem', fontWeight: 700, margin: 0 }}>🎨 God Mode — CMS</h2>
          <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem', margin: 0 }}>Edit every piece of content on the public website. Changes apply instantly.</p>
        </div>
        <div className="flex gap-2" style={{ flexWrap: 'wrap' }}>
          <button className="btn btn-success" onClick={handleSave}>💾 Save Changes</button>
          <button className="btn btn-gold" onClick={handleReset}>↺ Reset to Default</button>
          <button className="btn btn-secondary" onClick={handleExport}>📤 Export JSON</button>
          <button className="btn btn-primary" onClick={handlePreview}>👁️ Preview</button>
        </div>
      </div>

      {/* Brand Identity */}
      <div style={{ marginBottom: '1.5rem' }}>
        {sectionTitle('🏷️ Brand Identity')}
        <div className="grid grid-2 gap-4">
          <div className="form-group"><label className="form-label">Company Name</label><input className="form-input" value={draft.brand?.name || ''} onChange={e => updateBrand('name', e.target.value)} /></div>
          <div className="form-group"><label className="form-label">Tagline</label><input className="form-input" value={draft.brand?.tagline || ''} onChange={e => updateBrand('tagline', e.target.value)} /></div>
          <div className="form-group"><label className="form-label">Business Email</label><input className="form-input" value={draft.brand?.email || ''} onChange={e => updateBrand('email', e.target.value)} /></div>
          <div className="form-group"><label className="form-label">WhatsApp Number</label><input className="form-input" value={draft.brand?.whatsapp || ''} onChange={e => updateBrand('whatsapp', e.target.value)} /></div>
        </div>
      </div>

      {/* Hero */}
      <div style={{ marginBottom: '1.5rem' }}>
        {sectionTitle('🦸 Hero Section')}
        <div className="grid grid-2 gap-4">
          <div className="form-group" style={{ gridColumn: '1 / -1' }}><label className="form-label">Badge Text</label><input className="form-input" value={draft.hero?.badge || ''} onChange={e => updateHero('badge', e.target.value)} /></div>
          <div className="form-group" style={{ gridColumn: '1 / -1' }}><label className="form-label">Headline</label><input className="form-input" value={draft.hero?.headline || ''} onChange={e => updateHero('headline', e.target.value)} /></div>
          <div className="form-group" style={{ gridColumn: '1 / -1' }}><label className="form-label">Subheadline</label><textarea className="form-textarea" value={draft.hero?.subheadline || ''} onChange={e => updateHero('subheadline', e.target.value)} /></div>
          <div className="form-group"><label className="form-label">Primary CTA</label><input className="form-input" value={draft.hero?.ctaPrimary || ''} onChange={e => updateHero('ctaPrimary', e.target.value)} /></div>
          <div className="form-group"><label className="form-label">Secondary CTA</label><input className="form-input" value={draft.hero?.ctaSecondary || ''} onChange={e => updateHero('ctaSecondary', e.target.value)} /></div>
        </div>
      </div>

      {/* Services */}
      <div style={{ marginBottom: '1.5rem' }}>
        {sectionTitle('📦 Services (4 Cards)')}
        <div className="grid grid-2 gap-4">
          {(draft.services || []).map((s, i) => (
            <div key={i} className="card" style={{ background: 'var(--bg-surface-2)' }}>
              <div style={{ fontSize: '0.85rem', fontWeight: 600, marginBottom: '0.5rem' }}>Service {i + 1}</div>
              <div className="form-group"><label className="form-label">Icon</label><input className="form-input" value={s.icon || ''} onChange={e => updateService(i, 'icon', e.target.value)} /></div>
              <div className="form-group"><label className="form-label">Title</label><input className="form-input" value={s.title || ''} onChange={e => updateService(i, 'title', e.target.value)} /></div>
              <div className="form-group"><label className="form-label">Description</label><textarea className="form-textarea" value={s.description || ''} onChange={e => updateService(i, 'description', e.target.value)} /></div>
            </div>
          ))}
        </div>
      </div>

      {/* Pricing */}
      <div style={{ marginBottom: '1.5rem' }}>
        {sectionTitle('💰 Pricing')}
        <div className="grid grid-2 gap-4">
          <div className="form-group"><label className="form-label">Undergraduate ($/page)</label><input type="number" className="form-input" value={draft.pricing?.undergraduate || 0} onChange={e => updatePricing('undergraduate', e.target.value)} /></div>
          <div className="form-group"><label className="form-label">Master's ($/page)</label><input type="number" className="form-input" value={draft.pricing?.masters || 0} onChange={e => updatePricing('masters', e.target.value)} /></div>
          <div className="form-group"><label className="form-label">PhD ($/page)</label><input type="number" className="form-input" value={draft.pricing?.phd || 0} onChange={e => updatePricing('phd', e.target.value)} /></div>
          <div className="form-group"><label className="form-label">Assignment ($/page)</label><input type="number" className="form-input" value={draft.pricing?.assignment || 0} onChange={e => updatePricing('assignment', e.target.value)} /></div>
          <div className="form-group"><label className="form-label">Project Report ($ flat)</label><input type="number" className="form-input" value={draft.pricing?.projectFlat || 0} onChange={e => updatePricing('projectFlat', e.target.value)} /></div>
          <div className="form-group"><label className="form-label">Odd Job ($ flat)</label><input type="number" className="form-input" value={draft.pricing?.oddJobFlat || 0} onChange={e => updatePricing('oddJobFlat', e.target.value)} /></div>
          <div className="form-group"><label className="form-label">Rush Fee — Under 7 Days (%)</label><input type="number" className="form-input" value={draft.pricing?.rush7day || 0} onChange={e => updatePricing('rush7day', e.target.value)} /></div>
          <div className="form-group"><label className="form-label">Rush Fee — Under 48 Hours (%)</label><input type="number" className="form-input" value={draft.pricing?.rush48hour || 0} onChange={e => updatePricing('rush48hour', e.target.value)} /></div>
        </div>
      </div>

      {/* FAQ */}
      <div style={{ marginBottom: '1.5rem' }}>
        {sectionTitle('❓ FAQ (6 Questions)')}
        <div className="flex flex-col gap-4">
          {(draft.faq || []).map((f, i) => (
            <div key={i} className="card" style={{ background: 'var(--bg-surface-2)' }}>
              <div style={{ fontSize: '0.85rem', fontWeight: 600, marginBottom: '0.5rem' }}>Question {i + 1}</div>
              <div className="form-group"><label className="form-label">Question</label><input className="form-input" value={f.q || ''} onChange={e => updateFAQ(i, 'q', e.target.value)} /></div>
              <div className="form-group"><label className="form-label">Answer</label><textarea className="form-textarea" value={f.a || ''} onChange={e => updateFAQ(i, 'a', e.target.value)} /></div>
            </div>
          ))}
        </div>
      </div>

      {/* Testimonials */}
      <div style={{ marginBottom: '1.5rem' }}>
        {sectionTitle('⭐ Testimonials (3 Cards)')}
        <div className="flex flex-col gap-4">
          {(draft.testimonials || []).map((t, i) => (
            <div key={i} className="card" style={{ background: 'var(--bg-surface-2)' }}>
              <div style={{ fontSize: '0.85rem', fontWeight: 600, marginBottom: '0.5rem' }}>Testimonial {i + 1}</div>
              <div className="form-group"><label className="form-label">Quote Text</label><textarea className="form-textarea" value={t.text || ''} onChange={e => updateTestimonial(i, 'text', e.target.value)} /></div>
              <div className="form-group"><label className="form-label">Attribution</label><input className="form-input" value={t.client || ''} onChange={e => updateTestimonial(i, 'client', e.target.value)} /></div>
            </div>
          ))}
        </div>
      </div>

      {/* About */}
      <div style={{ marginBottom: '1.5rem' }}>
        {sectionTitle('📖 About Us')}
        <div className="grid grid-2 gap-4">
          <div className="form-group" style={{ gridColumn: '1 / -1' }}><label className="form-label">Headline</label><input className="form-input" value={draft.about?.headline || ''} onChange={e => updateAbout('headline', e.target.value)} /></div>
          <div className="form-group" style={{ gridColumn: '1 / -1' }}><label className="form-label">Paragraph 1</label><textarea className="form-textarea" value={draft.about?.p1 || ''} onChange={e => updateAbout('p1', e.target.value)} /></div>
          <div className="form-group" style={{ gridColumn: '1 / -1' }}><label className="form-label">Paragraph 2</label><textarea className="form-textarea" value={draft.about?.p2 || ''} onChange={e => updateAbout('p2', e.target.value)} /></div>
          <div className="form-group"><label className="form-label">Stat 1 Value</label><input className="form-input" value={draft.about?.stat1 || ''} onChange={e => updateAbout('stat1', e.target.value)} /></div>
          <div className="form-group"><label className="form-label">Stat 1 Label</label><input className="form-input" value={draft.about?.stat1Label || ''} onChange={e => updateAbout('stat1Label', e.target.value)} /></div>
          <div className="form-group"><label className="form-label">Stat 2 Value</label><input className="form-input" value={draft.about?.stat2 || ''} onChange={e => updateAbout('stat2', e.target.value)} /></div>
          <div className="form-group"><label className="form-label">Stat 2 Label</label><input className="form-input" value={draft.about?.stat2Label || ''} onChange={e => updateAbout('stat2Label', e.target.value)} /></div>
          <div className="form-group"><label className="form-label">Stat 3 Value</label><input className="form-input" value={draft.about?.stat3 || ''} onChange={e => updateAbout('stat3', e.target.value)} /></div>
          <div className="form-group"><label className="form-label">Stat 3 Label</label><input className="form-input" value={draft.about?.stat3Label || ''} onChange={e => updateAbout('stat3Label', e.target.value)} /></div>
        </div>
      </div>

      {/* Trust Badges */}
      <div style={{ marginBottom: '1.5rem' }}>
        {sectionTitle('🛡️ Trust Badges')}
        <div className="grid grid-2 gap-4">
          {(draft.trustBadges || []).map((b, i) => (
            <div key={i} className="form-group"><label className="form-label">Badge {i + 1}</label><input className="form-input" value={b || ''} onChange={e => updateTrustBadge(i, e.target.value)} /></div>
          ))}
        </div>
      </div>

      {/* Footer */}
      <div style={{ marginBottom: '1.5rem' }}>
        {sectionTitle('📜 Footer')}
        <div className="form-group"><label className="form-label">Copyright Year + Company</label><input className="form-input" value={draft.footer?.copyright || ''} onChange={e => updateFooter('copyright', e.target.value)} /></div>
      </div>

      {/* Sticky Actions */}
      <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap', marginTop: '1.5rem', paddingTop: '1rem', borderTop: '1px solid var(--border)', position: 'sticky', bottom: 0, background: 'var(--bg-body)', zIndex: 10, paddingBottom: '1rem' }}>
        <button className="btn btn-success btn-lg" onClick={handleSave}>💾 Save All Changes</button>
        <button className="btn btn-gold btn-lg" onClick={handleReset}>↺ Reset to Default</button>
        <button className="btn btn-secondary btn-lg" onClick={handleExport}>📤 Export JSON</button>
        <button className="btn btn-primary btn-lg" onClick={handlePreview}>👁️ Preview Public Site</button>
      </div>
    </div>
  );
}
