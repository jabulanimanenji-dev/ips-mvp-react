import React,{useEffect,useMemo,useRef,useState} from 'react';
import '../styles/academic-workspace.css';
import '../styles/ips-premium-admin.css';
import {Link,Outlet,useLocation} from 'react-router-dom';
import AdminSidebar from '../components/admin/AdminSidebar';
import AdminIcon from '../components/admin/AdminIcon';
import {useAuth} from '../context/AuthContext';
import {IPS_COMPANY_ADMIN_NAV} from '../../shared/ipsCompanyScope.js';

export default function AdminLayout(){
  const location=useLocation();
  const {admin,hasAdminPermission}=useAuth();
  // Admin theme is private to the company console. Never flip public/client themes.
  const [theme,setTheme]=useState(()=>{
    try{return localStorage.getItem('ips-admin-theme')==='light'?'light':'dark';}
    catch{return 'dark';}
  });
  const toggleTheme=()=>{
    setTheme(value=>{
      const next=value==='dark'?'light':'dark';
      try{localStorage.setItem('ips-admin-theme',next);}catch{}
      return next;
    });
  };
  const [searchOpen,setSearchOpen]=useState(false);
  const [term,setTerm]=useState('');
  const searchRef=useRef(null);
  const permitted=IPS_COMPANY_ADMIN_NAV.filter(item=>hasAdminPermission(item.permission));
  const active=permitted.find(item=>location.pathname===item.target||
    location.pathname.startsWith(item.target+'/'));
  const heading=active?.label||'IPS Administration';
  const results=useMemo(()=>{
    const q=term.trim().toLowerCase();
    return permitted.filter(item=>!q||[item.label,item.group].some(v=>v.toLowerCase().includes(q))).slice(0,14);
  },[term,permitted.map(x=>x.target).join(',')]);
  useEffect(()=>{setSearchOpen(false);setTerm('');},[location.pathname]);
  useEffect(()=>{
    const keydown=event=>{
      if(event.key==='Escape')setSearchOpen(false);
      if(event.key==='/'&&!(event.target instanceof HTMLInputElement)&&
         !(event.target instanceof HTMLTextAreaElement)&&!(event.target instanceof HTMLSelectElement)&&
         !event.metaKey&&!event.ctrlKey&&!event.altKey){
        event.preventDefault();setSearchOpen(true);
      }
    };
    document.addEventListener('keydown',keydown);
    return()=>document.removeEventListener('keydown',keydown);
  },[]);
  useEffect(()=>{if(searchOpen)searchRef.current?.focus();},[searchOpen]);
  return <div className={"admin-layout ips-premium-admin"+(theme==='dark'?" ips-dark-admin":"")} style={{display:'flex',minHeight:'100vh'}}>
    <AdminSidebar/>
    <div className="admin-layout-content" style={{marginLeft:264,flex:1,minWidth:0,display:'flex',flexDirection:'column'}}>
      <header className="ips-premium-topbar">
        <div>
          <div className="ips-premium-breadcrumb">
            <strong>IPS</strong><AdminIcon name="chevron" size={12}/><span>Administration</span>
            <AdminIcon name="chevron" size={12}/><span>{active?.group||'Workspace'}</span>
          </div>
          <h1>{heading}</h1>
        </div>
        <div className="ips-premium-toolbar">
          <button type="button" className="ips-premium-theme-toggle"
            aria-label={theme==='dark'?'Switch administration to light mode':'Switch administration to dark mode'}
            title={theme==='dark'?'Use light workspace':'Use dark workspace'}
            onClick={toggleTheme}><AdminIcon name={theme==='dark'?'sun':'moon'} size={18}/></button>
          <button type="button" className="ips-premium-search" aria-label="Search administration sections"
            onClick={()=>setSearchOpen(true)}>
            <span style={{display:'flex',alignItems:'center',gap:9}}><AdminIcon name="search" size={16}/> Search workspace</span>
            <span className="ips-premium-kbd">/</span>
          </button>
          <div className="ips-premium-identity">
            <div><strong>{admin?.name||'IPS administrator'}</strong><small>{admin?.customRoleName||admin?.role||'Administrator'}</small></div>
            <span className="ips-premium-avatar" aria-label="IPS administrator session">IPS</span>
          </div>
        </div>
      </header>
      <main className="admin-main-content" id="ips-admin-main" style={{flex:1,minWidth:0}}>
        <Outlet/>
      </main>
    </div>
    {searchOpen&&<div className="ips-command-overlay" role="presentation"
      onMouseDown={e=>{if(e.target===e.currentTarget)setSearchOpen(false);}}>
      <div className="ips-command-dialog" role="dialog" aria-modal="true" aria-label="Search IPS workspaces">
        <div style={{display:'flex',gap:10,alignItems:'center'}}>
          <input ref={searchRef} className="ips-command-input" type="search" value={term}
            onChange={e=>setTerm(e.target.value)} placeholder="Find an IPS workspace…" aria-label="Find workspace"/>
          <button type="button" className="btn btn-ghost" aria-label="Close workspace search" onClick={()=>setSearchOpen(false)}>
            <AdminIcon name="close" size={17}/>
          </button>
        </div>
        <p style={{fontSize:'.69rem',fontWeight:800,letterSpacing:'.11em',color:'#74898b',textTransform:'uppercase',margin:'18px 9px 7px'}}>Authorized company sections</p>
        {results.length===0?<p style={{padding:15,color:'#6b7e86'}}>No accessible sections match that search.</p>:
          results.map(item=><Link key={item.target} className="ips-command-option" to={item.target}
            onClick={()=>setSearchOpen(false)}>
            <AdminIcon name={item.icon||'overview'} size={19}/>{item.label}<small>{item.group}</small>
          </Link>)}
        <p style={{color:'#8a999b',fontSize:'.7rem',margin:'13px 10px 2px'}}>Esc closes · Access is limited by your IPS staff role.</p>
      </div>
    </div>}
  </div>;
}
