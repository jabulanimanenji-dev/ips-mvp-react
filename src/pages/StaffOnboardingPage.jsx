import React,{useEffect,useState} from 'react';
import {Link} from 'react-router-dom';
import {companyStaffPasswordValid} from '../../shared/companyGovernance.js';

// Read the one-use secret from the URL fragment, never from the query string,
// and remove it from the visible address immediately.
export default function StaffOnboardingPage(){
  const [proof,setProof]=useState({id:'',token:''});
  const [password,setPassword]=useState('');
  const [confirm,setConfirm]=useState('');
  const [busy,setBusy]=useState(false);
  const [error,setError]=useState('');
  const [done,setDone]=useState(false);
  useEffect(()=>{
    const params=new URLSearchParams(window.location.hash.slice(1));
    setProof({id:params.get('id')||'',token:params.get('token')||''});
    if(window.location.hash)window.history.replaceState(window.history.state,'',window.location.pathname);
  },[]);
  async function submit(event){
    event.preventDefault();
    if(!companyStaffPasswordValid(password))return setError('Use at least 10 characters, an uppercase letter, number and symbol.');
    if(password!==confirm)return setError('Passwords must match.');
    setBusy(true);setError('');
    try{
      const res=await fetch('/api/admin/company-team/accept',{method:'POST',cache:'no-store',
        credentials:'omit',headers:{'Content-Type':'application/json'},body:JSON.stringify({...proof,password})});
      const data=await res.json().catch(()=>({}));
      if(!res.ok||!data.success)throw Error(data.error||'Staff invitation is invalid or expired.');
      setDone(true);setProof({id:'',token:''});setPassword('');setConfirm('');
    }catch(err){setError(err.message);}finally{setBusy(false);}
  }
  return <div style={{minHeight:'100vh',background:'#122839',color:'#1b3440',
    display:'grid',placeItems:'center',padding:18}}>
    <main style={{background:'#fff',width:'min(490px,100%)',padding:'32px clamp(22px,5vw,38px)',
      borderRadius:18,boxShadow:'0 18px 52px rgba(0,0,0,.23)',border:'1px solid #dce8e3'}}>
      <span style={{fontSize:'.66rem',fontWeight:900,color:'#a17c4a',letterSpacing:'.14em'}}>IPS ACADEMIC SERVICES</span>
      <h1 style={{fontSize:'1.65rem',letterSpacing:'-.04em',margin:'11px 0'}}>Secure staff onboarding</h1>
      <p style={{fontSize:'.87rem',lineHeight:1.65,color:'#667b81'}}>
        Your company manager has invited you to IPS. You create your own password; neither the manager nor the owner will be shown it.
      </p>
      {error&&<p role="alert" style={{padding:12,background:'#fff1ef',color:'#a33d38',borderRadius:10}}>{error}</p>}
      {done?<div role="status" style={{padding:16,background:'#e9f4ee',borderRadius:12}}>
        <strong style={{color:'#285f51'}}>Your account is active.</strong>
        <p style={{fontSize:'.84rem',color:'#56706b'}}>Sign in with your invited work email and new password.</p>
        <Link to="/ips-mission-control" style={{color:'#24596a',fontWeight:750}}>Open company login</Link>
      </div>:<form onSubmit={submit} style={{display:'grid',gap:17,marginTop:22}}>
        {!proof.id||!proof.token?<p role="alert" style={{color:'#a33d38'}}>This invitation has no usable token. Ask your manager for a new private invitation.</p>:null}
        <label style={{display:'grid',gap:7,fontSize:'.82rem',fontWeight:750}}>
          New password
          <input type="password" value={password} autoComplete="new-password" required minLength={10} maxLength={128}
            onChange={e=>setPassword(e.target.value)} style={{minHeight:44,borderRadius:9,border:'1px solid #cbdad6',padding:11}}/>
        </label>
        <label style={{display:'grid',gap:7,fontSize:'.82rem',fontWeight:750}}>
          Confirm password
          <input type="password" value={confirm} autoComplete="new-password" required minLength={10} maxLength={128}
            onChange={e=>setConfirm(e.target.value)} style={{minHeight:44,borderRadius:9,border:'1px solid #cbdad6',padding:11}}/>
        </label>
        <p style={{margin:0,fontSize:'.75rem',color:'#678087'}}>At least 10 characters, one uppercase letter, number and symbol. One-time invitations expire after 48 hours.</p>
        <button type="submit" disabled={!proof.id||!proof.token||busy} style={{minHeight:47,borderRadius:10,
          border:0,background:'#183e52',color:'#fff',fontWeight:800}}>
          {busy?'Activating…':'Activate company account'}
        </button>
      </form>}
      <p style={{fontSize:'.74rem',marginTop:22,color:'#82908c'}}>IPS will never request your password or invitation secret by phone or Telegram.</p>
    </main>
  </div>;
}
