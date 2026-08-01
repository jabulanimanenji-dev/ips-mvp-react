import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { fmtCur } from '../../utils/formatters';
import { WRITER_DEFAULTS } from '../../utils/constants';

const blankWriter = {
  full_name: '', email: '', password: '', primary_expertise: '', secondary_expertise: '',
  academic_level: 'Master', rate_per_page_usd: 10
};

export default function AdminWriters() {
  const [writers, setWriters] = useState([]);
  const [filter, setFilter] = useState('all');
  const [showAddModal, setShowAddModal] = useState(false);
  const [newWriter, setNewWriter] = useState(blankWriter);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    try {
      const response = await fetch('/api/writers');
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Failed to load providers.');
      setWriters(data.writers || []);
    } catch (error) {
      window.alert(error.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const counts = useMemo(() => writers.reduce((result, writer) => {
    const status = writer.application_status || 'approved';
    result[status] = (result[status] || 0) + 1;
    return result;
  }, {}), [writers]);

  const visible = useMemo(() => filter === 'all'
    ? writers
    : writers.filter(writer => (writer.application_status || 'approved') === filter), [filter, writers]);

  const review = async (writer, decision) => {
    let rejection_reason = '';
    let admin_notes = '';
    if (decision === 'rejected') {
      rejection_reason = window.prompt(`Reason for rejecting ${writer.full_name}:`) || '';
      if (!rejection_reason) return;
    } else {
      admin_notes = window.prompt(`Optional internal note for ${writer.full_name}:`) || '';
    }
    const response = await fetch(`/api/provider/applications/${writer.writer_id}`, {
      method: 'PATCH', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ decision, rejection_reason, admin_notes })
    });
    const data = await response.json();
    if (!response.ok) return window.alert(data.error || 'Review failed.');
    setWriters(list => list.map(item => item.writer_id === writer.writer_id ? data.writer : item));
  };

  const updateWriter = async (writerId, updates) => {
    const response = await fetch(`/api/writers/${writerId}`, {
      method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(updates)
    });
    const data = await response.json();
    if (!response.ok) return window.alert(data.error || 'Update failed.');
    setWriters(list => list.map(writer => writer.writer_id === writerId ? data.writer : writer));
  };

  const toggleStatus = writer => updateWriter(writer.writer_id, { status: writer.status === 'Active' ? 'On Leave' : 'Active' });

  const deleteWriter = async writer => {
    if (!window.confirm(`Delete ${writer.full_name}? This cannot be undone.`)) return;
    const response = await fetch(`/api/writers/${writer.writer_id}`, { method: 'DELETE' });
    if (response.ok) setWriters(list => list.filter(item => item.writer_id !== writer.writer_id));
  };

  const resetPassword = async writer => {
    const password = window.prompt(`Set a new temporary password for ${writer.full_name}:`);
    if (!password) return;
    if (password.length < 8) return window.alert('Password must contain at least 8 characters.');
    await updateWriter(writer.writer_id, { password });
    window.alert('Temporary password updated.');
  };

  const addWriter = async event => {
    event.preventDefault();
    const payload = {
      ...newWriter,
      rate_per_page_usd: Number(newWriter.rate_per_page_usd) || WRITER_DEFAULTS.rate_per_page_usd,
      rating: WRITER_DEFAULTS.rating, projects_completed: WRITER_DEFAULTS.projects_completed,
      availability: WRITER_DEFAULTS.availability, status: 'Active'
    };
    const response = await fetch('/api/writers', {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload)
    });
    const data = await response.json();
    if (!response.ok) return window.alert(data.error || 'Failed to add provider.');
    setWriters(list => [data.writer, ...list]);
    setNewWriter(blankWriter);
    setShowAddModal(false);
  };

  const statusBadge = writer => {
    const status = writer.application_status || 'approved';
    const styles = {
      pending: 'badge-review', approved: 'badge-success', rejected: 'badge-danger', more_information: 'badge-warning'
    };
    return <span className={`badge ${styles[status] || ''}`}>{status.replace('_', ' ')}</span>;
  };

  return (
    <div>
      <div className="flex justify-between items-center" style={{ marginBottom: '1.25rem', gap: '1rem', flexWrap: 'wrap' }}>
        <div><h2 style={{ fontSize: '1.4rem', fontWeight: 700 }}>Service Providers</h2><p style={{ color: 'var(--text-muted)', margin: '.25rem 0 0' }}>Review self-service applications and manage approved providers.</p></div>
        <button className="btn btn-primary" onClick={() => setShowAddModal(true)}>+ Add Provider</button>
      </div>

      <div className="flex gap-2" style={{ flexWrap: 'wrap', marginBottom: '1rem' }}>
        {[['all', writers.length], ['pending', counts.pending || 0], ['approved', counts.approved || 0], ['more_information', counts.more_information || 0], ['rejected', counts.rejected || 0]].map(([key, count]) => (
          <button key={key} className={`btn ${filter === key ? 'btn-primary' : 'btn-secondary'} btn-sm`} onClick={() => setFilter(key)}>{key.replace('_', ' ')} ({count})</button>
        ))}
      </div>

      {showAddModal && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,.72)', zIndex: 1200, display: 'grid', placeItems: 'center', padding: '1rem' }}>
          <form className="card" onSubmit={addWriter} style={{ width: 'min(520px,100%)', maxHeight: '90vh', overflowY: 'auto' }}>
            <h3>Add approved provider</h3>
            {Object.entries({ full_name: 'Full name', email: 'Email', password: 'Temporary password', primary_expertise: 'Primary expertise', secondary_expertise: 'Secondary expertise' }).map(([name, label]) => (
              <label className="form-group" key={name}><span className="form-label">{label}{name !== 'secondary_expertise' ? ' *' : ''}</span><input className="form-input" type={name === 'email' ? 'email' : name === 'password' ? 'password' : 'text'} name={name} value={newWriter[name]} onChange={e => setNewWriter({ ...newWriter, [name]: e.target.value })} required={name !== 'secondary_expertise'} /></label>
            ))}
            <label className="form-group"><span className="form-label">Academic level</span><select className="form-select" value={newWriter.academic_level} onChange={e => setNewWriter({ ...newWriter, academic_level: e.target.value })}><option>Bachelor</option><option>Master</option><option>PhD</option></select></label>
            <label className="form-group"><span className="form-label">Rate per page (USD)</span><input className="form-input" type="number" min="1" value={newWriter.rate_per_page_usd} onChange={e => setNewWriter({ ...newWriter, rate_per_page_usd: e.target.value })} /></label>
            <div className="flex gap-2"><button className="btn btn-primary">Add provider</button><button type="button" className="btn btn-secondary" onClick={() => setShowAddModal(false)}>Cancel</button></div>
          </form>
        </div>
      )}

      <div className="card" style={{ overflowX: 'auto' }}>
        {loading ? <p>Loading providers…</p> : (
          <table className="data-table">
            <thead><tr><th>Provider</th><th>Application</th><th>Expertise</th><th>Location</th><th>Experience</th><th>Availability</th><th>Rate</th><th>Account</th><th>Actions</th></tr></thead>
            <tbody>
              {!visible.length && <tr><td colSpan="9" style={{ textAlign: 'center', padding: '2rem', color: 'var(--text-muted)' }}>No providers in this category.</td></tr>}
              {visible.map(writer => (
                <tr key={writer.writer_id}>
                  <td><strong>{writer.full_name}</strong><div style={{ fontSize: '.78rem', color: 'var(--text-muted)' }}>{writer.writer_id} · {writer.email}</div>{writer.professional_title && <div style={{ fontSize: '.78rem' }}>{writer.professional_title}</div>}</td>
                  <td>{statusBadge(writer)}<div style={{ fontSize: '.72rem', color: 'var(--text-muted)', marginTop: 4 }}>{writer.application_source === 'self-service' ? 'Self-applied' : 'Admin-created'}</div></td>
                  <td>{writer.primary_expertise || 'Not provided'}{writer.secondary_expertise && <div style={{ fontSize: '.78rem', color: 'var(--text-muted)' }}>{writer.secondary_expertise}</div>}<div style={{ fontSize: '.72rem', color: 'var(--text-muted)', marginTop: 4 }}>{(writer.experience_level || 'entry-level').replace('-', ' ')}</div></td>
                  <td>{[writer.city, writer.country].filter(Boolean).join(', ') || '—'}</td>
                  <td>{writer.has_professional_experience ? `${writer.years_of_experience || 0} years` : 'Starting out'}<div style={{ fontSize: '.78rem', color: 'var(--text-muted)' }}>{writer.academic_level || 'No education profile'}</div></td>
                  <td>{writer.availability}</td><td>{fmtCur(writer.rate_per_page_usd || 0)}</td>
                  <td><span className={`badge ${writer.status === 'Active' ? 'badge-success' : 'badge-warning'}`}>{writer.status}</span></td>
                  <td><div className="flex gap-1" style={{ flexWrap: 'wrap', minWidth: 220 }}>
                    {(writer.application_status || 'approved') !== 'approved' && <button className="btn btn-primary btn-sm" onClick={() => review(writer, 'approved')}>Approve</button>}
                    {writer.application_status === 'pending' && <button className="btn btn-secondary btn-sm" onClick={() => review(writer, 'more_information')}>Need info</button>}
                    {(writer.application_status || 'approved') !== 'rejected' && <button className="btn btn-danger btn-sm" onClick={() => review(writer, 'rejected')}>Reject</button>}
                    {writer.portfolio_url && <a className="btn btn-secondary btn-sm" href={writer.portfolio_url} target="_blank" rel="noreferrer">Portfolio</a>}
                    {writer.cv_stored_name && <a className="btn btn-secondary btn-sm" href={`/api/provider/applications/${writer.writer_id}/cv`}>Download CV</a>}
                    {(writer.application_status || 'approved') === 'approved' && <button className="btn btn-secondary btn-sm" onClick={() => toggleStatus(writer)}>{writer.status === 'Active' ? 'Pause' : 'Activate'}</button>}
                    <button className="btn btn-secondary btn-sm" onClick={() => resetPassword(writer)}>Password</button>
                    <button className="btn btn-danger btn-sm" onClick={() => deleteWriter(writer)}>Delete</button>
                  </div></td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
