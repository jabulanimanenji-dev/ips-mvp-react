import React,{useState} from 'react';
import {Link,useNavigate,useLocation} from 'react-router-dom';
import {useAuth} from '../context/AuthContext';
import AcademicAuthShell,{isAcademicDesignPreview} from '../components/public/AcademicAuthShell.jsx';

export default function LoginPage(){
  const {loginClient}=useAuth();
  const navigate=useNavigate(),location=useLocation();
  const returnTo=String(location.state?.returnTo||'');
  const next=returnTo.startsWith('/student-support')?returnTo:'/client/overview';
  const [email,setEmail]=useState(''),[password,setPassword]=useState('');
  const [error,setError]=useState(''),[loading,setLoading]=useState(false);
  async function submit(event){
    event.preventDefault();
    if(isAcademicDesignPreview)return;
    setError('');setLoading(true);
    try{
      const result=await loginClient(email,password);
      if(result.success)navigate(next);
      else setError(result.error||'Invalid email or password.');
    }catch{setError('The secure account service is not available. Please try again later.');}
    finally{setLoading(false);}
  }
  return <AcademicAuthShell eyebrow="YOUR IPS WORKSPACE" title="Welcome" italicTitle="back." intro="Access your IPS requests, quotations and conversations in one secure workspace.">
    <nav className="ipsa-auth-roles" aria-label="Choose account type">
      <span className="active" aria-current="page">Seeking support</span>
      <Link to="/writer/login">Working with IPS</Link>
    </nav>
    {error&&<div className="ipsa-auth-alert" role="alert">{error}</div>}
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
    <p className="ipsa-auth-help">Need help accessing your account? <a className="ipsa-auth-link"
      href="mailto:support@ipsglobalservice.com?subject=IPS%20Account%20Access%20Assistance">Contact IPS support</a>. Do not email your password.</p>
    <div className="ipsa-auth-after">New to IPS? <Link className="ipsa-auth-link" to="/signup" state={{returnTo:next}}>Create an account</Link></div>
  </AcademicAuthShell>;
}
