import React, { useCallback, useEffect, useState } from 'react';

const fileCategories = ['Client Requirements', 'Reference Material', 'Writer Draft', 'Admin Feedback', 'Revision', 'Final Delivery', 'Supporting Document', 'Other'];
const statuses = ['Pending', 'Assigned', 'Accepted by Writer', 'In Progress', 'Submitted for Admin Review', 'Revision Required', 'Approved for Client', 'Delivered', 'Client Revision Requested', 'Completed', 'On Hold'];

export default function OrderWorkspace({ order, role, actor }) {
  const orderId = order?.order_id;
  const actorId = actor?.client_id || actor?.writer_id || actor?.id || actor?._id || role;
  const [workspace, setWorkspace] = useState({ files: [], messages: [], audit: [] });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [category, setCategory] = useState(role === 'client' ? 'Client Requirements' : role === 'writer' ? 'Writer Draft' : 'Other');
  const [visibility, setVisibility] = useState(role === 'client' ? 'admin_writer' : role === 'writer' ? 'admin_writer' : 'all');
  const [progress, setProgress] = useState(order?.progress || 0);

  const load = useCallback(async () => {
    if (!orderId) return;
    const response = await fetch(`/api/orders/${orderId}/workspace?role=${role}`);
    const data = await response.json();
    if (response.ok) setWorkspace(data);
    else setError(data.error || 'Failed to load workspace.');
  }, [orderId, role]);

  useEffect(() => { load(); }, [load]);

  const upload = async (event) => {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) return;
    if (file.size > 25 * 1024 * 1024) return setError('Maximum file size is 25 MB.');
    setBusy(true);
    setError('');
    try {
      const data = await new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result);
        reader.onerror = reject;
        reader.readAsDataURL(file);
      });
      const response = await fetch(`/api/orders/${orderId}/files`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: file.name, mime_type: file.type, size: file.size, data,
          category, uploader_id: actorId, uploader_role: role, visibility
        })
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || 'Upload failed.');
      await load();
    } catch (uploadError) {
      setError(uploadError.message);
    } finally {
      setBusy(false);
    }
  };

  const updateFile = async (fileId, updates) => {
    await fetch(`/api/files/${fileId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...updates, actor_id: actorId })
    });
    await load();
  };

  const sendMessage = async () => {
    if (!message.trim()) return;
    const channel = role === 'client' ? 'client_admin' : role === 'writer' ? 'writer_admin' : 'admin_internal';
    const response = await fetch(`/api/orders/${orderId}/messages`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ sender_id: actorId, sender_role: role, channel, body: message })
    });
    if (response.ok) {
      setMessage('');
      await load();
    }
  };

  const updateProgress = async (status = order.status) => {
    setBusy(true);
    const response = await fetch(`/api/orders/${orderId}/progress`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ progress: Number(progress), status, actor_id: actorId, actor_role: role })
    });
    const data = await response.json();
    if (!response.ok) setError(data.error || 'Progress update failed.');
    setBusy(false);
  };

  const requestRevision = async () => {
    const reason = window.prompt('Describe the revision required:');
    if (!reason) return;
    await fetch(`/api/orders/${orderId}/revisions`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ actor_id: actorId, actor_role: role, reason })
    });
    window.alert('Revision request submitted.');
  };

  if (!orderId) return null;

  return (
    <section style={{ marginTop: '2rem', display: 'grid', gap: '1rem' }}>
      <div className="card">
        <h3 style={{ marginBottom: '1rem' }}>Progress & Status</h3>
        <div style={{ height: 10, background: 'var(--bg-surface-2)', borderRadius: 20, overflow: 'hidden' }}>
          <div style={{ width: `${progress}%`, height: '100%', background: 'var(--primary)' }} />
        </div>
        <div className="flex gap-2 items-center" style={{ marginTop: '0.8rem', flexWrap: 'wrap' }}>
          <strong>{progress}%</strong>
          {(role === 'writer' || role === 'admin') && (
            <>
              <input type="range" min="0" max="100" value={progress} onChange={e => setProgress(e.target.value)} />
              <select className="form-select" defaultValue={order.status} onChange={e => updateProgress(e.target.value)} style={{ maxWidth: 260 }}>
                {statuses.map(status => <option key={status}>{status}</option>)}
              </select>
              <button className="btn btn-primary btn-sm" disabled={busy} onClick={() => updateProgress()}>Save Progress</button>
            </>
          )}
          {role === 'client' && <button className="btn btn-secondary btn-sm" onClick={requestRevision}>Request Revision</button>}
        </div>
      </div>

      <div className="card">
        <h3 style={{ marginBottom: '1rem' }}>Files</h3>
        <div className="flex gap-2" style={{ flexWrap: 'wrap', marginBottom: '1rem' }}>
          <select className="form-select" value={category} onChange={e => setCategory(e.target.value)} style={{ maxWidth: 220 }}>
            {fileCategories.map(value => <option key={value}>{value}</option>)}
          </select>
          {role === 'admin' && (
            <select className="form-select" value={visibility} onChange={e => setVisibility(e.target.value)} style={{ maxWidth: 190 }}>
              <option value="all">Client and Writer</option>
              <option value="admin_client">Client only</option>
              <option value="admin_writer">Writer only</option>
              <option value="admin">Admin only</option>
            </select>
          )}
          <label className="btn btn-primary btn-sm" style={{ cursor: busy ? 'wait' : 'pointer' }}>
            {busy ? 'Uploading…' : 'Upload File'}
            <input type="file" hidden disabled={busy} onChange={upload} accept=".pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.txt,.zip,.png,.jpg,.jpeg" />
          </label>
        </div>
        {error && <div style={{ color: 'var(--danger)', marginBottom: '0.8rem' }}>{error}</div>}
        {workspace.files.length === 0 ? <p style={{ color: 'var(--text-muted)' }}>No files available.</p> : (
          <div style={{ display: 'grid', gap: '0.6rem' }}>
            {workspace.files.map(file => (
              <div key={file._id} style={{ padding: '0.75rem', border: '1px solid var(--border)', borderRadius: 8, display: 'flex', justifyContent: 'space-between', gap: 10, flexWrap: 'wrap' }}>
                <div><strong>{file.original_name}</strong><div style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>{file.category} · {file.uploader_role} · {file.state} · {(file.size / 1024).toFixed(1)} KB</div></div>
                <div className="flex gap-1">
                  {(role !== 'client' || file.state === 'released') && <a className="btn btn-secondary btn-sm" href={`/api/files/${file._id}/download?role=${role}`}>Download</a>}
                  {role === 'admin' && file.state !== 'released' && <button className="btn btn-primary btn-sm" onClick={() => updateFile(file._id, { state: 'released', visibility: file.visibility === 'admin_writer' ? 'all' : file.visibility })}>Release</button>}
                  {role === 'admin' && <button className="btn btn-danger btn-sm" onClick={() => updateFile(file._id, { state: 'archived' })}>Archive</button>}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="card">
        <h3 style={{ marginBottom: '1rem' }}>{role === 'client' ? 'Message Admin' : role === 'writer' ? 'Writer–Admin Messages' : 'Internal Admin Notes'}</h3>
        <div style={{ maxHeight: 260, overflowY: 'auto', display: 'grid', gap: '0.5rem', marginBottom: '1rem' }}>
          {workspace.messages.map(item => <div key={item._id} style={{ padding: '0.65rem', background: 'var(--bg-surface-2)', borderRadius: 8 }}><strong>{item.sender_role}</strong>: {item.body}</div>)}
          {!workspace.messages.length && <span style={{ color: 'var(--text-muted)' }}>No messages yet.</span>}
        </div>
        <textarea className="form-textarea" value={message} onChange={e => setMessage(e.target.value)} placeholder="Write a message…" />
        <button className="btn btn-primary btn-sm" onClick={sendMessage} style={{ marginTop: '0.6rem' }}>Send</button>
      </div>

      {role === 'admin' && (
        <div className="card">
          <h3 style={{ marginBottom: '1rem' }}>Audit History</h3>
          {workspace.audit.map(item => <div key={item._id} style={{ fontSize: '0.82rem', padding: '0.45rem 0', borderBottom: '1px solid var(--border)' }}>{new Date(item.createdAt).toLocaleString()} — {item.actor_role}: {item.action}</div>)}
        </div>
      )}
    </section>
  );
}
