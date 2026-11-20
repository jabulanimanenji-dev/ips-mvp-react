import React,{useEffect,useState} from 'react';
import {Link} from 'react-router-dom';

export default function AdminPayments(){
  const [state,setState]=useState({checked:false,enabled:false,pending:true,error:''});
  useEffect(()=>{
    let active=true;
    fetch('/api/student-payments/config',{cache:'no-store',credentials:'same-origin'})
      .then(async response=>{
        const data=await response.json().catch(()=>({}));
        if(!response.ok||!data.success)throw Error(data.error||'Payment configuration unavailable.');
        if(active)setState({checked:true,enabled:data.enabled===true,pending:data.pending===true,error:''});
      }).catch(err=>{if(active)setState(v=>({...v,checked:true,error:err.message}));});
    return()=>{active=false;};
  },[]);
  return <section style={{maxWidth:1000,margin:'0 auto'}}>
    <small style={{fontWeight:750,letterSpacing:'.11em',color:'var(--text-secondary)'}}>IPS · FINANCE READINESS</small>
    <h1 style={{fontSize:'1.6rem',margin:'5px 0 10px'}}>Payments</h1>
    <p style={{color:'var(--text-muted)',maxWidth:690}}>Payment collection is the final planned integration. This workspace does not present legacy estimates, imported marketplace transactions or test records as real company revenue.</p>
    {state.error&&<p role="alert" className="card" style={{color:'var(--danger)'}}>{state.error}</p>}
    <div className="card" style={{padding:'26px 28px',borderLeft:'4px solid '+(state.enabled?'#3b9478':'#c7a46e')}}>
      <small style={{fontWeight:750,color:'var(--text-secondary)'}}>LIVE PAYMENT PROVIDER STATUS</small>
      <h2 style={{margin:'8px 0 12px',fontSize:'1.5rem'}}>{!state.checked?'Checking production configuration…':state.enabled?'Provider enabled':'Integration pending'}</h2>
      <p style={{lineHeight:1.65,color:'var(--text-muted)'}}>{state.enabled
        ?'A payment provider reports enabled. Verify signed transactions, settlement and reconciliation before accepting real funds.'
        :'IPS is not collecting or processing customer payments. Academic quotations, customer approval and project preparation do not constitute payment.'}</p>
      {!state.enabled&&<p style={{fontSize:'.85rem',color:'var(--text-muted)',margin:'12px 0 0'}}>No payment actions are available to administrators until the provider integration passes the company release gate.</p>}
    </div>
    <div className="card" style={{marginTop:16}}>
      <h2 style={{fontSize:'1.1rem'}}>Before accepting funds</h2>
      <p style={{color:'var(--text-muted)'}}>The final integration will require customer payment authorization, authenticated provider webhooks, invoices, refund handling, specialist payouts, financial reconciliation and negative tests. None of those are represented as completed here.</p>
      <Link className="btn btn-secondary" to="/admin/enquiries">Return to private quotations</Link>
    </div>
  </section>;
}
