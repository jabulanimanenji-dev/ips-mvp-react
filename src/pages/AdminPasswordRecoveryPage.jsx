import React,{useEffect,useState} from 'react';
import {Link} from 'react-router-dom';
import {companyStaffPasswordValid} from '../../shared/companyGovernance.js';

// Employee recovery is never handled manually by another administrator.
// The recovery token stays in the browser fragment, never in an HTTP GET.
const accessPath=(import.meta.env.VITE_ADMIN_ENTRY_PATH||'/ips-mission-control');
const style={
  backdrop:{minHeight:'100vh',background:'linear-gradient(135deg,#0d2034 0%,#254057 72%,#665c4a 100%)',
    display:'flex',alignItems:'center',justifyContent:'center',padding:'24px',color:'#F8F4E9'},
  panel:{maxWidth:465,width:'100%',padding:'32px',borderRadius:16,
    border:'1px solid rgba(185,205,238,.14)',background:'rgba(13,30,47,.95)',
    boxShadow:'0 24px 64px rgba(0,0,0,.38)'},
  heading:{fontSize:26,fontWeight:750,margin:'0 0 8px',color:'#F8F4E9'},
  copy:{fontSize:14,lineHeight:1.6,color:'#B9CDEE',margin:'0 0 18px'},
  label:{display:'grid',gap:7,fontSize:13,color:'#D4DFE8',marginBottom:14},
  input:{background:'#131F38',border:'1px solid rgba(185,205,238,.23)',borderRadius:9,
    padding:'12px 13px',fontSize:15,color:'#F8F4E9',width:'100%',outlineOffset:3},
  button:{width:'100%',padding:'12px 16px',border:'1px solid #be9965',borderRadius:10,
    background:'#be9965',color:'#101B25',fontWeight:750,cursor:'pointer',fontSize:14},
  help:{fontSize:13,lineHeight:1.55,color:'#B9CDEE',margin:'16px 0 0'},
  link:{color:'#DAB780',textDecoration:'underline',fontWeight:600}
};
export default function AdminPasswordRecoveryPage(){
  const resetting=window.location.pathname.endsWith('/reset-password');
  const [token,setToken]=useState('');
  const [email,setEmail]=useState('');
  const [password,setPassword]=useState('');
  const [confirm,setConfirm]=useState('');
  const [busy,setBusy]=useState(false);
  const [error,setError]=useState('');
  const [notice,setNotice]=useState('');
  const [complete,setComplete]=useState(false);
  useEffect(()=>{
    const parsed=new URLSearchParams(window.location.hash.slice(1));
    setToken(parsed.get('token')||'');
    if(window.location.hash)window.history.replaceState(window.history.state,'',window.location.pathname+window.location.search);
  },[]);
  async function submit(event){
    event.preventDefault();
    if(import.meta.env.VITE_DESIGN_PREVIEW==='true')return;
    if(resetting){
      if(!/^[A-Za-z0-9_-]{43}$/.test(token))return setError('This secure link is expired or invalid.');
      if(!companyStaffPasswordValid(password))
        return setError('Use at least 10 characters, an uppercase letter, number and symbol.');
      if(password!==confirm)return setError('The confirmation does not match your new password.');
    }
    setError('');setNotice('');setBusy(true);
    try{
      const response=await fetch('/api/admin/password-recovery/'+(resetting?'complete':'request'),{
        method:'POST',cache:'no-store',credentials:'same-origin',headers:{'Content-Type':'application/json'},
        body:JSON.stringify(resetting?{token,password}:{email:email.trim()})
      });
      const result=await response.json().catch(()=>({}));
      if(!response.ok||!result.success)throw Error(result.error||'Secure employee recovery is not available.');
      setNotice(result.message||'Your request has been received.');
      if(resetting){
        setComplete(true);setToken('');setPassword('');setConfirm('');
        if(result.session_opened&&result.redirect){
          window.location.replace(result.redirect);return;
        }
      }
    }catch(err){setError(String(err?.message||'Could not complete account recovery.'));}
    finally{setBusy(false);}
  }
  return <main style={style.backdrop}>
    <section style={style.panel} aria-label="IPS company employee account recovery">
      <p style={{fontSize:12,letterSpacing:'.15em',color:'#DAB780',fontWeight:750,margin:'0 0 16px'}}>IPS · PRIVATE COMPANY ACCESS</p>
      <h1 style={style.heading}>{resetting?'Choose a new password':'Recover your employee account'}</h1>
      <p style={style.copy}>{resetting?
        'Your one-time private email link can update your credentials and return you to your assigned company workspace.':
        'Enter your verified IPS manager or employee email address. No one on the company team will see your password or recovery link.'}</p>
      {error&&<p role="alert" style={{...style.help,color:'#FFB9B3',marginBottom:18}}>{error}</p>}
      {notice&&<p role="status" style={{...style.help,color:'#B8E7C9',marginBottom:18}}>{notice}</p>}
      {!complete&&<form onSubmit={submit}>
        {!resetting?
          <label style={style.label}>Verified company email
            <input style={style.input} type="email" autoComplete="email" value={email}
              onChange={e=>setEmail(e.target.value)} required maxLength={254} placeholder="employee@company.example"/>
          </label>:<>
          <label style={style.label}>New password
            <input style={style.input} type="password" autoComplete="new-password"
              value={password} onChange={e=>setPassword(e.target.value)} required minLength={10} maxLength={128}/>
          </label>
          <label style={style.label}>Confirm new password
            <input style={style.input} type="password" autoComplete="new-password"
              value={confirm} onChange={e=>setConfirm(e.target.value)} required minLength={10} maxLength={128}/>
          </label>
          <p style={{...style.help,margin:'0 0 15px'}}>At least 10 characters, a capital letter, number and symbol. The link works once and expires after 15 minutes.</p>
        </>}
        <button type="submit" style={style.button} disabled={busy||import.meta.env.VITE_DESIGN_PREVIEW==='true'}>
          {busy?'Processing securely…':resetting?'Save password and enter workspace':'Email my secure recovery link'}
        </button>
      </form>}
      <p style={style.help}>Recovery only uses your verified IPS company email. Root Admin credentials are protected separately in the deployment environment. No telephone calls or employee-created replacement passwords.</p>
      <p style={style.help}><Link style={style.link} to={accessPath}>Return to IPS Mission Control sign-in</Link></p>
    </section>
  </main>;
}
