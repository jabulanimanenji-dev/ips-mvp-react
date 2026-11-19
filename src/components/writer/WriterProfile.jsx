import React,{useState} from 'react';
import {useNavigate} from 'react-router-dom';
import {useAuth} from '../../context/AuthContext';
import {passwordValid} from '../../../shared/privacyIdentity.js';

export default function WriterProfile(){
  const {writer,logout}=useAuth();
  const navigate=useNavigate();
  const [fields,setFields]=useState({
    full_name:writer?.full_name||'',
    primary_expertise:writer?.primary_expertise||'',
    secondary_expertise:writer?.secondary_expertise||'',
    academic_level:writer?.academic_level||'Master',
    availability:writer?.availability||'Available',
    current_password:'',password:'',confirm:''
  });
  const [saving,setSaving]=useState(false),[error,setError]=useState(''),[message,setMessage]=useState('');
  function update(field,value){setFields(v=>({...v,[field]:value}));setError('');setMessage('');}
  async function submit(event){
    event.preventDefault();
    if(!writer?.writer_id)return;
    if(fields.full_name.trim().length<2)return setError('Your verified specialist identity requires a full name.');
    if(fields.password&&(!passwordValid(fields.password)||fields.password!==fields.confirm))
      return setError('Passwords must match and have at least eight characters, including an uppercase letter, number and symbol.');
    setSaving(true);setError('');setMessage('');
    try{
      const body={
        primary_expertise:fields.primary_expertise.trim(),
        secondary_expertise:fields.secondary_expertise.trim(),
        academic_level:fields.academic_level.trim(),availability:fields.availability,
        ...(fields.password?{password:fields.password,current_password:fields.current_password}:{})
      };
      const response=await fetch('/api/writers/'+encodeURIComponent(writer.writer_id),{
        method:'PATCH',credentials:'same-origin',headers:{'Content-Type':'application/json'},body:JSON.stringify(body)
      });
      const data=await response.json().catch(()=>({}));
      if(!response.ok||!data.success)throw Error(data.error||'Your specialist profile could not be saved.');
      if(data.session_revoked){
        await logout();
        navigate('/writer/login',{replace:true});
        return;
      }
      setFields(prev=>({...prev,password:'',current_password:'',confirm:''}));
      setMessage('Your professional profile has been saved securely. Changes to the display will be visible after reloading.');
    }catch(err){setError(err.message||'Specialist profile update is unavailable.');}
    finally{setSaving(false);}
  }
  return <main>
    <header style={{marginBottom:24}}>
      <p style={{fontSize:'.74rem',fontWeight:800,letterSpacing:'.12em'}}>VETTED IPS SPECIALIST</p>
      <h1 className="section-title">My Professional Profile</h1>
      <p>IPS maintains the real identity of its approved professionals. Your personal credentials and client assignments are not publicly searchable.</p>
    </header>
    <form className="card" style={{maxWidth:760}} onSubmit={submit}>
      <label className="form-group"><span className="form-label">Full professional name</span>
        <input className="form-input" required readOnly value={fields.full_name}/></label>
      <label className="form-group"><span className="form-label">Verified email address</span>
        <input className="form-input" type="email" value={writer?.email||''} readOnly/></label>
      <label className="form-group"><span className="form-label">Primary expertise</span>
        <input className="form-input" maxLength={160} value={fields.primary_expertise}
          onChange={e=>update('primary_expertise',e.target.value)}/></label>
      <label className="form-group"><span className="form-label">Secondary expertise</span>
        <input className="form-input" maxLength={160} value={fields.secondary_expertise}
          onChange={e=>update('secondary_expertise',e.target.value)}/></label>
      <label className="form-group"><span className="form-label">Academic level</span>
        <input className="form-input" maxLength={90} value={fields.academic_level}
          onChange={e=>update('academic_level',e.target.value)}/></label>
      <label className="form-group"><span className="form-label">Current availability</span>
        <select className="form-select" value={fields.availability}
          onChange={e=>update('availability',e.target.value)}>
          {['Available','Limited Availability','Unavailable'].map(v=><option key={v} value={v}>{v}</option>)}
        </select></label>
      <h2 style={{marginTop:25}}>Account security</h2>
      <p>Change your password only if you want to rotate your credentials. All earlier signed-in sessions will be revoked.</p>
      <label className="form-group"><span className="form-label">Current password</span>
        <input className="form-input" type="password" autoComplete="current-password" value={fields.current_password}
          onChange={e=>update('current_password',e.target.value)}/></label>
      <label className="form-group"><span className="form-label">New password (optional)</span>
        <input className="form-input" type="password" autoComplete="new-password" minLength={8}
          value={fields.password} onChange={e=>update('password',e.target.value)}/></label>
      <label className="form-group"><span className="form-label">Confirm new password</span>
        <input className="form-input" type="password" autoComplete="new-password" value={fields.confirm}
          onChange={e=>update('confirm',e.target.value)}/></label>
      {error&&<p role="alert" className="toast error" style={{position:'static'}}>{error}</p>}
      {message&&<p role="status" className="toast success" style={{position:'static'}}>{message}</p>}
      <button className="btn btn-primary" type="submit" disabled={saving}>{saving?'Saving…':'Save Professional Profile'}</button>
    </form>
  </main>;
}
