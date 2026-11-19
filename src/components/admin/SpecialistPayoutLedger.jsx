import React,{useEffect,useState} from 'react';
import {Link} from 'react-router-dom';

const money=(minor,currency)=>new Intl.NumberFormat('en-GB',{style:'currency',currency:currency||'PLN'}).format(Number(minor||0)/100);
export default function SpecialistPayoutLedger(){
  const [requests,setRequests]=useState([]);
  const [payouts,setPayouts]=useState([]);
  const [requestId,setRequestId]=useState('');
  const [amount,setAmount]=useState('');
  const [scope,setScope]=useState('');
  const [references,setReferences]=useState({});
  const [error,setError]=useState(''),[notice,setNotice]=useState(''),[busy,setBusy]=useState(false);
  const refresh=async()=>{
    const [orders,records]=await Promise.all([
      fetch('/api/services',{cache:'no-store'}).then(r=>r.ok?r.json():Promise.reject(Error('Services unavailable.'))),
      fetch('/api/specialist-payouts/admin',{cache:'no-store'}).then(r=>r.ok?r.json():Promise.reject(Error('Payout ledger unavailable.')))
    ]);
    if(!orders.success||!records.success)throw Error('IPS could not load complete payout records.');
    setRequests(orders.requests||[]);setPayouts(records.payouts||[]);
  };
  useEffect(()=>{refresh().catch(e=>setError(e.message));},[]);
  const eligible=requests.filter(r=>r.category==='Academic Support'&&r.status==='Completed'&&
    r.payment_status==='paid'&&r.provider_id&&!payouts.some(p=>p.request_id===r.request_id));
  async function send(url,data){
    setError('');setNotice('');setBusy(true);
    try{
      const response=await fetch(url,{method:'POST',credentials:'same-origin',
        headers:{'Content-Type':'application/json'},body:JSON.stringify(data)});
      const outcome=await response.json().catch(()=>({}));
      if(!response.ok||!outcome.success)throw Error(outcome.error||'Finance approval could not be recorded.');
      await refresh();
      setNotice('The financial record has been saved and audited. IPS must independently verify any external bank transfer.');
    }catch(e){setError(e.message||'Financial record not saved.');}
    finally{setBusy(false);}
  }
  const create=e=>{
    e.preventDefault();
    if(!requestId||!amount||!scope.trim())return;
    void send('/api/specialist-payouts/admin',{
      request_id:requestId,amount:Number(amount),agreed_scope:scope.trim()
    }).then(()=>{setRequestId('');setAmount('');setScope('');});
  };
  return <section className="card" aria-label="Specialist payout reconciliation" style={{marginTop:22}}>
    <h3>Verified Specialist Payments</h3>
    <p style={{color:'var(--text-muted)',fontSize:'.88rem'}}>Only completed, provider-paid IPS engagements become eligible. An approved amount is owed, not yet paid. Mark paid only after an external transfer has actually been completed and evidenced.</p>
    {error&&<p role="alert" style={{color:'var(--danger)'}}>{error}</p>}
    {notice&&<p role="status">{notice}</p>}
    <form onSubmit={create} style={{display:'grid',gap:10,margin:'20px 0'}}>
      <label className="form-group"><span className="form-label">Completed and paid engagement</span>
        <select className="form-select" value={requestId} onChange={e=>setRequestId(e.target.value)} required>
          <option value="">Select a completed order</option>
          {eligible.map(job=><option key={job.request_id} value={job.request_id}>
            {job.request_id} · {job.title} · {job.provider_name||'Assigned specialist'} · {job.quote?.currency} {job.quote?.total}
          </option>)}
        </select>
      </label>
      <label className="form-group"><span className="form-label">Agreed specialist fee in order currency</span>
        <input className="form-input" required type="number" min=".01" max="100000" step=".01" value={amount}
          onChange={e=>setAmount(e.target.value)}/>
      </label>
      <label className="form-group"><span className="form-label">Written approved specialist payout scope</span>
        <textarea className="form-textarea" rows={2} minLength={10} maxLength={1000} required
          value={scope} onChange={e=>setScope(e.target.value)}/>
      </label>
      <button className="btn btn-primary" disabled={busy||!requestId} type="submit">
        Approve recorded specialist payout
      </button>
    </form>
    <div style={{overflowX:'auto'}}>
      <table className="data-table">
        <thead><tr><th>Engagement</th><th>Specialist</th><th>Approved fee</th><th>Status</th><th>Bank transfer confirmation</th></tr></thead>
        <tbody>{payouts.map(p=><tr key={p.request_id}>
          <td><Link to={'/admin/services/'+encodeURIComponent(p.request_id)}>{p.request_id}</Link></td>
          <td>{p.writer_id}</td><td>{money(p.amount_minor,p.currency)}</td>
          <td>{p.status==='paid'?'Staff-recorded as transferred':'Approved — not paid'}</td>
          <td>{p.status==='paid'?<span>{p.payment_reference}</span>:
            <div style={{display:'flex',gap:8}}>
              <input className="form-input" placeholder="Actual bank confirmation ref"
                value={references[p.request_id]||''} maxLength={160}
                onChange={e=>setReferences(v=>({...v,[p.request_id]:e.target.value}))}/>
              <button className="btn btn-ghost btn-sm" disabled={busy||String(references[p.request_id]||'').trim().length<6}
                onClick={()=>send('/api/specialist-payouts/admin/'+encodeURIComponent(p.request_id)+'/record-bank-transfer',
                  {reference:references[p.request_id]})}>Confirm transfer</button>
            </div>}</td>
        </tr>)}</tbody>
      </table>
      {!payouts.length&&<p>No approved specialist payouts are currently recorded.</p>}
    </div>
  </section>;
}
