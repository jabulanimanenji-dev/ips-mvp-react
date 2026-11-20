import React,{useEffect,useState} from 'react';
import {Link,useNavigate} from 'react-router-dom';
import AcademicAuthShell,{isAcademicDesignPreview} from '../components/public/AcademicAuthShell.jsx';
import {passwordValid} from '../../shared/privacyIdentity.js';

// The link's random token lives in a URL fragment. It must never be sent in a
// GET request or retained in browser history after this page reads it.
export default function PasswordRecoveryPage(){
  const navigate=useNavigate();
  const writerRecovery=window.location.pathname.startsWith('/writer/');
  const role=writerRecovery?'writer':'client';
  const [token,setToken]=useState('');
  const [requestMode,setRequestMode]=useState(true);
  const [email,setEmail]=useState('');
  const [password,setPassword]=useState('');
  const [confirm,setConfirm]=useState('');
  const [busy,setBusy]=useState(false);
  const [error,setError]=useState('');
  const [notice,setNotice]=useState('');
  const [complete,setComplete]=useState(false);
  useEffect(()=>{
    const params=new URLSearchParams(window.location.hash.slice(1));
    const provided=params.get('token')||'';
    setRequestMode(!window.location.pathname.endsWith('/reset-password'));

    setToken(provided);
    if(window.location.hash)window.history.replaceState(window.history.state,'',window.location.pathname+window.location.search);
  },[]);
  async function submit(event){
    event.preventDefault();
    if(isAcademicDesignPreview)return;
    if(!requestMode){
      if(!/^[A-Za-z0-9_-]{43}$/.test(token))return setError('This password reset link is invalid or has expired.');
      if(!passwordValid(password))return setError('Use at least eight characters, an uppercase letter, number and symbol.');
      if(password!==confirm)return setError('Passwords do not match.');
    }
    setError('');setNotice('');setBusy(true);
    try{
      const response=await fetch('/api/'+role+'/password-recovery/'+(requestMode?'request':'complete'),{
        method:'POST',cache:'no-store',headers:{'Content-Type':'application/json'},
        body:JSON.stringify(requestMode?{email}:{token,password})
      });
      const result=await response.json().catch(()=>({}));
      if(!response.ok||!result.success)throw Error(result.error||'Secure account recovery is unavailable.');
      setNotice(result.message||'Your request has been received.');
      if(!requestMode){
        setComplete(true);setToken('');setPassword('');setConfirm('');
        if(result.session_opened&&result.redirect){navigate(result.redirect,{replace:true});return;}
      }
    }catch(err){setError(err.message||'Secure account recovery is temporarily unavailable.');}
    finally{setBusy(false);}
  }
  const resetting=!requestMode;
  return <AcademicAuthShell eyebrow="PRIVATE ACCOUNT RECOVERY"
    title={resetting?'Choose a secure':'Recover your'} italicTitle={resetting?'password.':writerRecovery?'specialist account.':'IPS account.'}
    intro={resetting?'A private one-time link lets you replace your password without revealing your identity or contacting IPS by phone.':'Enter your verified email address. For privacy, IPS does not confirm whether an account exists.'}
    asideTitle="Your workspace." asideItalic="Protected." asideCopy="IPS never asks for passwords or recovery links in messages. Reset requests expire and earlier sessions become invalid after a successful change.">
    {error&&<div role="alert" className="ipsa-auth-alert">{error}</div>}
    {notice&&<p role="status" className="ipsa-auth-help">{notice}</p>}
    {!complete&&<form onSubmit={submit} aria-label={resetting?'Reset IPS account password':'Request IPS password recovery'}>
      {resetting?<>
        <label className="ipsa-auth-field"><span>New password</span>
          <input type="password" autoComplete="new-password" value={password} onChange={e=>setPassword(e.target.value)}
            minLength={8} maxLength={128} required/>
        </label>
        <label className="ipsa-auth-field"><span>Confirm new password</span>
          <input type="password" autoComplete="new-password" value={confirm} onChange={e=>setConfirm(e.target.value)}
            minLength={8} maxLength={128} required/>
        </label>
        <p className="ipsa-auth-help">At least eight characters, including an uppercase letter, number and symbol. The link works once and expires after 15 minutes.</p>
      </>:<label className="ipsa-auth-field"><span>Verified account email</span>
        <input type="email" autoComplete="email" value={email} onChange={e=>setEmail(e.target.value)}
          placeholder="you@example.com" required/>
      </label>}
      <button className="ipsa-auth-submit" type="submit" disabled={busy||isAcademicDesignPreview}>
        <span>{busy?'Processing securely…':resetting?'Save new password':'Send private recovery link'}</span>
        <span aria-hidden="true">↗</span>
      </button>
    </form>}
    <p className="ipsa-auth-after">
      <Link className="ipsa-auth-link" to={writerRecovery?"/writer/login":"/login"}>Return to login</Link>
      {complete&&<button className="btn btn-ghost" type="button" onClick={()=>navigate(writerRecovery?'/writer/login':'/login',{replace:true})}>Sign in with new password</button>}
    </p>
  </AcademicAuthShell>;
}
