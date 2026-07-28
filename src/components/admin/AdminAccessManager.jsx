import React, { useEffect, useMemo, useState } from 'react';
import { useAuth } from '../../context/AuthContext';

const emptyAccount = {
  name: '',
  email: '',
  password: '',
  roleKey: 'moderator'
};

const emptyRole = {
  name: '',
  description: '',
  permissions: ['platform.access', 'dashboard.view']
};

const request = async (url, options = {}) => {
  const response = await fetch(url, {
    credentials: 'same-origin',
    ...options,
    headers: { 'Content-Type': 'application/json', ...(options.headers || {}) }
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok || !data.success) throw new Error(data.error || 'The request could not be completed.');
  return data;
};

const roleKey = admin => admin.custom_role_id ? `custom:${admin.custom_role_id}` : admin.role;

export default function AdminAccessManager() {
  const { admin: signedInAdmin, hasAdminPermission } = useAuth();
  const [accounts, setAccounts] = useState([]);
  const [rootAdmin, setRootAdmin] = useState(null);
  const [roles, setRoles] = useState([]);
  const [builtInRoles, setBuiltInRoles] = useState({});
  const [permissions, setPermissions] = useState([]);
  const [auditLogs, setAuditLogs] = useState([]);
  const [accountForm, setAccountForm] = useState(emptyAccount);
  const [roleForm, setRoleForm] = useState(emptyRole);
  const [editingRole, setEditingRole] = useState('');
  const [resetTarget, setResetTarget] = useState(null);
  const [temporaryPassword, setTemporaryPassword] = useState('');
  const [working, setWorking] = useState('');
  const [notice, setNotice] = useState({ type: '', text: '' });

  const canManage = hasAdminPermission('administrators.manage') && signedInAdmin?.isSuperAdmin;

  const groupedPermissions = useMemo(() => {
    const groups = {};
    permissions.forEach(permission => {
      const group = permission.id.split('.')[0];
      groups[group] = [...(groups[group] || []), permission];
    });
    return groups;
  }, [permissions]);

  const load = async () => {
    setWorking('load');
    setNotice({ type: '', text: '' });
    try {
      const [accountData, roleData, permissionData, auditData] = await Promise.all([
        request('/api/admins'),
        request('/api/admin-roles'),
        request('/api/admin/permissions'),
        request('/api/admin/audit-logs')
      ]);
      setAccounts(accountData.admins || []);
      setRootAdmin(accountData.rootAdmin || null);
      setRoles(roleData.roles || []);
      setPermissions(permissionData.permissions || []);
      setBuiltInRoles(permissionData.builtInRoles || {});
      setAuditLogs(auditData.logs || []);
    } catch (error) {
      setNotice({ type: 'error', text: error.message });
    } finally {
      setWorking('');
    }
  };

  useEffect(() => {
    if (canManage) load();
  }, [canManage]);

  const createAccount = async event => {
    event.preventDefault();
    setWorking('account');
    setNotice({ type: '', text: '' });
    try {
      const custom = accountForm.roleKey.startsWith('custom:') ? accountForm.roleKey.slice(7) : '';
      await request('/api/admins', {
        method: 'POST',
        body: JSON.stringify({
          name: accountForm.name,
          email: accountForm.email,
          password: accountForm.password,
          role: custom ? 'moderator' : accountForm.roleKey,
          custom_role_id: custom
        })
      });
      setAccountForm(emptyAccount);
      await load();
      setNotice({ type: 'success', text: 'Administrator created. They must change the temporary password after signing in.' });
    } catch (error) {
      setNotice({ type: 'error', text: error.message });
    } finally {
      setWorking('');
    }
  };

  const updateAccount = async (account, updates, successText) => {
    setWorking(account.id);
    setNotice({ type: '', text: '' });
    try {
      await request(`/api/admins/${account.id}`, {
        method: 'PATCH',
        body: JSON.stringify({ ...updates, reason: 'Updated from Super Admin Access Control' })
      });
      await load();
      setNotice({ type: 'success', text: successText || 'Administrator updated and previous sessions revoked.' });
    } catch (error) {
      setNotice({ type: 'error', text: error.message });
    } finally {
      setWorking('');
    }
  };

  const changeRole = (account, nextRoleKey) => {
    const custom = nextRoleKey.startsWith('custom:') ? nextRoleKey.slice(7) : '';
    updateAccount(account, {
      role: custom ? 'moderator' : nextRoleKey,
      custom_role_id: custom
    }, 'Role changed and previous sessions revoked.');
  };

  const resetPassword = async event => {
    event.preventDefault();
    if (!resetTarget) return;
    await updateAccount(resetTarget, { temporary_password: temporaryPassword }, 'Temporary password set and previous sessions revoked.');
    setResetTarget(null);
    setTemporaryPassword('');
  };

  const removeAccount = async account => {
    if (!window.confirm(`Archive administrator access for ${account.name}? This cannot be undone from this screen.`)) return;
    setWorking(account.id);
    try {
      await request(`/api/admins/${account.id}`, { method: 'DELETE' });
      await load();
      setNotice({ type: 'success', text: 'Administrator account removed.' });
    } catch (error) {
      setNotice({ type: 'error', text: error.message });
    } finally {
      setWorking('');
    }
  };

  const togglePermission = id => {
    setRoleForm(previous => ({
      ...previous,
      permissions: previous.permissions.includes(id)
        ? previous.permissions.filter(permission => permission !== id)
        : [...previous.permissions, id]
    }));
  };

  const submitRole = async event => {
    event.preventDefault();
    setWorking('role');
    try {
      await request(editingRole ? `/api/admin-roles/${editingRole}` : '/api/admin-roles', {
        method: editingRole ? 'PATCH' : 'POST',
        body: JSON.stringify(roleForm)
      });
      setRoleForm(emptyRole);
      setEditingRole('');
      await load();
      setNotice({ type: 'success', text: editingRole ? 'Role updated; assigned sessions were revoked.' : 'Custom administrator role created.' });
    } catch (error) {
      setNotice({ type: 'error', text: error.message });
    } finally {
      setWorking('');
    }
  };

  const editRole = role => {
    setEditingRole(role.role_id);
    setRoleForm({
      name: role.name,
      description: role.description || '',
      permissions: role.permissions || []
    });
    window.scrollTo({ top: document.body.scrollHeight, behavior: 'smooth' });
  };

  const deleteRole = async role => {
    if (!window.confirm(`Delete custom role “${role.name}”?`)) return;
    setWorking(role.role_id);
    try {
      await request(`/api/admin-roles/${role.role_id}`, { method: 'DELETE' });
      await load();
      setNotice({ type: 'success', text: 'Custom role deleted.' });
    } catch (error) {
      setNotice({ type: 'error', text: error.message });
    } finally {
      setWorking('');
    }
  };

  if (!canManage) {
    return (
      <div className="card" style={{ maxWidth: 720 }}>
        <div className="badge badge-review">Restricted</div>
        <h2>Super Admin authority required</h2>
        <p style={{ color: 'var(--text-muted)' }}>Only a Super Admin can create administrators, assign authority, reset their passwords, or revoke access.</p>
      </div>
    );
  }

  const roleOptions = [
    ...Object.entries(builtInRoles).filter(([key]) => key !== 'superadmin').map(([key, value]) => ({ key, label: value.label })),
    ...roles.map(role => ({ key: `custom:${role.role_id}`, label: `${role.name} (custom)` }))
  ];

  return (
    <div>
      <div className="flex justify-between items-center gap-3" style={{ marginBottom: '1.5rem', flexWrap: 'wrap' }}>
        <div>
          <div style={{ color: 'var(--primary)', fontSize: '.72rem', fontWeight: 800, letterSpacing: '.14em', textTransform: 'uppercase' }}>Identity & authority</div>
          <h2 style={{ margin: '.35rem 0' }}>Administrator Access Control</h2>
          <p style={{ color: 'var(--text-muted)', margin: 0 }}>Create least-privilege teams, reset credentials, suspend accounts, and revoke sessions centrally.</p>
        </div>
        <button className="btn btn-secondary" onClick={load} disabled={working === 'load'}>Refresh</button>
      </div>

      {notice.text && <div className={`toast ${notice.type}`} style={{ position: 'static', maxWidth: 'none', marginBottom: '1rem' }}>{notice.text}</div>}

      <div className="card" style={{ marginBottom: '1rem', borderColor: 'rgba(163,5,166,.45)' }}>
        <div className="flex justify-between items-center gap-3" style={{ flexWrap: 'wrap' }}>
          <div>
            <span className="badge badge-success">Immutable root</span>
            <h3 style={{ margin: '.6rem 0 .2rem' }}>{rootAdmin?.name || 'Primary Super Admin'}</h3>
            <div style={{ color: 'var(--text-muted)' }}>{rootAdmin?.email || signedInAdmin?.email}</div>
          </div>
          <div style={{ textAlign: 'right' }}>
            <strong>Full God Mode</strong>
            <small style={{ display: 'block', color: 'var(--text-muted)' }}>Protected by deployment environment credentials</small>
          </div>
        </div>
      </div>

      <div className="grid grid-2 gap-4" style={{ alignItems: 'start' }}>
        <section className="card">
          <h3>Create administrator or moderator</h3>
          <form onSubmit={createAccount} className="flex flex-col gap-3">
            <input className="form-input" placeholder="Full name" value={accountForm.name} onChange={event => setAccountForm({ ...accountForm, name: event.target.value })} required />
            <input className="form-input" type="email" placeholder="Work email" value={accountForm.email} onChange={event => setAccountForm({ ...accountForm, email: event.target.value })} required />
            <input className="form-input" type="password" minLength={10} pattern="(?=.*[A-Za-z])(?=.*\d).{10,}" placeholder="Temporary password (10+ characters, letter + number)" value={accountForm.password} onChange={event => setAccountForm({ ...accountForm, password: event.target.value })} required />
            <select className="form-select" value={accountForm.roleKey} onChange={event => setAccountForm({ ...accountForm, roleKey: event.target.value })}>
              {roleOptions.map(option => <option key={option.key} value={option.key}>{option.label}</option>)}
            </select>
            <button className="btn btn-primary" disabled={working === 'account'}>Create secure account</button>
          </form>
        </section>

        <section className="card">
          <h3>Authority model</h3>
          <div className="flex flex-col gap-2">
            {Object.entries(builtInRoles).map(([key, role]) => (
              <div key={key} style={{ padding: '.75rem', border: '1px solid var(--border)', borderRadius: 12 }}>
                <strong>{role.label}</strong>
                <small style={{ display: 'block', color: 'var(--text-muted)' }}>{role.description}</small>
              </div>
            ))}
          </div>
        </section>
      </div>

      <section className="card" style={{ marginTop: '1rem' }}>
        <div className="flex justify-between items-center">
          <div><h3 style={{ margin: 0 }}>Managed administrators</h3><small style={{ color: 'var(--text-muted)' }}>Every authority or status change immediately invalidates old sessions.</small></div>
          <span className="badge">{accounts.length} accounts</span>
        </div>
        <div style={{ overflowX: 'auto', marginTop: '1rem' }}>
          <table className="data-table">
            <thead><tr><th>Administrator</th><th>Authority</th><th>Status</th><th>Last login</th><th>Controls</th></tr></thead>
            <tbody>
              {accounts.length === 0 && <tr><td colSpan={5} style={{ color: 'var(--text-muted)' }}>No managed administrator accounts yet.</td></tr>}
              {accounts.map(account => (
                <tr key={account.id}>
                  <td><strong>{account.name}</strong><small style={{ display: 'block' }}>{account.email}<br />{account.id}</small></td>
                  <td>
                    <select className="form-select" value={roleKey(account)} onChange={event => changeRole(account, event.target.value)} disabled={working === account.id}>
                      {roleOptions.map(option => <option key={option.key} value={option.key}>{option.label}</option>)}
                    </select>
                  </td>
                  <td>
                    <select className="form-select" value={account.status || 'Active'} onChange={event => updateAccount(account, { status: event.target.value, suspended_reason: event.target.value === 'Active' ? '' : 'Changed by Super Admin' })} disabled={working === account.id}>
                      {['Active', 'Suspended', 'Locked', 'Archived'].map(status => <option key={status}>{status}</option>)}
                    </select>
                  </td>
                  <td>{account.last_login_at ? new Date(account.last_login_at).toLocaleString() : 'Never'}</td>
                  <td>
                    <div className="flex gap-2" style={{ flexWrap: 'wrap' }}>
                      <button className="btn btn-secondary btn-sm" onClick={() => { setResetTarget(account); setTemporaryPassword(''); }}>Reset password</button>
                      <button className="btn btn-danger btn-sm" onClick={() => removeAccount(account)} disabled={working === account.id}>Remove</button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <div className="grid grid-2 gap-4" style={{ alignItems: 'start', marginTop: '1rem' }}>
        <section className="card">
          <h3>Custom roles</h3>
          {roles.length === 0 && <p style={{ color: 'var(--text-muted)' }}>No custom roles. Built-in roles are ready to use.</p>}
          <div className="flex flex-col gap-2">
            {roles.map(role => (
              <div key={role.role_id} style={{ padding: '.8rem', border: '1px solid var(--border)', borderRadius: 12 }}>
                <div className="flex justify-between items-center gap-2">
                  <div><strong>{role.name}</strong><small style={{ display: 'block', color: 'var(--text-muted)' }}>{role.description || 'No description'} · {role.permissions?.length || 0} permissions</small></div>
                  <div className="flex gap-2"><button className="btn btn-secondary btn-sm" onClick={() => editRole(role)}>Edit</button><button className="btn btn-danger btn-sm" onClick={() => deleteRole(role)}>Delete</button></div>
                </div>
              </div>
            ))}
          </div>
        </section>

        <section className="card">
          <h3>{editingRole ? 'Edit custom role' : 'Create custom role'}</h3>
          <form onSubmit={submitRole} className="flex flex-col gap-3">
            <input className="form-input" placeholder="Role name" value={roleForm.name} onChange={event => setRoleForm({ ...roleForm, name: event.target.value })} required minLength={3} />
            <textarea className="form-textarea" placeholder="What is this role responsible for?" value={roleForm.description} onChange={event => setRoleForm({ ...roleForm, description: event.target.value })} />
            <div style={{ maxHeight: 430, overflowY: 'auto', paddingRight: '.35rem' }}>
              {Object.entries(groupedPermissions).map(([group, items]) => (
                <fieldset key={group} style={{ border: '1px solid var(--border)', borderRadius: 12, marginBottom: '.75rem', padding: '.75rem' }}>
                  <legend style={{ textTransform: 'capitalize', fontWeight: 800 }}>{group}</legend>
                  {items.map(permission => (
                    <label key={permission.id} style={{ display: 'flex', gap: '.65rem', alignItems: 'flex-start', margin: '.6rem 0' }}>
                      <input type="checkbox" checked={roleForm.permissions.includes(permission.id)} onChange={() => togglePermission(permission.id)} />
                      <span><strong>{permission.label}</strong><small style={{ display: 'block', color: 'var(--text-muted)' }}>{permission.description}</small></span>
                    </label>
                  ))}
                </fieldset>
              ))}
            </div>
            <div className="flex gap-2">
              <button className="btn btn-primary" disabled={working === 'role'}>{editingRole ? 'Save role and revoke sessions' : 'Create role'}</button>
              {editingRole && <button type="button" className="btn btn-secondary" onClick={() => { setEditingRole(''); setRoleForm(emptyRole); }}>Cancel</button>}
            </div>
          </form>
        </section>
      </div>

      <section className="card" style={{ marginTop: '1rem' }}>
        <div className="flex justify-between items-center">
          <div><h3 style={{ margin: 0 }}>Administrator security audit</h3><small style={{ color: 'var(--text-muted)' }}>Recent access, design, media, and governance actions.</small></div>
          <span className="badge">{auditLogs.length} events</span>
        </div>
        <div style={{ overflowX: 'auto', marginTop: '1rem', maxHeight: 430, overflowY: 'auto' }}>
          <table className="data-table">
            <thead><tr><th>When</th><th>Actor</th><th>Action</th><th>Area</th><th>Details</th></tr></thead>
            <tbody>
              {auditLogs.length === 0 && <tr><td colSpan={5} style={{ color: 'var(--text-muted)' }}>No administrator audit events yet.</td></tr>}
              {auditLogs.map(log => (
                <tr key={log._id}>
                  <td>{new Date(log.createdAt).toLocaleString()}</td>
                  <td>{log.actor_id}<small style={{ display: 'block' }}>{log.actor_role}</small></td>
                  <td>{String(log.action || '').replaceAll('_', ' ')}</td>
                  <td>{log.order_id}</td>
                  <td><code style={{ fontSize: '.7rem', whiteSpace: 'pre-wrap' }}>{JSON.stringify(log.details || {}).slice(0, 260)}</code></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      {resetTarget && (
        <div style={{ position: 'fixed', inset: 0, background: 'var(--overlay)', zIndex: 1300, display: 'grid', placeItems: 'center', padding: '1rem' }}>
          <form onSubmit={resetPassword} className="card" style={{ width: 'min(460px, 100%)' }}>
            <h3>Reset {resetTarget.name}’s password</h3>
            <p style={{ color: 'var(--text-muted)' }}>The current password cannot be retrieved. Set a temporary replacement; all previous sessions will be revoked.</p>
            <input className="form-input" type="password" minLength={10} pattern="(?=.*[A-Za-z])(?=.*\d).{10,}" value={temporaryPassword} onChange={event => setTemporaryPassword(event.target.value)} placeholder="New temporary password (letter + number)" required />
            <div className="flex gap-2" style={{ marginTop: '1rem' }}>
              <button className="btn btn-primary">Reset and revoke</button>
              <button type="button" className="btn btn-secondary" onClick={() => setResetTarget(null)}>Cancel</button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}
