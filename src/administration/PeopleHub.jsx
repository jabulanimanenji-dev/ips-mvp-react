import React,{useMemo,useState} from 'react';
import {useAuth} from '../context/AuthContext.jsx';
import {isIpsQaFixtureClient,isIpsQaFixtureEmail} from '../../shared/ipsCompanyScope.js';
import {useFeed,useAction,Title,Panel,Button,Dialog,Tag,Notice,Empty,Feedback,GroupTotals,LinkButton} from './core.jsx';

function ResetLink({kind,record,close,after}){
  const [reason,setReason]=useState('');
  const action=useAction(after);
  const id=kind==='client'?record.client_id:record.writer_id;
  const endpoint=kind==='client'?'/api/admin/clients/'+encodeURIComponent(id)+'/password-recovery':
    '/api/admin/specialists/'+encodeURIComponent(id)+'/password-recovery';
  const verified=Boolean(record.email_verified_at);
  return <form className="ips4-form" onSubmit={async e=>{
    e.preventDefault();if(reason.trim().length<10)return;
    const ok=await action.run(endpoint,'POST',{reason:reason.trim()},
      'IPS submitted a one-time reset link to the verified registered email. Only the recipient can choose and confirm a password.');
    if(ok)close();
  }}>
    <div className="ips4-note info">
      Authorized assistance only. A reset link goes to the account's verified email, opens a protected page with <b>New password</b> and <b>Confirm password</b>, invalidates older sessions, and signs eligible users into their own workspace. The link never appears here.
    </div>
    <div className="ips4-row"><div><strong>Registered email</strong><small>{record.email||'Not available'}</small></div>
      <Tag tone={verified?'good':'warn'}>{verified?'Verified':'Verification incomplete'}</Tag></div>
    {!verified&&<div className="ips4-note">Email ownership is not yet proved. IPS automatically sends a verification link during signup, and resends on a valid unverified login when the cooldown permits. Staff must not bypass that proof.</div>}
    {verified&&<><label className="ips4-field">Document the client's requested assistance and reason
      <textarea required minLength={10} maxLength={500} value={reason} onChange={e=>setReason(e.target.value)} placeholder="E.g. Account holder requested an emailed password reset following failed sign-in."/>
    </label>
    <Button kind="gold" type="submit" disabled={action.pending||reason.trim().length<10}>Send private password reset link</Button></>}
    <Feedback error={action.error} notice={action.notice}/>
  </form>;
}

