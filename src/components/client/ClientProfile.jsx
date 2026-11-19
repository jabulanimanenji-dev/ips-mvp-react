import React,{useEffect,useState} from 'react';
import {useAuth} from '../../context/AuthContext';
import {usernameValid,passwordValid} from '../../../shared/privacyIdentity.js';

export default function ClientProfile(){
  const {user,updateClientProfile}=useAuth();
  const [form,setForm]=useState({username:'',country:'',phone:'',password:'',currentPassword:''});
  const [state,setState]=useState({saving:false,success:'',error:''});
  useEffect(()=>setForm({
    username:user?.username||'',country:user?.country||'',phone:user?.phone||'',password:'',currentPassword:''
  }),[user]);
  const submit=async event=>{
    event.preventDefault();
    if(!usernameValid(form.username.trim()))return setState({saving:false,success:'',error:'Choose a valid available username.'});
    if(form.password&&!passwordValid(form.password))return setState({saving:false,success:'',error:'Use at least 8 characters, a capital letter, a number and a symbol.'});
    setState({saving:true,success:'',error:''});
    const updates={username:form.username.trim(),country:form.country.trim(),phone:form.phone.trim(),
      ...(form.password?{password:form.password,current_password:form.currentPassword}:{})};
    const result=await updateClientProfile(updates);
    setState({saving:false,success:result.success?'Profile updated.':'',error:result.success?'':result.error});
    if(result.success)setForm(p=>({...p,password:'',currentPassword:''}));
  };
  return <div>
    <header style={{marginBottom:26}}>
      <p style={{color:'var(--primary)',fontSize:'.72rem',fontWeight:800,letterSpacing:'.14em'}}>MY PRIVATE ACCOUNT</p>
      <h1 className="section-title">My Profile</h1>
      <p className="section-subtitle">Your legal name is not needed for normal IPS account access. Only your username and verified email identify this account.</p>
    </header>
    <div className="card" style={{maxWidth:760}}>
      <form onSubmit={submit}>
        <div className="grid grid-2 gap-4">
          <label className="form-group"><span className="form-label">Username</span>
            <input className="form-input" autoComplete="username" required minLength={3} maxLength={32}
              value={form.username} onChange={e=>setForm(p=>({...p,username:e.target.value}))}/>
          </label>
          <label className="form-group"><span className="form-label">Account reference</span>
            <input className="form-input" readOnly value={user?.client_id||''}/>
          </label>
          <label className="form-group"><span className="form-label">Verified email address</span>
            <input className="form-input" readOnly value={user?.email||''}/>
            <small style={{color:'var(--text-muted)'}}>Changing your email requires verifying the new address. Contact IPS support for account recovery.</small>
          </label>
          <label className="form-group"><span className="form-label">Country (optional)</span>
            <input className="form-input" value={form.country} onChange={e=>setForm(p=>({...p,country:e.target.value}))} placeholder="Country"/>
          </label>
          <label className="form-group"><span className="form-label">WhatsApp number (optional)</span>
            <input className="form-input" type="tel" value={form.phone} onChange={e=>setForm(p=>({...p,phone:e.target.value}))} placeholder="Only if you want written WhatsApp contact"/>
            <small style={{color:'var(--text-muted)'}}>IPS never makes phone or voice calls.</small>
          </label>
          <label className="form-group"><span className="form-label">Current password (required only when changing password)</span>
            <input className="form-input" type="password" autoComplete="current-password" value={form.currentPassword}
              onChange={e=>setForm(p=>({...p,currentPassword:e.target.value}))}
              placeholder="Confirm your current password"/>
          </label>
          <label className="form-group"><span className="form-label">New password (optional)</span>
            <input className="form-input" type="password" autoComplete="new-password" minLength={8}
              value={form.password} onChange={e=>setForm(p=>({...p,password:e.target.value}))}
              placeholder="Leave blank to keep your current password"/>
          </label>
        </div>
        <p style={{color:'var(--text-muted)',fontSize:'.84rem'}}>We will not request your legal name for browsing, quotes or ordinary academic support. If a paid engagement requires verified billing details, IPS will explain why before requesting them.</p>
        {state.error&&<p className="toast error" role="alert" style={{position:'static'}}>{state.error}</p>}
        {state.success&&<p className="toast success" role="status" style={{position:'static'}}>{state.success}</p>}
        <button className="btn btn-primary" disabled={state.saving}>{state.saving?'Saving…':'Save Changes'}</button>
      </form>
    </div>
  </div>;
}
