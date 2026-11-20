// Scope authority for the IPS Academic Services company workspace.
// Legacy universal marketplace, Studio and cross-project controls stay archived
// in source but are not operational IPS admin navigation.
export const IPS_COMPANY_ADMIN_NAV = Object.freeze([
  {label:'Operations desk',target:'/admin/dashboard',permission:'dashboard.view',icon:'overview',group:'Operations'},
  {label:'Cases & quotations',target:'/admin/enquiries',permission:'support.view',icon:'quotes',group:'Operations'},
  {label:'Academic projects',target:'/admin/services',permission:'services.view',icon:'projects',group:'Operations'},
  {label:'Client support',target:'/admin/support',permission:'support.view',icon:'support',group:'Operations'},
  {label:'Telegram inbox',target:'/admin/external-chats',permission:'messages.view',icon:'telegram',group:'Communications'},
  {label:'Secure messages',target:'/admin/messages',permission:'messages.view',icon:'messages',group:'Communications'},
  {label:'Clients',target:'/admin/clients',permission:'clients.view',icon:'clients',group:'People'},
  {label:'Specialists',target:'/admin/writers',permission:'providers.view',icon:'specialists',group:'People'},
  {label:'Service reports',target:'/admin/reports',permission:'reports.view',icon:'reports',group:'Company'},
  {label:'Team & access',target:'/admin/access',permission:'administrators.manage',icon:'access',group:'Company'},
  {label:'Company settings',target:'/admin/settings',permission:'settings.view',icon:'settings',group:'Company'},
  {label:'Payments — pending',target:'/admin/payments',permission:'payments.view',icon:'payments',group:'Company'}
]);
// Production historical data may contain synthetic records from earlier
// platform/marketplace development. Do not delete or leak them into live
// company metrics, customer queues or operational selection controls.
export function isIpsQaFixtureEmail(value){
  const email=String(value||'').trim().toLowerCase();
  return /@(?:ips\.test|test\.ips|example\.(?:org|com|test)|test\.example)$/.test(email);
}
export function isIpsQaFixtureAdmin(record){
  return /^ADM-TEST-/i.test(String(record?.id||'')) ||
    isIpsQaFixtureEmail(record?.email);
}
export function isIpsQaFixtureClient(record){
  return isIpsQaFixtureEmail(record?.email) ||
    /^(?:EVAL|TEST|DEMO)-/i.test(String(record?.client_id||''));
}

export function isIpsAcademicProject(request){
  return Boolean(request && request.category==='Academic Support' &&
    (request.source==='quote_intake'||Boolean(request.source_quote_id)));
}
export function scopeIpsMessagingDirectory({clients=[],providers=[],orders=[],services=[]},{production=false}={}){
  const scopedClients=production?clients.filter(c=>c.status==='Active'&&Boolean(c.email_verified_at)&&!isIpsQaFixtureClient(c)):clients;
  const scopedProviders=production?providers.filter(w=>w.status==='Active'&&w.application_status==='approved'&&Boolean(w.email_verified_at)&&!isIpsQaFixtureEmail(w.email)):providers;
  const jobs=production?services.filter(isIpsAcademicProject).map(x=>({
    work_id:x.request_id,work_kind:'service',title:x.title,...x
  })):[...orders.map(x=>({work_id:x.order_id,work_kind:'academic',title:x.topic_title,...x})),
    ...services.map(x=>({work_id:x.request_id,work_kind:'service',title:x.title,...x}))];
  return {clients:scopedClients.map(c=>({client_id:c.client_id,username:c.username||'',email:c.email})),
    providers:scopedProviders.map(w=>({writer_id:w.writer_id,full_name:w.full_name,email:w.email})),jobs};
}
