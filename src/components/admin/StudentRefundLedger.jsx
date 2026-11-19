import React,{useEffect,useState} from 'react';

const fmt=(minor,currency)=>new Intl.NumberFormat('en-GB',{style:'currency',currency:currency||'PLN'}).format(Number(minor||0)/100);
export default function StudentRefundLedger({payments=[]}){
  const [refunds,setRefunds]=useState([]);
  const [requestId,setRequestId]=useState(''),[amount,setAmount]=useState(''),[reason,setReason]=useState('');
  const [busy,setBusy]=useState(false),[error,setError]=useState(''),[notice,setNotice]=useState('');
  async function refresh(){
    try{
      const response=await fetch('/api/student-refunds/admin',{cache:'no-store'});
      const data=await response.json().catch(()=>({}));
      if(!response.ok||!data.success)throw Error(data.error||'Refund ledger unavailable.');
      setRefunds(data.refunds||[]);setError('');
    }catch(e){setError(e.message);}
  }
  useEffect(()=>{refresh();},[]);
  const eligible=payments.filter(p=>p.status==='paid');
  const selected=eligible.find(p=>p.request_id===requestId);
  const maxAmount=selected?Math.max(0,Number(selected.amount_minor||0)-Number(selected.refunded_minor||0))/100:0;
  async function submit(event){
    event.preventDefault();setBusy(true);setError('');setNotice('');
    if(!selected)return setBusy(false);
    try{
      const refundMinor=amount.trim()?Math.round(Number(amount)*100):undefined;
      const response=await fetch('/api/student-refunds/admin',{
        method:'POST',credentials:'same-origin',headers:{'Content-Type':'application/json'},
        body:JSON.stringify({request_id:requestId,reason:reason.trim(),
          ...(refundMinor?{amount_minor:refundMinor}:{})})
      });
      const data=await response.json().catch(()=>({}));
      if(!response.ok||!data.success)throw Error(data.error||'The payment provider could not confirm this refund.');
      setNotice('Refund submitted to the real payment provider. It is only final when the verified provider reports success.');
      setRequestId('');setAmount('');setReason('');
      await refresh();
    }catch(e){setError(e.message||'Refund could not be safely submitted.');}
    finally{setBusy(false);}
  }
  return <section className="card" aria-label="Student refunds and finance reconciliation" style={{marginTop:20}}>
    <h3>Student Support — Actual Stripe Refunds</h3>
    <p style={{color:'var(--text-muted)',fontSize:'.87rem'}}>Only authorized finance staff can submit refunds against an actual verified settled Stripe charge. Requests use a one-time lock to avoid double reimbursement. A provider-pending response is never recorded as completed.</p>
    {error&&<p role="alert" style={{color:'var(--danger)'}}>{error}</p>}
    {notice&&<p role="status">{notice}</p>}
    <form onSubmit={submit} style={{display:'grid',gap:10,marginTop:15}}>
      <label className="form-group"><span className="form-label">Verified paid IPS project</span>
        <select className="form-select" value={requestId} required onChange={e=>{setRequestId(e.target.value);setAmount('');}}>
          <option value="">Choose a paid project</option>
          {eligible.map(p=><option key={p.request_id} value={p.request_id}>{p.request_id} · {fmt(Number(p.amount_minor)-Number(p.refunded_minor||0),p.currency.toUpperCase())} remaining</option>)}
        </select>
      </label>
      <label className="form-group"><span className="form-label">Refund amount (optional: leave empty for remaining full amount)</span>
        <input className="form-input" type="number" min=".01" step=".01" max={maxAmount||undefined} value={amount}
          onChange={e=>setAmount(e.target.value)}/></label>
      <label className="form-group"><span className="form-label">Written finance decision and customer reason (15+ characters)</span>
        <textarea className="form-textarea" value={reason} minLength={15} maxLength={1600} required rows={3}
          onChange={e=>setReason(e.target.value)} placeholder="Describe the authorized refund and reason."/>
      </label>
      <button className="btn btn-primary" type="submit" disabled={busy||!requestId||reason.trim().length<15}>
        {busy?'Submitting to provider…':'Submit actual provider refund'}
      </button>
    </form>
    <div style={{overflowX:'auto',marginTop:18}}>
      <table className="data-table"><thead><tr><th>Project</th><th>Amount</th><th>Provider state</th><th>Requested</th><th>Completed</th></tr></thead>
        <tbody>{refunds.map(item=><tr key={item.refund_id}>
          <td>{item.request_id}</td>
          <td>{fmt(item.amount_minor,item.currency.toUpperCase())}</td>
          <td><strong>{item.status}</strong></td>
          <td>{new Date(item.requested_at).toLocaleDateString()}</td>
          <td>{item.completed_at?new Date(item.completed_at).toLocaleDateString():'Not verified complete'}</td>
        </tr>)}</tbody>
      </table>
      {!refunds.length&&<p>No provider-backed student refunds recorded.</p>}
    </div>
  </section>;
}
