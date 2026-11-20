// Scope authority for the IPS Academic Services company workspace.
// Legacy universal marketplace, Studio and cross-project controls stay archived
// in source but are not operational IPS admin navigation.
export const IPS_COMPANY_ADMIN_NAV = Object.freeze([
  {label:'Overview',target:'/admin/dashboard',permission:'dashboard.view',icon:'▦',group:'Company'},
  {label:'Quotes & enquiries',target:'/admin/enquiries',permission:'support.view',icon:'✉',group:'Company'},
  {label:'Telegram support',target:'/admin/external-chats',permission:'messages.view',icon:'↗',group:'Company'},
  {label:'Private messages',target:'/admin/messages',permission:'messages.view',icon:'◉',group:'Company'},
  {label:'Support cases',target:'/admin/support',permission:'support.view',icon:'?',group:'Company'},
  {label:'Clients',target:'/admin/clients',permission:'clients.view',icon:'◌',group:'Operations'},
  {label:'Specialists',target:'/admin/writers',permission:'providers.view',icon:'◆',group:'Operations'},
  {label:'Academic projects',target:'/admin/services',permission:'services.view',icon:'▤',group:'Operations'},
  {label:'Reports',target:'/admin/reports',permission:'reports.view',icon:'▥',group:'Management'},
  {label:'Team & access',target:'/admin/access',permission:'administrators.manage',icon:'♙',group:'Management'},
  {label:'Settings',target:'/admin/settings',permission:'settings.view',icon:'⚙',group:'Management'},
  {label:'Payments — pending',target:'/admin/payments',permission:'payments.view',icon:'◷',group:'Management'}
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
