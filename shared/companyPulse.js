// Pure company-operations derivations. Never mutate business records or infer
// revenue, delivery, identity verification or global totals from a partial query.
const CLOSED=new Set(['closed','Closed','Resolved','Completed','Cancelled','cancelled']);
export const isOpenCompanyCase=record=>Boolean(record&&!CLOSED.has(record.status));
export function isOverdueCompanyCase(record,now=Date.now()){
  if(!isOpenCompanyCase(record))return false;
  if(Number(record.tasks?.overdue||0)>0)return true;
  return Boolean(record.kind==='enquiry'&&record.verified&&record.due_at&&
    Number.isFinite(Date.parse(record.due_at))&&Date.parse(record.due_at)<now);
}
export const needsCompanyCaseOwner=record=>Boolean(record&&record.kind==='enquiry'&&
  isOpenCompanyCase(record)&&record.verified&&!record.owner);
export function requiresManagementAttention(record,now=Date.now()){
  if(!isOpenCompanyCase(record))return false;
  return isOverdueCompanyCase(record,now)||needsCompanyCaseOwner(record)||
    Boolean(record.new_message)||record.priority==='urgent'||
    ['Submitted for Review','Disputed','Correction Required'].includes(record.status)||
    (record.kind==='enquiry'&&record.verified&&record.status==='new');
}
export function summarizeCompanyCases(cases,now=Date.now()){
  if(!Array.isArray(cases))return null;
  const active=cases.filter(isOpenCompanyCase);
  return Object.freeze({
    open:active.length,
    attention:active.filter(c=>requiresManagementAttention(c,now)).length,
    unowned:active.filter(needsCompanyCaseOwner).length,
    overdue:active.filter(c=>isOverdueCompanyCase(c,now)).length,
    tasks:active.reduce((sum,c)=>sum+Math.max(0,Number(c.tasks?.open||0)),0),
    counts:Object.freeze(Object.fromEntries(['enquiry','support','project','telegram']
      .map(k=>[k,active.filter(c=>c.kind===k).length])))
  });
}
export function departmentLeadershipState(members,department){
  if(!Array.isArray(members))return 'unavailable';
  const leaders=members.filter(m=>m.company_role==='manager'&&m.department===department);
  return leaders.some(m=>m.status==='Active')?'appointed':
    leaders.some(m=>m.status==='Invited')?'invited':'vacant';
}
