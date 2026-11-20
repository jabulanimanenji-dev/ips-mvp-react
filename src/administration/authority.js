export const MODULES=[
 ['TODAY','Company bridge','/admin/dashboard','dashboard.view','layout-dashboard','Live leadership and execution'],
 ['TODAY','Action centre','/admin/case-desk','dashboard.view','list-checks','Assigned decisions and deadlines'],
 ['CUSTOMER JOURNEY','Enquiries & quotes','/admin/enquiries','support.view','inbox','Verified, written intake'],
 ['CUSTOMER JOURNEY','Client accounts','/admin/clients','clients.view','users','Private identity and recovery'],
 ['CUSTOMER JOURNEY','Support & resolution','/admin/support','support.view','headphones','Tickets, replies and ownership'],
 ['CUSTOMER JOURNEY','Telegram conversations','/admin/external-chats','messages.view','send','Live written channel'],
 ['CUSTOMER JOURNEY','Private IPS messages','/admin/messages','messages.view','messages-square','Client–specialist–staff'],
 ['SERVICE PRODUCTION','Project command','/admin/services','services.view','folder-kanban','Assignment and milestones'],
 ['SERVICE PRODUCTION','Quality & release','/admin/quality','services.view','badge-check','Reviews and corrections'],
 ['SERVICE PRODUCTION','Specialist network','/admin/writers','providers.view','graduation-cap','Vetting and recovery'],
 ['ORGANIZATION','Departments','/admin/departments','dashboard.view','building-2','Accountability and coverage'],
 ['ORGANIZATION','People & permissions','/admin/access','team.manage','shield-user','Managers and team members'],
 ['ORGANIZATION','Company intelligence','/admin/reports','reports.view','chart-no-axes-combined','Verified operating evidence'],
 ['ORGANIZATION','Financial controls','/admin/payments','payments.view','wallet','Readiness, not fake cash'],
 ['ORGANIZATION','Trust & policy','/admin/settings','settings.view','shield-check','Protected authority']
].map(([group,label,path,permission,icon,sub])=>({group,label,path,permission,icon,sub}));
