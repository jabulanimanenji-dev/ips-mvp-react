import React from 'react';
import {Link} from 'react-router-dom';
import {useAuth} from '../context/AuthContext.jsx';
import {useCompanyResource,PageHeading,Panel,ErrorState,Empty,Refresh,Status} from './data.jsx';
import {summarizeWork,caseNeedsDecision,caseLate,caseNeedsOwner,caseKey,caseUrl,shortDate,departmentCoverage,departmentNames,readyClient,readySpecialist,caseOpen} from './model.js';
import AdminIcon from '../components/admin/AdminIcon.jsx';

export default function CompanyHome(){
  const {admin,hasAdminPermission}=useAuth();
  const cases=useCompanyResource('/api/admin/company-cases','cases');
  const team=useCompanyResource('/api/admin/company-team/roster','members',hasAdminPermission('team.manage'));
  const clients=useCompanyResource('/api/clients','clients',hasAdminPermission('clients.view'));
  const specialists=useCompanyResource('/api/writers','writers',hasAdminPermission('providers.view'));
  const pulse=summarizeWork(cases.value);
  const coverage=departmentCoverage(team.value);
  const uncovered=coverage?.filter(d=>!d.managers.length)||[];
  const decisions=(cases.value||[]).filter(c=>caseNeedsDecision(c)).sort((a,b)=>Number(caseLate(b))-Number(caseLate(a))||Number(caseNeedsOwner(b))-Number(caseNeedsOwner(a))).slice(0,9);
  const readyClients=clients.value?.filter(readyClient).length??null;
  const readyProviders=specialists.value?.filter(readySpecialist).length??null;
  const reload=()=>{cases.refresh();team.refresh();clients.refresh();specialists.refresh();};
  return <>
    <PageHeading eyebrow="OPERATIONS / DAILY CONTROL" title={admin?.isRoot?'The company, under your control.':'Your operational command.'}
      description="The next decision, its accountable owner and the actual business record. No decorative totals, no invented data. Every exception opens its source work.">
      <Refresh onClick={reload} loading={cases.loading}/>
    </PageHeading>
    <ErrorState error={cases.error} retry={cases.refresh}/>
    <div className="os-grid">
      <Link className="os-stat urgent" to="/admin/case-desk?filter=priority"><span>Requires a decision</span><strong>{pulse?.decision??'—'}</strong><small>Live cases requiring intervention</small></Link>
      <Link className="os-stat" to="/admin/case-desk?filter=open"><span>Unfinished company work</span><strong>{pulse?.open??'—'}</strong><small>Across cases, support, projects and Telegram</small></Link>
      <Link className="os-stat gold" to="/admin/case-desk?filter=unowned"><span>Without accountable owner</span><strong>{pulse?.unowned??'—'}</strong><small>Needs staff assignment or triage</small></Link>
      <Link className="os-stat urgent" to="/admin/case-desk?filter=overdue"><span>Deadline exceptions</span><strong>{pulse?.overdue??'—'}</strong><small>Overdue tasks or promised updates</small></Link>
    </div>
    <div className="os-split">
      <div className="os-stack">
        <Panel title="Decision queue" subtitle="Urgent, overdue and unowned records have priority. Only records in your authorized scope are shown." href="/admin/case-desk">
          {cases.loading&&!cases.value?<Empty>Loading the accountable company queue…</Empty>:!decisions.length?<Empty>No cases currently require immediate intervention. Open Work command to review normal cases.</Empty>:decisions.map(c=><Link className="os-row" key={caseKey(c)} to={caseUrl(c)}>
            <div><strong>{c.subject||c.ref}</strong><small>{c.kind.toUpperCase()} · {c.status} · {c.owner||'UNASSIGNED'} · {shortDate(c.due_at)}</small></div>
            <Status tone={caseLate(c)?'bad':caseNeedsOwner(c)?'warn':''}>{caseLate(c)?'Overdue':caseNeedsOwner(c)?'Unowned':'Action'}</Status>
          </Link>)}
        </Panel>
        <Panel title="Company workflow integrity" subtitle="One business case flows through verification, consent, quotation, payment gate, delivery and quality.">
          <div className="os-action-grid">
            {[['Quotation intake',pulse?.quotes,'/admin/enquiries'],['Academic delivery',pulse?.projects,'/admin/services'],
              ['Client support',pulse?.support,'/admin/support'],['Telegram & written enquiries',pulse?.telegram,'/admin/external-chats']].map(([label,count,path])=>
              <Link className="os-stat" key={path} to={path}><span>{label}</span><strong style={{fontSize:25}}>{count??'—'}</strong><small>Review permitted records</small></Link>)}
          </div>
        </Panel>
      </div>
      <div className="os-stack">
        {admin?.isRoot&&<Panel title="Leadership gaps" subtitle="The owner is not part of any employee hierarchy. Vacant leadership must be appointed explicitly." href="/admin/departments">
          {team.error&&<ErrorState error={team.error} retry={team.refresh}/>}
          {!coverage?<Empty>Loading manager coverage…</Empty>:uncovered.length===0?<div className="os-notice">Every company department has an active accountable manager.</div>:
          uncovered.map(d=><Link className="os-row" key={d.id} to={'/admin/access?department='+d.id}><div><strong>{d.label}</strong><small>{d.pending.length?'Invitation pending — no active manager':'No active department manager'}</small></div><Status tone="warn">Appoint</Status></Link>)}
        </Panel>}
        {hasAdminPermission('clients.view')&&<Panel title="Real client eligibility" subtitle="An account is not operationally ready merely because the status field says Active." href="/admin/clients">
          <div className="os-row"><div><strong>Verified active clients</strong><small>Eligible for private account operations</small></div><strong>{readyClients??'—'}</strong></div>
          <div className="os-row"><div><strong>Unverified or restricted</strong><small>Require client-side verification or review</small></div><strong>{clients.value?clients.value.filter(c=>!readyClient(c)).length:'—'}</strong></div>
        </Panel>}
        {hasAdminPermission('providers.view')&&<Panel title="Specialist eligibility" subtitle="Application approval alone does not authorize assignment." href="/admin/writers">
          <div className="os-row"><div><strong>Eligible verified specialists</strong><small>Verified, approved, active</small></div><strong>{readyProviders??'—'}</strong></div>
          <div className="os-row"><div><strong>Not assignment-ready</strong><small>Verification, application or status gate</small></div><strong>{specialists.value?specialists.value.filter(w=>!readySpecialist(w)).length:'—'}</strong></div>
        </Panel>}
        <div className="os-command-note"><AdminIcon name="shield" size={17}/> Payments are not activated. Quotations can proceed, but real academic delivery cannot be represented as paid or authorized until the payment integration verifies it.</div>
      </div>
    </div>
  </>;
}
