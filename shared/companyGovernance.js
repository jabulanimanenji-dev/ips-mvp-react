// IPS governance authority. Root is outside the employee hierarchy.
// Root appoints department managers; managers may invite only their own staff.
// No non-root identity can mint the owner role or delegate powers it lacks.
const core=['platform.access','dashboard.view'];
export const COMPANY_DEPARTMENTS=Object.freeze({
  client_relations:{label:'Client Relations',manager:['clients.view','clients.manage','clients.recovery','support.view','support.manage','messages.view','messages.manage','reports.view'],staff:['clients.view','clients.recovery','support.view','support.manage','messages.view','messages.manage']},
  academic_delivery:{label:'Academic Delivery',manager:['services.view','services.manage','orders.view','orders.manage','providers.view','files.view','files.manage','messages.view','messages.manage','reports.view'],staff:['services.view','orders.view','providers.view','files.view','messages.view','messages.manage']},
  specialist_network:{label:'Specialist Network',manager:['providers.view','providers.manage','services.view','reports.view'],staff:['providers.view','services.view']},
  communications:{label:'Communications',manager:['messages.view','messages.manage','support.view','support.manage','clients.view','reports.view'],staff:['messages.view','messages.manage','support.view','clients.view']},
  quality_assurance:{label:'Quality Assurance',manager:['services.view','services.manage','orders.view','files.view','files.manage','reports.view'],staff:['services.view','orders.view','files.view','files.manage']},
  finance:{label:'Finance & Billing',manager:['payments.view','reports.view','clients.view'],staff:['payments.view','reports.view']},
  governance:{label:'Governance & Security',manager:['audit.view','reports.view','settings.view','clients.view'],staff:['audit.view','reports.view']}
});
const unique=items=>[...new Set(items)];
export const isCompanyDepartment=dept=>Object.hasOwn(COMPANY_DEPARTMENTS,String(dept||''));
export function permittedCompanyPermissions(department,level,requested){
  if(!isCompanyDepartment(department)||!['manager','staff'].includes(level))return [];
  const allowed=unique([...core,...COMPANY_DEPARTMENTS[department][level],...(level==='manager'?['team.manage']:[])]);
  // Empty permission list means the default role template, not owner authority.
  if(!Array.isArray(requested))return allowed;
  return allowed.filter(id=>requested.includes(id));
}
export function delegatedPermissions(actor,targetLevel,requested){
  if(!actor||!['staff','manager'].includes(targetLevel))return [];
  if(targetLevel==='manager'&&!actor.isRoot)return [];
  const allowed=permittedCompanyPermissions(actor.department||'client_relations',targetLevel);
  return allowed.filter(x=>(!Array.isArray(requested)||requested.includes(x))&&
    (actor.isRoot||actor.permissions?.includes(x)));
}
export const mayManageTeamMember=(actor,target)=>Boolean(actor&&target&&!target.isRoot&&
  (actor.isRoot?['manager',undefined].includes(target.company_role):actor.companyRole==='manager'&&target.company_role==='staff'&&
    target.department===actor.department&&target.manager_id===actor.adminId));
// Limit management-facing company structure to the reporting authority held by the viewer.
// A department manager's private roster is NOT a company-wide leadership register.
export function managementDepartments(actor){
  if(actor?.isRoot)return Object.entries(COMPANY_DEPARTMENTS);
  if(['manager','staff'].includes(actor?.companyRole)&&isCompanyDepartment(actor.department))
    return [[actor.department,COMPANY_DEPARTMENTS[actor.department]]];
  return [];
}
export const managerTeamTitle=department=>isCompanyDepartment(department)?COMPANY_DEPARTMENTS[department].label:'Unassigned';

export const companyStaffPasswordValid=password=>typeof password==='string'&&password.length>=10&&password.length<=128&&/[A-Z]/.test(password)&&/[0-9]/.test(password)&&/[^A-Za-z0-9]/.test(password);
