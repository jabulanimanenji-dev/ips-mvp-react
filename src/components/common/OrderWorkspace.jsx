import React, { useCallback, useEffect, useState } from 'react';
import WorkDecisions from './WorkDecisions';

const fileCategories = ['Client Requirements', 'Reference Material', 'Before Evidence', 'Progress Evidence', 'Completion Evidence', 'Receipt', 'Expense Evidence', 'Provider Draft', 'Admin Feedback', 'Revision', 'Final Delivery', 'Signed Approval', 'Incident Report', 'Supporting Document', 'Other'];
const statuses = ['Pending', 'Assigned', 'Accepted by Writer', 'In Progress', 'Submitted for Admin Review', 'Revision Required', 'Approved for Client', 'Delivered', 'Client Revision Requested', 'Completed', 'On Hold'];
const providerStatuses = ['Accepted by Writer', 'In Progress', 'Submitted for Admin Review'];

export default function OrderWorkspace({ order, role, actor, workKind = 'academic', quote = null }) {
  const orderId = order?.order_id;
  const actorId = actor?.client_id || actor?.writer_id || actor?.id || actor?._id || role;
  const authHeaders = actor?.token ? { Authorization: `Bearer ${actor.token}` } : {};
  const [workspace, setWorkspace] = useState({ files: [], messages: [], audit: [], expenses: [], direct_contact_enabled: false });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [category, setCategory] = useState(role === 'client' ? 'Client Requirements' : role === 'writer' ? 'Writer Draft' : 'Other');
  const [visibility, setVisibility] = useState(role === 'client' ? 'admin_client' : role === 'writer' ? 'admin_writer' : 'admin');
  const [fileDescription, setFileDescription] = useState('');
  const [fileFilter, setFileFilter] = useState('all');
  const [progress, setProgress] = useState(order?.progress || 0);
  const [channel, setChannel] = useState(role === 'client' ? 'client_admin' : role === 'writer' ? 'writer_admin' : 'admin_internal');
  const [expense, setExpense] = useState({ category: 'Materials', merchant: '', description: '', amount: '', currency: 'USD', expense_date: new Date().toISOString().slice(0,10), pre_approved: false });

  const load = useCallback(async () => {
    if (!orderId) return;
    const response = await fetch(`/api/orders/${orderId}/workspace`, { headers: authHeaders });
    const data = await response.json();
    if (response.ok) setWorkspace(data);
    else setError(data.error || 'Failed to load workspace.');
  }, [orderId, actor?.token]);

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
        headers: { 'Content-Type': 'application/json', ...authHeaders },
        body: JSON.stringify({
          name: file.name, mime_type: file.type, size: file.size, data,
          category, description: fileDescription, uploader_id: actorId, uploader_role: role, visibility
        })
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || 'Upload failed.');
      setFileDescription('');
      await load();
    } catch (uploadError) {
      setError(uploadError.message);
    } finally {
      setBusy(false);
    }
  };

  const updateFile = async (fileId, updates) => {
    const response = await fetch(`/api/files/${fileId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json', ...authHeaders },
      body: JSON.stringify({ ...updates, actor_id: actorId })
    });
    const data = await response.json();
    if (!response.ok) return setError(data.error || 'File update failed.');
    await load();
  };

  const reviewFile = async (file, state) => {
    let review_reason = '';
    if (state === 'rejected' || state === 'archived') {
      review_reason = window.prompt(state === 'rejected' ? 'Explain why this file is rejected:' : 'Explain why this file is being archived:') || '';
      if (!review_reason.trim()) return;
    }
    await updateFile(file._id, { state, review_reason });
  };

  const sendMessage = async () => {
    if (!message.trim()) return;
    const response = await fetch(`/api/orders/${orderId}/messages`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...authHeaders },
      body: JSON.stringify({ sender_id: actorId, sender_role: role, channel, body: message })
    });
    if (response.ok) {
      setMessage('');
      await load();
    }
  };

  const toggleContact = async () => {
    const response = await fetch(`/api/work/${orderId}/contact-policy`, {
      method: 'PATCH', headers: { 'Content-Type': 'application/json', ...authHeaders },
      body: JSON.stringify({ enabled: !workspace.direct_contact_enabled, actor_id: actorId, actor_role: role })
    });
    const data = await response.json();
    if (!response.ok) return setError(data.error || 'Could not update contact policy.');
    await load();
  };

  const submitExpense = async event => {
    event.preventDefault();
    setBusy(true); setError('');
    const response = await fetch(`/api/work/${orderId}/expenses`, {
      method: 'POST', headers: { 'Content-Type': 'application/json', ...authHeaders },
      body: JSON.stringify({ ...expense, submitted_by_id: actorId, submitted_by_role: role === 'writer' ? 'provider' : role })
    });
    const data = await response.json();
    if (!response.ok) setError(data.error || 'Expense submission failed.');
    else {
      setExpense(current => ({ ...current, merchant: '', description: '', amount: '' }));
      await load();
    }
    setBusy(false);
  };

  const reviewExpense = async (item, status) => {
    const reason = status === 'approved' ? 'Approved by administrator' : window.prompt('Give the provider a reason:');
    if (!reason) return;
    const response = await fetch(`/api/work/${orderId}/expenses/${item._id}`, {
      method: 'PATCH', headers: { 'Content-Type': 'application/json', ...authHeaders },
      body: JSON.stringify({
        status, approved_amount: status === 'approved' ? item.amount : 0,
        admin_reason: reason, client_visible: status === 'approved',
        actor_id: actorId, actor_role: role
      })
    });
    const data = await response.json();
    if (!response.ok) setError(data.error || 'Expense review failed.');
    await load();
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

  const approveAcademicCompletion = async () => {
    const response = await fetch(`/api/orders/${orderId}`, {
      method: 'PATCH', headers: { 'Content-Type': 'application/json', ...authHeaders },
      body: JSON.stringify({ status: 'Completed', client_approved: true })
    });
    const data = await response.json();
    if (!response.ok) setError(data.error || 'Completion approval failed.');
    else window.location.reload();
  };

  if (!orderId) return null;

  return (
    <section style={{ marginTop: '2rem', display: 'grid', gap: '1rem' }}>
      <WorkDecisions workId={orderId} workKind={workKind} role={role} actor={actor} quote={quote || { total: order.total_fee_usd, currency: 'USD' }} />
      <div className="card">
        <h3 style={{ marginBottom: '1rem' }}>Progress & Status</h3>
        <div style={{ height: 10, background: 'var(--bg-surface-2)', borderRadius: 20, overflow: 'hidden' }}>
          <div style={{ width: `${progress}%`, height: '100%', background: 'var(--primary)' }} />
        </div>
        <div className="flex gap-2 items-center" style={{ marginTop: '0.8rem', flexWrap: 'wrap' }}>
          <strong>{progress}%</strong>
          {workKind === 'academic' && (role === 'writer' || role === 'admin') && (
            <>
              <input type="range" min="0" max="100" value={progress} onChange={e => setProgress(e.target.value)} />
              <select className="form-select" defaultValue={order.status} onChange={e => updateProgress(e.target.value)} style={{ maxWidth: 260 }}>
                {(role === 'writer' ? providerStatuses : statuses).map(status => <option key={status}>{status}</option>)}
              </select>
              <button className="btn btn-primary btn-sm" disabled={busy} onClick={() => updateProgress()}>Save Progress</button>
            </>
          )}
          {workKind === 'academic' && role === 'client' && <button className="btn btn-secondary btn-sm" onClick={requestRevision}>Request Revision</button>}
          {workKind === 'academic' && role === 'client' && order.status === 'Delivered' && <button className="btn btn-primary btn-sm" onClick={approveAcademicCompletion}>Approve completed work</button>}
        </div>
      </div>

      <div className="card">
        <div className="flex justify-between items-center" style={{ gap: 10, flexWrap: 'wrap', marginBottom: '1rem' }}>
          <div><h3>Files & Evidence</h3><small style={{ color: 'var(--text-muted)' }}>Uploads stay private to the uploader and admin until an administrator releases them.</small></div>
          <select className="form-select" value={fileFilter} onChange={e => setFileFilter(e.target.value)} style={{ maxWidth: 180 }}>
            <option value="all">All files</option><option value="pending">Pending review</option><option value="released">Released</option><option value="rejected">Rejected</option><option value="mine">My uploads</option>
          </select>
        </div>
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
          <input className="form-input" value={fileDescription} onChange={e => setFileDescription(e.target.value)} placeholder="Description or purpose" style={{ minWidth: 220, flex: 1 }} />
          <label className="btn btn-primary btn-sm" style={{ cursor: busy ? 'wait' : 'pointer' }}>
            {busy ? 'Uploading…' : 'Upload File'}
            <input type="file" hidden disabled={busy} onChange={upload} accept=".pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.txt,.zip,.png,.jpg,.jpeg" />
          </label>
        </div>
        {error && <div style={{ color: 'var(--danger)', marginBottom: '0.8rem' }}>{error}</div>}
        {workspace.files.length === 0 ? <p style={{ color: 'var(--text-muted)' }}>No files available.</p> : (
          <div style={{ display: 'grid', gap: '0.6rem' }}>
            {workspace.files.filter(file => fileFilter === 'all' || fileFilter === file.state || (fileFilter === 'mine' && file.uploader_id === actorId)).map(file => (
              <div key={file._id} style={{ padding: '0.75rem', border: '1px solid var(--border)', borderRadius: 8, display: 'flex', justifyContent: 'space-between', gap: 10, flexWrap: 'wrap' }}>
                <div><strong>{file.original_name}</strong><div style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>{file.category} · {file.uploader_role} · {file.state} · {(file.size / 1024).toFixed(1)} KB</div></div>
                <div style={{ width: '100%', fontSize: '.82rem' }}>
                  {file.description && <div>{file.description}</div>}
                  {file.review_reason && <div style={{ color: file.state === 'rejected' ? 'var(--danger)' : 'var(--text-muted)' }}>Admin note: {file.review_reason}</div>}
                  {file.state === 'pending' && file.uploader_id === actorId && role !== 'admin' && <small style={{ color: 'var(--warning)' }}>Visible only to you and admin while awaiting review.</small>}
                </div>
                <div className="flex gap-1">
                  <a className="btn btn-secondary btn-sm" href={`/api/files/${file._id}/download?token=${encodeURIComponent(actor?.token || '')}`}>Download</a>
                  {role === 'admin' && <select className="form-select" value={file.visibility} onChange={e => updateFile(file._id, { visibility: e.target.value })} style={{ maxWidth: 155 }}><option value="admin">Admin only</option><option value="admin_client">Client</option><option value="admin_writer">Provider</option><option value="all">Client + provider</option></select>}
                  {role === 'admin' && file.state === 'pending' && <button className="btn btn-secondary btn-sm" onClick={() => reviewFile(file, 'approved')}>Approve</button>}
                  {role === 'admin' && file.state !== 'released' && file.state !== 'rejected' && <button className="btn btn-primary btn-sm" onClick={() => reviewFile(file, 'released')}>Release</button>}
                  {role === 'admin' && file.state !== 'rejected' && <button className="btn btn-ghost btn-sm" onClick={() => reviewFile(file, 'rejected')}>Reject</button>}
                  {role === 'admin' && <button className="btn btn-danger btn-sm" onClick={() => reviewFile(file, 'archived')}>Archive</button>}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="card">
        <div className="flex justify-between items-center" style={{ gap: 10, flexWrap: 'wrap', marginBottom: '1rem' }}>
          <div><h3>Job Messages</h3><small style={{ color: 'var(--text-muted)' }}>Client-provider contact is {workspace.direct_contact_enabled ? 'enabled by admin' : 'blocked'}.</small></div>
          {role === 'admin' && <button className={`btn btn-sm ${workspace.direct_contact_enabled ? 'btn-danger' : 'btn-primary'}`} onClick={toggleContact}>{workspace.direct_contact_enabled ? 'Disable direct contact' : 'Allow client-provider contact'}</button>}
        </div>
        <select className="form-select" value={channel} onChange={e => setChannel(e.target.value)} style={{ maxWidth: 290, marginBottom: 10 }}>
          {role === 'client' && <option value="client_admin">Message admin</option>}
          {role === 'writer' && <option value="writer_admin">Message admin</option>}
          {role === 'admin' && <><option value="admin_internal">Internal admin note</option><option value="client_admin">Message client</option><option value="writer_admin">Message provider</option><option value="announcement">Announcement to participants</option></>}
          {workspace.direct_contact_enabled && role !== 'admin' && <option value="client_provider">Direct client-provider conversation</option>}
        </select>
        <div style={{ maxHeight: 260, overflowY: 'auto', display: 'grid', gap: '0.5rem', marginBottom: '1rem' }}>
          {workspace.messages.map(item => <div key={item._id} style={{ padding: '0.65rem', background: 'var(--bg-surface-2)', borderRadius: 8 }}><strong>{item.sender_role}</strong>: {item.body}</div>)}
          {!workspace.messages.length && <span style={{ color: 'var(--text-muted)' }}>No messages yet.</span>}
        </div>
        <textarea className="form-textarea" value={message} onChange={e => setMessage(e.target.value)} placeholder="Write a message…" />
        <button className="btn btn-primary btn-sm" onClick={sendMessage} style={{ marginTop: '0.6rem' }}>Send</button>
      </div>

      <div className="card">
        <h3>Receipts & Expenses</h3>
        {(role === 'writer' || role === 'admin') && <form onSubmit={submitExpense} style={{ margin: '1rem 0', padding: '1rem', background: 'var(--bg-surface-2)', borderRadius: 10 }}>
          <div className="grid grid-3 gap-3">
            <label className="form-group"><span className="form-label">Category</span><select className="form-select" value={expense.category} onChange={e => setExpense({ ...expense, category: e.target.value })}>{['Materials','Travel','Delivery','Supplier','Accommodation','Other'].map(v => <option key={v}>{v}</option>)}</select></label>
            <label className="form-group"><span className="form-label">Merchant</span><input className="form-input" value={expense.merchant} onChange={e => setExpense({ ...expense, merchant: e.target.value })} /></label>
            <label className="form-group"><span className="form-label">Date</span><input required type="date" className="form-input" value={expense.expense_date} onChange={e => setExpense({ ...expense, expense_date: e.target.value })} /></label>
          </div>
          <label className="form-group"><span className="form-label">Why this expense was necessary</span><textarea required className="form-textarea" value={expense.description} onChange={e => setExpense({ ...expense, description: e.target.value })} /></label>
          <div className="grid grid-2 gap-3">
            <label className="form-group"><span className="form-label">Amount</span><input required min="0" step=".01" type="number" className="form-input" value={expense.amount} onChange={e => setExpense({ ...expense, amount: e.target.value })} /></label>
            <label className="form-group"><span className="form-label">Currency</span><input required className="form-input" value={expense.currency} onChange={e => setExpense({ ...expense, currency: e.target.value.toUpperCase() })} /></label>
          </div>
          <label><input type="checkbox" checked={expense.pre_approved} onChange={e => setExpense({ ...expense, pre_approved: e.target.checked })} /> This expense was pre-approved</label>
          <p style={{ color: 'var(--text-muted)', fontSize: '.82rem' }}>Upload the receipt above using the Receipt category, then submit this expense record.</p>
          <button disabled={busy} className="btn btn-primary btn-sm">Submit expense</button>
        </form>}
        {!workspace.expenses?.length && <p style={{ color: 'var(--text-muted)' }}>No expense records.</p>}
        {workspace.expenses?.map(item => <div key={item._id} style={{ padding: '.8rem 0', borderBottom: '1px solid var(--border)', display: 'grid', gridTemplateColumns: '1fr auto', gap: 10 }}>
          <div><strong>{item.category}: {item.currency} {item.amount}</strong><div>{item.description}</div><small style={{ color: 'var(--text-muted)' }}>{item.merchant || 'No merchant'} · {item.status}{item.admin_reason ? ` · ${item.admin_reason}` : ''}</small></div>
          {role === 'admin' && item.status === 'submitted' && <div className="flex gap-1"><button className="btn btn-primary btn-sm" onClick={() => reviewExpense(item, 'approved')}>Approve</button><button className="btn btn-ghost btn-sm" onClick={() => reviewExpense(item, 'more_info_required')}>Need info</button><button className="btn btn-danger btn-sm" onClick={() => reviewExpense(item, 'rejected')}>Reject</button></div>}
        </div>)}
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
