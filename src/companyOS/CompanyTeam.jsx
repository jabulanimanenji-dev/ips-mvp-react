import React,{useEffect,useMemo,useState} from 'react';
import {useSearchParams} from 'react-router-dom';
import {useAuth} from '../context/AuthContext.jsx';
import {COMPANY_DEPARTMENTS,permittedCompanyPermissions} from '../../shared/companyGovernance.js';
import {PageHeading,Panel,ErrorState,Empty,Refresh,Status,useCompanyResource,companyRequest} from './data.jsx';
import {departmentCoverage,departmentNames,eligibleStaff,shortDate} from './model.js';
import AdminIcon from '../components/admin/AdminIcon.jsx';

const INITIAL={name:'',email:'',department:'client_relations',permissions:[]};
const displayRole=m=>m.company_role==='manager'?'Department manager':m.company_role==='staff'?'Staff member':'Legacy · governance review';
const workload=m=>(m.workload?.tasks||0)+(m.workload?.enquiries||0)+(m.workload?.support||0);
export default function CompanyTeam(){
  const {admin,hasAdminPermission}=useAuth();
  const [params]=useSearchParams(),initial=params.get('department');
  const isRoot=Boolean(admin?.isRoot);
  const team=useCompanyResource('/api/admin/company-team/roster','members',hasAdminPermission('team.manage'));
  const people=team.value||[];
  const coverage=departmentCoverage(people)||[];
  const [form,setForm]=useState({...INITIAL,department:Object.hasOwn(COMPANY_DEPARTMENTS,initial)?initial:'client_relations'});
  const [editing,setEditing]=useState(null),[filter,setFilter]=useState('active'),[reason,setReason]=useState(''),
    [replacement,setReplacement]=useState(''),[busy,setBusy]=useState(false),[error,setError]=useState(''),[notice,setNotice]=useState('');
  useEffect(()=>{if(isRoot&&Object.hasOwn(COMPANY_DEPARTMENTS,initial))setForm(v=>({...v,department:initial,permissions:[]}));},[initial,isRoot]);
  const department=isRoot?form.department:admin?.department;
  const role=isRoot?'manager':'staff';
  const permissions=permittedCompanyPermissions(department,role);
  const effective=useMemo(()=>form.permissions.length?permissions.filter(x=>form.permissions.includes(x)):permissions,[department,role,form.permissions.join(',')]);
  const visible=people.filter(m=>eligibleStaff(m)&&
    (filter==='all'||(filter==='active'?['Active','Invited','Locked'].includes(m.status):m.status===filter)));
  const legacy=people.filter(m=>!eligibleStaff(m));
  const managers=people.filter(m=>m.company_role==='manager'&&m.status==='Active');
  const replacements=people.filter(m=>editing&&m.id!==editing.id&&m.department===editing.department&&m.status==='Active'&&
    (isRoot?m.company_role==='manager':m.company_role==='staff'&&m.manager_id===admin?.id));
  const reset=()=>{setEditing(null);setReason('');setReplacement('');setError('');};
  async function submit(path,method,payload,success){
    if(busy)return false;setBusy(true);setError('');setNotice('');
    try{await companyRequest(path,{method,body:JSON.stringify(payload)});
      team.refresh();setNotice(success);return true;}
    catch(e){setError(e.message);return false;}
    finally{setBusy(false);}
  }
  async function invite(e){
    e.preventDefault();
    const result=await submit('/api/admin/company-team/invite','POST',{
      name:form.name.trim(),email:form.email.trim(),department,company_role:role,
      permissions:effective
    },'One-time private invitation accepted by company email. The employee chooses their own password.');
    if(result)setForm({...INITIAL,department});
  }
  async function amend(payload,success){
    if(!editing)return;
    const okay=await submit('/api/admin/company-team/members/'+encodeURIComponent(editing.id),'PATCH',payload,success);
    if(okay)reset();
  }
  async function offboard(e){
    e.preventDefault();if(reason.trim().length<10)return;
    const okay=await submit('/api/admin/company-team/members/'+encodeURIComponent(editing.id)+'/offboard',
      'POST',{reason:reason.trim(),replacement_id:replacement},'Staff access archived and sessions revoked. Assigned work transferred where applicable.');
    if(okay)reset();
  }
  const legacyAdopt=async member=>{
    const managerId=String(replacement||'');
    if(!managerId)return setError('Select an active department manager for the legacy account.');
    const okay=await submit('/api/admin/company-team/legacy/'+encodeURIComponent(member.id)+'/adopt','POST',{manager_id:managerId},'Legacy administrator converted to scoped staff. Old sessions revoked.');
    if(okay)reset();
  };
  return <>
    <PageHeading eyebrow="ORGANIZATION / AUTHORITY" title="People, authority and responsibility"
      description={isRoot?'You appoint managers. They build and govern their teams. No staff member, manager or legacy admin has authority over the sovereign root.':'Manage only employees assigned to your department and to you. You cannot create managers or grant powers outside your department.'}>
      <Refresh onClick={team.refresh} loading={team.loading}/>
    </PageHeading>
    <ErrorState error={team.error} retry={team.refresh}/>
    <ErrorState error={error} retry={()=>setError('')}/>
    {notice&&<div className="os-notice" role="status">{notice}</div>}
    {isRoot&&<div className="os-command-note" style={{marginBottom:22}}>
      <AdminIcon name="shield" size={18}/> ROOT OWNER · Outside employee hierarchy · No manager · Never staff · No self-demotion or staff-list deletion. Only the verified environment-backed owner identity can create company managers.
    </div>}
    <div className="os-split">
      <Panel title={isRoot?'Appoint department manager':'Invite authorized staff'}
        subtitle="Invitation by business email. No employee password is chosen, read or stored by a manager. The recipient verifies the one-time link.">
        <form className="os-stack" onSubmit={invite}>
          <label className="os-field">Full staff name<input className="os-input" value={form.name} onChange={e=>setForm({...form,name:e.target.value})} minLength={2} maxLength={120} required placeholder="Legal staff identity"/></label>
          <label className="os-field">Professional email<input className="os-input" type="email" value={form.email} onChange={e=>setForm({...form,email:e.target.value})} required placeholder="person@company.com"/></label>
          {isRoot?<label className="os-field">Department to lead<select className="os-input" value={department} onChange={e=>setForm({...form,department:e.target.value,permissions:[]})}>{Object.entries(departmentNames).map(([id,label])=><option key={id} value={id}>{label}</option>)}</select></label>:
            <div className="os-fact"><small>Department · fixed by your authority</small><strong>{departmentNames[department]||'No department assigned'}</strong></div>}
          <details><summary style={{fontSize:12,color:'var(--o-gold)',cursor:'pointer'}}>Permission ceiling · {effective.length} authorized capabilities</summary>
            <div className="os-fields" style={{marginTop:14}}>
              {permissions.map(p=><label key={p} style={{display:'flex',alignItems:'center',gap:9,fontSize:11,color:'var(--o-dim)'}}><input type="checkbox"
                checked={effective.includes(p)} disabled={['platform.access','dashboard.view'].includes(p)}
                onChange={e=>{const next=e.target.checked?[...effective,p]:effective.filter(x=>x!==p);setForm({...form,permissions:next});}}/>{p.replaceAll('.',' / ')}</label>)}
            </div>
          </details>
          <button type="submit" className="os-action" disabled={busy||!department||form.name.trim().length<2||!form.email.includes('@')}>
            <AdminIcon name="plus" size={16}/>{busy?'Sending…':isRoot?'Appoint by private invitation':'Invite staff under my authority'}</button>
        </form>
      </Panel>
      <Panel title="Reporting structure" subtitle={isRoot?'Every IPS department must have an accountable manager. Vacancies are surfaced, not assigned to root.':'Your team belongs to your department and can never be delegated outside its authority.'}>
        {isRoot?coverage.map(x=><div key={x.id} className="os-row">
          <div><strong>{x.label}</strong><small>{x.managers.map(m=>m.name).join(', ')||'No active department manager'} · {x.team.length} active staff</small></div>
          <Status tone={x.managers.length?'good':'warn'}>{x.managers.length?'Covered':x.pending.length?'Invited':'Vacant'}</Status>
        </div>):
          <div className="os-facts"><div className="os-fact"><small>Department</small><strong>{departmentNames[admin?.department]||'Unassigned'}</strong></div>
            <div className="os-fact"><small>Direct staff</small><strong>{visible.length}</strong></div></div>}
        {team.loading&&<Empty>Reading company roster…</Empty>}
      </Panel>
    </div>
    <div className="os-section-gap"><Panel title="Accountable team directory" subtitle="Only genuine manager and staff principals. The protected owner is not an employee and is never selectable for mutation.">
      <div className="os-pill-bar">{[['active','Current'],['Invited','Invited'],['Suspended','Suspended'],['Archived','Archived'],['all','All']].map(([v,l])=><button type="button" key={v} className="os-pill" aria-pressed={filter===v} onClick={()=>setFilter(v)}>{l}</button>)}</div>
      {!visible.length?<Empty>No staff in this filter. Appoint a manager or invite department members to establish the reporting chain.</Empty>:
      <div className="os-table-wrap"><table className="os-table"><thead><tr><th>Company member</th><th>Authority</th><th>Operational load</th><th>State</th><th>Control</th></tr></thead><tbody>
        {visible.map(m=><tr key={m.id}><td><strong>{m.name}</strong><small>{m.email}</small></td>
          <td>{displayRole(m)}<small>{departmentNames[m.department]||'Unassigned'}{m.manager_id?' · Reports to '+(people.find(x=>x.id===m.manager_id)?.name||m.manager_id):''}</small></td>
          <td>{workload(m)} open actions<small>{m.workload?.tasks||0} tasks · {m.workload?.enquiries||0} enquiries · {m.workload?.support||0} support</small></td>
          <td><Status tone={m.status==='Active'?'good':m.status==='Suspended'?'bad':'warn'}>{m.status}</Status></td>
          <td><button type="button" className="os-action secondary" onClick={()=>{setEditing(m);setError('');setNotice('');setReason('');setReplacement('');}}>Govern</button></td></tr>)}
      </tbody></table></div>}
    </Panel></div>
    {isRoot&&legacy.length>0&&<div className="os-section-gap"><Panel title="Legacy identity quarantine" subtitle="Older ungoverned administrator rows are outside the active management hierarchy. Review before explicitly converting one to a subordinate employee. They cannot become root.">
      {legacy.map(m=><div className="os-row" key={m.id}><div><strong>{m.name}</strong><small>{m.id} · Unassigned legacy authority</small></div>
        <button type="button" className="os-action quiet" onClick={()=>{setEditing({...m,legacy:true});setError('');}}>Review identity</button></div>)}
    </Panel></div>}
    {editing&&<div className="ips-os-command-shade" role="presentation" onMouseDown={e=>{if(e.target===e.currentTarget)reset();}}>
      <div className="ips-os-command" role="dialog" aria-modal="true" aria-label="Govern employee authority" style={{maxHeight:'82vh',overflow:'auto',padding:24}}>
        <div className="os-panel-head"><h2 style={{fontSize:20}}>{editing.name}</h2><button type="button" className="os-action quiet" onClick={reset}>Close</button></div>
        <p className="os-lead">{editing.email} · {displayRole(editing)} · {departmentNames[editing.department]||'Legacy account'}</p>
        {editing.legacy?<div className="os-stack"><div className="os-command-note">Legacy identity is not a company owner. Explicit assignment changes its permissions to restricted department staff and revokes old sessions. Verify the person's identity and the selected reporting relationship first.</div>
          <label className="os-field">Verified receiving manager<select className="os-input" value={replacement} onChange={e=>setReplacement(e.target.value)}><option value="">Choose active manager</option>{managers.map(m=><option key={m.id} value={m.id}>{m.name} · {departmentNames[m.department]}</option>)}</select></label>
          <button className="os-action" type="button" disabled={busy||!replacement} onClick={()=>legacyAdopt(editing)}>Convert to restricted departmental staff</button></div>:
        <div className="os-stack">
          <div className="os-facts"><div className="os-fact"><small>Workload</small><strong>{workload(editing)} active assignments</strong></div><div className="os-fact"><small>Current state</small><strong>{editing.status}</strong></div></div>
          {['Active','Suspended'].includes(editing.status)&&<>
            <button className="os-action secondary" type="button" disabled={busy} onClick={()=>amend({status:editing.status==='Active'?'Suspended':'Active',reason:'Authorized company authority review'},editing.status==='Active'?'Staff suspended and sessions revoked.':'Staff reactivated.')} >
              {editing.status==='Active'?'Suspend company access':'Reactivate company access'}</button>
            <div className="os-command-note">Changes are audited. Suspending access does not erase a person's work history or assigned cases.</div>
          </>}
          {['Invited','Locked'].includes(editing.status)&&<button className="os-action" type="button" disabled={busy} onClick={async()=>{const ok=await submit('/api/admin/company-team/members/'+encodeURIComponent(editing.id)+'/reinvite','POST',{},'Private onboarding invitation reissued.');if(ok)reset();}}>Reissue one-time invite</button>}
          {editing.status!=='Archived'&&<form className="os-stack" onSubmit={offboard}>
            <h3>Governed offboarding</h3><p className="os-panel-sub">A replacement must be selected when open cases or reporting relationships need transferring. Accounts are archived, not deleted.</p>
            <label className="os-field">Replacement in same department<select className="os-input" value={replacement} onChange={e=>setReplacement(e.target.value)}><option value="">None — only when no outstanding work</option>{replacements.map(m=><option key={m.id} value={m.id}>{m.name}</option>)}</select></label>
            <label className="os-field">Documented reason (minimum 10 characters)<textarea className="os-input" value={reason} onChange={e=>setReason(e.target.value)} minLength={10} maxLength={500} required/></label>
            <button className="os-action danger" type="submit" disabled={busy||reason.trim().length<10}>Archive access with verified work transfer</button>
          </form>}
        </div>}
        <ErrorState error={error}/>
      </div>
    </div>}
  </>;
}
