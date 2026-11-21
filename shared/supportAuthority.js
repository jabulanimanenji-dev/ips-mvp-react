// IPS support ownership authority. Only verified management lines may assign
// customer support responsibilities. The server provides the actual actor and
// target records; browser-provided "manager" and permission claims are ignored.
import {permittedCompanyPermissions} from './companyGovernance.js';

export function canAssignSupportTicket(actor,target,currentOwner=''){
  if(!actor||!target||target.status!=='Active')return false;
  const targetPermissions=permittedCompanyPermissions(target.department,target.company_role,
    target.permissions);
  if(!targetPermissions.includes('support.manage'))return false;
  if(actor.isRoot===true)return target.company_role==='manager';
  if(actor.companyRole==='manager'){
    if(actor.adminId===target.id)return target.company_role==='manager'&&
      actor.department===target.department;
    return target.company_role==='staff'&&target.department===actor.department&&
      target.manager_id===actor.adminId;
  }
  if(actor.companyRole==='staff'){
    return target.company_role==='staff'&&target.id===actor.adminId&&
      target.department===actor.department&&(!currentOwner||currentOwner===actor.adminId);
  }
  return false;
}
