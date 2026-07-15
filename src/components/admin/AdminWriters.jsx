import React, { useEffect, useState } from 'react';
import { fmtCur } from '../../utils/formatters';

export default function AdminWriters() {
  const [writers, setWriters] = useState([]);

  useEffect(() => {
    const raw = JSON.parse(localStorage.getItem('ips-admin-writers') || '[]');
    setWriters(raw);
  }, []);

  const toggleStatus = (writerId) => {
    const all = JSON.parse(localStorage.getItem('ips-admin-writers') || '[]');
    const idx = all.findIndex((w) => w.writer_id === writerId);
    if (idx === -1) return;
    const current = all[idx].status;
    all[idx] = { ...all[idx], status: current === 'Active' ? 'On Leave' : 'Active' };
    localStorage.setItem('ips-admin-writers', JSON.stringify(all));
    setWriters(all);
  };

  return (
    <div>
      <div className="flex justify-between items-center" style={{ marginBottom: '1.5rem' }}>
        <h2 style={{ fontSize: '1.4rem', fontWeight: 700 }}>Writers</h2>
        <span style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>{writers.length} total</span>
      </div>

      <div className="card" style={{ overflowX: 'auto' }}>
        <table className="data-table">
          <thead>
            <tr>
              <th>ID</th>
              <th>Name</th>
              <th>Expertise</th>
              <th>Level</th>
              <th>Rating</th>
              <th>Completed</th>
              <th>Availability</th>
              <th>Rate</th>
              <th>Status</th>
              <th>Action</th>
            </tr>
          </thead>
          <tbody>
            {writers.length === 0 && (
              <tr>
                <td colSpan={10} style={{ textAlign: 'center', color: 'var(--text-muted)', padding: '2rem' }}>
                  No writers found.
                </td>
              </tr>
            )}
            {writers.map((w) => (
              <tr key={w.writer_id}>
                <td style={{ fontWeight: 700 }}>{w.writer_id}</td>
                <td>{w.full_name}</td>
                <td>{w.primary_expertise}{w.secondary_expertise ? ` / ${w.secondary_expertise}` : ''}</td>
                <td>{w.academic_level}</td>
                <td>⭐ {w.rating}</td>
                <td>{w.projects_completed}</td>
                <td>
                  <span className={`badge ${w.availability === 'Available' ? 'badge-completed' : w.availability === 'Limited' ? 'badge-review' : w.availability === 'Busy' ? 'badge-progress' : 'badge-new'}`}>
                    {w.availability}
                  </span>
                </td>
                <td>{fmtCur(w.rate_per_page_usd)}/page</td>
                <td>
                  <span className={`badge ${w.status === 'Active' ? 'badge-completed' : 'badge-new'}`}>
                    {w.status}
                  </span>
                </td>
                <td>
                  <button className="btn btn-sm btn-secondary" onClick={() => toggleStatus(w.writer_id)}>
                    {w.status === 'Active' ? 'Deactivate' : 'Activate'}
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
