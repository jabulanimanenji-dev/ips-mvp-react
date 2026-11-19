import React from 'react';
import {Link} from 'react-router-dom';

/* Shared visual shell: it conveys which private department is active without
   revealing real names, project titles or academic subjects in page chrome. */
const roleConfig={
  client:{title:'Client workspace',description:'Private academic services',home:'/client/overview'},
  writer:{title:'Specialist workspace',description:'Approved IPS assignments',home:'/writer/dashboard'}
};
export default function WorkspaceTopbar({role}){
  const view=roleConfig[role];
  if(!view)return null;
  return <header className="ips-workspace-topbar">
    <div className="ips-workspace-topbar-identity">
      <span className="ips-workspace-topbar-monogram" aria-hidden="true">IPS</span>
      <div>
        <Link to={view.home} className="ips-workspace-topbar-title">{view.title}</Link>
        <p>{view.description}</p>
      </div>
    </div>
    <div className="ips-workspace-topbar-status"><span aria-hidden="true" className="ips-workspace-privacy-dot"/>
      <span>Private · written communication</span>
    </div>
  </header>;
}
