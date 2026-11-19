import React,{useCallback,useEffect,useState} from 'react';
import {serviceTitle,quoteStatusTitle} from '../../utils/quoteLabels.js';

// This inbox intentionally reads only quotations associated with the
// authenticated IPS student session. The public quote reference is not an
// authorization token and must never be used for guest lookup.
export default function PrivateQuoteInbox(){
  const [rows,setRows]=useState([]),[selected,setSelected]=useState(''),[message,setMessage]=useState('');
  const [error,setError]=useState(''),[notice,setNotice]=useState(''),[busy,setBusy]=useState(false),[loading,setLoading]=useState(true);
  const refresh=useCallback(async()=>{
    try{
      const response=await fetch('/api/quote-requests/me',{credentials:'same-origin',cache:'no-store'});
      const result=await response.json().catch(()=>({}));
      if(!response.ok||!result.success)throw Error(result.error||'Could not load your private messages.');
      setRows(result.quotes||[]);
      setSelected(id=>(result.quotes||[]).some(row=>row.enquiry_id===id)?id:result.quotes?.[0]?.enquiry_id||'');
      setError('');
    }catch(err){setError(err.message||'Private quote messages are temporarily unavailable.');}
    finally{setLoading(false);}
  },[]);
  useEffect(()=>{refresh();},[refresh]);
  const quote=rows.find(row=>row.enquiry_id===selected);
  async function send(e){
    e.preventDefault();
    if(!quote||message.trim().length<3)return;
    setError('');setNotice('');setBusy(true);
    try{
      const res=await fetch('/api/quote-requests/'+encodeURIComponent(quote.enquiry_id)+'/workspace-reply',{
        method:'POST',credentials:'same-origin',headers:{'Content-Type':'application/json'},
        body:JSON.stringify({message:message.trim()})
      });
      const data=await res.json().catch(()=>({}));
      if(!res.ok||!data.success)throw Error(data.error||'Your message was not sent.');
      setMessage('');
      setNotice('Your written reply has been saved for IPS.');
      await refresh();
    }catch(err){setError(err.message||'Unable to save your reply.');}
    finally{setBusy(false);}
  }
  return <section className="card" aria-labelledby="ips-private-quotes-title" style={{marginBottom:'1.5rem',borderTop:'4px solid var(--primary)'}}>
    <div style={{display:'flex',gap:12,justifyContent:'space-between',alignItems:'start',flexWrap:'wrap'}}>
      <div>
        <h2 id="ips-private-quotes-title" style={{margin:'0 0 .3rem'}}>Private Quote Messages</h2>
        <p style={{margin:0,color:'var(--text-muted)',fontSize:'.87rem'}}>
          Written quotations and questions sent to your IPS workspace. Only your verified account can read them.
        </p>
      </div>
      <button type="button" className="btn btn-ghost btn-sm" onClick={()=>{setLoading(true);refresh();}} disabled={busy}>Refresh</button>
    </div>
    {loading?<p role="status">Loading your private quotations…</p>:null}
    {error?<p role="alert" style={{color:'var(--danger)',fontSize:'.85rem'}}>{error}</p>:null}
    {!loading&&!error&&rows.length===0?<p style={{color:'var(--text-muted)',fontSize:'.88rem'}}>No quotations are linked to this workspace yet. <a href="/#request-support">Get a Quote</a> to submit a private request.</p>:null}
    {rows.length>0&&<div style={{display:'grid',gridTemplateColumns:'minmax(0,1fr)',gap:14,marginTop:18}}>
      <label className="form-group"><span className="form-label">Choose your quotation</span>
        <select className="form-select" value={selected} onChange={e=>{setSelected(e.target.value);setMessage('');setNotice('');}}>
          {rows.map(row=><option value={row.enquiry_id} key={row.enquiry_id}>{row.enquiry_id} · {serviceTitle(row.service)} · {quoteStatusTitle(row.status)}</option>)}
        </select>
      </label>
      {quote&&<div>
        <p style={{fontSize:'.83rem',color:'var(--text-muted)'}}>Private reference: <strong>{quote.enquiry_id}</strong>. Status: <strong>{quoteStatusTitle(quote.status)}</strong>. Quotation details and payment arrangements require separate confirmation.</p>
        {quote.next_update_at&&quote.status!=='closed'&&quote.status!=='waiting_for_customer'&&
          <p role="status" style={{fontSize:'.85rem',fontWeight:600}}>Next written IPS update expected by: {new Date(quote.next_update_at).toLocaleString()}. If this time has passed, IPS still has your request and should provide an update.</p>}
        {!quote.next_update_at&&quote.status==='new'&&
          <p style={{fontSize:'.83rem',color:'var(--text-muted)'}}>Your request is safely recorded and awaiting human review. IPS has not yet committed to a review time.</p>}
        <div aria-label="Written quotation conversation" style={{maxHeight:320,overflowY:'auto',background:'var(--bg-surface-2)',borderRadius:8,padding:12}}>
          {(quote.messages||[]).map((item,i)=><article key={item._id||i} style={{padding:12,marginBottom:9,background:'var(--bg-surface)',borderRadius:7}}>
            <strong style={{fontSize:'.78rem'}}>{item.direction==='outbound'?'IPS Academic Services':'You'}</strong>
            <p style={{whiteSpace:'pre-wrap',overflowWrap:'anywhere',margin:'6px 0 0',fontSize:'.87rem'}}>{item.body}</p>
          </article>)}
        </div>
        {quote.status!=='closed'&&<form onSubmit={send} style={{marginTop:15}}>
          <label className="form-group"><span className="form-label">Reply privately to IPS</span>
            <textarea className="form-textarea" required minLength={3} maxLength={2400} rows={3}
              value={message} onChange={e=>setMessage(e.target.value)} placeholder="Ask a question or clarify your request."/>
          </label>
          {notice&&<p role="status" style={{fontSize:'.8rem'}}>{notice}</p>}
          <button type="submit" className="btn btn-primary" disabled={busy||message.trim().length<3}>{busy?'Saving…':'Send Written Reply'}</button>
        </form>}
      </div>}
    </div>}
    <p style={{fontSize:'.77rem',marginTop:18,color:'var(--text-muted)'}}>
      IPS does not call customers. Avoid posting account passwords, card numbers or identifiable research participant data.
      Your username and academic requests are not public.
    </p>
  </section>;
}
