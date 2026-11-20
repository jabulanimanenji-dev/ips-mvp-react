import React,{useCallback,useEffect,useState} from 'react';
import {Link,useLocation,useNavigate} from 'react-router-dom';
import {useAuth} from '../../context/AuthContext';
import {IPS_COMPANY_ADMIN_NAV} from '../../../shared/ipsCompanyScope.js';

// Company-specific operational navigation is fixed in source and permission
// gated. Historical CMS navigation must never reintroduce marketplace,
// platform-studio or unrelated engineering functions into the live IPS desk.
export default function AdminSidebar(){
  const location=useLocation();
  const navigate=useNavigate();
  const {admin,logout,hasAdminPermission}=useAuth();
  const [mobileOpen,setMobileOpen]=useState(false);
  const [logoutError,setLogoutError]=useState('');
  const [attention,setAttention]=useState({new_requests:0,overdue_updates:0});
  const [unread,setUnread]=useState(0);
  const nav=IPS_COMPANY_ADMIN_NAV.filter(item=>hasAdminPermission(item.permission));

  const refresh=useCallback(async()=>{
    if(!admin?.id)return;
    if(hasAdminPermission('support.view')){
      try{
        const response=await fetch('/api/contact-enquiries/admin/attention',{cache:'no-store',credentials:'same-origin'});
        const data=await response.json();
        if(response.ok&&data.success)setAttention({new_requests:Number(data.new_requests||0),overdue_updates:Number(data.overdue_updates||0)});
      }catch{}
    }
    if(hasAdminPermission('messages.view')){
      try{
        const response=await fetch('/api/contact-channels/admin/threads',{cache:'no-store',credentials:'same-origin'});
        const data=await response.json();
        if(response.ok&&data.success)setUnread((data.threads||[]).filter(x=>x.channel==='telegram').reduce((sum,t)=>sum+Number(t.unread_count||0),0));
      }catch{}
    }
  },[admin?.id,hasAdminPermission]);

  useEffect(()=>{
    refresh();
    const timer=setInterval(refresh,60000);
    return ()=>clearInterval(timer);
  },[refresh,location.pathname]);

  const handleLogout=async()=>{
    setLogoutError('');
    const result=await logout();
    if(result?.success)navigate(import.meta.env.VITE_ADMIN_ENTRY_PATH||'/ips-mission-control',{replace:true});
    else setLogoutError(result?.error||'Could not end your session.');
  };

  let group='';
  return <>
    <button type="button" className="btn btn-ghost ipsa-admin-mobile-toggle" aria-label="Open administration menu"
      aria-expanded={mobileOpen} onClick={()=>setMobileOpen(v=>!v)}>☰ Menu</button>
    {mobileOpen&&<button type="button" aria-label="Close administration menu" className="ipsa-admin-overlay" onClick={()=>setMobileOpen(false)}/>}
    <aside className={'admin-sidebar ipsa-company-sidebar'+(mobileOpen?' sidebar-open':'')}
      style={{width:248,position:'fixed',left:0,top:0,height:'100vh',zIndex:100,display:'flex',flexDirection:'column',
        background:'#142b3d',borderRight:'1px solid rgba(225,234,244,.13)',boxShadow:'2px 0 16px rgba(0,0,0,.07)'}}>
      <div style={{padding:'22px 16px 19px',borderBottom:'1px solid rgba(225,234,244,.12)'}}>
        <div style={{display:'flex',alignItems:'center',gap:12}}>
          <span style={{width:39,height:39,display:'grid',placeItems:'center',border:'1px solid rgba(222,187,120,.5)',background:'#253c50',borderRadius:9,color:'#f4e5c9',fontWeight:800}}>IPS</span>
          <div>
            <strong style={{color:'#f6f3ed',fontSize:'.94rem',display:'block'}}>IPS Academic Services</strong>
            <small style={{color:'#c3d0dc'}}>Administration</small>
          </div>
        </div>
        <div style={{marginTop:12,color:'#d0dae4',fontSize:'.76rem',overflowWrap:'anywhere'}}>{admin?.customRoleName||admin?.role||'Administrator'}</div>
      </div>
      <nav aria-label="IPS administration" style={{flex:1,padding:'9px 11px 18px',overflowY:'auto',overscrollBehavior:'contain'}}>
        {nav.map(item=>{
          const newGroup=item.group!==group;
          group=item.group;
          const active=location.pathname===item.target||location.pathname.startsWith(item.target+'/');
          const count=item.target==='/admin/enquiries'?attention.new_requests:item.target==='/admin/external-chats'?unread:0;
          return <React.Fragment key={item.target}>
            {newGroup&&<div style={{color:'#b9c5ce',fontSize:'.65rem',fontWeight:750,letterSpacing:'.14em',padding:'17px 12px 7px',textTransform:'uppercase'}}>{item.group}</div>}
            <Link to={item.target} onClick={()=>setMobileOpen(false)} aria-current={active?'page':undefined}
              style={{display:'flex',alignItems:'center',gap:10,padding:'10px 11px',marginBottom:3,borderRadius:8,
                textDecoration:'none',color:active?'#fff':'#cbd8e0',background:active?'#304a60':'transparent',
                borderLeft:active?'3px solid #c9a977':'3px solid transparent',fontSize:'.86rem',fontWeight:active?700:500}}>
              <span aria-hidden="true" style={{fontSize:'.95rem',width:20,textAlign:'center'}}>{item.icon}</span>
              <span style={{flex:1}}>{item.label}</span>
              {count>0&&<span style={{background:'#8a3a30',padding:'2px 6px',borderRadius:7,fontSize:'.71rem',color:'#fff'}}>{count>99?'99+':count}</span>}
            </Link>
          </React.Fragment>;
        })}
      </nav>
      <div style={{borderTop:'1px solid rgba(225,234,244,.12)',padding:'13px 11px'}}>
        {logoutError&&<small role="alert" style={{color:'#ffb4b4',display:'block',marginBottom:8}}>{logoutError}</small>}
        <button type="button" className="btn btn-ghost" onClick={handleLogout}
          style={{width:'100%',border:'1px solid rgba(255,255,255,.17)',color:'#f5f7f9'}}>Logout</button>
      </div>
    </aside>
    <style>{'.ipsa-admin-mobile-toggle{display:none!important;position:fixed;left:12px;top:13px;z-index:1100}.ipsa-admin-overlay{position:fixed;inset:0;border:0;background:rgba(0,0,0,.6);z-index:99}@media(max-width:850px){.ipsa-admin-mobile-toggle{display:inline-flex!important}.ipsa-company-sidebar{transform:translateX(-105%);max-width:82vw;transition:transform .22s}.ipsa-company-sidebar.sidebar-open{transform:translateX(0)}}'}</style>
  </>;
}
