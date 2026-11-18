import React,{useState} from 'react';
import {Link,useNavigate} from 'react-router-dom';
import {useAuth} from '../../context/AuthContext';
import AcademicAuthShell,{isAcademicDesignPreview} from '../public/AcademicAuthShell.jsx';

export default function WriterLogin(){
  const [email,setEmail]=useState(''),[password,setPassword]=useState('');
  const [error,setError]=useState(''),[loading,setLoading]=useState(false);
  const {loginWriter}=useAuth();
  const navigate=useNavigate();
  async function submit(e){
    e.preventDefault();if(isAcademicDesignPreview)return;
    setError('');setLoading(true);
    try{
      const result=await loginWriter(email,password);
      if(result.success)navigate('/writer',{replace:true});
      else setError(result.error||'Invalid email or password.');
    }catch{setError('IPS specialist sign-in is temporarily unavailable.');}
    finally{setLoading(false);}
  }
  return <AcademicAuthShell standalone eyebrow="WORKING WITH IPS" title="Your expertise." italicTitle="Our platform." intro="Sign in to review your assignments and communicate with the IPS team in one professional workspace."
    asideTitle="Work with" asideItalic="clarity." asideCopy="A structured space for assignments, project updates and correspondence with the IPS team.">
    <nav className="ipsa-auth-roles" aria-label="Choose account type">
      <Link to="/login">Seeking support</Link><span className="active" aria-current="page">Working with IPS</span>
    </nav>
    {error&&<div className="ipsa-auth-alert" role="alert">{error}</div>}
    <form onSubmit={submit} aria-label="Sign in to work with IPS">
      <label className="ipsa-auth-field"><span>Email address</span>
        <input type="email" autoComplete="username" value={email} onChange={e=>setEmail(e.target.value)} required placeholder="you@example.com"/>
      </label>
      <label className="ipsa-auth-field"><span>Password</span>
        <input type="password" autoComplete="current-password" value={password} onChange={e=>setPassword(e.target.value)} required placeholder="Enter your password"/>
      </label>
      <button className="ipsa-auth-submit" type="submit" disabled={loading||isAcademicDesignPreview}>
        <span>{loading?'Signing in…':'Open my workspace'}</span><span aria-hidden="true">↗</span>
      </button>
    </form>
    <p className="ipsa-auth-help">Workspace access begins once IPS approves your application.</p>
    <div className="ipsa-auth-after">Interested in working with IPS? <Link className="ipsa-auth-link" to="/become-a-provider">Apply to work with IPS</Link>.</div>
  </AcademicAuthShell>;
}
