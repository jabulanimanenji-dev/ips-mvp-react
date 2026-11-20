import React,{useEffect,useMemo,useState} from 'react';
import {NavLink,Outlet,useLocation,useNavigate} from 'react-router-dom';
import {useAuth} from '../context/AuthContext.jsx';
import AdminIcon from '../components/admin/AdminIcon.jsx';
import {COMPANY_NAV} from './model.js';
import './company-os.css';

export default function CompanyShell(){
  const {admin,logout,hasAdminPermission}=useAuth();
  const location=useLocation(),navigate=useNavigate();
  const [menu,setMenu]=useState(false),[search,setSearch]=useState(false),[query,setQuery]=useState(''),[error,setError]=useState('');
  const permitted=useMemo(()=>COMPANY_NAV.filter(x=>hasAdminPermission(x.permission)),[admin?.id,admin?.department,admin?.permissions?.join('|')]);
  const current=permitted.find(x=>location.pathname===x.path)||permitted[0];
  useEffect(()=>{setMenu(false);setSearch(false);setQuery('');},[location.pathname]);
  useEffect(()=>{
    const fn=e=>{if((e.metaKey||e.ctrlKey)&&e.key.toLowerCase()==='k'){e.preventDefault();setSearch(true);}
      if(e.key==='Escape')setSearch(false);};
    document.addEventListener('keydown',fn);return()=>document.removeEventListener('keydown',fn);
  },[]);
  const found=permitted.filter(x=>(x.name+' '+x.sub+' '+x.group).toLowerCase().includes(query.toLowerCase()));
  const exit=async()=>{
    setError('');try{const result=await logout();if(result?.success)navigate(import.meta.env.VITE_ADMIN_ENTRY_PATH||'/ips-mission-control',{replace:true});
      else setError(result?.error||'Sign out failed.');}
    catch{setError('Could not end this session.');}
  };
  let group='';
  return <div className="ips-os">
    <button className="ips-os-mobile-trigger" type="button" onClick={()=>setMenu(!menu)} aria-label="Toggle company navigation" aria-expanded={menu}><AdminIcon name="menu"/></button>
    {menu&&<button className="ips-os-scrim" type="button" aria-label="Close company navigation" onClick={()=>setMenu(false)}/>}
    <aside className={'ips-os-rail'+(menu?' open':'')} aria-label="Company administration">
      <div className="ips-os-identity">
        <div className="ips-os-seal">IPS<span>.</span></div>
        <div><strong>INTERNATIONAL<br/>PROJECT SERVICES</strong><small>COMPANY OPERATING SYSTEM</small></div>
      </div>
      <div className="ips-os-environment"><span className="ips-os-pulse"/> PRIVATE COMPANY CONSOLE <AdminIcon name="shield" size={14}/></div>
      <nav aria-label="Company workspaces" className="ips-os-navigation">
        {permitted.map(item=>{const changed=item.group!==group;group=item.group;
          return <React.Fragment key={item.path}>
            {changed&&<div className="ips-os-nav-caption">{item.group}</div>}
            <NavLink to={item.path} end className={({isActive})=>'ips-os-nav'+(isActive?' selected':'')}>
              <AdminIcon name={item.icon} size={18}/><span>{item.name}</span>
            </NavLink>
          </React.Fragment>;})}
      </nav>
      <div className="ips-os-rail-foot">
        <div className="ips-os-owner-mini"><span className="ips-os-user-badge">{admin?.isRoot?'R':'M'}</span>
          <div><strong>{admin?.isRoot?'Root owner':admin?.name||'Authorized staff'}</strong>
          <small>{admin?.isRoot?'No manager · Protected identity':admin?.department?.replaceAll('_',' ')||admin?.companyRole||'Company staff'}</small></div>
        </div>
        {error&&<div role="alert" className="ips-os-error">{error}</div>}
        <button type="button" className="ips-os-signout" onClick={exit}><AdminIcon name="logout" size={16}/> Sign out securely</button>
      </div>
    </aside>
    <div className="ips-os-main">
      <header className="ips-os-header">
        <div><div className="ips-os-breadcrumb">IPS <span>/</span> {current?.group||'COMPANY'} <span>/</span> <b>{current?.name||'Administration'}</b></div>
          <div className="ips-os-header-caption">{current?.sub||'Protected company management'}</div></div>
        <div className="ips-os-header-controls">
          <button type="button" className="ips-os-search-trigger" onClick={()=>setSearch(true)}><AdminIcon name="search" size={17}/> Find a workspace <kbd>Ctrl K</kbd></button>
          <span className="ips-os-private-tag"><AdminIcon name="lock" size={14}/> CONFIDENTIAL</span>
        </div>
      </header>
      <main id="ips-company-main" className="ips-os-content"><Outlet/></main>
      <div className="ips-os-footer">IPS COMPANY CONTROL <span>•</span> Access governed by staff authority <span>•</span> Payment collection disabled until provider integration</div>
    </div>
    {search&&<div className="ips-os-command-shade" onMouseDown={e=>{if(e.target===e.currentTarget)setSearch(false);}}>
      <div className="ips-os-command" role="dialog" aria-modal="true" aria-label="Find authorized company workspace">
        <div className="ips-os-command-entry"><AdminIcon name="search" size={19}/><input autoFocus value={query} onChange={e=>setQuery(e.target.value)} placeholder="Search authorized workspaces…"/><button type="button" onClick={()=>setSearch(false)} aria-label="Close search">ESC</button></div>
        <div className="ips-os-command-results">{found.map(x=><button type="button" key={x.path} onClick={()=>{navigate(x.path);setSearch(false);}}><AdminIcon name={x.icon} size={18}/><span><strong>{x.name}</strong><small>{x.sub}</small></span><AdminIcon name="arrow" size={15}/></button>)}
          {!found.length&&<p>No authorized workspaces match the search.</p>}</div>
      </div>
    </div>}
  </div>;
}
