import React,{useMemo,useState} from 'react';
import {Link} from 'react-router-dom';
import {useAuth} from '../context/AuthContext.jsx';
import {isIpsQaFixtureClient,isIpsQaFixtureEmail,isIpsAcademicProject} from '../../shared/ipsCompanyScope.js';
import {allowedAdminServiceStatuses} from '../../shared/serviceTransitions.js';
import {PageHeading,Panel,ErrorState,Empty,Refresh,Status,useCompanyResource,companyRequest} from './data.jsx';
import {clientState,specialistState,readyClient,readySpecialist,shortDate} from './model.js';
import AdminIcon from '../components/admin/AdminIcon.jsx';

const money=(value,currency='PLN')=>Number.isFinite(Number(value))&&Number(value)>0?
  new Intl.NumberFormat('en-GB',{style:'currency',currency}).format(Number(value)):'Not issued';

export function CompanyClients(){
  const {hasAdminPermission}=useAuth();
  const source=useCompanyResource('/api/clients','clients');
  const manage=hasAdminPermission('clients.manage'),recover=hasAdminPermission('clients.recovery');
  const [term,setTerm]=useState(''),[state,setState]=useState('all'),[selected,setSelected]=useState(null),
    [notes,setNotes]=useState(''),[status,setStatus]=useState('Active'),[reason,setReason]=useState(''),
    [intent,setIntent]=useState(''),[busy,setBusy]=useState(false),[error,setError]=useState(''),[notice,setNotice]=useState('');
  const records=(source.value||[]).filter(c=>!isIpsQaFixtureClient(c));
  const eligible=records.filter(readyClient).length;
  const visible=records.filter(c=>(state==='all'||(state==='eligible'?readyClient(c):!readyClient(c)))&&
    [c.client_id,c.username,c.email,c.status].join(' ').toLowerCase().includes(term.toLowerCase()));
  const open=c=>{setSelected(c);setNotes(c.notes||'');setStatus(c.status||'Active');setReason('');setIntent('');setError('');};
  const send=async(path,method,body,message)=>{
    setBusy(true);setError('');setNotice('');
    try{await companyRequest(path,{method,body:JSON.stringify(body)});
      source.refresh();setSelected(null);setNotice(message);}
    catch(e){setError(e.message);}finally{setBusy(false);}
  };
  const base=selected?'/api/clients/'+encodeURIComponent(selected.client_id):'';
  return <>
    <PageHeading eyebrow="CLIENT RELATIONS / CONFIDENTIAL IDENTITIES" title="Client account governance"
      description="Clients choose their own username and remain private. Verified email is required for access eligibility. IPS does not collect or reveal customer passwords.">
      <Refresh onClick={source.refresh} loading={source.loading}/>
    </PageHeading>
    <ErrorState error={source.error} retry={source.refresh}/><ErrorState error={error}/>
    {notice&&<div className="os-notice" role="status">{notice}</div>}
    <div className="os-grid three">
      <div className="os-stat"><span>Registered client records</span><strong>{source.value?records.length:'—'}</strong><small>Production-eligible scope, excluding named QA fixtures</small></div>
      <div className="os-stat"><span>Verified and active</span><strong>{source.value?eligible:'—'}</strong><small>Eligible private client accounts</small></div>
      <div className="os-stat urgent"><span>Require verification or review</span><strong>{source.value?records.length-eligible:'—'}</strong><small>Never confuse Active with verified</small></div>
    </div>
    <Panel title="Private client register" subtitle="Account recovery uses the existing verified mailbox. Clients with unverified addresses may receive a new verification challenge; staff cannot verify them manually.">
      <div className="os-fields">
        <label className="os-field">Search by chosen username, reference or email<input type="search" className="os-input" value={term} onChange={e=>setTerm(e.target.value)} placeholder="Find a client…"/></label>
        <label className="os-field">Eligibility<select className="os-input" value={state} onChange={e=>setState(e.target.value)}><option value="all">All client accounts</option><option value="eligible">Verified & active</option><option value="pending">Verification / restriction pending</option></select></label>
      </div>
      <div className="os-section-gap">
        {source.loading&&!source.value?<Empty>Loading the private client directory…</Empty>:!visible.length?<Empty>No clients match the selected account state or search.</Empty>:
        <div className="os-table-wrap"><table className="os-table"><thead><tr><th>Private identity</th><th>Verification</th><th>Account status</th><th>Eligibility</th><th>Control</th></tr></thead><tbody>{visible.map(c=><tr key={c.client_id}>
          <td><strong>{c.username||'Private username'}</strong><small>{c.client_id}</small></td>
          <td>{c.email_verified_at?<Status tone="good">Verified</Status>:<Status tone="warn">Verification pending</Status>}<small>{c.email||'Email unavailable'}</small></td>
          <td>{c.status||'Unknown'}</td><td><Status tone={readyClient(c)?'good':'warn'}>{clientState(c)}</Status></td>
          <td><button type="button" className="os-action secondary" onClick={()=>open(c)}>Manage safely</button></td>
        </tr>)}</tbody></table></div>}
      </div>
    </Panel>
    {selected&&<div className="ips-os-command-shade" role="presentation" onMouseDown={e=>{if(e.target===e.currentTarget)setSelected(null);}}>
      <div className="ips-os-command" role="dialog" aria-modal="true" aria-label="Private client account governance" style={{maxHeight:'85vh',overflow:'auto',padding:25}}>
        <div className="os-panel-head"><h2>{selected.username||'Private client'} · {selected.client_id}</h2><button type="button" className="os-action quiet" onClick={()=>setSelected(null)}>Close</button></div>
        <div className="os-facts">
          <div className="os-fact"><small>Verified email</small><strong>{selected.email_verified_at?'Yes':'No'}</strong></div>
          <div className="os-fact"><small>Account eligibility</small><strong>{clientState(selected)}</strong></div>
        </div>
        <div className="os-stack">
          {manage&&<form className="os-stack" onSubmit={e=>{e.preventDefault();send(base,'PATCH',{status,notes},'Client account saved.');}}>
            <h3>Account restrictions and private notes</h3>
            <label className="os-field">Account state<select className="os-input" value={status} onChange={e=>setStatus(e.target.value)}><option>Active</option><option>Suspended</option><option>Pending Verification</option></select></label>
            <label className="os-field">Private administrator notes<textarea className="os-input" value={notes} maxLength={2000} onChange={e=>setNotes(e.target.value)}/></label>
            <button className="os-action secondary" type="submit" disabled={busy}>Save account governance</button>
          </form>}
          {(manage&&!selected.email_verified_at||recover&&selected.email_verified_at&&selected.status==='Active')&&<>
            <h3 style={{marginTop:10}}>Identity assistance</h3>
            <div className="os-pill-bar">
              {manage&&!selected.email_verified_at&&<button className="os-pill" type="button" aria-pressed={intent==='verify'} onClick={()=>setIntent('verify')}>Resend verification code</button>}
              {recover&&selected.email_verified_at&&selected.status==='Active'&&<button className="os-pill" type="button" aria-pressed={intent==='reset'} onClick={()=>setIntent('reset')}>Send password recovery</button>}
            </div>
            {intent&&<form className="os-stack" onSubmit={e=>{e.preventDefault();if(reason.trim().length<10)return;
              const path='/api/admin/clients/'+encodeURIComponent(selected.client_id)+(intent==='verify'?'/resend-verification':'/password-recovery');
              send(path,'POST',{reason:reason.trim()},intent==='verify'?
                'The email provider accepted a verification challenge. Client must complete it. Inbox receipt is not guaranteed.':
                'One-use recovery link accepted by email provider for verified client mailbox. Staff cannot view the token or password.');
            }}>
              <div className="os-command-note">Only the owner of the mailbox can finish this process. No phone calls, password disclosure or manual verification override.</div>
              <label className="os-field">Required documented assistance reason<textarea className="os-input" value={reason} onChange={e=>setReason(e.target.value)} minLength={10} maxLength={500} required/></label>
              <button className="os-action" type="submit" disabled={busy||reason.trim().length<10}>{busy?'Sending…':'Send secure '+(intent==='verify'?'verification challenge':'recovery link')}</button>
            </form>}
          </>}
        </div><ErrorState error={error}/>
      </div>
    </div>}
  </>;
}

