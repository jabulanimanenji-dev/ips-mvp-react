import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';

export default function AdminSettings() {
  const { admin, hasAdminPermission } = useAuth();
  const [summary, setSummary] = useState(null);
  const [state, setState] = useState({ loading: true, saving: false, error: '', success: '' });

  useEffect(() => {
    fetch('/api/admin/data-summary')
      .then(async response => {
        const data = await response.json().catch(() => ({}));
        if (!response.ok || !data.success) throw new Error(data.error || 'Database summary could not be loaded.');
        setSummary(data);
        setState(previous => ({ ...previous, loading: false }));
      })
      .catch(error => setState(previous => ({ ...previous, loading: false, error: error.message })));
  }, []);

  const exportData = async () => {
    setState(previous => ({ ...previous, saving: true, error: '', success: '' }));
    try {
      const response = await fetch('/api/admin/export');
      if (!response.ok) {
        const data = await response.json().catch(() => ({}));
        throw new Error(data.error || 'Export could not be generated.');
      }
      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `ips-database-export-${new Date().toISOString().slice(0, 10)}.json`;
      link.click();
      URL.revokeObjectURL(url);
      setState(previous => ({ ...previous, saving: false, success: 'Sanitised database export downloaded.' }));
    } catch (error) {
      setState(previous => ({ ...previous, saving: false, error: error.message }));
    }
  };

  return (
    <div>
      <div style={{ marginBottom: '1.5rem' }}>
        <div style={{ color: 'var(--primary)', fontSize: '.72rem', fontWeight: 800, letterSpacing: '.14em', textTransform: 'uppercase' }}>System governance</div>
        <h2 style={{ fontSize: '1.5rem', fontWeight: 800, margin: '.35rem 0' }}>Settings & Data</h2>
        <p style={{ color: 'var(--text-muted)', margin: 0 }}>MongoDB is the source of truth. Your authority is enforced by the server on every protected request.</p>
      </div>

      {state.error && <div className="toast error" style={{ position: 'static', marginBottom: '1rem', maxWidth: 'none' }}>{state.error}</div>}
      {state.success && <div className="toast success" style={{ position: 'static', marginBottom: '1rem', maxWidth: 'none' }}>{state.success}</div>}

      <div className="grid grid-2 gap-4">
        <div className="card">
          <h3 style={{ marginBottom: '.5rem' }}>Signed-in authority</h3>
          <div className="badge badge-success">{admin?.customRoleName || admin?.role || 'Administrator'}</div>
          <p><strong>{admin?.name}</strong><br /><span style={{ color: 'var(--text-muted)' }}>{admin?.email}</span></p>
          <small style={{ color: 'var(--text-muted)' }}>{admin?.permissions?.includes('*') ? 'All platform permissions' : `${admin?.permissions?.length || 0} active permissions`}</small>
          {admin?.isSuperAdmin && <div style={{ marginTop: '1rem' }}><Link to="/admin/access" className="btn btn-primary">Open Access Control</Link></div>}
        </div>

        <div className="card">
          <h3 style={{ marginBottom: '.5rem' }}>Brand, Pages & Media</h3>
          <p style={{ color: 'var(--text-muted)' }}>Visual configuration is versioned on the server. The builder supports responsive page composition, media, preview, publish, and rollback.</p>
          {hasAdminPermission('design.view') && <Link to="/admin/cms" className="btn btn-primary">Open Visual Builder 2.0</Link>}
        </div>

        <div className="card">
          <div className="flex justify-between items-center" style={{ marginBottom: '1rem' }}>
            <div><h3 style={{ margin: 0 }}>Database Inventory</h3><small style={{ color: 'var(--text-muted)' }}>{summary?.source || 'MongoDB'} · {summary?.mode || 'server authoritative'}</small></div>
            {hasAdminPermission('data.export') && <button className="btn btn-secondary" onClick={exportData} disabled={state.saving}>Export Safe JSON</button>}
          </div>
          {state.loading ? <p>Loading inventory…</p> : (
            <div className="grid grid-3 gap-3">
              {Object.entries(summary?.collections || {}).map(([key, value]) => (
                <div key={key} style={{ padding: '.8rem', borderRadius: 12, background: 'var(--bg-surface-2)', border: '1px solid var(--border)' }}>
                  <strong style={{ fontSize: '1.25rem' }}>{value}</strong>
                  <small style={{ display: 'block', color: 'var(--text-muted)', overflowWrap: 'anywhere' }}>{key}</small>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="card" style={{ borderColor: 'rgba(237,158,111,.35)' }}>
          <h3 style={{ marginBottom: '.5rem' }}>Recovery & Destructive Operations</h3>
          <p style={{ color: 'var(--text-muted)', marginBottom: '.75rem' }}>Production deletion, restore, and bulk import require a controlled maintenance procedure, verified backup, least-privilege authority, and an audit record.</p>
          <div className="badge badge-review">Protected maintenance only</div>
        </div>
      </div>
    </div>
  );
}
