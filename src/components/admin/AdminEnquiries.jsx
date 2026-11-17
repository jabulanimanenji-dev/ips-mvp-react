import React,{useEffect,useState} from 'react';

function ContactActions({lead}){
  const {email,phone,preferred_channel,enquiry_id}=lead;
  return <div style={{display:'flex',gap:10,flexWrap:'wrap',marginBottom:14}}>
    {email&&<small>Email replies are sent from the IPS business address using the verified email service below—not your personal mail app.</small>}
    {phone&&preferred_channel==='phone'&&<a className="btn btn-ghost" href={'tel:'+phone}>Call {phone} ↗</a>}
    {phone&&preferred_channel==='whatsapp'&&<a className="btn btn-ghost" href={'https://wa.me/'+phone.replace('+','')+'?text='+encodeURIComponent('Hello '+lead.name+', this is IPS following up about your enquiry '+enquiry_id+'.') } target="_blank" rel="noopener noreferrer">Open WhatsApp ↗</a>}
    {preferred_channel==='telegram'&&<small>Telegram bot messages require the customer to start @IPScontactBot first. Request email or phone follow-up if needed.</small>}
  </div>;
}
export default function AdminEnquiries(){
  const [leads,setLeads]=useState([]),[selected,setSelected]=useState('');
  const [filter,setFilter]=useState('open'),[query,setQuery]=useState('');
  const [message,setMessage]=useState('');
  const [statusMessage,setStatusMessage]=useState('');
  const [busy,setBusy]=useState(false);
  const [emailReady,setEmailReady]=useState(false);
  const [error,setError]=useState('');
  const current=leads.find(v=>v.enquiry_id===selected);
  const visible=leads.filter(x=>(filter==='all'||(filter==='open'?x.status!=='closed':x.status===filter)) &&
      [x.enquiry_id,x.name,x.email,x.phone,x.subject].join(' ').toLowerCase().includes(query.toLowerCase()));
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
      <div><h1>Contact & callback requests</h1><p style={{color:'var(--text-muted)'}}>Incoming public enquiries. Reply using the customer's requested contact channel.</p></div>
      <button className="btn btn-ghost" type="button" onClick={()=>refresh()}>Refresh</button>
    </div>
    <p className="card" style={{marginBottom:15,fontSize:'.86rem'}}>Only contact clients about their enquiry and through the channel they have requested. Never disclose academic project files or passwords through messaging apps. Manual email/call links open other apps and do not record successful delivery in IPS.</p>
    {error&&<div role="alert" className="card" style={{color:'var(--danger)',marginBottom:12}}>{error}</div>}
    {statusMessage&&<div role="status" className="card" style={{marginBottom:12}}>{statusMessage}</div>}
    <div className="grid grid-2 gap-3" style={{alignItems:'start'}}>
      <section className="card">
        <h3>Contact queue ({leads.length})</h3>
        <div style={{display:'flex',gap:8,margin:'12px 0'}}>
          <input className="form-input" value={query} onChange={e=>setQuery(e.target.value)} placeholder="Search name or reference" aria-label="Search enquiries"/>
          <select className="form-select" value={filter} onChange={e=>setFilter(e.target.value)} aria-label="Filter enquiries">
            <option value="open">Active</option><option value="all">All</option><option value="new">New</option>
            <option value="in_progress">In progress</option><option value="waiting_for_customer">Waiting</option><option value="closed">Closed</option>
          </select>
        </div>
        {visible.length===0&&<p>No enquiries in this view.</p>}
        <div style={{display:'grid',gap:7}}>
          {visible.map(x=><button key={x.enquiry_id} onClick={()=>{setSelected(x.enquiry_id);setMessage('');}}
            style={{background:selected===x.enquiry_id?'var(--bg-active)':'transparent',padding:13,textAlign:'left',color:'var(--text-primary)',border:'1px solid var(--border)',borderRadius:8,cursor:'pointer'}}>
            <strong>{x.subject}</strong><small style={{display:'block',marginTop:6,color:'var(--text-muted)'}}>{x.name} · {x.preferred_channel} · {x.status}</small>
          </button>)}
        </div>
      </section>
      <section className="card">
        {!current?<p>Select a contact request.</p>:<>
          <h3 style={{marginBottom:8}}>{current.subject}</h3>
          <small>{current.enquiry_id} · {current.name} · {new Date(current.createdAt).toLocaleString()}</small>
          <p style={{marginTop:10}}><b>Preferred contact:</b> {current.preferred_channel}</p>
          <p><b>Contact details:</b> {current.email||'No email'} {current.phone||''}</p>
          <p style={{fontSize:'.8rem',color:'var(--text-muted)'}}>Enquiry-specific contact permission recorded: {current.contact_consent?'Yes':'No'} · {current.consent_at?new Date(current.consent_at).toLocaleString():''}</p>
          <ContactActions lead={current}/>
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
            <button type="submit" className="btn btn-primary" disabled={busy||!emailReady||!current.email||current.status==='closed'} style={{marginTop:12}}>{busy?'Sending…':'Send verified email'}</button>
          </form>
          {!emailReady&&<p style={{fontSize:'.8rem',color:'var(--text-muted)',marginTop:10}}>Automated email requires a verified sending domain and backend Resend key. You can use the phone/WhatsApp contact links above in the meantime. Do not reply using a personal email address.</p>}
        </>}
      </section>
    </div>
  </div>;
}
