import React,{useCallback,useEffect,useState} from 'react';
import {useSearchParams} from 'react-router-dom';

// Genuine external support only. Telegram is provider-connected; WhatsApp
// stays an external manual business-number conversation, never a fake inbox.
export default function ChannelInbox(){
  const [params]=useSearchParams();
  const linkedThread=String(params.get('thread')||'');
  const [threads,setThreads]=useState([]);
  const [selected,setSelected]=useState('');
  const [messages,setMessages]=useState([]);
  const [body,setBody]=useState('');
  const [error,setError]=useState('');
  const [notice,setNotice]=useState('');
  const [loading,setLoading]=useState(false);
  const [refreshing,setRefreshing]=useState(false);

  const refresh=useCallback(async()=>{
    setRefreshing(true);
    try{
      const response=await fetch('/api/contact-channels/admin/threads',{cache:'no-store',credentials:'same-origin'});
      const result=await response.json().catch(()=>({}));
      if(!response.ok||!result.success)throw Error(result.error||'Could not load the customer inbox.');
      const rows=result.threads||[];
      setThreads(rows);
      setSelected(id=>id&&rows.some(t=>t._id===id)?id:rows[0]?._id||'');
      setError('');
    }catch(err){setError(err.message);}
    finally{setRefreshing(false);}
  },[]);
  const loadMessages=useCallback(async()=>{
    if(!selected){setMessages([]);return;}
    try{
      const response=await fetch('/api/contact-channels/admin/threads/'+encodeURIComponent(selected)+'/messages',{cache:'no-store',credentials:'same-origin'});
      const result=await response.json().catch(()=>({}));
      if(!response.ok||!result.success)throw Error(result.error||'Could not load this conversation.');
      setMessages(result.messages||[]);
    }catch(err){setError(err.message);}
  },[selected]);

  useEffect(()=>{refresh();},[refresh]);
  useEffect(()=>{if(/^[a-f0-9]{24}$/i.test(linkedThread))setSelected(linkedThread);},[linkedThread]);
  useEffect(()=>{loadMessages();},[loadMessages]);
  useEffect(()=>{
    const timer=setInterval(()=>{refresh();if(selected)loadMessages();},30000);
    return ()=>clearInterval(timer);
  },[refresh,loadMessages,selected]);

  const contact=threads.find(t=>t._id===selected);
  const connectedTelegram=contact?.channel==='telegram';
  const generalSupport=connectedTelegram&&contact?.support_reply_allowed===true&&!contact?.verified_contact;
  const canReply=Boolean(contact&&contact.status==='open'&&connectedTelegram&&(contact.verified_contact||generalSupport));
  const replyLimit=generalSupport?650:2000;

  async function reply(event){
    event.preventDefault();
    if(!canReply||loading||!body.trim())return;
    setLoading(true);setError('');setNotice('');
    try{
      const response=await fetch('/api/contact-channels/admin/threads/'+encodeURIComponent(selected)+'/reply',{
        method:'POST',credentials:'same-origin',headers:{'Content-Type':'application/json'},
        body:JSON.stringify({body:body.trim()})
      });
      const data=await response.json().catch(()=>({}));
      if(!response.ok||!data.success)throw Error(data.error||'The provider did not accept the message.');
      setBody('');
      await loadMessages();
      await refresh();
      setNotice(data.delivery==='provider_accepted'
        ?'Telegram accepted your reply. That is a provider acknowledgment, not proof the customer read it.'
        :'The reply was recorded.');
    }catch(err){setError(err.message);}
    finally{setLoading(false);}
  }

  return <section className="ips-telegram-desk" style={{maxWidth:1380,margin:'0 auto'}}>
    <div style={{display:'flex',alignItems:'start',justifyContent:'space-between',gap:16,flexWrap:'wrap',marginBottom:20}}>
      <div>
        <small style={{color:'var(--text-secondary)',letterSpacing:'.11em',fontWeight:700}}>IPS ACADEMIC SERVICES · WRITTEN SUPPORT</small>
        <h1 style={{fontSize:'1.65rem',margin:'5px 0 8px'}}>Telegram customer inbox</h1>
        <p style={{color:'var(--text-muted)',margin:0,maxWidth:710}}>Answer customer-initiated enquiries in writing. Private quotations, files, identities and project records remain inside the protected IPS workspace.</p>
      </div>
      <button type="button" className="btn btn-secondary" onClick={()=>{refresh();loadMessages();}} disabled={refreshing}>{refreshing?'Refreshing…':'Refresh messages'}</button>
    </div>
    <div className="card" style={{padding:'13px 18px',borderLeft:'3px solid #b99a6a',marginBottom:16}}>
      <b>WhatsApp remains manual.</b> Clients open the IPS business number and send their quotation reference. WhatsApp messages are not imported into this inbox. For manual confirmation and handling, use <a href="/admin/enquiries">Quotes & enquiries</a>. No telephone calls.
    </div>
    {error&&<p className="card" role="alert" style={{color:'var(--danger)',marginBottom:12}}>{error}</p>}
    {notice&&<p className="card" role="status" style={{marginBottom:12,borderLeft:'3px solid #4e9c83'}}>{notice}</p>}
    <div className="ips-telegram-grid" style={{display:'grid',gridTemplateColumns:'minmax(250px,0.85fr) minmax(0,1.5fr)',gap:16,alignItems:'start'}}>
      <section className="card" style={{minWidth:0,overflow:'hidden'}}>
        <h2 style={{fontSize:'1rem',marginBottom:13}}>Conversations <span style={{color:'var(--text-muted)'}}>({threads.length})</span></h2>
        {!threads.length&&<p style={{color:'var(--text-muted)'}}>No customer-initiated messages are recorded yet.</p>}
        <div style={{display:'grid',gap:8,maxHeight:'min(65vh,640px)',overflowY:'auto'}}>
          {threads.map(t=><button key={t._id} type="button" onClick={()=>{setSelected(t._id);setBody('');setError('');setNotice('');}}
            aria-pressed={selected===t._id}
            style={{textAlign:'left',width:'100%',padding:13,border:'1px solid '+(selected===t._id?'#b99a6a':'var(--border)'),borderRadius:10,background:selected===t._id?'var(--bg-surface-2)':'transparent',color:'var(--text-primary)',cursor:'pointer'}}>
            <div style={{display:'flex',justifyContent:'space-between',gap:8,alignItems:'start'}}>
              <strong style={{overflowWrap:'anywhere'}}>{t.display_name||'Customer conversation'}</strong>
              {t.unread_count>0&&<span style={{fontSize:'.74rem',color:'var(--text-secondary)'}}>{t.unread_count} new</span>}
            </div>
            <small style={{display:'block',marginTop:5,color:'var(--text-muted)'}}>{t.channel==='telegram'?'Telegram':'Archived external chat'} · {t.status==='closed'?'Closed':t.verified_contact?'Verified project contact':t.support_reply_allowed?'General support — reply permitted':'Awaiting customer verification'}</small>
          </button>)}
        </div>
      </section>
      <section className="card" style={{minWidth:0}}>
        {!contact?<p style={{color:'var(--text-muted)'}}>Select a conversation to review and respond.</p>:<>
          <h2 style={{fontSize:'1.08rem',margin:'0 0 5px',overflowWrap:'anywhere'}}>{contact.display_name||'Customer'} · {contact.channel}</h2>
          <p style={{fontSize:'.84rem',color:'var(--text-muted)',marginBottom:14}}>
            {contact.status==='closed'?'Conversation closed. Do not contact the customer.'
              :contact.verified_contact?'Identity linked to a verified, consented IPS request.'
              :generalSupport?'Customer initiated a recent general-support message. One short support reply is permitted; this does not verify their IPS identity.'
              :contact.channel==='whatsapp'?'WhatsApp is manual. Continue through the IPS business phone, not this provider inbox.'
              :'No current support reply permission. Ask the customer to send a new Telegram message or submit a private quotation request.'}
          </p>
          <div aria-label="Conversation history" style={{maxHeight:420,minHeight:180,overflowY:'auto',padding:'4px 2px 12px',borderTop:'1px solid var(--border)'}}>
            {messages.map(m=><div key={m._id} style={{margin:'11px 0',padding:'11px 14px',maxWidth:'92%',marginLeft:m.direction==='outbound'?'auto':0,background:m.direction==='outbound'?'var(--bg-active)':'var(--bg-surface-2)',border:'1px solid var(--border)',borderRadius:11}}>
              <small style={{color:'var(--text-muted)'}}>{m.direction==='inbound'?'Customer':'IPS team'} · {m.createdAt?new Date(m.createdAt).toLocaleString():''}</small>
              <p style={{margin:'5px 0 0',whiteSpace:'pre-wrap',overflowWrap:'anywhere'}}>{m.body}</p>
            </div>)}
          </div>
          {canReply?<form onSubmit={reply} style={{borderTop:'1px solid var(--border)',paddingTop:13}}>
            <label htmlFor="ips-telegram-reply" className="form-label">{generalSupport?'General support reply (one per customer message)':'Reply in verified Telegram conversation'}</label>
            <textarea id="ips-telegram-reply" className="form-textarea" value={body} onChange={e=>setBody(e.target.value)} maxLength={replyLimit} rows={4} required placeholder={generalSupport?'Acknowledge the enquiry and direct the customer to the confidential IPS quotation form if needed.':'Write a response in the customer-selected channel.'}/>
            {generalSupport&&<small style={{display:'block',color:'var(--text-muted)',margin:'7px 0'}}>Up to 650 characters. Do not send links, payment requests, case references, names or research details. For private work, request verification within IPS.</small>}
            <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',gap:10,marginTop:10}}>
              <small style={{color:'var(--text-muted)'}}>{body.length}/{replyLimit} characters · written messages only</small>
              <button type="submit" className="btn btn-primary" disabled={loading||!body.trim()}>{loading?'Sending…':'Send Telegram reply'}</button>
            </div>
          </form>:<div className="card" style={{padding:12,background:'var(--bg-surface-2)',fontSize:'.85rem'}}>Sending is restricted until the customer initiates a new Telegram enquiry or verifies an IPS request. Their existing messages are still visible for review.</div>}
        </>}
      </section>
    </div>
    <style>{'@media (max-width:900px){.ips-telegram-grid{grid-template-columns:1fr!important;}.ips-telegram-grid > section{width:100%;}}'}</style>
  </section>;
}
