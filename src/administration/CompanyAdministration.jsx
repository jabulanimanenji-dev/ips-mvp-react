import React,{useEffect,useMemo,useState} from 'react';
import {NavLink,Outlet,useLocation,useNavigate} from 'react-router-dom';
import {useAuth} from '../context/AuthContext.jsx';
import AdminIcon from '../components/admin/AdminIcon.jsx';
import {MODULES,Notice} from './core.jsx';
import './ips4.css';

const ICONS={'layout-dashboard':'overview','list-checks':'activity','inbox':'quotes','users':'clients',
  'headphones':'support','send':'telegram','messages-square':'messages','folder-kanban':'projects',
  'badge-check':'check','graduation-cap':'specialists','building-2':'specialists',
  'shield-user':'access','chart-no-axes-combined':'reports','wallet':'payments','shield-check':'shield'};

export default function CompanyAdministration(){
  const {admin,logout,hasAdminPermission}=useAuth();
  const navigate=useNavigate(),location=useLocation();
  const [drawer,setDrawer]=useState(false),[search,setSearch]=useState(false),[query,setQuery]=useState(''),[logoutError,setLogoutError]=useState('');
  const [databaseState,setDatabaseState]=useState('checking');
  useEffect(()=>{
    let active=true;
    const inspect=async()=>{
      try{
        const response=await fetch('/api/health',{credentials:'same-origin',cache:'no-store'});
        const health=await response.json();
        if(active)setDatabaseState(response.ok&&health?.database==='connected'?'connected':'unavailable');
      }catch{if(active)setDatabaseState('unavailable');}
    };
    void inspect();
    const poll=setInterval(inspect,60000);
    return()=>{active=false;clearInterval(poll);};
  },[]);
  const available=MODULES.filter(m=>hasAdminPermission(m.permission));
  const current=available.find(m=>m.path===location.pathname)||available[0]||MODULES[0];
  const results=useMemo(()=>available.filter(m=>(m.label+' '+m.sub+' '+m.group).toLowerCase().includes(query.toLowerCase())),[admin?.id,admin?.permissions?.join(','),query]);
  useEffect(()=>{setDrawer(false);setSearch(false);setQuery('');},[location.pathname]);
  useEffect(()=>{
    const key=e=>{if((e.ctrlKey||e.metaKey)&&e.key.toLowerCase()==='k'){e.preventDefault();setSearch(true);}
      if(e.key==='Escape'){setSearch(false);setDrawer(false);}};
    document.addEventListener('keydown',key);return()=>document.removeEventListener('keydown',key);
  },[]);
  async function endSession(){
    setLogoutError('');
    try{const outcome=await logout();
      if(outcome?.success)navigate(import.meta.env.VITE_ADMIN_ENTRY_PATH||'/ips-mission-control',{replace:true});
      else setLogoutError(outcome?.error||'Secure logout failed.');}
    catch{setLogoutError('IPS could not end this session securely.');}
  }
  let last='';
  return <div className="ips4">
    <button className="ips4-mobile-menu" type="button" aria-label="Open company navigation" onClick={()=>setDrawer(true)}><AdminIcon name="menu"/></button>
    {drawer&&<button className="ips4-mobile-shade" type="button" aria-label="Close company navigation" onClick={()=>setDrawer(false)}/>}
    <aside className={'ips4-rail'+(drawer?' open':'')} aria-label="IPS company administration">
      <div className="ips4-logo">
        <div className="ips4-monogram">IPS</div><div className="ips4-brand">
          <strong>INTERNATIONAL<br/>PROJECT SERVICES</strong><span>ADMINISTRATION · OPERATIONS</span>
        </div>
      </div>
      <div className={'ips4-rail-state'+(databaseState==='connected'?'':' degraded')} role="status">
        {databaseState==='connected'?'COMPANY DATABASE CONNECTED':
          databaseState==='checking'?'CHECKING OPERATING SERVICES':'DATABASE / API NOT READY'}
      </div>
      <nav className="ips4-rail-nav" aria-label="Company management responsibilities">
        {available.map(module=>{
          const first=module.group!==last;last=module.group;
          return <React.Fragment key={module.path}>
            {first&&<div className="ips4-nav-section">{module.group}</div>}
            <NavLink to={module.path} end className={({isActive})=>'ips4-nav-link'+(isActive?' active':'')}>
              <AdminIcon name={ICONS[module.icon]||'overview'} size={17}/><span>{module.label}</span>
            </NavLink>
          </React.Fragment>;
        })}
      </nav>
      <div className="ips4-persona">
        <div className="ips4-persona-head">
          <div className="ips4-avatar">{admin?.isRoot?'N':String(admin?.name||'S').slice(0,1).toUpperCase()}</div>
          <div><strong>{admin?.isRoot?'Nyoro':admin?.name||'Authorized staff'}</strong>
            <small>{admin?.isRoot?'Root Admin · Independent authority':
              admin?.companyRole==='manager'?'Department Manager':admin?.department?.replaceAll('_',' ')||'Company team'}</small></div>
        </div>
        {logoutError&&<Notice kind="danger">{logoutError}</Notice>}
        <button type="button" onClick={endSession}><AdminIcon name="logout" size={15}/> &nbsp; Sign out securely</button>
      </div>
    </aside>
    <div className="ips4-content-shell">
      <header className="ips4-topbar">
        <div><div className="ips4-crumb">IPS / {current.group} / <strong>{current.label}</strong></div>
          <span className="ips4-topbar-desc">{current.sub}</span></div>
        <div className="ips4-topbar-right"><button className="ips4-hotkey" type="button" onClick={()=>setSearch(true)}>
          <AdminIcon name="search" size={15}/> Find a company action <kbd>CTRL K</kbd></button>
          <span className="ips4-lock-state"><AdminIcon name="lock" size={14}/> AUTHORIZED ACCESS</span></div>
      </header>
      <main id="ips-administration-main" className="ips4-main"><Outlet/></main>
      <footer className="ips4-footer">IPS PRIVATE COMPANY SYSTEM · Nyoro, Root Admin, is not managed as an employee · Client confidentiality and verified authority apply everywhere</footer>
    </div>
    {search&&<div className="ips4-search-shade" onMouseDown={e=>{if(e.target===e.currentTarget)setSearch(false);}}>
      <div className="ips4-search-dialog" role="dialog" aria-label="Find a company responsibility" aria-modal="true">
        <input autoFocus type="search" placeholder="Find a responsibility, record or department…" value={query} onChange={e=>setQuery(e.target.value)}/>
        {results.map(m=><button type="button" key={m.path} onClick={()=>{navigate(m.path);setSearch(false);}}><strong>{m.label}</strong> · {m.sub}</button>)}
        {!results.length&&<p>No authorized management work matches your search.</p>}
        <button type="button" onClick={()=>setSearch(false)}>Close search</button>
      </div>
    </div>}
  </div>;
}
