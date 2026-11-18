import React,{useState} from 'react';
import {Link,useNavigate,useLocation} from 'react-router-dom';
import {useAuth} from '../context/AuthContext';
import AcademicAuthShell,{isAcademicDesignPreview} from '../components/public/AcademicAuthShell.jsx';
import VerifyEmailPanel from '../components/public/VerifyEmailPanel.jsx';
import {usernameValid,passwordValid} from '../../shared/privacyIdentity.js';

export default function SignupPage(){
  const {signupClient,verifyClientEmail}=useAuth();
  const navigate=useNavigate(),location=useLocation();
  const returnTo=String(location.state?.returnTo||'');
  const next=returnTo.startsWith('/student-support')?returnTo:'/client/overview';
  const [form,setForm]=useState({username:'',email:'',password:'',confirm:''});
  const [verify,setVerify]=useState(false),[error,setError]=useState(''),[loading,setLoading]=useState(false);
  const update=e=>{setForm(prev=>({...prev,[e.target.name]:e.target.value}));setError('');};
  async function submit(event){
    event.preventDefault();if(isAcademicDesignPreview)return;
    if(!usernameValid(form.username.trim()))return setError('Use 3–32 letters, numbers, periods, underscores or hyphens for your username.');
    if(!passwordValid(form.password))return setError('Use at least 8 characters, including an uppercase letter, number and symbol.');
    if(form.password!==form.confirm)return setError('Passwords do not match.');
    setLoading(true);setError('');
    try{
      const result=await signupClient(form.username.trim(),form.email.trim(),form.password);
      if(result.success&&result.verification_required)setVerify(true);
      else if(result.success)setError('Email verification is required before account access.');
      else{
        if(result.verification_required)setVerify(true);
        setError(result.error||'Registration unavailable.');
      }
    }catch{setError('Registration is temporarily unavailable. Please try again later.');}
    finally{setLoading(false);}
  }
  return <AcademicAuthShell eyebrow="WELCOME TO IPS" title={verify?'Verify your':'Welcome to IPS.'} italicTitle={verify?'email.':null}
    intro={verify?'Confirm your email address to activate your private IPS account.':'Choose a username and get started. Your legal name, institution and phone number are not required.'}
    asideTitle="Your academic work." asideItalic="Your privacy." asideCopy="IPS requests only the information needed to communicate about your work. A private username can be used instead of your legal name.">
    {verify?<VerifyEmailPanel email={form.email.trim()} verify={verifyClientEmail} onSuccess={()=>navigate(next,{replace:true})} onCancel={()=>setVerify(false)}/>:
    <>
      {error&&<div className="ipsa-auth-alert" role="alert">{error}</div>}
      <form onSubmit={submit} aria-label="Create your IPS account">
        <label className="ipsa-auth-field"><span>Choose a username</span>
          <input name="username" autoComplete="username" value={form.username} onChange={update}
            minLength={3} maxLength={32} pattern="[A-Za-z0-9][A-Za-z0-9_.-]{2,31}"
            placeholder="Your private username" required/>
        </label>
        <p className="ipsa-auth-help">Your username does not need to reveal your identity. It is visible only within your account and to authorized IPS personnel.</p>
        <label className="ipsa-auth-field"><span>Email address</span>
          <input name="email" type="email" autoComplete="email" value={form.email} onChange={update} placeholder="you@example.com" required/>
        </label>
        <label className="ipsa-auth-field"><span>Create a password</span>
          <input name="password" type="password" autoComplete="new-password" value={form.password} onChange={update}
            placeholder="At least 8 characters" minLength={8} maxLength={128} required/>
        </label>
        <label className="ipsa-auth-field"><span>Confirm password</span>
          <input name="confirm" type="password" autoComplete="new-password" value={form.confirm} onChange={update}
            placeholder="Repeat your password" required/>
        </label>
        <p className="ipsa-auth-help">Include an uppercase letter, a number and a symbol. Your email must be verified before you can sign in.</p>
        <button type="submit" className="ipsa-auth-submit" disabled={loading||isAcademicDesignPreview}>
          <span>{loading?'Creating your account…':'Create Account'}</span><span aria-hidden="true">↗</span>
        </button>
      </form>
      <div className="ipsa-auth-after">Already registered? <Link className="ipsa-auth-link" to="/login" state={{returnTo:next}}>Login</Link></div>
    </>}
  </AcademicAuthShell>;
}
