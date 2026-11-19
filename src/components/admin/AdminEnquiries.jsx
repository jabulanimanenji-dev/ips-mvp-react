import React,{useEffect,useState} from 'react';

function ContactActions({lead}){
  const {email,phone,preferred_channel,enquiry_id,contact_verified}=lead;
  return <div style={{display:'flex',gap:10,flexWrap:'wrap',marginBottom:14}}>
    <p style={{fontSize:'.81rem',color:'var(--text-muted)'}}>
      {contact_verified?'Written contact verified.':'Contact not yet verified — do not send a quotation or private project details.'}
    </p>
    {email&&preferred_channel==='email'&&contact_verified&&
      <small>Email replies use only the verified IPS business address. Do not send from a personal account.</small>}
    {phone&&preferred_channel==='whatsapp'&&contact_verified&&
      <a className="btn btn-ghost" href={'https://wa.me/'+phone.replace('+','')+'?text='+encodeURIComponent('IPS reference: '+enquiry_id)}
        target="_blank" rel="noopener noreferrer">Open verified WhatsApp chat ↗</a>}
    {preferred_channel==='telegram'&&<small>Telegram contact requires the customer to start @IPScontactBot, provide their reference and link the conversation. Never send academic documents through bot chat.</small>}
    {preferred_channel==='workspace'&&<small>Customer chose their private IPS workspace. Record the quote in the authenticated project area, not email or external messaging.</small>}
  </div>;
}
export default function AdminEnquiries(){
  const [leads,setLeads]=useState([]),[selected,setSelected]=useState('');
  const [filter,setFilter]=useState('open'),[query,setQuery]=useState('');
  const [message,setMessage]=useState('');
  const [statusMessage,setStatusMessage]=useState('');
  const [busy,setBusy]=useState(false);
  const [emailReady,setEmailReady]=useState(false);
  const [emailJobs,setEmailJobs]=useState([]);
  const [error,setError]=useState('');
  const current=leads.find(v=>v.enquiry_id===selected);
  const visible=leads.filter(x=>(filter==='all'||(filter==='open'?x.status!=='closed':x.status===filter)) &&
      [x.enquiry_id,x.username,x.name,x.email,x.phone,x.subject].join(' ').toLowerCase().includes(query.toLowerCase()));
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
  async function send(event){
    event.preventDefault();if(!current||!message.trim())return;
    setError('');setStatusMessage('');setBusy(true);
    try{
      const response=await fetch('/api/contact-enquiries/admin/'+encodeURIComponent(current.enquiry_id)+'/email-reply',
      {method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({message})});
      const data=await response.json();
      if(!response.ok||!data.success)throw Error(data.error||'Email not confirmed.');
      setMessage('');setStatusMessage('Email accepted by provider (delivery is not guaranteed).');
      await refresh();
    }catch(ex){setError(ex.message);}
    finally{setBusy(false);}
  }
  return <div className="ips-contact-admin">
    <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',flexWrap:'wrap',gap:12,marginBottom:24}}>
      <div><h1>Private Quotes & Enquiries</h1><p style={{color:'var(--text-muted)'}}>Review private requests and reply only through each customer's verified, selected written channel.</p></div>
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
            <option value="in_progress">In progress</option><option value="waiting_for_customer">Waiting</option><option value="closed">Closed</option>
          </select>
        </div>
        {visible.length===0&&<p>No enquiries in this view.</p>}
        <div style={{display:'grid',gap:7}}>
          {visible.map(x=><button key={x.enquiry_id} onClick={()=>{setSelected(x.enquiry_id);setMessage('');}}
            style={{background:selected===x.enquiry_id?'var(--bg-active)':'transparent',padding:13,textAlign:'left',color:'var(--text-primary)',border:'1px solid var(--border)',borderRadius:8,cursor:'pointer'}}>
            <strong>{x.subject}</strong><small style={{display:'block',marginTop:6,color:'var(--text-muted)'}}>{x.username||x.name||'Private visitor'} · {x.preferred_channel} · {x.status}</small>
          </button>)}
        </div>
      </section>
      <section className="card">
        {!current?<p>Select a contact request.</p>:<>
          <h3 style={{marginBottom:8}}>{current.subject}</h3>
          <small>{current.enquiry_id} · {current.username||current.name||'Private visitor'} · {new Date(current.createdAt).toLocaleString()}</small>
          <p style={{marginTop:10}}><b>Preferred contact:</b> {current.preferred_channel}</p>
          <p><b>Written contact:</b> {current.email||current.telegram_username||current.phone||'Private workspace'} · {current.contact_verified?'Verified':'Awaiting verification'}</p>
          {current.request_type==='quote'&&<p><b>Quotation:</b> {current.service||'General'} · {current.discipline||'Unspecified discipline'} · {current.study_level||'Unspecified level'} · {current.preferred_deadline||'No deadline selected'}</p>}
          <p style={{fontSize:'.8rem',color:'var(--text-muted)'}}>Enquiry-specific contact permission recorded: {current.contact_consent?'Yes':'No'} · {current.consent_at?new Date(current.consent_at).toLocaleString():''}</p>
          <ContactActions lead={current}/>
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
          <div style={{borderTop:'1px solid var(--border)',paddingTop:12,marginBottom:16}}>
            {(current.messages||[]).map((m,i)=><div key={m._id||i} style={{padding:13,marginBottom:9,border:'1px solid var(--border)',borderRadius:8,background:'var(--bg-surface-2)'}}>
              <small>{m.direction==='inbound'?'Customer':'IPS · '+m.channel} · {m.delivery_status}</small>
              <p style={{whiteSpace:'pre-wrap',overflowWrap:'anywhere',marginTop:6}}>{m.body}</p>
            </div>)}
          </div>
          <form onSubmit={send}>
            <label className="form-label">Reply by email {emailReady?'(configured)':'(pending sender verification)'}</label>
            <textarea className="form-textarea" maxLength={2400} minLength={3} rows={5} required value={message} onChange={e=>setMessage(e.target.value)} placeholder="Write a response to this customer" />
            <button type="submit" className="btn btn-primary" disabled={busy||!emailReady||!current.email||current.preferred_channel!=='email'||!current.contact_verified||current.status==='closed'} style={{marginTop:12}}>{busy?'Sending…':'Send verified email'}</button>
          </form>
          {!emailReady&&<p style={{fontSize:'.8rem',color:'var(--text-muted)',marginTop:10}}>Automated email requires a verified sending domain and backend Resend key. Never switch a customer to another channel without permission, and do not use a personal email address.</p>}
        </>}
      </section>
    </div>
  </div>;
}
