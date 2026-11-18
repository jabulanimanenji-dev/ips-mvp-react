import React,{useState} from 'react';
import {isAcademicDesignPreview} from './AcademicAuthShell.jsx';

// Only the real backend verifies account emails. This component intentionally
// never displays verification secrets in query strings or browser storage.
export default function VerifyEmailPanel({kind='client',email,onSuccess,onCancel}){
  const [code,setCode]=useState(''),[status,setStatus]=useState(''),[error,setError]=useState(''),[busy,setBusy]=useState(false);
  const path=kind==='writer'?'/api/writer':'/api/client';
  const submit=async(event)=>{
    event.preventDefault();if(isAcademicDesignPreview)return;
    setError('');setStatus('');setBusy(true);
    try{
      const res=await fetch(path+'/verify-email',{method:'POST',headers:{'Content-Type':'application/json'},
        body:JSON.stringify({email,code})});
      const data=await res.json().catch(()=>({}));
      if(!res.ok||!data.success)throw Error(data.error||'Verification failed.');
      setStatus('Email verified successfully.');
      onSuccess?.(data);
    }catch(e){setError(e.message);}
    finally{setBusy(false);}
  };
  const resend=async()=>{
    if(isAcademicDesignPreview)return;setError('');setStatus('');setBusy(true);
    try{
      const res=await fetch(path+'/resend-verification',{method:'POST',headers:{'Content-Type':'application/json'},
        body:JSON.stringify({email})});
      const data=await res.json().catch(()=>({}));
      if(!res.ok)throw Error(data.error||'Could not send a new code.');
      setStatus(data.message||'Check your email for a new verification code.');
    }catch(e){setError(e.message);}
    finally{setBusy(false);}
  };
  return <form onSubmit={submit} aria-label="Verify your email address">
    <p className="ipsa-auth-intro">We sent an eight-digit verification code to <strong>{email}</strong>. Enter it to confirm that you control this email address.</p>
    <label className="ipsa-auth-field"><span>Verification code</span>
      <input inputMode="numeric" autoComplete="one-time-code" pattern="[0-9]{8}" maxLength={8}
        placeholder="8-digit code" value={code} onChange={e=>setCode(e.target.value.replace(/\D/g,'').slice(0,8))} required/>
    </label>
    <p className="ipsa-auth-help">The code expires after 15 minutes. IPS will never ask you to share your password or verification code with a specialist.</p>
    {error&&<p className="ipsa-auth-alert" role="alert">{error}</p>}
    {status&&<p className="ipsa-auth-help" role="status">{status}</p>}
    <button type="submit" className="ipsa-auth-submit" disabled={busy||code.length!==8||isAcademicDesignPreview}>
      {busy?'Checking…':'Verify Email Address'} <span aria-hidden="true">↗</span>
    </button>
    <div className="ipsa-auth-after">
      <button type="button" className="ipsa-auth-link" disabled={busy||isAcademicDesignPreview}
        style={{border:0,background:'transparent',cursor:'pointer',padding:0}} onClick={resend}>Send a new code</button>
      {' · '}
      <button type="button" className="ipsa-auth-link" disabled={busy}
        style={{border:0,background:'transparent',cursor:'pointer',padding:0}} onClick={onCancel}>Back</button>
    </div>
  </form>;
}
