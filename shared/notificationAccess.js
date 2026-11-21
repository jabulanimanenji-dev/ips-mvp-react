// Private notification inbox authority. No administrator may silently read
// client/specialist inboxes, including the protected Root Admin.
// Legacy company-wide 'admin' notifications are reserved to Root Admin.
const ROLES=new Set(['client','writer','admin']);
export function canReadNotificationInbox(session,recipientRole,recipientId,adminAccess){
  if(!session||!ROLES.has(recipientRole)||typeof recipientId!=='string'||!recipientId)return false;
  if(recipientRole==='admin'&&recipientId==='admin')
    return session.role==='admin'&&adminAccess?.isRoot===true;
  return session.role===recipientRole&&String(session.id||'')===recipientId;
}
