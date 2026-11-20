import React,{useCallback,useEffect,useMemo,useState} from 'react';
import {useSearchParams} from 'react-router-dom';
import {useAuth} from '../../context/AuthContext';
import {COMPANY_DEPARTMENTS,permittedCompanyPermissions,managerTeamTitle} from '../../../shared/companyGovernance.js';
import AdminIcon from './AdminIcon.jsx';

const get=async(url,options={})=>{
  const r=await fetch(url,{credentials:'same-origin',cache:'no-store',...options,
    headers:{'Content-Type':'application/json',...(options.headers||{})}});
  const d=await r.json().catch(()=>({}));
  if(!r.ok||!d.success)throw Error(d.error||'Company management request failed.');
  return d;
};
const total=m=>(m?.workload?.tasks||0)+(m?.workload?.enquiries||0)+(m?.workload?.support||0);
const labelFor=s=>s==='Invited'?'Invitation pending':s==='Suspended'?'Suspended':s==='Archived'?'Archived':s==='Active'?'Active':'Locked';
const accountTemplate={name:'',email:'',department:'client_relations',permissions:[]};

export default function AdminAccessManager(){
  const {admin,hasAdminPermission}=useAuth();
  const isRoot=Boolean(admin?.isRoot);
  const [queryParams]=useSearchParams();
  const requestedDepartment=queryParams.get('department');
  const canManage=hasAdminPermission('team.manage');
  const [team,setTeam]=useState([]);
  const [root,setRoot]=useState(null);
  const [form,setForm]=useState(()=>({...accountTemplate,
    department:COMPANY_DEPARTMENTS[requestedDepartment]?requestedDepartment:'client_relations'}));
  useEffect(()=>{if(isRoot&&COMPANY_DEPARTMENTS[requestedDepartment])
    setForm(f=>({...f,department:requestedDepartment,permissions:[]}));},[requestedDepartment,isRoot]);
  const [selected,setSelected]=useState(null);
  const [selectionPerms,setSelectionPerms]=useState([]);
  const [replacement,setReplacement]=useState('');
  const [reason,setReason]=useState('');
  const [offboard,setOffboard]=useState(false);
  const [legacyManager,setLegacyManager]=useState('');
  const [filter,setFilter]=useState('active');
  const [search,setSearch]=useState('');
  const [busy,setBusy]=useState(false);
  const [loading,setLoading]=useState(true);
  const [error,setError]=useState('');
  const [notice,setNotice]=useState('');
  const level=isRoot?'manager':'staff';
  const dept=isRoot?form.department:(admin?.department||'client_relations');
  const allowed=permittedCompanyPermissions(dept,level);
  const safePermissions=allowed.filter(p=>form.permissions.includes(p));
  const reload=useCallback(async()=>{
    setLoading(true);
    try{
      const response=await get('/api/admin/company-team/roster');
      setTeam(response.members||[]);
      setRoot(response.self||null);
      setError('');
    }catch(e){setError(e.message);}finally{setLoading(false);}
  },[]);
  useEffect(()=>{if(canManage)reload();},[canManage,reload]);

  const rows=useMemo(()=>team.filter(x=>{
    if(filter==='active'&&!['Active','Invited','Locked'].includes(x.status))return false;
    if(filter==='invited'&&x.status!=='Invited')return false;
    if(filter==='archived'&&x.status!=='Archived')return false;
    const q=search.trim().toLowerCase();
    return !q||[x.name,x.email,x.department,x.id,x.manager_id].join(' ').toLowerCase().includes(q);
  }),[team,filter,search]);
  const managers=team.filter(x=>x.company_role==='manager'&&x.status==='Active');
  const replacementCandidates=team.filter(x=>x.id!==selected?.id&&x.status==='Active'&&
    x.department===selected?.department&&
    (isRoot?x.company_role==='manager':x.company_role==='staff'&&x.manager_id===admin?.id));

  function open(target){
    setSelected(target);setSelectionPerms(target.permissions||[]);
    setReplacement('');setReason('');setOffboard(false);setError('');setNotice('');
  }
  async function invite(e){
    e.preventDefault();if(busy)return;
    setBusy(true);setError('');setNotice('');
    try{
      await get('/api/admin/company-team/invite',{method:'POST',body:JSON.stringify({
        name:form.name.trim(),email:form.email.trim(),department:dept,
        company_role:level,permissions:safePermissions.length?safePermissions:allowed
      })});
      setForm({...accountTemplate,department:dept,permissions:[]});
      await reload();
      setNotice('One-time invitation sent to the staff member. No administrator has seen or chosen their password.');
    }catch(e){setError(e.message);}finally{setBusy(false);}
  }
  async function update(updates,message){
    if(!selected||busy)return;
    setBusy(true);setError('');setNotice('');
    try{
      await get('/api/admin/company-team/members/'+encodeURIComponent(selected.id),{
        method:'PATCH',body:JSON.stringify(updates)
      });
      setSelected(null);await reload();setNotice(message);
    }catch(e){setError(e.message);}finally{setBusy(false);}
  }
  async function offboardUser(){
    if(!selected||!reason.trim()||busy)return;
    setBusy(true);setError('');setNotice('');
    try{
      await get('/api/admin/company-team/members/'+encodeURIComponent(selected.id)+'/offboard',{
        method:'POST',body:JSON.stringify({replacement_id:replacement,reason:reason.trim()})
      });
      setSelected(null);await reload();
      setNotice('Account archived, sessions revoked and outstanding work transferred where required.');
    }catch(e){setError(e.message);}finally{setBusy(false);}
  }
  async function resendInvite(){
    if(!selected||busy)return;
    setBusy(true);setError('');setNotice('');
    try{
      await get('/api/admin/company-team/members/'+encodeURIComponent(selected.id)+'/reinvite',{method:'POST'});
      setSelected(null);await reload();setNotice('New invitation sent to the existing registered staff email.');
    }catch(e){setError(e.message);}finally{setBusy(false);}
  }
  async function adopt(target){
    if(!legacyManager||busy)return;
    setBusy(true);setError('');setNotice('');
    try{
      await get('/api/admin/company-team/legacy/'+encodeURIComponent(target.id)+'/adopt',{
        method:'POST',body:JSON.stringify({manager_id:legacyManager})
      });
      setSelected(null);await reload();setNotice('Existing staff assigned to the selected manager. Previous sessions were revoked.');
    }catch(e){setError(e.message);}finally{setBusy(false);}
  }
  const toggle=p=>setForm(v=>{
    const current=v.permissions.length?v.permissions:permittedCompanyPermissions(isRoot?v.department:admin.department,level);
    return {...v,permissions:current.includes(p)?current.filter(x=>x!==p):[...current,p]};
  });
  if(!canManage)return <section className="card" style={{maxWidth:720,padding:28}}>
    <h2>Department management is restricted</h2>
    <p>You do not have team-management permission. Ask your IPS department manager for access.</p>
  </section>;

  return <section className="ips-company-people" style={{maxWidth:1520,margin:'0 auto',display:'grid',gap:19}}>
    <header className="ips-case-top">
      <div><span className="ips-eyebrow">IPS company operating system · people & authority</span>
        <h1>{isRoot?'Company management':'My department'}</h1>
        <p>{isRoot?'You are the protected root owner. You have no reporting manager. Appoint department managers, allocate their authority and oversee the company.':'Manage only your own assigned staff, duties, workload and available permissions. You cannot create managers or change ownership.'}</p>
      </div>
      <button type="button" className="btn btn-secondary" onClick={reload} disabled={loading||busy}>
        <AdminIcon name="refresh" size={16}/> {loading?'Updating…':'Refresh team'}
      </button>
    </header>
    <div className="ips-case-overview">
      <article><span>{isRoot?'Department managers':'My team members'}</span><strong>{team.filter(x=>x.company_role===level&&x.status==='Active').length}</strong></article>
      <article><span>Invitations awaiting acceptance</span><strong>{team.filter(x=>x.status==='Invited').length}</strong></article>
      <article><span>Open staff follow-ups</span><strong>{team.reduce((n,x)=>n+(x.workload?.tasks||0),0)}</strong></article>
      <article><span>Assigned client / support cases</span><strong>{team.reduce((n,x)=>n+(x.workload?.enquiries||0)+(x.workload?.support||0),0)}</strong></article>
    </div>
    <div className="ips-panel" style={{padding:22,borderLeft:'4px solid #b28e5a'}}>
      <div style={{display:'flex',alignItems:'start',gap:13}}>
        <AdminIcon name="shield" size={25}/>
        <div><strong style={{display:'block',fontSize:'.98rem'}}>{isRoot?'Protected company owner · root':'Accountable department manager'}</strong>
          <p style={{color:'var(--text-muted)',fontSize:'.82rem',lineHeight:1.6,margin:'5px 0 0'}}>
            {isRoot?'Root has no manager, cannot be deleted or offboarded, and appoints managers only. Staff report to those managers. Existing legacy staff must be deliberately assigned to a manager.':'You control your own department within the permissions granted by root. No manager can grant permissions they do not possess, delete accounts, or modify another department.'}
          </p>
        </div>
      </div>
    </div>
    {error&&<div role="alert" className="ips-panel" style={{color:'var(--danger)',padding:17,borderLeft:'4px solid var(--danger)'}}>{error}</div>}
    {notice&&<div role="status" className="ips-panel" style={{color:'var(--success)',padding:17}}>{notice}</div>}
    <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fit,minmax(min(100%,390px),1fr))',gap:17,alignItems:'start'}}>
      <section className="ips-panel" style={{padding:24}}>
        <span className="ips-eyebrow">{isRoot?'Appoint a manager':'Recruit department staff'}</span>
        <h2 style={{fontSize:'1.17rem',margin:'9px 0'}}>Invite {isRoot?'department manager':'team member'}</h2>
        <p style={{fontSize:'.78rem',color:'var(--text-muted)',lineHeight:1.6}}>
          IPS sends a time-limited private invitation to their work email. The invitee verifies mailbox access and creates their own password. An invitation never grants access until accepted.
        </p>
        <form onSubmit={invite} style={{display:'grid',gap:13,marginTop:15}}>
          <label className="form-group"><span className="form-label">Full staff name</span>
            <input className="form-input" value={form.name} onChange={e=>setForm(v=>({...v,name:e.target.value}))} placeholder="Staff member's full name" maxLength={120} minLength={2} required/></label>
          <label className="form-group"><span className="form-label">Professional email address</span>
            <input className="form-input" type="email" value={form.email} onChange={e=>setForm(v=>({...v,email:e.target.value}))} placeholder="person@example.com" required/></label>
          {isRoot?<label className="form-group"><span className="form-label">Department to lead</span>
            <select className="form-select" value={form.department} onChange={e=>setForm(v=>({...v,department:e.target.value,permissions:[]}))}>
              {Object.entries(COMPANY_DEPARTMENTS).map(([key,d])=><option key={key} value={key}>{d.label}</option>)}
            </select></label>:<div className="card" style={{padding:13}}><strong>{managerTeamTitle(admin?.department)}</strong>
              <small style={{display:'block',color:'var(--text-muted)'}}>Reports to you, not the root owner directly.</small></div>}
          <details style={{border:'1px solid var(--border)',borderRadius:12,padding:'12px 14px'}}>
            <summary style={{fontSize:'.82rem',fontWeight:750,cursor:'pointer'}}>Delegated permissions ({safePermissions.length||allowed.length} allowed)</summary>
            <p style={{fontSize:'.73rem',color:'var(--text-muted)'}}>Leave all unselected to apply the department template. Or choose a narrower role. Core workspace access is mandatory.</p>
            <div style={{display:'grid',gap:8,maxHeight:260,overflowY:'auto'}}>
              {allowed.map(p=><label key={p} style={{display:'flex',gap:9,fontSize:'.78rem',alignItems:'center'}}>
                <input type="checkbox" checked={form.permissions.length===0||form.permissions.includes(p)}
                  disabled={['platform.access','dashboard.view'].includes(p)}
                  onChange={()=>toggle(p)}/>{p.replaceAll('.',' · ')}</label>)}
            </div>
          </details>
          <button type="submit" className="btn btn-primary" disabled={busy}>{busy?'Sending invitation…':isRoot?'Invite department manager':'Invite team member'}</button>
        </form>
      </section>
      <section className="ips-panel" style={{padding:24}}>
        <span className="ips-eyebrow">Reporting responsibility</span>
        <h2 style={{fontSize:'1.17rem',margin:'9px 0'}}>Company hierarchy</h2>
        <div style={{display:'grid',gap:10,marginTop:17}}>
          <div className="card" style={{padding:'13px 17px',borderLeft:'3px solid #b38c53'}}>
            <strong>Root company owner</strong><small style={{display:'block',color:'var(--text-muted)'}}>No manager · Protected · All department oversight</small>
          </div>
          {isRoot?Object.entries(COMPANY_DEPARTMENTS).map(([dept,d])=>{
            const managers=team.filter(x=>x.company_role==='manager'&&x.department===dept&&x.status==='Active');
            return <div key={dept} className="card" style={{padding:'12px 15px'}}>
              <strong>{d.label}</strong><small style={{display:'block',color:'var(--text-muted)'}}>{managers.length?managers.map(m=>m.name).join(', '):'No active manager assigned'}</small>
            </div>;
          }):<div className="card" style={{padding:'14px 17px',borderLeft:'3px solid #4e8471'}}>
            <strong>{managerTeamTitle(admin?.department)}</strong>
            <small style={{display:'block',color:'var(--text-muted)'}}>Manager: {admin?.name||admin?.email} · {team.filter(x=>x.company_role==='staff').length} team accounts</small>
          </div>}
        </div>
      </section>
    </div>
    <section className="ips-panel" style={{overflow:'hidden'}}>
      <div className="ips-panel-head" style={{flexWrap:'wrap'}}>
        <div><span className="ips-eyebrow">People management</span><h3 style={{margin:'6px 0'}}>Company staff directory</h3>
          <p>Review authority, reporting relationships, pending invitations and active workload</p></div>
        <div style={{display:'flex',gap:8,flexWrap:'wrap'}}>
          <input className="form-input" aria-label="Search staff" placeholder="Search staff…" value={search} onChange={e=>setSearch(e.target.value)} style={{maxWidth:210}}/>
          <select className="form-select" aria-label="Staff status filter" value={filter} onChange={e=>setFilter(e.target.value)}>
            <option value="active">Active and invited</option><option value="invited">Invitations</option>
            <option value="archived">Archived</option><option value="all">All staff</option>
          </select>
        </div>
      </div>
      <div style={{overflowX:'auto'}}>
        <table className="data-table" style={{minWidth:780}}>
          <thead><tr><th>Company member</th><th>Department / manager</th><th>Status</th><th>Assigned workload</th><th>Control</th></tr></thead>
          <tbody>
            {!rows.length&&<tr><td colSpan={5} style={{padding:25,color:'var(--text-muted)'}}>No company staff match the selected view. Invite a manager or staff member above to build the structure.</td></tr>}
            {rows.map(m=><tr key={m.id}>
              <td><strong>{m.name}</strong><small style={{display:'block',color:'var(--text-muted)'}}>{m.email} · {m.company_role==='manager'?'Manager':m.company_role==='staff'?'Staff':'Legacy staff'}</small></td>
              <td>{managerTeamTitle(m.department)}<small style={{display:'block',color:'var(--text-muted)'}}>{m.manager_id?'Reports to '+(team.find(x=>x.id===m.manager_id)?.name||m.manager_id):m.company_role==='manager'?'Appointed by root':'Not yet assigned'}</small></td>
              <td>{labelFor(m.status)}</td>
              <td>{total(m)}<small style={{display:'block',color:'var(--text-muted)'}}>{m.workload?.tasks||0} tasks · {m.workload?.enquiries||0} cases · {m.workload?.support||0} support</small></td>
              <td><button type="button" className="btn btn-secondary btn-sm" onClick={()=>open(m)}>Manage</button></td>
            </tr>)}
          </tbody>
        </table>
      </div>
    </section>
    {selected&&<div role="dialog" aria-modal="true" aria-label="Manage company staff member" style={{position:'fixed',inset:0,zIndex:1200,background:'rgba(10,23,33,.77)',display:'grid',placeItems:'center',padding:15}}>
      <div className="card" style={{width:'min(660px,100%)',maxHeight:'90vh',overflowY:'auto',padding:25}}>
        <div style={{display:'flex',justifyContent:'space-between',gap:15,alignItems:'start'}}>
          <div><span className="ips-eyebrow">Company people & authority</span><h2 style={{fontSize:'1.26rem',margin:'7px 0'}}>{selected.name}</h2>
            <p style={{fontSize:'.79rem',color:'var(--text-muted)'}}>{selected.email} · {labelFor(selected.status)} · {selected.id}</p></div>
          <button className="btn btn-ghost" type="button" onClick={()=>setSelected(null)} disabled={busy}>Close</button>
        </div>
        {selected.company_role==='legacy'?<>
          <p style={{fontSize:'.86rem',color:'var(--text-muted)'}}>This account predates IPS company departments. Assign it explicitly to an approved manager before it can become normal team staff.</p>
          <label className="form-group"><span className="form-label">Assign legacy staff to an active department manager</span>
            <select className="form-select" value={legacyManager} onChange={e=>setLegacyManager(e.target.value)}>
              <option value="">Choose manager</option>{managers.map(m=><option key={m.id} value={m.id}>{m.name} · {managerTeamTitle(m.department)}</option>)}
            </select></label>
          <button className="btn btn-primary" disabled={busy||!legacyManager} onClick={()=>adopt(selected)}>Assign to manager and revoke old sessions</button>
        </>:<>
          <p className="card" style={{padding:13,fontSize:'.8rem'}}>Department: <strong>{managerTeamTitle(selected.department)}</strong>. Role: <strong>{selected.company_role}</strong>. Manager: {selected.manager_id||'Company owner (appointment)'}. Never elevate another user to root.</p>
          <div style={{display:'flex',flexWrap:'wrap',gap:10,marginBottom:14}}>
            {['Invited','Locked'].includes(selected.status)&&
              <button type="button" className="btn btn-primary" disabled={busy} onClick={resendInvite}>Resend private invitation</button>}
            {selected.status==='Active'&&<button type="button" className="btn btn-secondary" disabled={busy} onClick={()=>update({status:'Suspended',reason:'Suspended by company owner or manager'},'Staff suspended; sessions revoked.')}>Suspend access</button>}
            {selected.status==='Suspended'&&<button type="button" className="btn btn-secondary" disabled={busy} onClick={()=>update({status:'Active'},'Staff access restored.')}>Restore access</button>}
            <button type="button" className="btn btn-secondary" onClick={()=>setOffboard(x=>!x)}>Governed offboarding</button>
          </div>
          <details>
            <summary style={{cursor:'pointer',fontWeight:750,marginBottom:11}}>Review delegated permissions</summary>
            <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fit,minmax(170px,1fr))',gap:8,maxHeight:190,overflow:'auto'}}>
              {permittedCompanyPermissions(selected.department,selected.company_role).map(p=><label key={p} style={{display:'flex',gap:8,fontSize:'.76rem'}}>
                <input type="checkbox" checked={selectionPerms.includes(p)} disabled={busy||['platform.access','dashboard.view'].includes(p)}
                  onChange={()=>setSelectionPerms(a=>a.includes(p)?a.filter(x=>x!==p):[...a,p])}/>{p}</label>)}
            </div>
            <button style={{marginTop:13}} className="btn btn-primary" type="button" disabled={busy} onClick={()=>update({permissions:selectionPerms},'Permissions updated and all earlier sessions revoked.')}>Save delegated authority</button>
          </details>
          {offboard&&<div style={{padding:15,marginTop:16,border:'1px solid var(--border)',borderRadius:12,background:'var(--bg-surface-2)'}}>
            <h3 style={{fontSize:'1rem'}}>Archive without deleting records</h3>
            <p style={{fontSize:'.8rem',color:'var(--text-muted)'}}>Staff are never permanently deleted. Active tasks, enquiries and direct reports must be reassigned first. The server will refuse an unsafe offboarding.</p>
            <label className="form-group"><span className="form-label">Replacement team member</span><select className="form-select" value={replacement} onChange={e=>setReplacement(e.target.value)}>
              <option value="">No replacement (only if no outstanding work)</option>
              {replacementCandidates.map(x=><option key={x.id} value={x.id}>{x.name} · {managerTeamTitle(x.department)}</option>)}
            </select></label>
            <label className="form-group"><span className="form-label">Reason and handover record</span>
              <textarea className="form-textarea" rows={3} minLength={10} maxLength={500} value={reason} onChange={e=>setReason(e.target.value)} required placeholder="Document the agreed staff transition." /></label>
            <button className="btn btn-secondary" type="button" disabled={busy||reason.trim().length<10} onClick={offboardUser}>Archive account and revoke sessions</button>
          </div>}
        </>}
      </div>
    </div>}
  </section>;
}
