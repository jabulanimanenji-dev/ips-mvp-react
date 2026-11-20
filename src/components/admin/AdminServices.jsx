import React,{useCallback,useEffect,useMemo,useState} from 'react';
import {Link} from 'react-router-dom';
import {useAuth} from '../../context/AuthContext';

// IPS owns academic work originating from verified, linked quotations.
// Historical odd-job and generic marketplace requests must not surface in
// the IPS Academic Services operations queue.
export const isCompanyAcademicProject=req=>Boolean(req&&(
  req.source==='quote_intake'&&req.category==='Academic Support'||
  req.category==='Academic Support'&&req.source_quote_id
));
const STATES=['New Request','Under Review','Clarification Required','Quoted','Quote Accepted','Awaiting Assignment','Assigned','In Progress','Waiting for Client','Submitted for Review','Correction Required','Ready for Client','Completed','On Hold','Cancelled','Disputed'];
const money=(amount,currency)=>new Intl.NumberFormat('en-GB',{style:'currency',currency:currency||'PLN'}).format(Number(amount)||0);

export default function AdminServices(){
  const {hasAdminPermission}=useAuth();
  const canManage=hasAdminPermission('services.manage');
  const [requests,setRequests]=useState([]);
  const [specialists,setSpecialists]=useState([]);
  const [filter,setFilter]=useState('active');
  const [quoteJob,setQuoteJob]=useState(null);
  const [quote,setQuote]=useState({labor:'',service_fee:'',expenses:'',notes:'',expires_at:'',currency:'PLN'});
  const [busy,setBusy]=useState(false);
  const [error,setError]=useState('');
  const [notice,setNotice]=useState('');
  const [loading,setLoading]=useState(true);

  const load=useCallback(async()=>{
    setLoading(true);setError('');
    try{
      const [jobsRes,peopleRes]=await Promise.all([
        fetch('/api/services',{cache:'no-store',credentials:'same-origin'}),
        fetch('/api/writers',{cache:'no-store',credentials:'same-origin'})
      ]);
      const jobs=await jobsRes.json().catch(()=>({}));
      const people=await peopleRes.json().catch(()=>({}));
      if(!jobsRes.ok||!jobs.success||!peopleRes.ok||!people.success)
        throw Error(jobs.error||people.error||'Academic project records are unavailable.');
      setRequests((jobs.requests||[]).filter(isCompanyAcademicProject));
      setSpecialists((people.writers||[]).filter(w=>w.application_status==='approved'&&w.status==='Active'&&w.email_verified_at));
    }catch(e){setError(e.message);}
    finally{setLoading(false);}
  },[]);
  useEffect(()=>{load();},[load]);

  const patch=async(id,updates)=>{
    if(!canManage)return;
    setBusy(true);setError('');setNotice('');
    try{
      const response=await fetch('/api/services/'+encodeURIComponent(id),{
        method:'PATCH',credentials:'same-origin',headers:{'Content-Type':'application/json'},
        body:JSON.stringify(updates)
      });
      const data=await response.json().catch(()=>({}));
      if(!response.ok||!data.success)throw Error(data.error||'Project change was not saved.');
      await load();setNotice('Project update saved.');
    }catch(e){setError(e.message);return false;}
    finally{setBusy(false);}
    return true;
  };
  const openQuote=job=>{
    setQuoteJob(job);setQuote({
      labor:String(job.quote?.labor??0),service_fee:String(job.quote?.service_fee??0),
      expenses:String(job.quote?.expenses??0),notes:job.quote?.notes||'',
      expires_at:job.quote?.expires_at?String(job.quote.expires_at).slice(0,10):'',
      currency:'PLN'
    });
  };
  const saveQuote=async event=>{
    event.preventDefault();
    const labor=Number(quote.labor),fee=Number(quote.service_fee),expenses=Number(quote.expenses);
    if(![labor,fee,expenses].every(v=>Number.isFinite(v)&&v>=0&&v<=100000)||labor+fee+expenses<=0||!quote.notes.trim()||!quote.expires_at){
      setError('Enter nonnegative amounts, an explanation and an expiry date.');return;
    }
    const result=await patch(quoteJob.request_id,{
      quote:{...quote,labor,service_fee:fee,expenses,total:labor+fee+expenses,accepted:false},
      status:'Quoted',reason:'Itemized academic quotation reviewed and issued by IPS'
    });
    if(result===true)setQuoteJob(null);
  };
  const visible=useMemo(()=>requests.filter(j=>filter==='all'||
    (filter==='complete'?j.status==='Completed':!['Completed','Cancelled'].includes(j.status))),[requests,filter]);
  return <section style={{maxWidth:1400,margin:'0 auto'}}>
    <div style={{display:'flex',justifyContent:'space-between',gap:16,alignItems:'start',flexWrap:'wrap',marginBottom:20}}>
      <div><small style={{color:'var(--text-secondary)',fontWeight:750,letterSpacing:'.1em'}}>IPS · CONFIDENTIAL DELIVERY</small>
        <h1 style={{fontSize:'1.6rem',margin:'5px 0'}}>Academic projects</h1>
        <p style={{color:'var(--text-muted)',maxWidth:740,margin:0}}>Only verified academic quotation handoffs appear here. Manage the assigned specialist, work status, scope and itemized quotation. Payments are not active.</p>
      </div>
      <button className="btn btn-secondary" type="button" onClick={load} disabled={loading||busy}>{loading?'Updating…':'Refresh projects'}</button>
    </div>
    <div className="card" style={{padding:'12px 16px',borderLeft:'3px solid #c7a46e',marginBottom:18}}>No odd jobs, marketplace activity or cross-project fixtures belong in the IPS academic operations queue. Existing historical records are preserved outside this view.</div>
    {error&&<p role="alert" className="card" style={{color:'var(--danger)'}}>{error}</p>}
    {notice&&<p role="status" className="card">{notice}</p>}
    <div style={{display:'flex',gap:8,marginBottom:15,flexWrap:'wrap'}}>
      {[['active','Active work'],['complete','Completed'],['all','All academic work']].map(([value,label])=><button key={value} type="button" className={filter===value?'btn btn-primary':'btn btn-ghost'} onClick={()=>setFilter(value)}>{label}</button>)}
    </div>
    <div className="card" style={{overflowX:'auto',padding:0}}>
      <table className="data-table">
        <thead><tr><th>Academic project</th><th>Client reference</th><th>Status</th><th>Approved specialist</th><th>Progress</th><th>Quotation</th></tr></thead>
        <tbody>
        {visible.length===0&&<tr><td colSpan={6} style={{padding:23,color:'var(--text-muted)'}}>No matching verified academic projects. New requests begin in <Link to="/admin/enquiries">Quotes & enquiries</Link>.</td></tr>}
        {visible.map(j=><tr key={j.request_id}>
          <td><Link to={'/admin/services/'+encodeURIComponent(j.request_id)} style={{fontWeight:700}}>{j.title||j.request_id}</Link><small style={{display:'block',color:'var(--text-muted)'}}>{j.request_id} · {j.source_quote_id}</small></td>
          <td>{j.client_name||'Private client'}</td>
          <td>{canManage?<select className="form-select" disabled={busy} value={j.status} onChange={e=>patch(j.request_id,{status:e.target.value,reason:'Authorized IPS academic project status update'})}>{STATES.map(x=><option key={x}>{x}</option>)}</select>:j.status}</td>
          <td>{canManage?<select className="form-select" disabled={busy} value={j.provider_id||''} onChange={e=>{
            const w=specialists.find(x=>x.writer_id===e.target.value);
            patch(j.request_id,{provider_id:e.target.value,provider_name:w?.full_name||'',status:e.target.value?'Assigned':'Awaiting Assignment',reason:e.target.value?'Approved academic specialist assigned':'Assignment withdrawn'});
          }}><option value="">Unassigned</option>{specialists.map(w=><option key={w.writer_id} value={w.writer_id}>{w.full_name}</option>)}</select>:(j.provider_name||'Unassigned')}</td>
          <td>{Number(j.progress||0)}%</td>
          <td>{canManage?<button type="button" disabled={busy} className="btn btn-secondary btn-sm" onClick={()=>openQuote(j)}>{j.quote?.total?money(j.quote.total,j.quote.currency):'Review quote'}</button>:(j.quote?.total?money(j.quote.total,j.quote.currency):'Not issued')}</td>
        </tr>)}
        </tbody>
      </table>
    </div>
    {quoteJob&&<div role="dialog" aria-modal="true" aria-label="Review academic quotation" style={{position:'fixed',inset:0,zIndex:1100,background:'rgba(0,0,0,.7)',display:'grid',placeItems:'center',padding:16}}>
      <form className="card" onSubmit={saveQuote} style={{width:'100%',maxWidth:620,maxHeight:'90vh',overflowY:'auto'}}>
        <div style={{display:'flex',justifyContent:'space-between',gap:12}}><div><small>{quoteJob.request_id}</small><h2 style={{fontSize:'1.22rem'}}>Itemized academic quotation</h2></div><button type="button" className="btn btn-ghost" onClick={()=>setQuoteJob(null)} disabled={busy}>Close</button></div>
        <div className="grid grid-3 gap-2">
          {[['labor','Specialist work'],['service_fee','IPS service fee'],['expenses','Approved expenses']].map(([key,label])=><label key={key} className="form-group"><span className="form-label">{label}</span><input className="form-input" type="number" min="0" step=".01" value={quote[key]} onChange={e=>setQuote(v=>({...v,[key]:e.target.value}))} required/></label>)}
        </div>
        <p style={{fontSize:'.86rem',color:'var(--text-muted)'}}>Currency: PLN (IPS academic quotations)</p>
        <label className="form-group"><span className="form-label">Scope, deliverables and conditions</span><textarea className="form-textarea" rows={4} value={quote.notes} onChange={e=>setQuote(v=>({...v,notes:e.target.value}))} required/></label>
        <label className="form-group"><span className="form-label">Valid until</span><input type="date" className="form-input" value={quote.expires_at} onChange={e=>setQuote(v=>({...v,expires_at:e.target.value}))} required/></label>
        <strong>Total: {money(Number(quote.labor)+Number(quote.service_fee)+Number(quote.expenses),quote.currency)}</strong>
        <p style={{fontSize:'.82rem',color:'var(--text-muted)'}}>Quotations do not collect payment or authorize work until the client accepts the company's terms and a payment workflow is available.</p>
        <button type="submit" className="btn btn-primary" disabled={busy}>{busy?'Saving…':'Save academic quotation'}</button>
      </form>
    </div>}
  </section>;
}
