import React from 'react';
import {Link} from 'react-router-dom';
import {useAuth} from '../context/AuthContext.jsx';
import '../styles/academic-workspace.css';
import '../styles/ips-premium-admin.css';
export function CompanyGuard({permission,children}){
  const {hasAdminPermission}=useAuth();
  if(hasAdminPermission(permission))return children;
  return <section className="os-panel" role="alert"><span className="os-eyebrow">DEPARTMENT-BOUND ACCESS</span>
    <h1 className="os-title">Not within your assigned authority</h1>
    <p className="os-lead">This workspace requires {permission}. Ask your department manager to review your work assignment. No additional company record has been opened.</p>
    <Link className="os-action secondary" to="/admin/dashboard">Return to authorized company work</Link>
  </section>;
}
export function ProtectedBusinessWorkspace({children}){
  // Some specialist-facing file and messaging controls still rely on their
  // existing, live APIs. Preserve those tools while replacing the company shell.
  return <div className="ips-premium-admin ips-dark-admin" style={{background:'#0b1219',minHeight:500,padding:14,borderRadius:14}}>
    {children}
  </div>;
}
