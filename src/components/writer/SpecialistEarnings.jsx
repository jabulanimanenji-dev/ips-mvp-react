import React,{useEffect,useState} from 'react';
import {Link} from 'react-router-dom';

const money=(minor,currency)=>new Intl.NumberFormat('en-GB',{style:'currency',currency:currency||'PLN'}).format(Number(minor||0)/100);
export default function SpecialistEarnings(){
  const [rows,setRows]=useState([]),[error,setError]=useState(''),[loading,setLoading]=useState(true);
  const refresh=async()=>{
    try{
      const response=await fetch('/api/specialist-payouts/me',{cache:'no-store',credentials:'same-origin'});
      const result=await response.json().catch(()=>({}));
      if(!response.ok||!result.success)throw Error(result.error||'Could not load your payment records.');
      setRows(result.payouts||[]);setError('');
    }catch(e){setError(e.message||'Specialist finance records unavailable.');}
    finally{setLoading(false);}
  };
  useEffect(()=>{refresh();},[]);
  const byCurrency=rows.reduce((all,row)=>{
    const k=row.currency;
    const entry=all[k]||{approved:0,paid:0};
    entry[row.status==='paid'?'paid':'approved']+=Number(row.amount_minor||0);
    all[k]=entry;return all;
  },{});
  return <main>
    <header style={{marginBottom:20}}>
      <p style={{fontWeight:800,fontSize:'.74rem',letterSpacing:'.12em'}}>MY IPS SPECIALIST FINANCES</p>
      <h1 className="section-title">My Payment Records</h1>
      <p>Approved fees and IPS-recorded bank transfers for completed, paid and manager-approved engagements. The customer quotation is not your income.</p>
    </header>
    <button type="button" className="btn btn-ghost" onClick={refresh} disabled={loading}>Refresh payment ledger</button>
    {loading&&<p role="status">Loading your private IPS payout records…</p>}
    {error&&<p role="alert" style={{color:'var(--danger)'}}>{error}</p>}
    <div className="grid grid-2 gap-4" style={{margin:'20px 0'}}>
      {Object.entries(byCurrency).map(([currency,amount])=><section className="card" key={currency}>
        <h2>{currency} payments</h2>
        <p><strong>IPS-recorded transferred:</strong> {money(amount.paid,currency)}</p>
        <p><strong>Approved but awaiting transfer:</strong> {money(amount.approved,currency)}</p>
      </section>)}
    </div>
    {!loading&&!error&&!rows.length&&<p className="card">No approved specialist payouts are recorded yet. Completing a customer project does not automatically mean a payment has been transferred.</p>}
    <section className="card" style={{overflowX:'auto'}}>
      <h2>Payment history</h2>
      <table className="data-table"><thead><tr><th>Project</th><th>Approved fee</th><th>Position</th><th>Recorded transfer date</th></tr></thead>
        <tbody>{rows.map(item=><tr key={item.request_id}>
          <td><Link to={'/writer/services/'+encodeURIComponent(item.request_id)}>{item.request_id}</Link></td>
          <td>{money(item.amount_minor,item.currency)}</td>
          <td>{item.status==='paid'?'Staff-recorded as paid':'Approved — pending transfer'}</td>
          <td>{item.paid_at?new Date(item.paid_at).toLocaleDateString():'—'}</td>
        </tr>)}</tbody>
      </table>
    </section>
    <p style={{fontSize:'.85rem',color:'var(--text-muted)',marginTop:15}}>A recorded bank transfer is a staff reconciliation record, not evidence of your bank's receipt. If a transfer is missing, contact IPS through your approved secure workspace. No client account numbers or private customer payment details are available here.</p>
  </main>;
}
