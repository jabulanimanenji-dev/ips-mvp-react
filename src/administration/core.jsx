import React,{useCallback,useEffect,useMemo,useState} from 'react';
import {Link} from 'react-router-dom';
import {useAuth} from '../context/AuthContext.jsx';

export {MODULES} from './authority.js';
export const CASE_KINDS={
 enquiry:{name:'Client enquiry',permission:'support.manage',desk:'/admin/enquiries'},
 support:{name:'Support case',permission:'support.manage',desk:'/admin/support'},
 project:{name:'Project file',permission:'services.manage',desk:'/admin/services'},
 telegram:{name:'Telegram thread',permission:'messages.manage',desk:'/admin/external-chats'}
};
export const FINISHED=new Set(['closed','Closed','Resolved','Completed','Cancelled','cancelled']);
export const isOpen=c=>Boolean(c&&!FINISHED.has(c.status));
export const dateTime=x=>x&&!Number.isNaN(Date.parse(x))?new Date(x).toLocaleString(undefined,{day:'numeric',month:'short',hour:'2-digit',minute:'2-digit'}):'Unscheduled';
export const canContact=c=>Boolean(c?.verified);
export const isPending=c=>c?.status==='Active'&&!c?.email_verified_at;
export const hasWorkPermission=(user,permission,fn)=>fn(permission);
export const describeError=e=>e?.message||'The company system could not complete this request.';
export async function request(path,{method='GET',body,signal}={}){
  const response=await fetch(path,{method,credentials:'same-origin',cache:'no-store',
    ...(signal?{signal}:{}),...(body===undefined?{}:{headers:{'Content-Type':'application/json'},body:JSON.stringify(body)})});
  let result;try{result=await response.json();}catch{result={};}
  if(!response.ok||result.success!==true)throw Error(result.error||result.message||'Company request could not be completed.');
  return result;
}
export function useFeed(path,key,enabled=true){
  const [payload,setPayload]=useState(null),[error,setError]=useState(''),[busy,setBusy]=useState(false),[stamp,setStamp]=useState(0);
  const refresh=useCallback(()=>setStamp(n=>n+1),[]);
  useEffect(()=>{
    if(!enabled){setPayload(null);setError('');setBusy(false);return;}
    let active=true;const controller=new AbortController();
    setBusy(true);setError('');
    request(path,{signal:controller.signal}).then(r=>{if(active)setPayload(r);})
      .catch(e=>{if(active&&e.name!=='AbortError'){setError(describeError(e));setPayload(null);}})
      .finally(()=>{if(active)setBusy(false);});
    return()=>{active=false;controller.abort();};
  },[path,enabled,stamp]);
  return {records:payload?.[key]??null,payload,error,busy,refresh,available:payload!==null};
}
export function Title({kicker,title,description,actions}){
  return <div className="ips4-heading"><div><span className="ips4-kicker">{kicker}</span><h1>{title}</h1><p>{description}</p></div>
    {actions&&<div className="ips4-heading-tools">{actions}</div>}</div>;
}
export function Panel({title,description,children,aside}){
  return <section className="ips4-panel"><div className="ips4-panel-heading"><div><h2>{title}</h2>{description&&<p>{description}</p>}</div>{aside}</div>{children}</section>;
}
export function Button({children,onClick,kind='neutral',disabled,type='button',title}){
  return <button type={type} title={title} disabled={disabled} onClick={onClick} className={'ips4-btn '+kind}>{children}</button>;
}
export function LinkButton({children,to,kind='neutral'}){return <Link className={'ips4-btn '+kind} to={to}>{children}</Link>;}
export function Tag({children,tone='neutral'}){return <span className={'ips4-tag '+tone}>{children}</span>;}
export function Notice({children,kind='notice'}){return <div className={'ips4-feedback '+kind} role={kind==='danger'?'alert':'status'}>{children}</div>;}
export function Empty({children}){return <div className="ips4-empty"><span aria-hidden="true">◇</span><p>{children}</p></div>;}
export function Dialog({title,subtitle,children,onClose}){
  useEffect(()=>{const key=e=>{if(e.key==='Escape')onClose();};document.addEventListener('keydown',key);return()=>document.removeEventListener('keydown',key);},[onClose]);
  return <div className="ips4-dialog-overlay" onMouseDown={e=>{if(e.target===e.currentTarget)onClose();}}>
    <section className="ips4-dialog" role="dialog" aria-modal="true" aria-label={title}>
      <header><div><span className="ips4-kicker">IPS · CONTROLLED ACTION</span><h2>{title}</h2>{subtitle&&<p>{subtitle}</p>}</div>
        <button className="ips4-close" aria-label="Close" type="button" onClick={onClose}>×</button></header>
      <div className="ips4-dialog-content">{children}</div>
    </section>
  </div>;
}
export function useAction(refresh){
  const [pending,setPending]=useState(false),[error,setError]=useState(''),[notice,setNotice]=useState('');
  const run=useCallback(async(path,method,body,message)=>{
    if(pending)return false;setPending(true);setError('');setNotice('');
    try{await request(path,{method,body});refresh?.();setNotice(message||'The company record was updated.');return true;}
    catch(e){setError(describeError(e));return false;}finally{setPending(false);}
  },[pending,refresh]);
  return {run,pending,error,notice,setError,setNotice};
}
export function Feedback({error,notice}){return <>{error&&<Notice kind="danger">{error}</Notice>}{notice&&<Notice>{notice}</Notice>}</>;}
export const GroupTotals=({items})=><div className="ips4-stats">{items.map(({label,value,hint,tone})=><div className={'ips4-stat '+(tone||'')} key={label}>
  <span>{label}</span><strong>{value===null||value===undefined?'—':value}</strong><small>{hint}</small></div>)}</div>;
export function Restricted({permission,children}){
  const {hasAdminPermission}=useAuth();
  return hasAdminPermission(permission)?children:<section className="ips4-panel"><Title kicker="ACCESS" title="Outside your authority" description={'This work requires '+permission+'. Your manager must grant any lawful delegated access.'}/><LinkButton to="/admin/dashboard">Go to permitted company work</LinkButton></section>;
}
