import React,{useCallback,useEffect,useMemo,useState} from 'react';
import {fmtDate} from '../../utils/formatters';

export default function AdminClients(){
  const [clients,setClients]=useState([]),[search,setSearch]=useState(''),[selected,setSelected]=useState(null);
  const [edit,setEdit]=useState({status:'Active',notes:''}),[busy,setBusy]=useState(false);
  const [error,setError]=useState(''),[notice,setNotice]=useState('');
  const [qaExcluded,setQaExcluded]=useState(0);
  const reload=useCallback(async()=>{
    try{
      const res=await fetch('/api/clients',{cache:'no-store',credentials:'same-origin'});
      const data=await res.json().catch(()=>({}));
      if(!res.ok||!data.success)throw Error(data.error||'Unable to load accounts.');
      setClients(data.clients||[]);setQaExcluded(Number(data.hidden_legacy_qa_accounts||0));setError('');
    }catch(e){setError(e.message||'Accounts are temporarily unavailable.');}
  },[]);
  useEffect(()=>{reload();},[reload]);
  const filtered=useMemo(()=>{
    const term=search.trim().toLowerCase();
    return clients.filter(c=>!term||[c.client_id,c.username,c.email,c.status].some(v=>String(v||'').toLowerCase().includes(term)));
  },[clients,search]);
  const open=client=>{
    setSelected(client);setEdit({status:client.status||'Active',notes:client.notes||''});setError('');setNotice('');
  };
  const save=async(event)=>{
    event.preventDefault();
    if(!selected||busy)return;
    setBusy(true);setError('');setNotice('');
    try{
      const res=await fetch('/api/clients/'+encodeURIComponent(selected.client_id),{
        method:'PATCH',credentials:'same-origin',headers:{'Content-Type':'application/json'},
        body:JSON.stringify({status:edit.status,notes:edit.notes})
      });
      const result=await res.json().catch(()=>({}));
      if(!res.ok||!result.success)throw Error(result.error||'Account update failed.');
      setSelected(null);setNotice('Account status and internal notes updated.');await reload();
    }catch(e){setError(e.message||'Account changes could not be saved.');}
    finally{setBusy(false);}
  };
  return <section className="ips-admin-customers" style={{maxWidth:1450,margin:'0 auto'}}>
    <div className="ips-case-top" style={{marginBottom:19}}>
      <div><span className="ips-eyebrow">Client services · private identities</span>
        <h1>Students & researchers</h1>
        <p>Manage private IPS accounts using chosen usernames and verified email addresses. Legal names and passwords are not collected by administrators at enquiry stage.</p>
      </div>
      <button type="button" className="btn btn-secondary" onClick={reload}>Refresh clients</button>
    </div>
    <div className="ips-case-overview" style={{marginBottom:19}}>
      <article><span>Client accounts</span><strong>{clients.length}</strong></article>
      <article><span>Email verified</span><strong>{clients.filter(c=>c.email_verified_at).length}</strong></article>
      <article><span>Verification pending</span><strong>{clients.filter(c=>!c.email_verified_at).length}</strong></article>
      <article><span>Active accounts</span><strong>{clients.filter(c=>c.status==='Active').length}</strong></article>
    </div>
    {qaExcluded>0&&<p className="card" role="status" style={{fontSize:'.83rem',borderLeft:'3px solid #c7a46e'}}>Archived development records ({qaExcluded}) are excluded from live IPS accounts. They were preserved for source audit, not deleted.</p>}
    <p className="card" style={{fontSize:'.85rem',lineHeight:1.6,borderLeft:'4px solid var(--primary)',marginBottom:17}}>
      Registration and email verification must be completed by the account holder.
      IPS staff cannot choose a student's password or bypass verification.
      Legal and billing details should only be requested when necessary for an agreed paid engagement.
    </p>
    {error&&<p className="card" role="alert" style={{color:'var(--danger)'}}>{error}</p>}
    {notice&&<p className="card" role="status">{notice}</p>}
    <label className="form-group" style={{maxWidth:450,marginBottom:15}}>
      <span className="form-label">Search private accounts</span>
      <input className="form-input" value={search} onChange={e=>setSearch(e.target.value)}
        placeholder="Username, account reference or verified email"/>
    </label>
    <div className="card" style={{overflowX:'auto'}}>
      <table className="data-table">
        <thead><tr><th>Account</th><th>Username</th><th>Email</th><th>Verification</th><th>Status</th><th>Registered</th><th>Action</th></tr></thead>
        <tbody>
          {filtered.length===0&&<tr><td colSpan={7}>No matching student or researcher accounts.</td></tr>}
          {filtered.map(c=><tr key={c.client_id}>
            <td style={{fontWeight:700}}>{c.client_id}</td>
            <td>{c.username||'Username not yet chosen (legacy account)'}</td>
            <td>{c.email}</td>
            <td>{c.email_verified_at?'Verified':'Pending email verification'}</td>
            <td>{c.status||'Unknown'}</td>
            <td>{fmtDate(c.registration_date)}</td>
            <td><button type="button" className="btn btn-sm btn-secondary" onClick={()=>open(c)}>Manage</button></td>
          </tr>)}
        </tbody>
      </table>
    </div>
    {selected&&<div role="dialog" aria-modal="true" aria-label="Manage private student account"
      style={{position:'fixed',inset:0,zIndex:1000,background:'rgba(0,0,0,.7)',display:'grid',placeItems:'center',padding:16}}>
      <form onSubmit={save} className="card" style={{width:'100%',maxWidth:470,maxHeight:'90vh',overflowY:'auto'}}>
        <h2>Manage Account</h2>
        <p style={{fontSize:'.85rem',color:'var(--text-muted)'}}>Reference: {selected.client_id} · Username: {selected.username||'Not set'}</p>
        <p style={{fontSize:'.83rem',color:'var(--text-muted)'}}>Email verification: {selected.email_verified_at?'Completed':'Pending'}. IPS staff cannot mark an unverified email as verified.</p>
        <label className="form-group"><span className="form-label">Account status</span>
          <select className="form-select" value={edit.status} onChange={e=>setEdit(p=>({...p,status:e.target.value}))}>
            <option value="Active">Active</option><option value="Suspended">Suspended</option><option value="Inactive">Inactive</option><option value="Pending Verification">Pending Verification</option>
          </select>
        </label>
        <label className="form-group"><span className="form-label">Internal notes (avoid unnecessary personal information)</span>
          <textarea className="form-textarea" maxLength={2000} rows={4} value={edit.notes}
            onChange={e=>setEdit(p=>({...p,notes:e.target.value}))}/>
        </label>
        <div style={{display:'flex',gap:12,flexWrap:'wrap'}}>
          <button type="submit" className="btn btn-primary" disabled={busy}>{busy?'Saving…':'Save Account'}</button>
          <button type="button" className="btn btn-ghost" disabled={busy} onClick={()=>setSelected(null)}>Cancel</button>
        </div>
      </form>
    </div>}
  </section>;
}