export function ClientRegistry(){
  const {hasAdminPermission}=useAuth();
  const feed=useFeed('/api/clients','clients',hasAdminPermission('clients.view'));
  const [search,setSearch]=useState(''),[filter,setFilter]=useState('all'),[focus,setFocus]=useState(null),[mode,setMode]=useState('view'),
    [status,setStatus]=useState('Active'),[notes,setNotes]=useState('');
  const action=useAction(feed.refresh);
  const records=(feed.records||[]).filter(x=>!isIpsQaFixtureClient(x));
  const verified=records.filter(x=>x.status==='Active'&&x.email_verified_at).length;
  const visible=records.filter(x=>(filter==='all'||(filter==='verified'?x.email_verified_at&&x.status==='Active':
    filter==='pending'?!x.email_verified_at:filter==='restricted'?x.status!=='Active':true))&&
    [x.username,x.client_id,x.email,x.status].join(' ').toLowerCase().includes(search.trim().toLowerCase()));
  const open=(r,next='view')=>{setFocus(r);setStatus(r.status||'Active');setNotes(r.notes||'');setMode(next);action.setError('');action.setNotice('');};
  const dismiss=()=>{setFocus(null);setMode('view');};
  return <>
    <Title kicker="CLIENT RELATIONS / PRIVATE IDENTITIES" title="Clients — real account care"
      description="Customers choose a pseudonym. Registration emails verify themselves, account recovery is private, and authorized employees handle account restrictions with an audit trail."
      actions={<Button onClick={feed.refresh} disabled={feed.busy}>Refresh clients</Button>}/>
    {feed.error&&<Notice kind="danger">{feed.error}</Notice>}
    <Feedback error={action.error} notice={action.notice}/>
    <GroupTotals items={[
      {label:'Client identities',value:feed.available?records.length:null,hint:'Live records, excluding evaluation fixtures'},
      {label:'Verified and eligible',value:feed.available?verified:null,hint:'Email ownership + active account'},
      {label:'Awaiting email proof',value:feed.available?records.filter(x=>!x.email_verified_at).length:null,hint:'Automated one-click confirmation',tone:'attention'},
      {label:'Restricted',value:feed.available?records.filter(x=>x.status!=='Active').length:null,hint:'Suspended, inactive or pending states'}
    ]}/>
    <Panel title="Private client register" description="The legal identity is not collected for ordinary registration. Passwords and reset tokens never appear in this directory.">
      <div className="ips4-toolbar">
        <input type="search" aria-label="Find clients" placeholder="Find private username, email or client reference…" value={search} onChange={e=>setSearch(e.target.value)}/>
        {[['all','All'],['verified','Eligible'],['pending','Awaiting verification'],['restricted','Restricted']].map(([value,label])=><button className="ips4-tab" key={value} type="button" aria-pressed={filter===value} onClick={()=>setFilter(value)}>{label}</button>)}
      </div>
      {!feed.available?<Empty>{feed.busy?'Loading real client records…':'No permitted client data available.'}</Empty>:
        !visible.length?<Empty>No clients match the chosen filter or search.</Empty>:
        <div className="ips4-table-wrap"><table className="ips4-table"><thead><tr><th>Private client</th><th>Email verification</th><th>Access</th><th>Care action</th></tr></thead><tbody>
        {visible.map(c=><tr key={c.client_id}><td><strong>{c.username||'Private identity'}</strong><small>{c.client_id} · {c.email}</small></td>
          <td><Tag tone={c.email_verified_at?'good':'warn'}>{c.email_verified_at?'Email verified':'Link pending'}</Tag></td>
          <td><Tag tone={c.status==='Active'&&c.email_verified_at?'good':c.status==='Suspended'?'danger':'warn'}>{c.status==='Active'&&!c.email_verified_at?'Not yet verified':c.status||'Unknown'}</Tag></td>
          <td><Button onClick={()=>open(c)}>Open client record</Button></td></tr>)}
        </tbody></table></div>}
    </Panel>
    {focus&&<Dialog title={focus.username||'Private client'} subtitle={focus.client_id+' · Confidential account management'} onClose={dismiss}>
      <div className="ips4-toolbar">
        {[['view','Account'],['reset','Password assistance'],['manage','Account restrictions']].map(([v,label])=>
          <button className="ips4-tab" key={v} type="button" aria-pressed={mode===v} onClick={()=>setMode(v)}
            disabled={v==='manage'&&!hasAdminPermission('clients.manage')||v==='reset'&&!hasAdminPermission('clients.recovery')}>{label}</button>)}
      </div>
      <div className="ips4-detail-facts">
        {[[ 'Pseudonymous reference',focus.client_id],['Email ownership',focus.email_verified_at?'Confirmed':'Not yet confirmed'],
          ['Account state',focus.status||'Unknown'],['Contact',focus.email||'Not supplied']].map(([label,value])=><div className="ips4-fact" key={label}><small>{label}</small><strong>{value}</strong></div>)}
      </div>
      {mode==='view'&&<div className="ips4-stack">
        {focus.email_verified_at?<Notice>The recipient can reset their own password from the public recovery page. Staff may initiate a secure email on request.</Notice>:
          <div className="ips4-note">The account is not verified. The system sends an email link on registration and again after a correct unverified login, respecting provider cooldown. A manager must not manually declare this email genuine.</div>}
        <div className="ips4-row"><div><strong>Confidentiality</strong><small>No legal name is required before paid engagement. Staff never read or choose client passwords.</small></div><Tag>Protected</Tag></div>
        {hasAdminPermission('clients.recovery')&&<Button kind="gold" onClick={()=>setMode('reset')}>Account-holder password recovery →</Button>}
      </div>}
      {mode==='reset'&&<ResetLink kind="client" record={focus} close={dismiss} after={feed.refresh}/>}
      {mode==='manage'&&<form className="ips4-form" onSubmit={async e=>{e.preventDefault();const ok=await action.run('/api/clients/'+encodeURIComponent(focus.client_id),'PATCH',{status,notes},
          'The client restriction and private notes were saved.');if(ok)dismiss();}}>
        <div className="ips4-note">Restrictions do not verify an email address or reveal a password. The client must complete their own proof-of-mailbox process.</div>
        <label className="ips4-field">Account restriction<select value={status} onChange={e=>setStatus(e.target.value)}><option>Active</option><option>Suspended</option><option>Pending Verification</option></select></label>
        <label className="ips4-field">Private management notes<textarea maxLength={2000} value={notes} onChange={e=>setNotes(e.target.value)}/></label>
        <Button type="submit" kind="gold" disabled={action.pending}>Save governed account decision</Button>
        <Feedback error={action.error}/>
      </form>}
    </Dialog>}
  </>;
}

