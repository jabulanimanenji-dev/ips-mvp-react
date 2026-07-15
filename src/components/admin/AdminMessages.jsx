import React from 'react';

export default function AdminMessages() {
  return (
    <div>
      <h2 style={{ fontSize: '1.4rem', fontWeight: 700, marginBottom: '1.5rem' }}>Messages</h2>
      <div className="card" style={{ textAlign: 'center', padding: '4rem 2rem' }}>
        <div style={{ fontSize: '3rem', marginBottom: '1rem' }}>💬</div>
        <h3 style={{ fontSize: '1.2rem', fontWeight: 700, marginBottom: '0.5rem' }}>Unified Inbox</h3>
        <p style={{ color: 'var(--text-muted)', maxWidth: 480, margin: '0 auto 1.5rem' }}>
          This is a placeholder for the unified messaging inbox. In production, this would integrate
          with client messages, writer communications, and support tickets in a single view.
        </p>
        <div className="flex justify-center gap-2" style={{ flexWrap: 'wrap' }}>
          <button className="btn btn-secondary" disabled>Client Messages (0)</button>
          <button className="btn btn-secondary" disabled>Writer Comms (0)</button>
          <button className="btn btn-secondary" disabled>Support Tickets (0)</button>
        </div>
      </div>
    </div>
  );
}
