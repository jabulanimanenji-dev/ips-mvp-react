import React,{useCallback,useEffect,useState} from 'react';
import {Link} from 'react-router-dom';
import AdminIcon from '../components/admin/AdminIcon.jsx';
export async function companyRequest(path,options={}){
  const response=await fetch(path,{credentials:'same-origin',cache:'no-store',...options,
    headers:{...(options.body?{'Content-Type':'application/json'}:{}),...(options.headers||{})}});
  let data;try{data=await response.json();}catch{data={};}
  if(!response.ok||data.success!==true)throw Error(data.error||data.message||'Company service unavailable.');
  return data;
}
export function useCompanyResource(url,key,allowed=true){
  const [value,setValue]=useState(null),[error,setError]=useState(''),[loading,setLoading]=useState(Boolean(allowed)),[version,setVersion]=useState(0);
  const refresh=useCallback(()=>setVersion(n=>n+1),[]);
  useEffect(()=>{
    if(!allowed){setValue(null);setError('');setLoading(false);return;}
    let active=true;const controller=new AbortController();setLoading(true);setError('');
    companyRequest(url,{signal:controller.signal})
      .then(data=>{if(active)setValue(data[key]??null);})
      .catch(e=>{if(active&&e.name!=='AbortError'){setError(e.message);setValue(null);}})
      .finally(()=>{if(active)setLoading(false);});
    return()=>{active=false;controller.abort();};
  },[url,key,allowed,version]);
  return {value,error,loading,refresh};
}
export function PageHeading({eyebrow,title,description,children}){
  return <div className="os-page-head"><div><span className="os-eyebrow">{eyebrow}</span><h1 className="os-title">{title}</h1>
    {description&&<p className="os-lead">{description}</p>}</div>{children&&<div style={{display:'flex',flexWrap:'wrap',gap:9}}>{children}</div>}</div>;
}
export function ErrorState({error,retry}){return error?<div className="os-error" role="alert">{error} {retry&&<button type="button" className="os-action quiet" onClick={retry}>Retry</button>}</div>:null;}
export function Empty({children}){return <div className="os-empty">{children}</div>;}
export function Status({children,tone}){return <span className={'os-status'+(tone?' '+tone:'')}>{children}</span>;}
export function Panel({title,subtitle,href,children}){
  return <section className="os-panel"><div className="os-panel-head"><h2>{title}</h2>{href&&<Link to={href}>Open <AdminIcon name="arrow" size={13}/></Link>}</div>
    {subtitle&&<p className="os-panel-sub">{subtitle}</p>}{children}</section>;
}
export function Refresh({onClick,loading}){return <button className="os-action secondary" type="button" disabled={loading} onClick={onClick}><AdminIcon name="refresh" size={16}/> {loading?'Syncing…':'Refresh live data'}</button>;}
