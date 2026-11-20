import React,{useEffect,useMemo,useState} from 'react';
import {useSearchParams} from 'react-router-dom';
import {useAuth} from '../context/AuthContext.jsx';
import {COMPANY_DEPARTMENTS,permittedCompanyPermissions} from '../../shared/companyGovernance.js';
import {useFeed,useAction,Title,Panel,Button,Tag,Notice,Empty,Dialog,GroupTotals,Feedback} from './core.jsx';

const departments=Object.entries(COMPANY_DEPARTMENTS);
const labelFor=d=>COMPANY_DEPARTMENTS[d]?.label||d||'Unassigned';
const active=x=>x.status==='Active';
const workload=x=>Number(x.workload?.tasks||0)+Number(x.workload?.enquiries||0)+Number(x.workload?.support||0);
export default function Workforce(){
  const {admin,hasAdminPermission}=useAuth();
  const isRoot=Boolean(admin?.isRoot);
  const [params]=useSearchParams();
  const initial=params.get('department');
  const team=useFeed('/api/admin/company-team/roster','members',hasAdminPermission('team.manage'));
  const action=useAction(team.refresh);
  const people=(team.records||[]).filter(x=>['manager','staff'].includes(x.company_role));
  const historical=(team.records||[]).filter(x=>!['manager','staff'].includes(x.company_role));
  const [filter,setFilter]=useState('working'),[department,setDepartment]=useState(isRoot&&COMPANY_DEPARTMENTS[initial]?initial:'client_relations'),
    [name,setName]=useState(''),[email,setEmail]=useState(''),[chosen,setChosen]=useState(null),
    [modal,setModal]=useState('person'),[reason,setReason]=useState(''),[replacement,setReplacement]=useState(''),
    [permissions,setPermissions]=useState(null),[busy,setBusy]=useState(false);
  useEffect(()=>{if(isRoot&&COMPANY_DEPARTMENTS[initial])setDepartment(initial);},[initial,isRoot]);
  const targetDepartment=isRoot?department:admin?.department;
  const targetLevel=isRoot?'manager':'staff';
  const ceiling=permittedCompanyPermissions(targetDepartment,targetLevel);
  const grant=permissions===null?ceiling:ceiling.filter(x=>permissions.includes(x));
  const roster=useMemo(()=>people.filter(x=>filter==='all'||(filter==='working'?
    ['Active','Invited','Locked'].includes(x.status):x.status===filter)),[team.records,filter]);
  const managerMap=new Map(people.filter(x=>x.company_role==='manager').map(x=>[x.id,x.name]));
  const activeManagers=people.filter(x=>x.company_role==='manager'&&active(x));
  const coverage=departments.map(([id,info])=>({id,info,managers:people.filter(x=>x.department===id&&x.company_role==='manager'&&active(x)),
    pending:people.filter(x=>x.department===id&&x.company_role==='manager'&&x.status==='Invited'),
    staff:people.filter(x=>x.department===id&&x.company_role==='staff'&&active(x))}));
  const replacements=people.filter(x=>chosen&&x.id!==chosen.id&&x.department===chosen.department&&active(x)&&
    (isRoot?x.company_role==='manager':x.company_role==='staff'&&x.manager_id===admin?.id));
  const reset=()=>{setChosen(null);setModal('person');setReason('');setReplacement('');setPermissions(null);action.setError('');};
  async function invite(e){
    e.preventDefault();if(name.trim().length<2||!email.includes('@')||!targetDepartment)return;
    const ok=await action.run('/api/admin/company-team/invite','POST',
      {name:name.trim(),email:email.trim(),department:targetDepartment,company_role:targetLevel,
        permissions:grant},'A private one-time staff invitation was accepted by the company mail provider. The recipient sets their own password.');
    if(ok){setName('');setEmail('');setPermissions(null);}
  }
  async function mutate(path,method,payload,message){
    const ok=await action.run(path,method,payload,message);
    if(ok)reset();
  }
  const memberPath=id=>'/api/admin/company-team/members/'+encodeURIComponent(id);
  return <>
    <Title kicker="PEOPLE OPERATIONS / DELEGATED AUTHORITY" title={isRoot?'Nyoro’s company management structure':'Your department and people'}
      description={isRoot?'Root Admin appoints department managers; department managers build and govern their own staff. The Root Admin has no manager and is not a staff record.':
        'A department manager governs only their own direct reports, their status, assigned work and permitted functions.'}
      actions={<Button onClick={team.refresh} disabled={team.busy}>Refresh company people</Button>}/>
    {team.error&&<Notice kind="danger">{team.error}</Notice>}
    <Feedback error={action.error} notice={action.notice}/>
    {isRoot&&<div className="ips4-note info" style={{marginBottom:20}}>
      <strong>NYORO · ROOT ADMIN · SOVEREIGN IDENTITY</strong> — outside employee and management lists, no superior, never assigned to another department and never eligible for employee suspension or deletion. Only you create department managers.
    </div>}
    <GroupTotals items={[{label:'Company departments',value:departments.length,hint:'Distinct responsibility domains'},
      {label:'Active accountable managers',value:team.available?activeManagers.length:null,hint:'Only real appointed management'},
      {label:'Active company staff',value:team.available?people.filter(x=>x.company_role==='staff'&&active(x)).length:null,hint:'Excludes Nyoro, Root Admin'},
      {label:'Management gaps',value:team.available?coverage.filter(x=>!x.managers.length).length:null,hint:'Root must appoint management',tone:'attention'}]}/>
    <div className="ips4-grid split">
      <Panel title={isRoot?'Appoint an actual department manager':'Invite a member of your staff'}
        description="Authorized invitation by work email. The employee opens their own one-time onboarding link and creates a private password.">
        <form className="ips4-form" onSubmit={invite}>
          <label className="ips4-field">Full professional name
            <input required minLength={2} maxLength={120} autoComplete="name" placeholder="Registered staff identity" value={name} onChange={e=>setName(e.target.value)}/></label>
          <label className="ips4-field">Verified professional email address
            <input required type="email" placeholder="staff@company.example" value={email} onChange={e=>setEmail(e.target.value)}/></label>
          {isRoot?<label className="ips4-field">Department to manage
            <select value={department} onChange={e=>{setDepartment(e.target.value);setPermissions(null);}}>
              {departments.map(([id,info])=><option value={id} key={id}>{info.label}</option>)}
            </select></label>:<div className="ips4-fact"><small>Your fixed department</small><strong>{labelFor(targetDepartment)}</strong></div>}
          <details className="ips4-note info"><summary style={{cursor:'pointer',fontWeight:800}}>Permission ceiling — {grant.length} permitted capabilities</summary>
            <div className="ips4-fields" style={{paddingTop:14}}>{ceiling.map(permission=>
              <label style={{display:'flex',alignItems:'center',gap:9,fontSize:11}} key={permission}>
                <input type="checkbox" checked={grant.includes(permission)} disabled={['platform.access','dashboard.view'].includes(permission)}
                  onChange={e=>setPermissions(v=>{
                    const base=v===null?[...ceiling]:v;
                    return e.target.checked?[...base,permission]:base.filter(p=>p!==permission);
                  })}/>{permission}</label>)}</div>
          </details>
          <div className="ips4-note">Root creates managers only. Managers create staff only. No one invites another root account or sets an employee password.</div>
          <Button kind="gold" type="submit" disabled={action.pending||name.trim().length<2||!email.includes('@')||!targetDepartment}>
            {action.pending?'Sending invitation…':isRoot?'Invite department manager':'Invite my staff member'}</Button>
        </form>
      </Panel>
      <Panel title="Reporting coverage" description={isRoot?'Your seven company departments need actual accountable managers.':'Your manager status, direct reports and operational remit are fixed by delegated authority.'}>
        {team.busy&&!team.available?<Empty>Loading signed company roster…</Empty>:coverage.map(c=>
          <div className="ips4-row" key={c.id}><div className="ips4-row-text"><strong>{c.info.label}</strong>
            <small>{c.managers.map(x=>x.name).join(', ')||'No active accountable manager'} · {c.staff.length} staff</small></div>
            <Tag tone={c.managers.length?'good':'warn'}>{c.managers.length?'Covered':c.pending.length?'Invitation pending':'Vacant'}</Tag></div>)}
      </Panel>
    </div>
    <div style={{marginTop:20}}><Panel title="Governed people directory" description="Only employee principals. Root Admin never appears as a manageable staff account.">
      <div className="ips4-toolbar">{[['working','Current'],['Invited','Invitations'],['Suspended','Suspended'],['Archived','Archived'],['all','Entire directory']].map(([v,l])=>
        <button type="button" className="ips4-tab" key={v} aria-pressed={filter===v} onClick={()=>setFilter(v)}>{l}</button>)}</div>
      {!team.available?<Empty>Reading company employees with delegated permission checks…</Empty>:!roster.length?<Empty>No people match this directory state. Use a verified employee invitation to establish department leadership.</Empty>:
      <div className="ips4-table-wrap"><table className="ips4-table"><thead><tr><th>Company employee</th><th>Reports to</th><th>Responsibility</th><th>Operational load</th><th>Account</th><th>Controls</th></tr></thead><tbody>
        {roster.map(p=><tr key={p.id}><td><strong>{p.name}</strong><small>{p.email}</small></td>
          <td><strong>{p.company_role==='manager'?'Nyoro · Root Admin':managerMap.get(p.manager_id)||'Assigned manager'}</strong><small>{p.company_role==='manager'?'Direct leadership': 'Departmental staff'}</small></td>
          <td>{labelFor(p.department)}<small>{p.permissions?.length||0} delegated capabilities</small></td>
          <td>{workload(p)} open responsibilities<small>{p.workload?.tasks||0} tasks · {p.workload?.enquiries||0} enquiries · {p.workload?.support||0} support</small></td>
          <td><Tag tone={p.status==='Active'?'good':p.status==='Suspended'?'danger':'warn'}>{p.status}</Tag></td>
          <td><Button onClick={()=>{setChosen(p);setModal('person');action.setError('');}}>Govern employee</Button></td>
        </tr>)}
      </tbody></table></div>}
    </Panel></div>
    {isRoot&&historical.length>0&&<div style={{marginTop:20}}><Panel title="Legacy access quarantine" description="Historic administrator identities remain separate until root explicitly evaluates and adopts them into a subordinate department.">
      {historical.map(p=><div className="ips4-row" key={p.id}><div><strong>{p.name}</strong><small>{p.id} · Legacy, unscoped administrator</small></div>
        <Button onClick={()=>{setChosen({...p,legacy:true});setModal('legacy');}}>Review controlled adoption</Button></div>)}
    </Panel></div>}
    {chosen&&<Dialog title={chosen.name||'Company member'} subtitle={(chosen.email||'')+' · '+labelFor(chosen.department)} onClose={reset}>
      <div className="ips4-detail-facts">
        {[[ 'Authority',chosen.company_role==='manager'?'Department Manager':chosen.company_role==='staff'?'Staff Member':'Legacy Identity'],
          ['Account status',chosen.status],['Open workload',workload(chosen)],['Management line',
          chosen.company_role==='manager'?'Nyoro · Root Admin':managerMap.get(chosen.manager_id)||'Requires manager']].map(([l,v])=>
          <div className="ips4-fact" key={l}><small>{l}</small><strong>{v}</strong></div>)}
      </div>
      {chosen.legacy?<div className="ips4-stack">
        <div className="ips4-note">Old ungoverned administrators are not root. A root-authorized adoption limits their permissions, assigns a manager and revokes old sessions.</div>
        <label className="ips4-field">Verified accountable receiving manager<select value={replacement} onChange={e=>setReplacement(e.target.value)}>
          <option value="">Select an active manager</option>{activeManagers.map(m=><option key={m.id} value={m.id}>{m.name} · {labelFor(m.department)}</option>)}</select></label>
        <Button kind="gold" disabled={!replacement||action.pending} onClick={()=>mutate('/api/admin/company-team/legacy/'+encodeURIComponent(chosen.id)+'/adopt',
          'POST',{manager_id:replacement},'Legacy identity converted to scoped staff; old sessions invalidated.')}>Convert to governed department staff</Button>
      </div>:<div className="ips4-stack">
        {['Active','Suspended'].includes(chosen.status)&&<Button kind={chosen.status==='Active'?'danger':'neutral'} disabled={action.pending} onClick={()=>
          mutate('/api/admin/company-team/members/'+encodeURIComponent(chosen.id),'PATCH',
            {status:chosen.status==='Active'?'Suspended':'Active',reason:'Authorized IPS staff governance and access review'},
            chosen.status==='Active'?'Employee account suspended, sessions revoked.':'Employee account restored under their existing authority.')}>
          {chosen.status==='Active'?'Suspend employee access':'Restore employee access'}</Button>}
        {['Invited','Locked'].includes(chosen.status)&&<Button kind="gold" disabled={action.pending} onClick={()=>
          mutate('/api/admin/company-team/members/'+encodeURIComponent(chosen.id)+'/reinvite','POST',{},
            'One-time onboarding invitation reissued to the employee email.')}>Reissue private employee invitation</Button>}
        {chosen.status!=='Archived'&&<form className="ips4-form" onSubmit={e=>{
          e.preventDefault();if(reason.trim().length<10)return;
          void mutate('/api/admin/company-team/members/'+encodeURIComponent(chosen.id)+'/offboard','POST',
            {reason:reason.trim(),replacement_id:replacement},
            'Employee archived; sessions revoked. Assigned cases transferred where required.');}}>
          <h3>Governed departure and work handover</h3>
          <div className="ips4-note">The system refuses offboarding with outstanding cases unless another approved colleague in the department receives them. Employee records are retained for audit.</div>
          <label className="ips4-field">Replacement accountable person<select value={replacement} onChange={e=>setReplacement(e.target.value)}>
            <option value="">None — only allowed with zero outstanding work</option>{replacements.map(m=><option key={m.id} value={m.id}>{m.name}</option>)}</select></label>
          <label className="ips4-field">Mandatory documented offboarding reason<textarea minLength={10} maxLength={500} required value={reason} onChange={e=>setReason(e.target.value)}/></label>
          <Button kind="danger" type="submit" disabled={action.pending||reason.trim().length<10}>Archive access and verify handover</Button>
        </form>}
      </div>}
      <Feedback error={action.error} notice={action.notice}/>
    </Dialog>}
  </>;
}
