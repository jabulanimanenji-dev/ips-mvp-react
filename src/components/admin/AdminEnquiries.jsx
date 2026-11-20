import React,{useEffect,useState} from 'react';
import {Link} from 'react-router-dom';
import {useAuth} from '../../context/AuthContext';
import {serviceTitle,quoteSubjectTitle,quoteStatusTitle,contactChannelTitle} from '../../utils/quoteLabels.js';
const needsUpdate=lead=>Boolean(lead?.next_update_at&&lead.status!=='closed'&&lead.status!=='waiting_for_customer'&&new Date(lead.next_update_at).getTime()<=Date.now());
const localDateTime=iso=>{if(!iso)return '';const value=new Date(iso);return new Date(value.getTime()-value.getTimezoneOffset()*60000).toISOString().slice(0,16);};

function ContactActions({lead}){
  const {email,phone,preferred_channel,enquiry_id,contact_verified}=lead;
  return <div style={{display:'flex',gap:10,flexWrap:'wrap',marginBottom:14}}>
    <p style={{fontSize:'.81rem',color:'var(--text-muted)'}}>
      {contact_verified?'Written contact verified.':'Contact not yet verified — do not send a quotation or private project details.'}
    </p>
    {email&&preferred_channel==='email'&&contact_verified&&
      <small>Email replies use only the verified IPS business address. Do not send from a personal account.</small>}
    {contact_verified&&lead.contact_thread_id&&['whatsapp','telegram'].includes(preferred_channel)&&
      <a className="btn btn-ghost" href={'/admin/external-chats?thread='+encodeURIComponent(lead.contact_thread_id)}>
        Open verified {preferred_channel==='telegram'?'Telegram':'WhatsApp'} conversation ↗
      </a>}
    {preferred_channel==='whatsapp'&&!contact_verified&&
      <small>Manual WhatsApp: inspect the customer-initiated chat on the IPS business number, compare its sender number and exact reference, and attest below. No Meta API or automatic inbox sync.</small>}
    {preferred_channel==='telegram'&&!contact_verified&&
      <small>Wait for the customer to start the IPS bot chat and send the exact quotation reference.</small>}
    {preferred_channel==='whatsapp'&&contact_verified&&!lead.contact_thread_id&&/^\+[1-9][0-9]{7,14}$/.test(phone||'')&&
      <a className="btn btn-ghost" href={'https://wa.me/'+phone.slice(1)} target="_blank" rel="noopener noreferrer">Open customer WhatsApp chat to reply manually ↗</a>}
    {preferred_channel==='workspace'&&<small>Customer chose their private IPS workspace. Record the quote in the authenticated project area, not email or external messaging.</small>}
  </div>;
}
export default function AdminEnquiries(){
  const {hasAdminPermission}=useAuth();
  const [leads,setLeads]=useState([]),[selected,setSelected]=useState('');
  const [filter,setFilter]=useState('open'),[query,setQuery]=useState('');
  const [message,setMessage]=useState('');
  const [statusMessage,setStatusMessage]=useState('');
  const [busy,setBusy]=useState(false);
  const [emailReady,setEmailReady]=useState(false);
  const [emailJobs,setEmailJobs]=useState([]);
  const [nextUpdate,setNextUpdate]=useState('');
  const [error,setError]=useState('');
  const [observedNumber,setObservedNumber]=useState('');
  const [observedReference,setObservedReference]=useState('');
  const [manualAttestation,setManualAttestation]=useState(false);
  const [withdrawalConfirmed,setWithdrawalConfirmed]=useState(false);
  const current=leads.find(v=>v.enquiry_id===selected);
  const visible=leads.filter(x=>(filter==='all'||(filter==='open'?x.status!=='closed':filter==='overdue'?needsUpdate(x):x.status===filter)) &&
      [x.enquiry_id,x.username,x.name,x.email,x.phone,x.subject].join(' ').toLowerCase().includes(query.toLowerCase()))
      .sort((a,b)=>Number(needsUpdate(b))-Number(needsUpdate(a)) ||
        (new Date(a.next_update_at||'9999-12-31').getTime()-new Date(b.next_update_at||'9999-12-31').getTime()));
  async function refresh(){
    try{
      const response=await fetch('/api/contact-enquiries/admin',{cache:'no-store'});
      const result=await response.json();
      if(!response.ok||!result.success)throw Error(result.error||'Cannot load enquiries.');
      setLeads(result.enquiries||[]);
      setSelected(prev=>prev||result.enquiries?.[0]?.enquiry_id||'');
    }catch(ex){setError(ex.message);}
  }
  useEffect(()=>{refresh();fetch('/api/contact-enquiries/config',{cache:'no-store'}).then(r=>r.json()).then(r=>setEmailReady(Boolean(r.email_replies_configured))).catch(()=>{});},[]);
  useEffect(()=>{setNextUpdate(localDateTime(current?.next_update_at));},[selected,current?.next_update_at]);
  useEffect(()=>{setObservedNumber('');setObservedReference('');setManualAttestation(false);setWithdrawalConfirmed(false);},[selected]);
  useEffect(()=>{
    if(!selected){setEmailJobs([]);return;}
    let mounted=true;
    fetch('/api/contact-enquiries/admin/'+encodeURIComponent(selected)+'/email-status',{cache:'no-store'})
      .then(async r=>{if(!r.ok)throw Error('not available');return r.json();})
      .then(data=>{if(mounted)setEmailJobs(data.notifications||[]);})
      .catch(()=>{if(mounted)setEmailJobs([]);});
    return ()=>{mounted=false;};
  },[selected]);
  async function update(updates){
    if(!current)return;
    setError('');setStatusMessage('');setBusy(true);
    try{
      const response=await fetch('/api/contact-enquiries/admin/'+encodeURIComponent(current.enquiry_id),
        {method:'PATCH',headers:{'Content-Type':'application/json'},body:JSON.stringify(updates)});
      const data=await response.json();
      if(!response.ok||!data.success)throw Error(data.error||'Could not update enquiry.');
      await refresh();setStatusMessage('Enquiry updated.');
    }catch(ex){setError(ex.message);}
    finally{setBusy(false);}
  }
  async function claimReview(){
    if(!current||busy)return;
    setBusy(true);setError('');setStatusMessage('');
    try{
      const res=await fetch('/api/contact-enquiries/admin/'+encodeURIComponent(current.enquiry_id)+'/claim',{
        method:'POST',credentials:'same-origin'
      });
      const result=await res.json().catch(()=>({}));
      if(!res.ok||!result.success)throw Error(result.error||'This request is already under another reviewer.');
      await refresh();
      setStatusMessage(result.already_assigned?'You already own this customer review.':
        'You now own this private review. Set a realistic written update date and respond through the verified channel.');
    }catch(err){setError(err.message||'Could not take responsibility for this request.');}
    finally{setBusy(false);}
  }
  async function confirmDirectWhatsapp(){
    if(!current||busy)return;
    setBusy(true);setError('');setStatusMessage('');
    try{
      const response=await fetch('/api/contact-enquiries/admin/'+encodeURIComponent(current.enquiry_id)+'/whatsapp-manual-verify',{
        method:'POST',credentials:'same-origin',headers:{'Content-Type':'application/json'},
        body:JSON.stringify({observed_phone:observedNumber,observed_reference:observedReference,attested:manualAttestation})
      });
      const result=await response.json().catch(()=>({}));
      if(!response.ok||!result.success)throw Error(result.error||'Manual WhatsApp verification was not recorded.');
      setManualAttestation(false);setObservedNumber('');setObservedReference('');
      await refresh();
      setStatusMessage('WhatsApp sender manually attested. Continue written replies in WhatsApp; it is not synchronized with this IPS inbox.');
    }catch(ex){setError(ex.message);}
    finally{setBusy(false);}
  }
  async function withdrawDirectWhatsapp(){
    if(!current||busy||!withdrawalConfirmed)return;
    setBusy(true);setError('');setStatusMessage('');
    try{
      const response=await fetch('/api/contact-enquiries/admin/'+encodeURIComponent(current.enquiry_id)+'/whatsapp-contact-withdrawn',{
        method:'POST',credentials:'same-origin',headers:{'Content-Type':'application/json'},
        body:JSON.stringify({confirmed:true})
      });
      const result=await response.json().catch(()=>({}));
      if(!response.ok||!result.success)throw Error(result.error||'Contact withdrawal could not be recorded.');
      setWithdrawalConfirmed(false);await refresh();
      setStatusMessage('WhatsApp contact consent withdrawn and enquiry closed. Do not message this customer.');
    }catch(ex){setError(ex.message);}
    finally{setBusy(false);}
  }
  async function createManagedProject(){
    if(!current||busy)return;
    setBusy(true);setError('');setStatusMessage('');
    try{
      const response=await fetch('/api/quote-requests/admin/'+encodeURIComponent(current.enquiry_id)+'/create-project',{
        method:'POST',credentials:'same-origin',headers:{'Content-Type':'application/json'}
      });
      const result=await response.json().catch(()=>({}));
      if(!response.ok||!result.success)throw Error(result.error||'Managed project could not be created.');
      await refresh();
      setStatusMessage('Managed project ready: '+result.request_id+'. Issue an itemized quote before any payment or assignment.');
    }catch(err){setError(err.message||'The verified customer project could not be opened.');}
    finally{setBusy(false);}
  }
  async function send(event){
    event.preventDefault();if(!current||!message.trim())return;
    setError('');setStatusMessage('');setBusy(true);
    try{
      const workspace=current.preferred_channel==='workspace';
      const url=workspace
        ?'/api/quote-requests/admin/'+encodeURIComponent(current.enquiry_id)+'/workspace-reply'
        :'/api/contact-enquiries/admin/'+encodeURIComponent(current.enquiry_id)+'/email-reply';
      const response=await fetch(url,{
        method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({message})
      });
      const data=await response.json();
      if(!response.ok||!data.success)throw Error(data.error||'Email not confirmed.');
      setMessage('');setStatusMessage(workspace?'Written reply saved in the customer workspace.':'Email accepted by the provider; inbox delivery is not guaranteed.');
      await refresh();
    }catch(ex){setError(ex.message);}
    finally{setBusy(false);}
  }
  return <div className="ips-contact-admin">
    <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',flexWrap:'wrap',gap:12,marginBottom:24}}>
      <div><h1 style={{color:'#1d344b'}}>Private Quotes & Enquiries</h1><p style={{color:'#52667a'}}>Review private requests and reply only through each customer's verified, selected written channel.</p></div>
      <button className="btn btn-ghost" type="button" onClick={()=>refresh()}>Refresh</button>
    </div>
    <p className="card" style={{marginBottom:15,fontSize:'.86rem'}}>Written communication only — no phone or voice calls. Never send private academic documents, research participant records, passwords or payment credentials through external messaging. Use only verified customer-selected contact channels.</p>
    {error&&<div role="alert" className="card" style={{color:'var(--danger)',marginBottom:12}}>{error}</div>}
    {statusMessage&&<div role="status" className="card" style={{marginBottom:12}}>{statusMessage}</div>}
    <div className="grid grid-2 gap-3" style={{alignItems:'start'}}>
      <section className="card">
        <h3>Contact queue ({leads.length})</h3>
        <div style={{display:'flex',gap:8,margin:'12px 0'}}>
          <input className="form-input" value={query} onChange={e=>setQuery(e.target.value)} placeholder="Search username or reference" aria-label="Search enquiries"/>
          <select className="form-select" value={filter} onChange={e=>setFilter(e.target.value)} aria-label="Filter enquiries">
            <option value="open">Active</option><option value="all">All</option><option value="new">New</option>
            <option value="in_progress">In progress</option><option value="waiting_for_customer">Waiting</option><option value="overdue">Updates overdue</option><option value="closed">Closed</option>
          </select>
        </div>
        {visible.length===0&&<p>No enquiries in this view.</p>}
        <div style={{display:'grid',gap:7}}>
          {visible.map(x=><button key={x.enquiry_id} onClick={()=>{setSelected(x.enquiry_id);setMessage('');}}
            style={{background:selected===x.enquiry_id?'var(--bg-active)':'transparent',padding:13,textAlign:'left',color:'var(--text-primary)',border:'1px solid var(--border)',borderRadius:8,cursor:'pointer'}}>
            <strong>{quoteSubjectTitle(x)}</strong><small style={{display:'block',marginTop:6,color:'var(--text-muted)'}}>{x.username||x.name||'Private visitor'} · {contactChannelTitle(x.preferred_channel)} · {quoteStatusTitle(x.status)}{needsUpdate(x)?' · UPDATE OVERDUE':''}</small>
          </button>)}
        </div>
      </section>
      <section className="card">
        {!current?<p>Select a contact request.</p>:<>
          <h3 style={{marginBottom:8}}>{quoteSubjectTitle(current)}</h3>
          <small>{current.enquiry_id} · {current.username||current.name||'Private visitor'} · {new Date(current.createdAt).toLocaleString()}</small>
          <p style={{marginTop:10}}><b>Preferred contact:</b> {current.preferred_channel}</p>
          <p><b>Written contact:</b> {current.email||current.telegram_username||current.phone||'Private workspace'} · {current.contact_verified?'Verified':'Awaiting verification'}</p>
          {current.request_type==='quote'&&<p><b>Quotation:</b> {serviceTitle(current.service)} · {current.discipline||'Unspecified discipline'} · {current.study_level||'Unspecified level'} · {current.preferred_deadline||'No deadline selected'}</p>}
          {current.request_type==='quote'&&<div className="card" style={{margin:'12px 0',padding:12,background:'var(--bg-surface-2)'}}>
            <strong>Central IPS project handoff</strong>
            {current.service_request_id?
              <p><Link to={'/admin/services/'+encodeURIComponent(current.service_request_id)}>Open managed project {current.service_request_id}</Link> to issue a written price, allocate a vetted specialist after payment and govern delivery.</p>
              :<p style={{marginTop:7}}>This request is not yet a paid order. The customer must use a verified IPS account and link this exact quotation before a managed project can open.</p>}
            {!current.service_request_id&&current.client_id&&current.contact_verified&&current.contact_consent&&hasAdminPermission('services.manage')&&
              <button className="btn btn-primary" type="button" disabled={busy} onClick={createManagedProject}>Open managed IPS project</button>}
            {!current.client_id&&<small>Customer can claim the reference privately after verifying their selected email or linking their messaging account. Never assign work or demand payment before agreement.</small>}
          </div>}
          <p><b>Human review:</b> {current.review_started_at?'Started '+new Date(current.review_started_at).toLocaleString():'Not yet marked under review'}</p>
          <div style={{margin:'8px 0 16px',padding:12,border:'1px solid var(--border)',borderRadius:8}}>
            <strong>Responsible IPS reviewer</strong>
            {current.assigned_admin_id?<p style={{margin:'8px 0'}}>Assigned internally: {current.assigned_admin_id} · {current.assigned_at?new Date(current.assigned_at).toLocaleString():''}</p>:
              <p style={{margin:'8px 0'}}>This verified request has no assigned human reviewer yet.</p>}
            {!current.assigned_admin_id&&current.contact_verified&&current.contact_consent&&current.status!=='closed'&&hasAdminPermission('support.manage')&&
              <button type="button" className="btn btn-primary" onClick={claimReview} disabled={busy}>Take review ownership</button>}
          </div>
          {needsUpdate(current)&&<p role="alert" style={{color:'var(--danger)',fontWeight:700}}>Customer update overdue — contact the customer using the verified chosen channel.</p>}
          <p style={{fontSize:'.8rem',color:'var(--text-muted)'}}>Enquiry-specific contact permission recorded: {current.contact_consent?'Yes':'No'} · {current.consent_at?new Date(current.consent_at).toLocaleString():''}</p>
          <ContactActions lead={current}/>
          {current.preferred_channel==='whatsapp'&&current.contact_verified&&<p style={{fontSize:'.82rem',color:'var(--text-muted)'}}>
            {current.contact_verification_method==='whatsapp_manual_attested'?
              'Manually confirmed in WhatsApp by IPS reviewer '+(current.contact_verified_by||'staff')+'. This is not automated Meta webhook verification.':
              'Verified channel. Do not assume WhatsApp is synchronized with the IPS inbox.'}
          </p>}
          {current.preferred_channel==='whatsapp'&&!current.contact_verified&&current.status!=='closed'&&hasAdminPermission('support.manage')&&
            <div className="card" style={{margin:'12px 0',padding:13}}>
              <strong>Confirm customer-initiated WhatsApp chat manually</strong>
              <p style={{fontSize:'.82rem'}}>First inspect the incoming WhatsApp message on IPS's business phone. Check that its sender matches the number stored here and that it contains this exact enquiry reference. No Meta API access is required.</p>
              <label style={{display:'block',marginTop:10}}>Sender number shown in WhatsApp
                <input className="form-input" value={observedNumber} onChange={e=>setObservedNumber(e.target.value)} placeholder="+48123456789" autoComplete="off"/>
              </label>
              <label style={{display:'block',marginTop:10}}>Exact reference sent in WhatsApp
                <input className="form-input" value={observedReference} onChange={e=>setObservedReference(e.target.value)} placeholder={current.enquiry_id} autoComplete="off"/>
              </label>
              <label style={{display:'flex',alignItems:'start',gap:7,margin:'12px 0'}}>
                <input type="checkbox" checked={manualAttestation} onChange={e=>setManualAttestation(e.target.checked)}/>
                I personally checked the incoming WhatsApp sender and exact reference. No confidential documents were copied to the IPS inbox.
              </label>
              <button type="button" className="btn btn-primary" disabled={busy||!manualAttestation||!observedNumber.trim()||observedReference!==current.enquiry_id}
                onClick={confirmDirectWhatsapp}>Record manual contact confirmation</button>
            </div>}
          {current.preferred_channel==='whatsapp'&&current.status!=='closed'&&hasAdminPermission('support.manage')&&
            <div style={{margin:'12px 0',padding:12,border:'1px solid var(--border)',borderRadius:8}}>
              <label style={{display:'flex',gap:7,alignItems:'start'}}>
                <input type="checkbox" checked={withdrawalConfirmed} onChange={e=>setWithdrawalConfirmed(e.target.checked)}/>
                The customer withdrew permission for WhatsApp contact or asked IPS to stop. Close this request and block further replies.
              </label>
              <button type="button" className="btn btn-ghost" disabled={busy||!withdrawalConfirmed} onClick={withdrawDirectWhatsapp}>Record contact withdrawal</button>
            </div>}
          <div style={{margin:'14px 0',padding:'13px 15px',border:'1px solid var(--border)',borderRadius:8}}>
            <strong>IPS email notifications</strong>
            {emailJobs.length?emailJobs.map(job=><p key={job._id||job.kind} style={{fontSize:'.83rem',margin:'8px 0'}}>
              {job.kind==='client_receipt'?'Customer confirmation':'IPS staff alert'}:
              <b> {job.status}</b>
              {job.status==='accepted'?' (provider accepted; inbox delivery not yet confirmed)':''}
              {job.status==='bounced'||job.status==='complained'?' (do not resend without investigating)':''}
            </p>):<p style={{fontSize:'.82rem',color:'var(--text-muted)'}}>
              No automatic notification was queued. Email automation may be disabled on this backend.
            </p>}
          </div>
          <label style={{display:'block',marginBottom:18}}>Status
            <select className="form-select" value={current.status} disabled={busy} onChange={e=>update({status:e.target.value})} style={{marginTop:5}}>
              <option value="new">New</option><option value="in_progress">In progress</option>
              <option value="waiting_for_customer">Waiting for customer</option><option value="closed">Closed</option>
            </select>
          </label>
          <div style={{display:'flex',gap:10,flexWrap:'wrap',alignItems:'end',marginBottom:18}}>
            <label style={{flex:'1 1 230px'}}>Next promised written update (optional)
              <input className="form-input" type="datetime-local" value={nextUpdate} disabled={busy||current.status==='closed'}
                onChange={e=>setNextUpdate(e.target.value)} style={{marginTop:5}}/>
            </label>
            <button type="button" className="btn btn-ghost" disabled={busy||current.status==='closed'}
              onClick={()=>update({next_update_at:nextUpdate?new Date(nextUpdate).toISOString():null})}>
              Save update deadline
            </button>
          </div>
          <p style={{fontSize:'.81rem',color:'var(--text-muted)',marginBottom:16}}>
            Do not promise a date IPS cannot meet. Saving a deadline does not send a message; send any commitment through the customer's verified channel.
          </p>
          <div style={{borderTop:'1px solid var(--border)',paddingTop:12,marginBottom:16}}>
            {(current.messages||[]).map((m,i)=><div key={m._id||i} style={{padding:13,marginBottom:9,border:'1px solid var(--border)',borderRadius:8,background:'var(--bg-surface-2)'}}>
              <small>{m.direction==='inbound'?'Customer':'IPS · '+m.channel} · {m.delivery_status}</small>
              <p style={{whiteSpace:'pre-wrap',overflowWrap:'anywhere',marginTop:6}}>{m.body}</p>
            </div>)}
          </div>
          {['email','workspace'].includes(current.preferred_channel)&&<form onSubmit={send}>
            <label className="form-label">{current.preferred_channel==='workspace'?'Reply in private IPS workspace':current.preferred_channel==='email'?'Reply by verified IPS email':'Reply using the verified external conversation link above'}</label>
            <textarea className="form-textarea" maxLength={2400} minLength={3} rows={5} required value={message} onChange={e=>setMessage(e.target.value)} placeholder="Write a response to this customer" />
            {['email','workspace'].includes(current.preferred_channel)&&
            <button type="submit" className="btn btn-primary"
              disabled={busy||!current.contact_verified||current.status==='closed'||(current.preferred_channel==='email'&&(!emailReady||!current.email))}
              style={{marginTop:12}}>
              {busy?'Sending…':current.preferred_channel==='workspace'?'Send Private Workspace Reply':'Send Verified Email'}
            </button>}
          </form>}
          {current.preferred_channel==='email'&&!emailReady&&<p style={{fontSize:'.8rem',color:'var(--text-muted)',marginTop:10}}>Email requires a verified IPS sender and backend mail provider. Do not use a personal account or change the customer's selected channel.</p>}
          {['telegram','whatsapp'].includes(current.preferred_channel)&&<p style={{fontSize:'.8rem',color:'var(--text-muted)',marginTop:10}}>Reply only through the verified, customer-selected external chat. WhatsApp is manually handled and no chat history is imported into this IPS inbox. No phone or voice calls.</p>}
        </>}
      </section>
    </div>
  </div>;
}
