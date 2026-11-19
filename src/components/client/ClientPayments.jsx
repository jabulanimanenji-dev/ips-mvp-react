import React,{useEffect,useState} from 'react';
import {Link} from 'react-router-dom';

function currencyMoney(amount,currency='PLN'){
  return new Intl.NumberFormat('en-GB',{style:'currency',currency:String(currency||'PLN').toUpperCase()}).format(Number(amount||0));
}
export default function ClientPayments(){
  const [jobs,setJobs]=useState([]),[refunds,setRefunds]=useState([]);
  const [error,setError]=useState(''),[loading,setLoading]=useState(true);
  async function load(){
    setLoading(true);setError('');
    try{
      const [j,r]=await Promise.all([
        fetch('/api/services',{credentials:'same-origin',cache:'no-store'}),
        fetch('/api/student-refunds/me',{credentials:'same-origin',cache:'no-store'})
      ]);
      const [projects,refundsResult]=await Promise.all([j.json(),r.json()]);
      if(!j.ok||!r.ok||!projects.success||!refundsResult.success)
        throw Error('Your confidential payment records could not be loaded.');
      setJobs((projects.requests||[]).filter(x=>x.category==='Academic Support'));
      setRefunds(refundsResult.refunds||[]);
    }catch(e){setError(e.message||'Your payment history is temporarily unavailable.');}
    finally{setLoading(false);}
  }
  useEffect(()=>{load();},[]);
  return <main>
    <header style={{marginBottom:20}}>
      <p style={{fontWeight:800,fontSize:'.74rem',letterSpacing:'.12em'}}>MY PRIVATE IPS FINANCES</p>
      <h1 className="section-title">My Payments & Refunds</h1>
      <p>Check accepted quotations, verified settlement and provider-backed refund progress. IPS will never telephone you to request payment details.</p>
    </header>
    <button className="btn btn-ghost" type="button" onClick={load} disabled={loading}>Refresh financial status</button>
    {loading&&<p role="status">Loading your verified private records…</p>}
    {error&&<p role="alert" className="toast error" style={{position:'static'}}>{error}</p>}
    <section className="card" style={{marginTop:16,overflowX:'auto'}}>
      <h2>Academic services & payments</h2>
      <table className="data-table"><thead><tr><th>Project</th><th>Quotation</th><th>Verified payment state</th><th>Next action</th></tr></thead>
        <tbody>{jobs.map(j=><tr key={j.request_id}>
          <td><Link to={'/client/services/'+encodeURIComponent(j.request_id)}>{j.title||j.request_id}</Link></td>
          <td>{j.quote?currencyMoney(j.quote.total,j.quote.currency):'Awaiting IPS review'}</td>
          <td>{j.payment_status==='paid'?'Paid — provider-confirmed':
            j.payment_status==='partially_refunded'?'Partially refunded':
            j.payment_status==='refunded'?'Fully refunded':
            j.payment_status==='processing'?'Provider processing':'No verified payment'}</td>
          <td><Link to={'/client/services/'+encodeURIComponent(j.request_id)}>Open private project</Link></td>
        </tr>)}</tbody>
      </table>
      {!loading&&!jobs.length&&<p>No IPS academic payments or quotations are linked to your verified account yet.</p>}
    </section>
    <section className="card" style={{marginTop:18,overflowX:'auto'}}>
      <h2>Provider-backed refunds</h2>
      <p style={{color:'var(--text-muted)'}}>Refund requests are not treated as complete until the provider reports success.</p>
      <table className="data-table"><thead><tr><th>Project</th><th>Refund amount</th><th>Provider result</th><th>Last update</th></tr></thead>
        <tbody>{refunds.map(r=><tr key={r.refund_id}>
          <td><Link to={'/client/services/'+encodeURIComponent(r.request_id)}>{r.request_id}</Link></td>
          <td>{currencyMoney(Number(r.amount_minor)/100,r.currency)}</td>
          <td>{r.status==='succeeded'?'Refunded — confirmed':r.status==='failed'?'Provider failed':r.status==='processing'?'Processing':'Awaiting provider confirmation'}</td>
          <td>{new Date(r.completed_at||r.requested_at).toLocaleDateString()}</td>
        </tr>)}</tbody>
      </table>
      {!loading&&!refunds.length&&<p>No refund requests recorded for this account.</p>}
    </section>
    <p style={{marginTop:15,color:'var(--text-muted)',fontSize:'.85rem'}}>Refunds are requested and administered through IPS's private support processes. Do not share passwords, card numbers, or research participant records in external chats.</p>
  </main>;
}
