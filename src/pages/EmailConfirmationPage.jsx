import React,{useCallback,useEffect,useRef,useState} from 'react';
import {Link,useNavigate} from 'react-router-dom';
import {useAuth} from '../context/AuthContext.jsx';
import AcademicAuthShell from '../components/public/AcademicAuthShell.jsx';

const validCode=v=>/^\d{8}$/.test(String(v||''));
const validEmail=v=>/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(v||'').trim());
const contactRole=v=>v==='quote'||v==='enquiry';
const validReference=(role,value)=>role==='quote'?/^IPS-Q-[A-F0-9]{18}$/.test(value):
  role==='enquiry'?/^[A-Z0-9_-]{4,120}$/.test(value):true;
export default function EmailConfirmationPage(){
  const navigate=useNavigate(),{verifyClientEmail}=useAuth();
  const initial=useRef(null),consumed=useRef(false);
  if(initial.current===null&&typeof window!=='undefined'){
    const params=new URLSearchParams(window.location.hash.replace(/^#/,''));
    const kind=params.get('role');
    const role=['writer','quote','enquiry'].includes(kind)?kind:'client';
    initial.current={role,email:params.get('email')||'',
      reference:role==='quote'?params.get('quote_id')||'':role==='enquiry'?params.get('enquiry_id')||'':'',
      code:params.get('code')||''};
    // The proof must not remain in the URL/history for extensions or referrers.
    if(window.location.hash)window.history.replaceState(window.history.state,'',
      window.location.pathname+window.location.search);
  }
  const [role,setRole]=useState(initial.current?.role||'client');
  const [email,setEmail]=useState(initial.current?.email||'');
  const [reference,setReference]=useState(initial.current?.reference||'');
  const [code,setCode]=useState(initial.current?.code||'');
  const [busy,setBusy]=useState(false),[error,setError]=useState(''),[success,setSuccess]=useState('');
  const [resending,setResending]=useState(false);
  const verify=useCallback(async(targetRole,targetEmail,targetCode,targetReference='')=>{
    if(!validEmail(targetEmail)||!validCode(targetCode)||
      (contactRole(targetRole)&&!validReference(targetRole,targetReference)))
      return setError('Enter the verified contact email, correct reference and eight-digit code from IPS.');
    setBusy(true);setError('');setSuccess('');
    try{
      if(contactRole(targetRole)){
        const idKey=targetRole==='quote'?'quote_id':'enquiry_id';
        const path=targetRole==='quote'?'/api/quote-requests/verify-email':'/api/contact-enquiries/verify-email';
        const response=await fetch(path,{method:'POST',credentials:'same-origin',
          cache:'no-store',headers:{'Content-Type':'application/json'},
          body:JSON.stringify({[idKey]:targetReference,code:targetCode})});
        const result=await response.json().catch(()=>({}));
        if(!response.ok||!result.success)throw Error(result.error||'Contact verification failed.');
        setSuccess('Your contact email is verified. IPS can now review your request and reply through your chosen method. No payment is required to request a quote.');
        setCode('');
      }else if(targetRole==='client'){
        const result=await verifyClientEmail(targetEmail.trim().toLowerCase(),targetCode);
        if(!result.success)throw Error(result.error||'Verification failed.');
        setSuccess('Your email is verified. Opening your private IPS account.');
        navigate('/client/overview',{replace:true});
      }else{
        const response=await fetch('/api/writer/verify-email',{method:'POST',credentials:'same-origin',
          cache:'no-store',headers:{'Content-Type':'application/json'},
          body:JSON.stringify({email:targetEmail.trim().toLowerCase(),code:targetCode})});
        const result=await response.json().catch(()=>({}));
        if(!response.ok||!result.success)throw Error(result.error||'Verification failed.');
        setSuccess('Email verified. Your application proceeds through specialist qualification review automatically. You can sign in when approved.');
        setCode('');
      }
    }catch(err){setError(err.message||'This link has expired or was already used.');setCode('');}
    finally{setBusy(false);}
  },[verifyClientEmail,navigate]);
  useEffect(()=>{
    if(consumed.current)return;
    consumed.current=true;
    const data=initial.current;
    if(data?.email&&validCode(data.code))void verify(data.role,data.email,data.code,data.reference);
  },[verify]);
  async function resend(){
    if(!validEmail(email)||contactRole(role)&&!validReference(role,reference))
      return setError('Enter the email and your valid IPS request reference first.');
    setResending(true);setError('');setSuccess('');
    try{
      const path=role==='writer'?'/api/writer/resend-verification':
        role==='quote'?'/api/quote-requests/resend-verification':
        role==='enquiry'?'/api/contact-enquiries/resend-verification':
        '/api/client/resend-verification';
      const body={email:email.trim().toLowerCase(),...(role==='quote'?{quote_id:reference}:{ }),
        ...(role==='enquiry'?{enquiry_id:reference}:{ })};
      const response=await fetch(path,{method:'POST',cache:'no-store',headers:{'Content-Type':'application/json'},
        body:JSON.stringify(body)});
      const result=await response.json().catch(()=>({}));
      if(!response.ok||!result.success)throw Error(result.error||'Could not send a fresh link.');
      setSuccess('If verification is pending, IPS has issued a fresh verification email automatically. Check your inbox and spam folder.');
    }catch(e){setError(e.message);}finally{setResending(false);}
  }
  return <AcademicAuthShell eyebrow="AUTOMATIC ACCOUNT VERIFICATION"
    title="Prove your email." italicTitle="One secure step."
    intro="IPS emails the verification link automatically when you register. Click the link and verification completes here without employee intervention."
    asideTitle="Private by default." asideItalic="Verified by you."
    asideCopy="IPS never lets a manager mark someone else’s email verified. Only you can prove access to the registered mailbox. Verification does not automatically approve a specialist application.">
    {busy&&<p role="status" className="ipsa-auth-help">Verifying your registered email securely…</p>}
    {error&&<div role="alert" className="ipsa-auth-alert">{error}</div>}
    {success&&<div role="status" className="ipsa-auth-help">{success}</div>}
    <form onSubmit={e=>{e.preventDefault();void verify(role,email,code,reference);}} aria-label="Complete IPS email verification">
      <label className="ipsa-auth-field"><span>Account type</span>
        <select value={role} onChange={e=>setRole(e.target.value)}><option value="client">Student / Researcher</option><option value="writer">Specialist</option><option value="quote">Private quote request</option><option value="enquiry">General enquiry</option></select>
      </label>
      <label className="ipsa-auth-field"><span>Registered email</span>
        <input type="email" required autoComplete="email" value={email} onChange={e=>setEmail(e.target.value)}/></label>
      {contactRole(role)&&<label className="ipsa-auth-field"><span>Private request reference</span>
        <input required value={reference} onChange={e=>setReference(e.target.value.toUpperCase().trim())}
          placeholder={role==='quote'?'IPS-Q-...':'Your IPS enquiry reference'}/></label>}
      <label className="ipsa-auth-field"><span>Eight-digit verification code</span>
        <input inputMode="numeric" pattern="[0-9]{8}" maxLength={8} required value={code} onChange={e=>setCode(e.target.value.replace(/[^0-9]/g,''))}/></label>
      <button className="ipsa-auth-submit" disabled={busy||!validCode(code)||!validEmail(email)||contactRole(role)&&!validReference(role,reference)} type="submit">Verify my email</button>
    </form>
    <p className="ipsa-auth-after">
      Didn't receive a message? <button type="button" className="ipsa-auth-link" onClick={resend} disabled={resending}>{resending?'Sending…':'Request another secure link'}</button>
    </p>
    <p className="ipsa-auth-after"><Link to={contactRole(role)?'/#request-support':role==='writer'?'/writer/login':'/login'}>{contactRole(role)?'Return to IPS requests':'Return to account login'}</Link></p>
  </AcademicAuthShell>;
}