export function CompanySpecialists(){
  const {hasAdminPermission}=useAuth();
  const source=useCompanyResource('/api/writers','writers');
  const manage=hasAdminPermission('providers.manage');
  const [filter,setFilter]=useState('all'),[search,setSearch]=useState(''),[selected,setSelected]=useState(null),
    [decision,setDecision]=useState('approved'),[notes,setNotes]=useState(''),[error,setError]=useState(''),[notice,setNotice]=useState(''),[busy,setBusy]=useState(false);
  const records=(source.value||[]).filter(w=>!isIpsQaFixtureEmail(w.email));
  const eligible=records.filter(readySpecialist);
  const visible=records.filter(w=>(filter==='all'||(filter==='ready'?readySpecialist(w):
    filter==='verification'?!w.email_verified_at:w.application_status===filter))&&
    [w.full_name,w.writer_id,w.email,w.primary_expertise].join(' ').toLowerCase().includes(search.toLowerCase()));
  async function patch(path,payload,message){
    setBusy(true);setError('');setNotice('');
    try{await companyRequest(path,{method:'PATCH',body:JSON.stringify(payload)});
      source.refresh();setSelected(null);setNotice(message);}
    catch(e){setError(e.message);}finally{setBusy(false);}
  }
  return <>
    <PageHeading eyebrow="SPECIALIST NETWORK / QUALIFIED TALENT" title="Verified specialist network"
      description="A specialist is eligible only when the application is approved, registered email is verified and account is active. Unverified approval does not authorize assignment.">
      <Refresh onClick={source.refresh} loading={source.loading}/>
    </PageHeading><ErrorState error={source.error} retry={source.refresh}/><ErrorState error={error}/>
    {notice&&<div className="os-notice" role="status">{notice}</div>}
    <div className="os-grid three"><div className="os-stat"><span>Specialist records</span><strong>{source.value?records.length:'—'}</strong><small>Excluding known evaluation identities</small></div>
      <div className="os-stat"><span>Eligible to assign</span><strong>{source.value?eligible.length:'—'}</strong><small>Approved + verified + active</small></div>
      <div className="os-stat urgent"><span>Awaiting eligibility</span><strong>{source.value?records.length-eligible.length:'—'}</strong><small>Verification, review or availability</small></div></div>
    <Panel title="Specialist qualification & applications" subtitle="Review expertise, academic level, submitted CV, email verification and actual activation before approving assignments.">
      <div className="os-fields"><label className="os-field">Find specialist<input type="search" className="os-input" value={search} onChange={e=>setSearch(e.target.value)}/></label>
        <label className="os-field">Application / eligibility<select className="os-input" value={filter} onChange={e=>setFilter(e.target.value)}>{[['all','All'],['ready','Eligible to assign'],['verification','Email verification pending'],['pending','Pending review'],['more_information','Needs more information'],['approved','Approved applications'],['rejected','Rejected applications']].map(([v,l])=><option value={v} key={v}>{l}</option>)}</select></label></div>
      <div className="os-section-gap">{!visible.length?<Empty>No specialists match these criteria.</Empty>:<div className="os-table-wrap"><table className="os-table"><thead><tr><th>Verified specialist identity</th><th>Expertise</th><th>Application</th><th>Actual eligibility</th><th>Govern</th></tr></thead><tbody>
        {visible.map(s=><tr key={s.writer_id}><td><strong>{s.full_name||'Name required'}</strong><small>{s.email}</small></td>
          <td>{s.primary_expertise||'Expertise missing'}<small>{s.academic_level||'Qualification not specified'}</small></td>
          <td>{s.application_status||'pending'}<small>{s.status||'Not active'}</small></td>
          <td><Status tone={readySpecialist(s)?'good':'warn'}>{specialistState(s)}</Status></td>
          <td><button type="button" className="os-action secondary" onClick={()=>{setSelected(s);setDecision(s.application_status==='approved'?'more_information':'approved');setNotes('');setError('');}}>Review</button></td></tr>)}
      </tbody></table></div>}</div>
    </Panel>
    {selected&&<div className="ips-os-command-shade" role="presentation" onMouseDown={e=>{if(e.target===e.currentTarget)setSelected(null);}}>
      <div className="ips-os-command" role="dialog" aria-modal="true" aria-label="Specialist qualification review" style={{maxHeight:'85vh',overflow:'auto',padding:24}}>
        <div className="os-panel-head"><h2>{selected.full_name}</h2><button type="button" className="os-action quiet" onClick={()=>setSelected(null)}>Close</button></div>
        <div className="os-facts">{[['Application',selected.application_status||'pending'],['Registered email',selected.email_verified_at?'Verified':'NOT verified'],
          ['Specialty',selected.primary_expertise||'Not supplied'],['Academic level',selected.academic_level||'Not supplied'],
          ['Availability',selected.status||'Not active'],['Eligibility',specialistState(selected)]].map(([l,v])=><div key={l} className="os-fact"><small>{l}</small><strong>{v}</strong></div>)}</div>
        <div className="os-stack">{selected.cv_stored_name&&<a className="os-action secondary" href={'/api/provider/applications/'+encodeURIComponent(selected.writer_id)+'/cv'} target="_blank" rel="noopener noreferrer">Inspect protected CV <AdminIcon name="file" size={16}/></a>}
          {manage&&<>
            <form className="os-stack" onSubmit={e=>{e.preventDefault();if(decision==='approved'&&!selected.email_verified_at)return setError('Specialist must verify registered email before approval.');
              if(decision==='rejected'&&notes.trim().length<10)return setError('Document a rejection reason (at least 10 characters).');
              patch('/api/provider/applications/'+encodeURIComponent(selected.writer_id),
                {decision,rejection_reason:decision==='rejected'?notes.trim():'',admin_notes:decision==='rejected'?'':notes.trim()},'Specialist application decision recorded.');}}>
              <label className="os-field">Qualification decision<select className="os-input" value={decision} onChange={e=>setDecision(e.target.value)}><option value="approved" disabled={!selected.email_verified_at}>Approve qualified specialist</option><option value="more_information">Request further information</option><option value="rejected">Reject application</option></select></label>
              <label className="os-field">Review findings and justification<textarea className="os-input" value={notes} onChange={e=>setNotes(e.target.value)} maxLength={2000}/></label>
              {!selected.email_verified_at&&<div className="os-command-note">Email verification missing. Approval must remain unavailable until the specialist completes their own verification.</div>}
              <button className="os-action" type="submit" disabled={busy||(decision==='approved'&&!selected.email_verified_at)||(decision==='rejected'&&notes.trim().length<10)}>Record governed decision</button>
            </form>
            {selected.application_status==='approved'&&<button type="button" className="os-action secondary" disabled={busy} onClick={()=>patch('/api/writers/'+encodeURIComponent(selected.writer_id),{status:selected.status==='Active'?'On Leave':'Active'},'Specialist availability updated.')}>{selected.status==='Active'?'Pause specialist access':'Reactivate specialist'}</button>}
          </>}
        </div><ErrorState error={error}/>
      </div>
    </div>}
  </>;
}