export function SpecialistRegistry(){
  const {hasAdminPermission}=useAuth();
  const feed=useFeed('/api/writers','writers',hasAdminPermission('providers.view'));
  const action=useAction(feed.refresh);
  const [search,setSearch]=useState(''),[filter,setFilter]=useState('all'),[focus,setFocus]=useState(null),[mode,setMode]=useState('review'),
    [decision,setDecision]=useState('more_information'),[reason,setReason]=useState('');
  const records=(feed.records||[]).filter(x=>!isIpsQaFixtureEmail(x.email));
  const ready=x=>x.status==='Active'&&x.application_status==='approved'&&Boolean(x.email_verified_at);
  const visible=records.filter(x=>(filter==='all'||(filter==='ready'?ready(x):filter==='pending'?
    x.application_status==='pending':filter==='verification'?!x.email_verified_at:x.status!=='Active'))&&
    [x.full_name,x.writer_id,x.email,x.primary_expertise].join(' ').toLowerCase().includes(search.toLowerCase()));
  const open=(w)=>{setFocus(w);setMode('review');setDecision(w.application_status==='approved'?'more_information':'approved');setReason('');action.setError('');action.setNotice('');};
  const close=()=>{setFocus(null);setMode('review');};
  const eligible=records.filter(ready).length;
  return <>
    <Title kicker="SPECIALIST NETWORK / HUMAN QUALIFICATION" title="Specialists — verified and accountable"
      description="Real full-name identities, applications, qualified services, verified email, availability, private recovery and controlled specialist assignment."
      actions={<Button onClick={feed.refresh} disabled={feed.busy}>Refresh specialists</Button>}/>
    <Feedback error={feed.error||action.error} notice={action.notice}/>
    <GroupTotals items={[{label:'Specialist identities',value:feed.available?records.length:null,hint:'Self-registered accounts'},
      {label:'Assignment eligible',value:feed.available?eligible:null,hint:'Approved + verified email + active'},
      {label:'Missing email ownership',value:feed.available?records.filter(w=>!w.email_verified_at).length:null,hint:'Verification link must be opened by specialist',tone:'attention'},
      {label:'Requires review',value:feed.available?records.filter(w=>['pending','more_information'].includes(w.application_status)).length:null,hint:'Professional qualification decisions',tone:'gold'}]}/>
    <Panel title="Specialist application and account register" description="IPS reviewers approve skills and availability, not email ownership. Staff do not create specialist passwords.">
      <div className="ips4-toolbar"><input type="search" aria-label="Find specialist" placeholder="Find legal name, registered email, skill or specialist reference…" value={search} onChange={e=>setSearch(e.target.value)}/>
        {[['all','All'],['ready','Eligible'],['pending','Applications'],['verification','Awaiting email'],['inactive','Restricted']].map(([v,l])=><button type="button" className="ips4-tab" key={v} aria-pressed={v===filter} onClick={()=>setFilter(v)}>{l}</button>)}</div>
      {!feed.available?<Empty>Reading the verified specialist register…</Empty>:!visible.length?<Empty>No specialists match the selected criteria.</Empty>:
        <div className="ips4-table-wrap"><table className="ips4-table"><thead><tr><th>Specialist identity</th><th>Academic expertise</th><th>Application</th><th>Eligible</th><th>Authority</th></tr></thead><tbody>
        {visible.map(w=><tr key={w.writer_id}><td><strong>{w.full_name}</strong><small>{w.email} · {w.writer_id}</small></td>
          <td>{w.primary_expertise||'Not provided'}<small>{w.academic_level||'No academic level'}</small></td>
          <td>{w.application_status||'pending'}<small>{w.email_verified_at?'Email confirmed':'Verification pending'}</small></td>
          <td><Tag tone={ready(w)?'good':'warn'}>{ready(w)?'Qualified and active':'Not assignment-ready'}</Tag></td>
          <td><Button onClick={()=>open(w)}>Review specialist</Button></td></tr>)}
        </tbody></table></div>}
    </Panel>
    {focus&&<Dialog title={focus.full_name||'Specialist'} subtitle={'Professional specialist record · '+focus.writer_id} onClose={close}>
      <div className="ips4-toolbar">{[['review','Qualification'],['reset','Password assistance'],['status','Availability']].map(([v,l])=><button className="ips4-tab" type="button" key={v} aria-pressed={mode===v}
        disabled={!hasAdminPermission('providers.manage')&&v!=='review'} onClick={()=>setMode(v)}>{l}</button>)}</div>
      <div className="ips4-detail-facts">
        {[[ 'Professional email',focus.email],['Email proof',focus.email_verified_at?'Verified':'Unverified'],['Application',focus.application_status],
          ['Account',focus.status],['Expertise',focus.primary_expertise||'Not supplied'],['Academic level',focus.academic_level||'Unconfirmed']].map(([k,v])=>
          <div className="ips4-fact" key={k}><small>{k}</small><strong>{v||'Not supplied'}</strong></div>)}
      </div>
      {mode==='review'&&<div className="ips4-stack">
        {!focus.email_verified_at&&<div className="ips4-note">This applicant has not proved mailbox ownership. IPS sends their secure verification link automatically; staff cannot mark the address verified or approve eligibility around that gate.</div>}
        {focus.cv_stored_name&&<a className="ips4-btn" href={'/api/provider/applications/'+encodeURIComponent(focus.writer_id)+'/cv'} target="_blank" rel="noopener noreferrer">Inspect authenticated professional CV ↗</a>}
        {hasAdminPermission('providers.manage')&&<form className="ips4-form" onSubmit={async e=>{e.preventDefault();
          const ok=await action.run('/api/provider/applications/'+encodeURIComponent(focus.writer_id),'PATCH',
            {decision,rejection_reason:decision==='rejected'?reason.trim():'',admin_notes:decision!=='rejected'?reason.trim():''},
            'Specialist qualification decision recorded. Verified account eligibility controls access.');if(ok)close();}}>
          <label className="ips4-field">Qualification decision<select value={decision} onChange={e=>setDecision(e.target.value)}>
            <option value="approved" disabled={!focus.email_verified_at}>Approve verified qualification</option>
            <option value="more_information">Request more information</option><option value="rejected">Reject application</option>
          </select></label>
          <label className="ips4-field">Review notes and documented decision<textarea minLength={decision==='rejected'?10:0} maxLength={1500} value={reason} onChange={e=>setReason(e.target.value)}/></label>
          <Button type="submit" kind="gold" disabled={action.pending||decision==='approved'&&!focus.email_verified_at||
            decision==='rejected'&&reason.trim().length<10}>Save qualification decision</Button>
          <Feedback error={action.error}/>
        </form>}
      </div>}
      {mode==='reset'&&<ResetLink kind="writer" record={focus} close={close} after={feed.refresh}/>}
      {mode==='status'&&<div className="ips4-stack">
        <div className="ips4-note">A professional account may be paused or restored only by authorized specialist management. This does not bypass email proof or application review.</div>
        <Button kind={focus.status==='Active'?'danger':'gold'} disabled={action.pending} onClick={async()=>{
          const next=focus.status==='Active'?'On Leave':'Active';
          const ok=await action.run('/api/writers/'+encodeURIComponent(focus.writer_id),'PATCH',{status:next},
            'Specialist availability updated.');if(ok)close();
        }}>{focus.status==='Active'?'Pause specialist availability':'Restore specialist availability'}</Button>
        <Feedback error={action.error}/>
      </div>}
    </Dialog>}
  </>;
}
