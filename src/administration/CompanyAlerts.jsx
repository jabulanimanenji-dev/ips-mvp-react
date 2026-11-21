import React from 'react';
import {useAuth} from '../context/AuthContext.jsx';
import {useFeed,useAction,Panel,Tag,Empty,Notice,LinkButton,Button,Feedback,dateTime} from './core.jsx';

// Notifications remain private to the signed-in company principal. The
// environment-backed Root Admin alone receives the legacy 'admin' escalation inbox.
export default function CompanyAlerts(){
  const {admin}=useAuth();
  const recipient=admin?.isRoot?'admin':admin?.id;
  const feed=useFeed(recipient?'/api/notifications/admin/'+encodeURIComponent(recipient):'','notifications',Boolean(recipient));
  const action=useAction(feed.refresh);
  const alerts=(feed.records||[]).filter(n=>['company_task_overdue','company_task_escalated','company_case_unowned'].includes(n.type)).slice(0,6);
  return <Panel title="Automatic overdue alerts" description="System-created accountability events. A recorded alert is not proof the task remains open; inspect the live case before taking action."
    aside={<LinkButton to="/admin/case-desk">Open Action Centre</LinkButton>}>
    <Feedback error={action.error} notice={action.notice}/>
    {feed.error?<Notice kind="danger">{feed.error}</Notice>:
      !feed.available?<Empty>{feed.busy?'Checking company alerts…':'Company notification evidence is unavailable.'}</Empty>:
      !alerts.length?<Empty>No recorded overdue-task alerts for this company identity.</Empty>:
      <div className="ips4-stack">{alerts.map(n=><div className="ips4-row" key={n._id}>
        <div className="ips4-row-text"><strong>{n.message}</strong><small>Recorded {dateTime(n.createdAt)} · Case {n.order_id||'protected reference'}</small></div>
        <div className="ips4-stack" style={{justifyItems:'end'}}>
          <Tag tone={n.read?'neutral':n.type==='company_task_escalated'?'danger':'warn'}>
            {n.read?'Reviewed':n.type==='company_task_escalated'?'Escalated':n.type==='company_case_unowned'?'Unassigned':'Overdue alert'}</Tag>
          {!n.read&&<Button disabled={action.pending} onClick={()=>void action.run(
            '/api/notifications/admin/'+encodeURIComponent(recipient)+'/'+encodeURIComponent(n._id)+'/read',
            'PATCH',{},'Notification acknowledged. Check the live case to confirm its status.'
          )}>Acknowledge</Button>}
          {n.type==='company_case_unowned'&&<LinkButton to={String(n.order_id||'').startsWith('IPS-Q-')||
            String(n.order_id||'').startsWith('ENQ-')?'/admin/enquiries':'/admin/support'}>Review queue</LinkButton>}
        </div>
      </div>)}</div>}
  </Panel>;
}
