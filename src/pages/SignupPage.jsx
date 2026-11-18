import React,{useState} from 'react';
import {Link,useNavigate,useLocation} from 'react-router-dom';
import {useAuth} from '../context/AuthContext';
import AcademicAuthShell,{isAcademicDesignPreview} from '../components/public/AcademicAuthShell.jsx';

export default function SignupPage(){
  const {signupClient}=useAuth();
  const navigate=useNavigate(),location=useLocation();
  const returnTo=String(location.state?.returnTo||'');
  const next=returnTo.startsWith('/student-support')?returnTo:'/client/overview';
  const [form,setForm]=useState({name:'',email:'',password:''});
  const [error,setError]=useState(''),[loading,setLoading]=useState(false);
  const update=e=>{setForm(prev=>({...prev,[e.target.name]:e.target.value}));setError('');};
  async function submit(event){
    event.preventDefault();
    if(isAcademicDesignPreview)return;
    if(!form.name.trim()||!form.email.trim()||!form.password.trim()){
      setError('Complete all required fields.');return;
    }
    setLoading(true);setError('');
    try{
      const result=await signupClient(form.name.trim(),form.email.trim(),form.password);
      if(result.success)navigate(next);
      else setError(result.error||'Your account could not be created.');
    }catch{setError('Registration is temporarily unavailable. Please try again later.');}
    finally{setLoading(false);}
  }
  return <AcademicAuthShell eyebrow="CREATE YOUR IPS ACCOUNT" title="Your next chapter" italicTitle="starts here." intro="Create a private account to request academic support and manage your correspondence with IPS."
    asideTitle="A clearer way to" asideItalic="move forward." asideCopy="Share your requirements, review the agreed scope and keep important project communications together.">
    {error&&<div className="ipsa-auth-alert" role="alert">{error}</div>}
    <form onSubmit={submit} aria-label="Create your IPS account">
      <label className="ipsa-auth-field"><span>Full name</span>
        <input name="name" type="text" autoComplete="name" value={form.name} onChange={update} placeholder="Your full name" required maxLength={100}/>
      </label>
      <label className="ipsa-auth-field"><span>Email address</span>
        <input name="email" type="email" autoComplete="email" value={form.email} onChange={update} placeholder="you@example.com" required/>
      </label>
      <label className="ipsa-auth-field"><span>Create a password</span>
        <input name="password" type="password" autoComplete="new-password" value={form.password} onChange={update} placeholder="Choose a secure password" minLength={6} required/>
      </label>
      <p className="ipsa-auth-help">Use a unique password. Your information is used to manage the services and communication you request.</p>
      <button type="submit" className="ipsa-auth-submit" disabled={loading||isAcademicDesignPreview}>
        <span>{loading?'Creating your account…':'Create your IPS account'}</span><span aria-hidden="true">↗</span>
      </button>
    </form>
    <div className="ipsa-auth-after">Already registered? <Link className="ipsa-auth-link" to="/login" state={{returnTo:next}}>Sign in instead</Link></div>
  </AcademicAuthShell>;
}
