import React,{useCallback,useEffect,useMemo,useState} from 'react';
import {useAuth} from '../../context/AuthContext';

const safePortfolio=value=>{
  try{const url=new URL(String(value||''));return ['https:','http:'].includes(url.protocol)?url.href:null;}
  catch{return null;}
};

export default function AdminWriters(){
  const {hasAdminPermission}=useAuth();
  const canManage=hasAdminPermission('providers.manage');
  const [specialists,setSpecialists]=useState([]);
  const [filter,setFilter]=useState('pending');
  const [query,setQuery]=useState('');
  const [selected,setSelected]=useState(null);
  const [decision,setDecision]=useState('approved');
  const [note,setNote]=useState('');
  const [error,setError]=useState('');
  const [notice,setNotice]=useState('');
  const [loading,setLoading]=useState(true);
  const [working,setWorking]=useState(false);
  const [archived,setArchived]=useState(0);

  const reload=useCallback(async()=>{
    setLoading(true);
    try{
      const response=await fetch('/api/writers',{cache:'no-store',credentials:'same-origin'});
      const data=await response.json().catch(()=>({}));
      if(!response.ok||!data.success)throw Error(data.error||'Specialist records are unavailable.');
      setSpecialists(data.writers||[]);
      setArchived(Number(data.hidden_legacy_qa_accounts||0));
      setError('');
    }catch(err){setError(err.message);}
    finally{setLoading(false);}
  },[]);
  useEffect(()=>{reload();},[reload]);

  const filtered=useMemo(()=>specialists.filter(s=>{
    const state=s.application_status||'pending';
    if(filter!=='all'&&state!==filter)return false;
    const term=query.trim().toLowerCase();
    return !term||[s.full_name,s.email,s.writer_id,s.primary_expertise].some(v=>String(v||'').toLowerCase().includes(term));
  }),[specialists,query,filter]);
  const counts=useMemo(()=>specialists.reduce((acc,s)=>{
    const status=s.application_status||'pending';
    acc[status]=(acc[status]||0)+1;return acc;
  },{}),[specialists]);
  const beginReview=(s,target)=>{
    setSelected(s);setDecision(target);setNote('');setError('');setNotice('');
  };
  async function review(event){
    event.preventDefault();
    if(!selected||!canManage||working)return;
    if(decision==='rejected'&&note.trim().length<10){setError('Provide a meaningful rejection reason (at least 10 characters).');return;}
    if(decision==='approved'&&!selected.email_verified_at){setError('The specialist must verify their email address before IPS can approve the application.');return;}
    setWorking(true);setError('');
    try{
      const response=await fetch('/api/provider/applications/'+encodeURIComponent(selected.writer_id),{
        method:'PATCH',credentials:'same-origin',headers:{'Content-Type':'application/json'},
        body:JSON.stringify({decision,
          rejection_reason:decision==='rejected'?note.trim():'',
          admin_notes:decision!=='rejected'?note.trim():''})
      });
      const data=await response.json().catch(()=>({}));
      if(!response.ok||!data.success)throw Error(data.error||'Specialist review was not saved.');
      setSelected(null);await reload();setNotice('Specialist review recorded. Account access follows the verified approval status.');
    }catch(err){setError(err.message);}
    finally{setWorking(false);}
  }
  async function toggleStatus(s){
    if(!canManage||working)return;
    setWorking(true);setError('');setNotice('');
    try{
      const next=s.status==='Active'?'On Leave':'Active';
      const response=await fetch('/api/writers/'+encodeURIComponent(s.writer_id),{
        method:'PATCH',credentials:'same-origin',headers:{'Content-Type':'application/json'},
        body:JSON.stringify({status:next})
      });
      const data=await response.json().catch(()=>({}));
      if(!response.ok||!data.success)throw Error(data.error||'Specialist availability could not be changed.');
      await reload();setNotice('Specialist availability updated.');
    }catch(err){setError(err.message);}
    finally{setWorking(false);}
  }

  return <section style={{maxWidth:1430,margin:'0 auto'}}>
    <div style={{display:'flex',justifyContent:'space-between',gap:15,flexWrap:'wrap',alignItems:'start',marginBottom:21}}>
      <div><small style={{color:'var(--text-secondary)',fontWeight:750,letterSpacing:'.1em'}}>IPS · SPECIALIST NETWORK</small>
        <h1 style={{fontSize:'1.65rem',margin:'5px 0 8px'}}>Specialist applications & approvals</h1>
        <p style={{color:'var(--text-muted)',maxWidth:800,margin:0}}>Review real applications, credentials, expertise and availability. Specialists provide their legal full names and verify their own email. Administrators cannot set their passwords.</p>
      </div>
      <button type="button" className="btn btn-secondary" disabled={loading||working} onClick={reload}>{loading?'Updating…':'Refresh specialists'}</button>
    </div>
    <div className="card" style={{padding:'13px 17px',marginBottom:17,borderLeft:'3px solid #c7a46e'}}>
      New specialists apply through the approved IPS specialist-registration process. IPS reviews their application before workspace activation; no automatic access is granted.
    </div>
    {archived>0&&<p role="status" className="card" style={{fontSize:'.82rem'}}>Archived development accounts excluded from the real specialist list: {archived}. No source records were deleted.</p>}
    {error&&<p role="alert" className="card" style={{color:'var(--danger)'}}>{error}</p>}
    {notice&&<p role="status" className="card">{notice}</p>}
    <div style={{display:'flex',gap:9,flexWrap:'wrap',alignItems:'center',marginBottom:16}}>
      {[['pending','Pending'],['more_information','Needs information'],['approved','Approved'],['rejected','Rejected'],['all','All']].map(([value,label])=>
        <button key={value} type="button" className={filter===value?'btn btn-primary':'btn btn-ghost'} onClick={()=>setFilter(value)}>{label} ({value==='all'?specialists.length:counts[value]||0})</button>
      )}
      <input className="form-input" style={{flex:'1 1 200px',maxWidth:310,marginLeft:'auto'}} value={query} onChange={e=>setQuery(e.target.value)} placeholder="Search specialist, ID or expertise" aria-label="Search specialists"/>
    </div>
    <div className="card" style={{overflowX:'auto',padding:0}}>
      <table className="data-table"><thead><tr><th>Specialist</th><th>Academic expertise</th><th>Email</th><th>Application</th><th>Availability</th><th>Review</th></tr></thead>
        <tbody>
          {filtered.length===0&&<tr><td colSpan={6} style={{padding:25,color:'var(--text-muted)'}}>No specialist applications in this view.</td></tr>}
          {filtered.map(s=><tr key={s.writer_id}>
            <td><strong>{s.full_name||'Pending legal name'}</strong><small style={{display:'block',color:'var(--text-muted)'}}>{s.writer_id}</small></td>
            <td>{s.primary_expertise||'Not specified'}<small style={{display:'block',color:'var(--text-muted)'}}>{s.academic_level||''} · {s.secondary_expertise||''}</small></td>
            <td>{s.email}<small style={{display:'block',color:'var(--text-muted)'}}>{s.email_verified_at?'Verified':'Pending verification'}</small></td>
            <td>{(s.application_status||'pending').replaceAll('_',' ')}</td>
            <td>{s.status||'Pending'}</td>
            <td><div style={{display:'flex',gap:8,flexWrap:'wrap'}}>
              {canManage&&<button type="button" className="btn btn-secondary btn-sm" onClick={()=>beginReview(s,s.application_status==='approved'?'more_information':'approved')}>Review application</button>}
              {canManage&&s.application_status==='approved'&&<button type="button" className="btn btn-ghost btn-sm" disabled={working} onClick={()=>toggleStatus(s)}>{s.status==='Active'?'Pause':'Activate'}</button>}
              {s.cv_stored_name&&<a className="btn btn-ghost btn-sm" href={'/api/provider/applications/'+encodeURIComponent(s.writer_id)+'/cv'}>Review CV</a>}
              {safePortfolio(s.portfolio_url)&&<a className="btn btn-ghost btn-sm" target="_blank" rel="noopener noreferrer" href={safePortfolio(s.portfolio_url)}>Portfolio</a>}
            </div></td>
          </tr>)}
        </tbody>
      </table>
    </div>
    {selected&&<div role="dialog" aria-modal="true" aria-label="Specialist application review" style={{position:'fixed',inset:0,zIndex:1200,background:'rgba(0,0,0,.72)',display:'grid',placeItems:'center',padding:16}}>
      <form className="card" onSubmit={review} style={{maxWidth:540,width:'100%',maxHeight:'92vh',overflowY:'auto'}}>
        <h2 style={{fontSize:'1.2rem',margin:'0 0 10px'}}>Review {selected.full_name}</h2>
        <p style={{color:'var(--text-muted)',fontSize:'.85rem'}}>Qualification: {selected.primary_expertise||'Not specified'} · {selected.academic_level||'Unknown'}. Email: {selected.email_verified_at?'Verified':'Not verified'}.</p>
        <label className="form-group"><span className="form-label">Decision</span><select className="form-select" value={decision} onChange={e=>setDecision(e.target.value)}>
          <option value="approved" disabled={!selected.email_verified_at}>Approve specialist</option>
          <option value="more_information">Request more information</option>
          <option value="rejected">Reject application</option>
        </select></label>
        <label className="form-group"><span className="form-label">{decision==='rejected'?'Reason for rejection (required)':'Internal reviewer note (optional)'}</span><textarea className="form-textarea" value={note} onChange={e=>setNote(e.target.value)} maxLength={1200} rows={4} placeholder="Record the actual academic qualification review and decision." required={decision==='rejected'}/></label>
        {decision==='approved'&&!selected.email_verified_at&&<p role="alert" style={{color:'var(--danger)'}}>Email must be verified before approval.</p>}
        <div style={{display:'flex',gap:10,marginTop:13}}>
          <button className="btn btn-primary" type="submit" disabled={working||(decision==='approved'&&!selected.email_verified_at)}>{working?'Saving…':'Save decision'}</button>
          <button className="btn btn-ghost" type="button" disabled={working} onClick={()=>setSelected(null)}>Cancel</button>
        </div>
      </form>
    </div>}
  </section>;
}
