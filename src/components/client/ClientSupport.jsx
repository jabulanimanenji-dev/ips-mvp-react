import React, { useState } from 'react';
import { DEFAULT_CMS } from '../../utils/constants';

export default function ClientSupport() {
  const [form, setForm] = useState({ subject: '', message: '' });
  const [submitted, setSubmitted] = useState(false);

  const handleChange = (e) => {
    setForm((prev) => ({ ...prev, [e.target.name]: e.target.value }));
    setSubmitted(false);
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    // In a real app, this would send to an API
    const messages = JSON.parse(localStorage.getItem('ips-support-messages') || '[]');
    messages.push({
      id: Date.now(),
      subject: form.subject,
      message: form.message,
      sent_at: new Date().toISOString(),
      status: 'Open',
    });
    localStorage.setItem('ips-support-messages', JSON.stringify(messages));
    setForm({ subject: '', message: '' });
    setSubmitted(true);
    setTimeout(() => setSubmitted(false), 4000);
  };

  const brand = DEFAULT_CMS.brand;

  return (
    <div>
      <h2 style={{ fontSize: '1.5rem', fontWeight: 800, marginBottom: '1.5rem' }}>Support</h2>

      <div className="grid grid-2 gap-4">
        {/* Contact Form */}
        <div className="card">
          <h3 style={{ fontWeight: 700, marginBottom: '1rem' }}>Send a Message</h3>
          <form onSubmit={handleSubmit}>
            <div className="form-group">
              <label className="form-label">Subject</label>
              <input
                type="text"
                name="subject"
                className="form-input"
                value={form.subject}
                onChange={handleChange}
                placeholder="How can we help?"
                required
              />
            </div>
            <div className="form-group">
              <label className="form-label">Message</label>
              <textarea
                name="message"
                className="form-textarea"
                value={form.message}
                onChange={handleChange}
                placeholder="Describe your issue or question in detail..."
                required
                rows={5}
              />
            </div>
            <button type="submit" className="btn btn-primary">
              Send Message
            </button>
            {submitted && (
              <span className="badge badge-completed" style={{ marginLeft: '0.75rem' }}>
                ✓ Message sent
              </span>
            )}
          </form>
        </div>

        {/* Direct Contact Info */}
        <div className="card">
          <h3 style={{ fontWeight: 700, marginBottom: '1rem' }}>Contact Us Directly</h3>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
            <div className="flex items-center" style={{ gap: '0.875rem' }}>
              <div
                style={{
                  width: 40,
                  height: 40,
                  borderRadius: 'var(--radius-md)',
                  background: 'var(--bg-hover)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: '1.1rem',
                }}
              >
                ✉
              </div>
              <div>
                <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>Email</div>
                <div style={{ fontWeight: 600 }}>{brand.email}</div>
              </div>
            </div>

            <div className="flex items-center" style={{ gap: '0.875rem' }}>
              <div
                style={{
                  width: 40,
                  height: 40,
                  borderRadius: 'var(--radius-md)',
                  background: 'var(--bg-hover)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: '1.1rem',
                }}
              >
                ☎
              </div>
              <div>
                <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>WhatsApp</div>
                <div style={{ fontWeight: 600 }}>{brand.whatsapp}</div>
              </div>
            </div>

            <div
              style={{
                padding: '1rem',
                borderRadius: 'var(--radius-md)',
                background: 'var(--bg-surface-2)',
                fontSize: '0.85rem',
                color: 'var(--text-secondary)',
              }}
            >
              <strong style={{ color: 'var(--text-primary)' }}>Response Time:</strong> We typically respond within 24 hours during business days. For urgent matters, please use WhatsApp.
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
