import React from 'react';
import '../styles/academic-workspace.css';
import {Outlet,useLocation} from 'react-router-dom';
import AdminSidebar from '../components/admin/AdminSidebar';
import {useAuth} from '../context/AuthContext';
import {IPS_COMPANY_ADMIN_NAV} from '../../shared/ipsCompanyScope.js';

export default function AdminLayout(){
  const location=useLocation();
  const {admin}=useAuth();
  const heading=IPS_COMPANY_ADMIN_NAV.find(item=>location.pathname===item.target||
    location.pathname.startsWith(item.target+'/'))?.label||'IPS Administration';
  return <div className="admin-layout ipsa-company-admin" style={{display:'flex',minHeight:'100vh'}}>
    <AdminSidebar/>
    <div className="admin-layout-content" style={{marginLeft:248,flex:1,minWidth:0,display:'flex',flexDirection:'column'}}>
      <header style={{height:72,position:'sticky',top:0,zIndex:80,display:'flex',alignItems:'center',
        justifyContent:'space-between',padding:'0 26px',gap:16,borderBottom:'1px solid var(--border)',
        background:'var(--bg-header)',color:'var(--text-primary)'}}>
        <div>
          <small style={{fontSize:'.68rem',fontWeight:750,color:'var(--text-secondary)',letterSpacing:'.1em'}}>IPS · COMPANY OPERATIONS</small>
          <h1 style={{fontSize:'1.14rem',margin:'3px 0 0',fontWeight:750}}>{heading}</h1>
        </div>
        <div style={{display:'flex',alignItems:'center',gap:10}}>
          <div style={{textAlign:'right'}}>
            <strong style={{fontSize:'.82rem',display:'block'}}>{admin?.name||'IPS administrator'}</strong>
            <small style={{fontSize:'.71rem',color:'var(--text-muted)'}}>{admin?.role||'Admin'}</small>
          </div>
          <div aria-hidden="true" style={{width:36,height:36,display:'grid',placeItems:'center',borderRadius:9,
            background:'#27465b',color:'#fff',fontSize:'.8rem',fontWeight:800}}>IPS</div>
        </div>
      </header>
      <main className="admin-main-content" style={{flex:1,padding:'24px clamp(15px,3vw,40px)',minWidth:0}}>
        <Outlet/>
      </main>
    </div>
    <style>{'@media(max-width:850px){.ipsa-company-admin .admin-layout-content{margin-left:0!important;width:100%}.ipsa-company-admin .admin-layout-content>header{padding-left:115px!important}.ipsa-company-admin .admin-main-content{padding:16px!important}}'}</style>
  </div>;
}
