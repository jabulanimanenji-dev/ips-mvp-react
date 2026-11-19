import React,{useCallback,useEffect,useState} from 'react';
import {useSearchParams} from 'react-router-dom';

export default function ChannelInbox(){
  const [params]=useSearchParams();
  const linkedThread=String(params.get('thread')||'');
  const [threads,setThreads]=useState([]);
  const [selected,setSelected]=useState('');
  const [messages,setMessages]=useState([]);
  const [body,setBody]=useState('');
  const [error,setError]=useState('');
  const [loading,setLoading]=useState(false);

  const refresh=useCallback(async()=>{
    try{
      const response=await fetch('/api/contact-channels/admin/threads',{cache:'no-store'});
      const result=await response.json();
      if(!response.ok)throw Error(result.error||'Could not load inbox');
      setThreads(result.threads||[]);
      setSelected(id=>id||(result.threads?.[0]?._id||''));
    }catch(err){setError(err.message);}
  },[]);
  const loadMessages=useCallback(async()=>{
    if(!selected)return;
    try{
      const response=await fetch('/api/contact-channels/admin/threads/'+encodeURIComponent(selected)+'/messages',{cache:'no-store'});
      const result=await response.json();
      if(!response.ok)throw Error(result.error||'Could not load messages');
      setMessages(result.messages||[]);
    }catch(err){setError(err.message);}
  },[selected]);

  useEffect(()=>{refresh();},[refresh]);
  useEffect(()=>{if(/^[a-f0-9]{24}$/i.test(linkedThread))setSelected(linkedThread);},[linkedThread]);
  useEffect(()=>{loadMessages();},[loadMessages]);
  async function reply(event){
    event.preventDefault();setError('');
    if(!body.trim())return;
    setLoading(true);
    try{
      const response=await fetch('/api/contact-channels/admin/threads/'+encodeURIComponent(selected)+'/reply',{
        method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({body})});
      const data=await response.json();
      if(!response.ok)throw Error(data.error||'Unable to send reply.');
      setBody('');await loadMessages();await refresh();
    }catch(err){setError(err.message);}
    finally{setLoading(false);}
  }
  const contact=threads.find(t=>t._id===selected);
  return <div>
    <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',gap:12,flexWrap:'wrap',marginBottom:18}}>
      <div><h1>External conversations</h1><p style={{color:'var(--text-muted)'}}>Incoming WhatsApp and Telegram support, separate from the governed customer workspace.</p></div>
      <button className="btn btn-ghost" onClick={()=>{refresh();loadMessages();}}>Refresh</button>
    </div>
    <p className="card" style={{fontSize:'.83rem',borderLeft:'4px solid var(--primary)'}}>Unverified chat identities cannot access IPS orders. Keep confidential documents, payments and identity verification in the IPS account. WhatsApp replies require a recent customer-initiated conversation.</p>
    {error&&<p role="alert" className="card" style={{color:'var(--danger)'}}>{error}</p>}
    <div className="grid grid-2 gap-3" style={{alignItems:'start'}}>
      <section className="card"><h3>Conversations ({threads.length})</h3>
        {threads.length===0&&<p>No incoming external messages recorded.</p>}
        <div style={{display:'flex',flexDirection:'column',gap:7}}>
          {threads.map(t=><button type="button" key={t._id} onClick={()=>setSelected(t._id)}
            style={{textAlign:'left',padding:12,border:'1px solid var(--border)',borderRadius:8,background:t._id===selected?'var(--bg-surface-2)':'transparent',color:'var(--text-primary)',cursor:'pointer'}}>
            <strong>{t.display_name||t.channel} · {t.channel}</strong><br/>
            <small>{t.status==='closed'?'Opted out / closed':t.verified_contact?'Verified written-contact request':t.client_id?'IPS account linked — no verified enquiry':'Unverified external contact'}{t.unread_count?' · '+t.unread_count+' unread':''}</small>
          </button>)}
        </div>
      </section>
      <section className="card">
        <h3>{contact?((contact.display_name||contact.channel)+' · '+contact.channel):'Select a conversation'}</h3>
        {contact&&<p style={{fontSize:'.8rem',color:'var(--text-muted)'}}>{contact.status==='closed'?'Contact withdrawn or closed':contact.verified_contact?'Customer-verified written channel':'No verified request — replies disabled'} — Keep academic documents and private project records in the protected IPS workspace.</p>}
        <div style={{maxHeight:500,minHeight:180,overflowY:'auto',padding:'10px 0'}}>
          {messages.map(m=><div key={m._id} style={{padding:12,marginBottom:8,background:m.direction==='inbound'?'var(--bg-surface-2)':'var(--bg-surface)',borderRadius:9}}>
            <small>{m.direction==='inbound'?'Customer':'IPS team'} · {new Date(m.createdAt).toLocaleString()}</small>
            <p style={{whiteSpace:'pre-wrap',overflowWrap:'anywhere',marginTop:5}}>{m.body}</p>
          </div>)}
        </div>
        {contact&&<form onSubmit={reply}>
          <label className="form-group"><span className="form-label">Reply through the customer's verified channel</span><textarea className="form-textarea" value={body} onChange={e=>setBody(e.target.value)} rows={4} maxLength={2000} required/></label>
          <button type="submit" className="btn btn-primary" disabled={loading||!contact.verified_contact||contact.status==='closed'}>{loading?'Sending…':'Send reply'}</button>
        </form>}
      </section>
    </div>
  </div>;
}
