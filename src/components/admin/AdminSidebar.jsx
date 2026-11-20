import React,{useCallback,useEffect,useState} from 'react';
import {Link,useLocation,useNavigate} from 'react-router-dom';
import {useAuth} from '../../context/AuthContext';
import {IPS_COMPANY_ADMIN_NAV} from '../../../shared/ipsCompanyScope.js';
import AdminIcon from './AdminIcon.jsx';

export default function AdminSidebar(){
  const location=useLocation();
  const navigate=useNavigate();
  const {admin,logout,hasAdminPermission}=useAuth();
  const [mobileOpen,setMobileOpen]=useState(false);
  const [logoutError,setLogoutError]=useState('');
  const [attention,setAttention]=useState({new_requests:null});
  const [unread,setUnread]=useState(null);
  const nav=IPS_COMPANY_ADMIN_NAV.filter(item=>hasAdminPermission(item.permission));
  const refresh=useCallback(async()=>{
    if(!admin?.id)return;
    const jobs=[];
    if(hasAdminPermission('support.view'))jobs.push((async()=>{
      try{
        const res=await fetch('/api/contact-enquiries/admin/attention',{credentials:'same-origin',cache:'no-store'});
        const d=await res.json().catch(()=>({}));
        if(res.ok&&d.success)setAttention({new_requests:Number(d.new_requests||0)});
        else setAttention({new_requests:null});
      }catch{setAttention({new_requests:null});}
    })());
    if(hasAdminPermission('messages.view'))jobs.push((async()=>{
      try{
        const res=await fetch('/api/contact-channels/admin/threads',{credentials:'same-origin',cache:'no-store'});
        const d=await res.json().catch(()=>({}));
        if(res.ok&&d.success)setUnread((d.threads||[]).filter(t=>t.channel==='telegram')
          .reduce((sum,t)=>sum+Number(t.unread_count||0),0));
        else setUnread(null);
      }catch{setUnread(null);}
    })());
    await Promise.all(jobs);
  },[admin?.id,hasAdminPermission]);
  useEffect(()=>{refresh();const timer=setInterval(refresh,60000);return()=>clearInterval(timer);},[refresh,location.pathname]);
  useEffect(()=>setMobileOpen(false),[location.pathname]);
  async function handleLogout(){
    setLogoutError('');
    try{
      const result=await logout();
      if(result?.success)navigate(import.meta.env.VITE_ADMIN_ENTRY_PATH||'/ips-mission-control',{replace:true});
      else setLogoutError(result?.error||'Could not end your session.');
    }catch(error){setLogoutError('Could not end your session. Try again.');}
  }
  let currentGroup='';
  return <>
    <button type="button" className="ips-premium-mobile-menu" aria-label="Open administration menu"
      aria-expanded={mobileOpen} onClick={()=>setMobileOpen(x=>!x)}>
      <AdminIcon name="menu" size={21}/>
    </button>
    {mobileOpen&&<button type="button" className="ips-premium-mobile-scrim" aria-label="Close administration menu"
      onClick={()=>setMobileOpen(false)}/>}
    <aside className={'admin-sidebar ipsa-company-sidebar ips-premium-sidebar'+(mobileOpen?' sidebar-open':'')}
      style={{position:'fixed',left:0,top:0,zIndex:101,height:'100vh',width:264,display:'flex',flexDirection:'column',background:'#142b3d'}}>
      <div className="ips-premium-sidebar-brand" style={{padding:'27px 21px 20px',borderBottom:'1px solid rgba(214,229,229,.11)'}}>
        <Link to="/admin/dashboard" aria-label="IPS company operations home" style={{display:'flex',gap:12,textDecoration:'none',alignItems:'center'}}>
          <span className="ips-premium-sidebar-monogram">IPS</span>
          <span>
            <strong style={{color:'#f7f6ef',display:'block',fontSize:'.92rem',letterSpacing:'-.02em'}}>IPS Academic</strong>
            <small style={{color:'#c5d2d8',fontSize:'.7rem',display:'block',letterSpacing:'.045em',marginTop:3}}>SERVICES · OPERATIONS</small>
          </span>
        </Link>
        <div className="ips-sidebar-division"><span className="ips-sidebar-live-dot"/>PRIVATE ADMINISTRATION <AdminIcon name="shield" size={14}/></div>
      </div>
      <nav aria-label="IPS administration" className="ips-premium-sidebar-nav"
        style={{overflowY:'auto',flex:1,padding:'14px 11px 20px'}}>
        {nav.map(item=>{
          const changed=item.group!==currentGroup;
          currentGroup=item.group;
          const active=location.pathname===item.target||location.pathname.startsWith(item.target+'/');
          const count=item.target==='/admin/enquiries'?attention.new_requests:
            item.target==='/admin/external-chats'?unread:null;
          return <React.Fragment key={item.target}>
            {changed&&<div className="ips-premium-nav-group">{item.group}</div>}
            <Link to={item.target} aria-current={active?'page':undefined} onClick={()=>setMobileOpen(false)}
              className={'ips-premium-nav-link'+(active?' is-active':'')}
              style={{display:'flex',alignItems:'center',gap:11,padding:'10px 11px',borderRadius:9,
                borderLeft:'3px solid '+(active?'#d4af73':'transparent'),
                marginBottom:3,fontSize:'.82rem',fontWeight:active?750:550,
                color:'#cbd8e0',textDecoration:'none'}}>
              <AdminIcon name={item.icon||'overview'} size={19}/>
              <span style={{flex:1,minWidth:0}}>{item.label}</span>
              {count>0&&<span className="ips-premium-nav-badge">{count>99?'99+':count}</span>}
            </Link>
          </React.Fragment>;
        })}
      </nav>
      <div className="ips-premium-sidebar-footer" style={{borderTop:'1px solid rgba(220,232,237,.13)',padding:'17px 17px 22px'}}>
        <div style={{display:'flex',alignItems:'center',gap:9,color:'#a9c1ca',fontSize:'.73rem',padding:'3px 5px 14px'}}>
          <AdminIcon name="lock" size={15}/> Private company environment
        </div>
        {logoutError&&<p role="alert" style={{fontSize:'.72rem',color:'#ffbeb8'}}>{logoutError}</p>}
        <button type="button" className="ips-premium-logout" aria-label="Logout" onClick={handleLogout}
          style={{width:'100%',display:'flex',alignItems:'center',justifyContent:'center',gap:9,background:'transparent',
            border:'1px solid #587082',borderRadius:9,padding:'11px',color:'#e7eef2',fontSize:'.8rem',fontWeight:750}}>
          <AdminIcon name="logout" size={17}/> Logout
        </button>
      </div>
    </aside>
    <style>{`
      .ips-premium-sidebar-monogram{display:grid;place-items:center;flex:0 0 46px;height:46px;width:46px;
       background:#233e4d;border:1px solid rgba(213,179,118,.55);border-radius:13px;color:#f4dbae;font-weight:850;letter-spacing:-.06em;font-size:1rem}
      .ips-sidebar-division{display:flex;align-items:center;gap:9px;margin-top:21px;color:#b6c9cc;font-size:.61rem;font-weight:800;letter-spacing:.11em}
      .ips-sidebar-division svg{margin-left:auto;color:#9fb6bb}
      .ips-sidebar-live-dot{display:inline-block;width:6px;height:6px;background:#7fbaa3;border-radius:50%;box-shadow:0 0 0 3px rgba(127,186,163,.12)}
      .ips-premium-nav-group{font-size:.63rem;letter-spacing:.14em;text-transform:uppercase;color:#aabcc5;padding:20px 12px 10px;font-weight:800}
      .ips-premium-nav-link svg{flex:0 0 19px;opacity:.9}
      .ips-premium-nav-link.is-active svg{color:#e6c48c}
      .ips-premium-nav-badge{font-size:.67rem;background:#a6594e;color:white;padding:3px 7px;border-radius:8px;font-weight:850}
      .ips-premium-logout:hover{background:#284658!important}
      .ips-premium-mobile-menu{display:none;position:fixed;left:13px;top:18px;z-index:160;
        width:44px;height:42px;align-items:center;justify-content:center;background:#142b3d;color:#fff;border:0;border-radius:9px}
      .ips-premium-mobile-scrim{display:none;position:fixed;inset:0;z-index:98;background:rgba(13,29,40,.58);border:0}
      @media(max-width:900px){.ips-premium-mobile-menu{display:flex}
        .ips-premium-sidebar{transform:translateX(-105%);transition:transform .2s;max-width:85vw}
        .ips-premium-sidebar.sidebar-open{transform:translateX(0)}
        .ips-premium-mobile-scrim{display:block}}
      @media(prefers-reduced-motion:reduce){.ips-premium-sidebar{transition:none}}
    `}</style>
  </>;
}
