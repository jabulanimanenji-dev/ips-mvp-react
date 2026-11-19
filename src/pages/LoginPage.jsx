import React,{useState} from 'react';
import {Link,useNavigate,useLocation} from 'react-router-dom';
import {useAuth} from '../context/AuthContext';
import AcademicAuthShell,{isAcademicDesignPreview} from '../components/public/AcademicAuthShell.jsx';
import VerifyEmailPanel from '../components/public/VerifyEmailPanel.jsx';

export default function LoginPage(){
  const {loginClient,verifyClientEmail}=useAuth();
  const navigate=useNavigate(),location=useLocation();
  const returnTo=String(location.state?.returnTo||'');
  const next=returnTo.startsWith('/student-support')?returnTo:'/client/overview';
  const [email,setEmail]=useState(''),[password,setPassword]=useState('');
  const [error,setError]=useState(''),[loading,setLoading]=useState(false),[verificationNeeded,setVerificationNeeded]=useState(false);
  async function submit(event){
    event.preventDefault();
    if(isAcademicDesignPreview)return;
    setError('');setLoading(true);
    try{
      const result=await loginClient(email,password);
      if(result.success)navigate(next);
      else {setError(result.error||'Invalid email or password.');setVerificationNeeded(Boolean(result.verification_required));}
    }catch{setError('The secure account service is not available. Please try again later.');}
    finally{setLoading(false);}
  }
  return <AcademicAuthShell eyebrow="YOUR IPS WORKSPACE" title="Welcome" italicTitle="back." intro="Access your IPS requests, quotations and conversations in one secure workspace.">
    <nav className="ipsa-auth-roles" aria-label="Choose account type">
      <span className="active" aria-current="page">Student / Researcher</span>
      <Link to="/writer/login">Specialist</Link>
    </nav>
    {error&&<div className="ipsa-auth-alert" role="alert">{error}</div>}
    {verificationNeeded?<VerifyEmailPanel email={email} verify={verifyClientEmail}
      onSuccess={()=>navigate(next,{replace:true})} onCancel={()=>{setVerificationNeeded(false);setError('');}}/>:null}
    <form onSubmit={submit} aria-label="Sign in to request support">
      <label className="ipsa-auth-field"><span>Email address</span>
        <input type="email" autoComplete="username" value={email} onChange={e=>setEmail(e.target.value)}
          placeholder="you@example.com" required/>
      </label>
      <label className="ipsa-auth-field"><span>Password</span>
        <input type="password" autoComplete="current-password" value={password} onChange={e=>setPassword(e.target.value)}
          placeholder="Enter your password" required/>
      </label>
      <button type="submit" className="ipsa-auth-submit" disabled={loading||isAcademicDesignPreview}>
        <span>{loading?'Signing in…':'Open my workspace'}</span><span aria-hidden="true">↗</span>
      </button>
    </form>
    <p className="ipsa-auth-help">Forgotten your password? <Link className="ipsa-auth-link" to="/forgot-password">Reset it securely by verified email</Link>. No phone calls or legal name required.</p>
    <div className="ipsa-auth-after">New to IPS? <Link className="ipsa-auth-link" to="/signup" state={{returnTo:next}}>Create an account</Link></div>
  </AcademicAuthShell>;
}