export function CompanyProjects({quality=false}){
  const {hasAdminPermission}=useAuth();
  const source=useCompanyResource('/api/services','requests');
  const writers=useCompanyResource('/api/writers','writers',hasAdminPermission('providers.view'));
  const manage=hasAdminPermission('services.manage');
  const [filter,setFilter]=useState(quality?'review':'active'),[term,setTerm]=useState(''),[selected,setSelected]=useState(null),
    [quote,setQuote]=useState({labor:'0',service_fee:'0',expenses:'0',notes:'',expires_at:''}),
    [error,setError]=useState(''),[notice,setNotice]=useState(''),[busy,setBusy]=useState(false);
  const records=(source.value||[]).filter(isIpsAcademicProject);
  const reviewStates=['Submitted for Review','Ready for Client','Disputed','Correction Required'];
  const visible=records.filter(p=>(filter==='all'||(filter==='review'?reviewStates.includes(p.status):
    filter==='complete'?['Completed','Cancelled'].includes(p.status):!['Completed','Cancelled'].includes(p.status)))&&
    [p.title,p.request_id,p.client_name,p.status,p.source_quote_id].join(' ').toLowerCase().includes(term.toLowerCase()));
  const eligible=(writers.value||[]).filter(readySpecialist);
  const update=async(p,payload,message)=>{
    setBusy(true);setError('');setNotice('');
    try{await companyRequest('/api/services/'+encodeURIComponent(p.request_id),{method:'PATCH',body:JSON.stringify(payload)});
      source.refresh();setSelected(null);setNotice(message);}
    catch(e){setError(e.message);}finally{setBusy(false);}
  };
  const open=p=>{setSelected(p);setQuote({labor:String(p.quote?.labor??0),service_fee:String(p.quote?.service_fee??0),
    expenses:String(p.quote?.expenses??0),notes:p.quote?.notes||'',expires_at:p.quote?.expires_at?String(p.quote.expires_at).slice(0,10):''});setError('');};
  const canQuote=selected&&['Under Review','Clarification Required','Quoted'].includes(selected.status)&&selected.payment_status!=='paid';
  const canAssign=selected&&manage&&writers.value&&selected.payment_status==='paid'&&
    ['Quote Accepted','Awaiting Assignment','Assigned'].includes(selected.status)&&
    (selected.status!=='Assigned'||Number(selected.progress||0)===0);
  async function saveQuote(e){
    e.preventDefault();if(!selected||!canQuote)return;
    const labor=Number(quote.labor),fee=Number(quote.service_fee),expenses=Number(quote.expenses);
    if(![labor,fee,expenses].every(v=>Number.isFinite(v)&&v>=0&&v<=100000)||labor+fee+expenses<=0||!quote.notes.trim()||!quote.expires_at)
      return setError('Provide a positive, itemized quotation, documented scope and expiration date.');
    update(selected,{quote:{...quote,labor,service_fee:fee,expenses,total:labor+fee+expenses,currency:'PLN',accepted:false},
      status:'Quoted',reason:'Governed itemized academic quotation issued by IPS'},'Quotation issued. Client acceptance and payment verification remain separate.');
  }
  return <>
    <PageHeading eyebrow={quality?'QUALITY ASSURANCE / APPROVAL':'ACADEMIC DELIVERY / PROJECT REGISTER'}
      title={quality?'Independent quality control':'Academic delivery governance'}
      description={quality?'Review submitted work, corrections, disputes and release gates. A project may be released only through authorized transitions.':'From accepted quotation to eligible specialist, controlled milestones, review, correction and approved client handover. Payment is never inferred.'}>
      <Refresh onClick={source.refresh} loading={source.loading}/>
    </PageHeading>
    <ErrorState error={source.error} retry={source.refresh}/><ErrorState error={error}/>{writers.error&&hasAdminPermission('providers.view')&&<div className="os-command-note">Specialist eligibility directory unavailable. Assignment disabled until verified.</div>}
    {notice&&<div className="os-notice" role="status">{notice}</div>}
    <div className="os-grid"><div className="os-stat"><span>Awaiting intake, quote or payment</span><strong>{source.value?records.filter(x=>['New Request','Under Review','Clarification Required','Quoted','Quote Accepted','Awaiting Assignment'].includes(x.status)).length:'—'}</strong><small>Not yet authorized delivery</small></div>
      <div className="os-stat"><span>Specialist delivery</span><strong>{source.value?records.filter(x=>['Assigned','In Progress','Waiting for Client'].includes(x.status)).length:'—'}</strong><small>Governed active work</small></div>
      <div className="os-stat urgent"><span>Quality decisions</span><strong>{source.value?records.filter(x=>reviewStates.includes(x.status)).length:'—'}</strong><small>Require review or correction</small></div>
      <div className="os-stat"><span>Completed</span><strong>{source.value?records.filter(x=>x.status==='Completed').length:'—'}</strong><small>Recorded as delivered</small></div></div>
    <div className="os-command-note" style={{marginBottom:20}}><AdminIcon name="shield" size={17}/> Payment integration remains disabled. No actual payment is implied by an accepted quote, and no specialist assignment can bypass backend payment gating.</div>
    <Panel title={quality?'Quality review queue':'Source-bound academic engagements'} subtitle="Only genuine IPS academic-support requests linked to client quotation intake appear in this register.">
      <div className="os-fields"><label className="os-field">Find project<input type="search" className="os-input" value={term} onChange={e=>setTerm(e.target.value)}/></label>
        <label className="os-field">Work state<select className="os-input" value={filter} onChange={e=>setFilter(e.target.value)}><option value="active">Current work</option><option value="review">Quality decisions</option><option value="complete">Closed and completed</option><option value="all">Full register</option></select></label></div>
      <div className="os-section-gap">{!visible.length?<Empty>No source-bound projects match this view. Verified service requests begin with private quotation intake.</Empty>:
        <div className="os-table-wrap"><table className="os-table"><thead><tr><th>Project & linked quote</th><th>Responsibility</th><th>State</th><th>Financial gate</th><th>Progress</th><th>Govern</th></tr></thead><tbody>{visible.map(p=><tr key={p.request_id}>
          <td><strong>{p.title||p.request_id}</strong><small>{p.request_id} · Quote {p.source_quote_id||'Not linked'}</small></td>
          <td>{p.provider_name||'No specialist'}<small>{p.client_name||'Private client'}</small></td>
          <td><Status tone={reviewStates.includes(p.status)?'warn':p.status==='Completed'?'good':''}>{p.status}</Status></td>
          <td>{p.payment_status==='paid'?<Status tone="good">Verified payment</Status>:<Status tone="warn">Payment required</Status>}</td>
          <td>{Number(p.progress||0)}%</td>
          <td><button className="os-action secondary" type="button" onClick={()=>open(p)}>Open control</button></td>
        </tr>)}</tbody></table></div>}</div>
    </Panel>
    {selected&&<div className="ips-os-command-shade" role="presentation" onMouseDown={e=>{if(e.target===e.currentTarget)setSelected(null);}}>
      <div className="ips-os-command" role="dialog" aria-modal="true" aria-label="Govern academic project" style={{maxHeight:'85vh',overflow:'auto',padding:24}}>
        <div className="os-panel-head"><h2>{selected.title||selected.request_id}</h2><button className="os-action quiet" type="button" onClick={()=>setSelected(null)}>Close</button></div>
        <p className="os-lead">Project {selected.request_id} · Quote {selected.source_quote_id||'Not linked'} · {selected.status}</p>
        <div className="os-facts">{[['Current specialist',selected.provider_name||'Not allocated'],['Payment',selected.payment_status||'Unverified'],
          ['Progress',Number(selected.progress||0)+'%'],['Quote',money(selected.quote?.total,selected.quote?.currency||'PLN')]].map(([l,v])=><div className="os-fact" key={l}><small>{l}</small><strong>{v}</strong></div>)}</div>
        {manage&&<div className="os-stack">
          <label className="os-field">Permitted project transition<select className="os-input" value={selected.status} disabled={busy} onChange={e=>update(selected,{status:e.target.value,reason:'Authorized IPS delivery/quality gate action'},'Project lifecycle updated.')}>
            {allowedAdminServiceStatuses(selected).map(s=><option key={s}>{s}</option>)}</select></label>
          {canAssign&&<label className="os-field">Eligible, verified specialist
            <select className="os-input" value={selected.provider_id||''} disabled={busy} onChange={e=>{
              const member=eligible.find(w=>w.writer_id===e.target.value);
              update(selected,{provider_id:e.target.value,provider_name:member?.full_name||'',
                status:e.target.value?'Assigned':'Awaiting Assignment',reason:e.target.value?'Verified eligible specialist assigned':'Unstarted assignment withdrawn'},'Assignment updated.');
            }}><option value="">Not assigned</option>{eligible.map(w=><option key={w.writer_id} value={w.writer_id}>{w.full_name} · {w.primary_expertise||'General'}</option>)}</select>
          </label>}
          {!canAssign&&<div className="os-command-note">{selected.payment_status!=='paid'?'A verified payment is required before specialist assignment.':'Allocation requires an eligible project state, available specialist directory and no irreversible active work.'}</div>}
          {canQuote&&<form className="os-stack" onSubmit={saveQuote}>
            <h3>Governed itemized quotation</h3>
            <div className="os-fields">{[['labor','Specialist service'],['service_fee','IPS service'],['expenses','Approved expenses']].map(([k,l])=><label className="os-field" key={k}>{l} (PLN)<input className="os-input" type="number" step=".01" min="0" value={quote[k]} onChange={e=>setQuote(q=>({...q,[k]:e.target.value}))}/></label>)}</div>
            <label className="os-field">Scope, terms and deliverables<textarea className="os-input" required value={quote.notes} onChange={e=>setQuote(q=>({...q,notes:e.target.value}))}/></label>
            <label className="os-field">Valid until<input className="os-input" type="date" required value={quote.expires_at} onChange={e=>setQuote(q=>({...q,expires_at:e.target.value}))}/></label>
            <button className="os-action" type="submit" disabled={busy}>Issue itemized quote — client acceptance still required</button>
          </form>}
        </div>}
        <Link to={'/admin/services/'+encodeURIComponent(selected.request_id)} className="os-action secondary os-section-gap" onClick={()=>setSelected(null)}>Open protected file and conversations <AdminIcon name="arrow" size={16}/></Link>
        <ErrorState error={error}/>
      </div>
    </div>}
  </>;
}
