// One source of truth for legally sequenced IPS service operations.
// Server validates every transition; browser uses exactly these rules to
// avoid presenting staff with controls which would be rejected.
export const SERVICE_TRANSITIONS=Object.freeze({
  'New Request':['Under Review','Clarification Required','Awaiting Assignment','Assigned','Cancelled'],
  'Under Review':['Clarification Required','Quoted','Cancelled','On Hold'],
  'Clarification Required':['Under Review','Quoted','Cancelled'],
  'Quoted':['Quote Accepted','Under Review','Cancelled'],
  'Quote Accepted':['Awaiting Assignment','Assigned','Cancelled'],
  'Awaiting Assignment':['Assigned','On Hold','Cancelled'],
  'Assigned':['Scheduled','In Progress','Awaiting Assignment','On Hold','Cancelled'],
  'Scheduled':['In Progress','On Hold','Cancelled'],
  'In Progress':['Waiting for Client','Submitted for Review','On Hold','Disputed'],
  'Waiting for Client':['In Progress','Submitted for Review','On Hold'],
  'Submitted for Review':['Correction Required','Ready for Client'],
  'Correction Required':['In Progress','Submitted for Review'],
  'Ready for Client':['Completed','Correction Required','Disputed'],
  'On Hold':['Under Review','Assigned','In Progress','Cancelled'],
  'Disputed':['In Progress','Completed','Cancelled'],
  'Completed':[],
  'Cancelled':[]
});
export const PAYMENT_REQUIRED_SERVICE_STATES=Object.freeze([
  'Assigned','Scheduled','In Progress','Submitted for Review','Ready for Client','Completed'
]);
export function canTransitionService(from,to,role){
  if(from===to)return true;
  if(role==='admin')return (SERVICE_TRANSITIONS[from]||[]).includes(to);
  if(role==='writer')return ['Assigned','Scheduled','In Progress','Waiting for Client','Submitted for Review'].includes(to)
    && (SERVICE_TRANSITIONS[from]||[]).includes(to);
  return (from==='Quoted'&&['Quote Accepted','Under Review'].includes(to))||
    (from==='Ready for Client'&&['Completed','Correction Required','Disputed'].includes(to));
}
// In the company console, client acceptance is ALWAYS recorded by the client,
// never simulated by an administrator clicking a status dropdown.
export function allowedAdminServiceStatuses(project){
  if(!project)return [];
  return [project.status,...(SERVICE_TRANSITIONS[project.status]||[])].filter((status,index,array)=>
    array.indexOf(status)===index&&(status===project.status||(
      status!=='Quote Accepted'&&
      !(status==='Quoted'&&!project.quote?.total)&&
      !(project.category==='Academic Support'&&project.payment_status!=='paid'&&PAYMENT_REQUIRED_SERVICE_STATES.includes(status))
    ))
  );
}
