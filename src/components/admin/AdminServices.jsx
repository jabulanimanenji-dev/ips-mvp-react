import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';

const statuses = ['New Request','Under Review','Clarification Required','Quoted','Quote Accepted','Awaiting Assignment','Assigned','Scheduled','In Progress','Waiting for Client','Submitted for Review','Correction Required','Ready for Client','Completed','On Hold','Cancelled','Disputed'];

export default function AdminServices() {
  const [requests, setRequests] = useState([]);
  const [writers, setWriters] = useState([]);
  const [filter, setFilter] = useState('All');
  const [quoteJob, setQuoteJob] = useState(null);
  const [quote, setQuote] = useState({ labor: 0, service_fee: 0, expenses: 0, notes: '', expires_at: '' });
  const [error, setError] = useState('');

  const load = () => Promise.all([fetch('/api/services'), fetch('/api/writers')])
    .then(async ([a,b]) => [await a.json(), await b.json()])
    .then(([a,b]) => { setRequests(a.requests || []); setWriters(b.writers || []); });
  useEffect(() => { load(); }, []);

  const patch = async (id, updates) => {
    const res = await fetch(`/api/services/${id}`, { method:'PATCH', headers:{'Content-Type':'application/json'}, body:JSON.stringify({...updates, actor_id:'admin', actor_role:'admin'}) });
    const data = await res.json();
    if (!res.ok) return setError(data.error || 'Update failed.');
    load();
  };
  const openQuote = job => {
    setQuoteJob(job);
    setQuote({
      labor: job.quote?.labor || 0, service_fee: job.quote?.service_fee || 0,
      expenses: job.quote?.expenses || 0, notes: job.quote?.notes || '',
      expires_at: job.quote?.expires_at ? String(job.quote.expires_at).slice(0,10) : ''
    });
  };
  const saveQuote = async e => {
    e.preventDefault();
    const labor = Number(quote.labor), fee = Number(quote.service_fee), expenses = Number(quote.expenses);
    await patch(quoteJob.request_id, {
      quote: { ...quote, labor, service_fee: fee, expenses, total: labor + fee + expenses, currency:'USD', accepted:false },
      status:'Quoted', reason:'New or revised quote issued'
    });
    setQuoteJob(null);
  };
  const visible = filter === 'All' ? requests : requests.filter(r => r.family === filter);

  return <div>
    <div className="flex justify-between items-center" style={{marginBottom:'1.5rem',flexWrap:'wrap',gap:12}}>
      <div><h2>Service Operations</h2><p style={{color:'var(--text-muted)'}}>Quote, assign and control every professional service and odd job.</p></div>
      <select className="form-select" value={filter} onChange={e=>setFilter(e.target.value)} style={{maxWidth:220}}><option>All</option><option value="professional">Professional</option><option value="odd_job">Odd Jobs</option></select>
    </div>
    {error && <div style={{color:'var(--danger)',marginBottom:12}}>{error}</div>}
    <div className="card" style={{overflowX:'auto'}}><table className="data-table"><thead><tr><th>Request</th><th>Client</th><th>Category</th><th>Status</th><th>Provider</th><th>Progress</th><th>Quote</th></tr></thead><tbody>
      {visible.map(r=><tr key={r._id}>
        <td><strong>{r.request_id}</strong><div><Link to={`/admin/services/${r.request_id}`}>{r.title}</Link></div></td>
        <td>{r.client_name}</td>
        <td>{r.category}<small style={{display:'block'}}>{r.delivery_mode} · {r.location||'Remote'}</small></td>
        <td><select className="form-select" value={r.status} onChange={e=>patch(r.request_id,{status:e.target.value,reason:`Admin changed status to ${e.target.value}`})}>{statuses.map(s=><option key={s}>{s}</option>)}</select></td>
        <td><select className="form-select" value={r.provider_id||''} onChange={e=>{const w=writers.find(x=>x.writer_id===e.target.value);patch(r.request_id,{provider_id:e.target.value,provider_name:w?.full_name||'',status:e.target.value?'Assigned':'Awaiting Assignment',reason:e.target.value?'Provider assigned':'Provider unassigned'})}}><option value="">Unassigned</option>{writers.map(w=><option key={w.writer_id} value={w.writer_id}>{w.full_name}</option>)}</select></td>
        <td>{r.progress || 0}%</td>
        <td><button className="btn btn-primary btn-sm" onClick={()=>openQuote(r)}>{r.quote?.total?`$${r.quote.total}`:'Create quote'}</button></td>
      </tr>)}
    </tbody></table></div>

    {quoteJob && <div style={{position:'fixed',inset:0,zIndex:2000,background:'rgba(0,0,0,.65)',display:'grid',placeItems:'center',padding:20}}>
      <form className="card" onSubmit={saveQuote} style={{width:'100%',maxWidth:600,maxHeight:'90vh',overflowY:'auto'}}>
        <div className="flex justify-between items-center"><div><small>{quoteJob.request_id}</small><h3>Create or revise quote</h3></div><button type="button" className="btn btn-ghost" onClick={()=>setQuoteJob(null)}>Close</button></div>
        <div className="grid grid-3 gap-3">
          <label className="form-group"><span className="form-label">Labor</span><input required min="0" type="number" className="form-input" value={quote.labor} onChange={e=>setQuote({...quote,labor:e.target.value})}/></label>
          <label className="form-group"><span className="form-label">Service fee</span><input required min="0" type="number" className="form-input" value={quote.service_fee} onChange={e=>setQuote({...quote,service_fee:e.target.value})}/></label>
          <label className="form-group"><span className="form-label">Expenses</span><input required min="0" type="number" className="form-input" value={quote.expenses} onChange={e=>setQuote({...quote,expenses:e.target.value})}/></label>
        </div>
        <label className="form-group"><span className="form-label">Explanation and inclusions</span><textarea required className="form-textarea" value={quote.notes} onChange={e=>setQuote({...quote,notes:e.target.value})} placeholder="Explain the scope, assumptions and what the price includes."/></label>
        <label className="form-group"><span className="form-label">Valid until</span><input required type="date" className="form-input" value={quote.expires_at} onChange={e=>setQuote({...quote,expires_at:e.target.value})}/></label>
        <strong>Total: ${(Number(quote.labor)+Number(quote.service_fee)+Number(quote.expenses)).toFixed(2)}</strong>
        <button className="btn btn-primary" style={{marginTop:12}}>Issue quote</button>
      </form>
    </div>}
  </div>;
}
