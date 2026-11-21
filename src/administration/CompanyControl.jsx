import React,{useMemo} from 'react';
import {Link} from 'react-router-dom';
import {useAuth} from '../context/AuthContext.jsx';
import {COMPANY_DEPARTMENTS,managementDepartments} from '../../shared/companyGovernance.js';
import {isOpenCompanyCase,isOverdueCompanyCase,needsCompanyCaseOwner,requiresManagementAttention,summarizeCompanyCases} from '../../shared/companyPulse.js';
import {useFeed,Title,Panel,LinkButton,Button,Notice,Empty,Tag,GroupTotals,dateTime} from './core.jsx';

const responsibilities={
  client_relations:'Confidential intake, client account eligibility, written quotation and customer care',
  academic_delivery:'Assign verified specialists only to authorized paid work; manage deadlines, client handover and delivery',
  specialist_network:'Review applications, credentials, email ownership, capacity and specialist account security',
  quality_assurance:'Independent quality decisions, revisions, evidence and client release gates',
  communications:'Permissioned internal messaging, Telegram correspondence and secure client updates',
  finance:'Quote records, financial verification, refunds and governed specialist-payment readiness',
  governance:'Company policy, access, risk, audit accountability, owner control and business continuity'
};
const coverage=(team,key)=>Array.isArray(team)?team.filter(m=>m.department===key&&m.company_role==='manager'&&m.status==='Active'):[];
const caseUrl=c=>'/admin/case-desk?case='+encodeURIComponent(c.kind+':'+c.ref);
const staged=[
 ['01','Private request','Client chooses confidentiality, service, channel and contact consent.'],
 ['02','Human review','Case owner evaluates the brief and issues a written quotation.'],
 ['03','Client acceptance','Only the customer accepts the reviewed scope and terms.'],
 ['04','Payment gate','A signed provider transaction must verify actual payment before assignment.'],
 ['05','Specialist delivery','Approved specialist works within governed milestones and secure records.'],
 ['06','Quality approval','Independent inspection or tracked correction precedes release.'],
 ['07','Handover & care','Authenticated customer receives approved work; revisions and support are traceable.']
];
export function CompanyBridge(){
  const {admin,hasAdminPermission}=useAuth();
  const work=useFeed('/api/admin/company-cases','cases');
  const people=useFeed('/api/admin/company-team/roster','members',hasAdminPermission('team.manage'));
  const cases=work.records||[],summary=summarizeCompanyCases(work.records);
  const leaders=people.records;
  const decisions=cases.filter(c=>requiresManagementAttention(c))
    .sort((a,b)=>Number(isOverdueCompanyCase(b))-Number(isOverdueCompanyCase(a))||Number(needsCompanyCaseOwner(b))-Number(needsCompanyCaseOwner(a))).slice(0,8);
  const vacant=admin?.isRoot&&leaders?Object.entries(COMPANY_DEPARTMENTS).filter(([key])=>!coverage(leaders,key).length):null;
  return <>
    <Title kicker="IPS / COMPANY BRIDGE" title={admin?.isRoot?'Welcome back, Nyoro.':'Your accountable company work.'}
      description="A leadership workspace driven by real company records: what needs a decision, who owns it, which teams can act and what has not been verified."
      actions={<Button onClick={()=>{work.refresh();people.refresh();}} disabled={work.busy}>Refresh operating evidence</Button>}/>
    {work.error&&<Notice kind="danger">{work.error}</Notice>}
    <GroupTotals items={[
      {label:'Decisions requiring action',value:summary?.attention,hint:'Verified work, deadlines and review exceptions',tone:'attention'},
      {label:'Open company cases',value:summary?.open,hint:'Only case records permitted to your role'},
      {label:'Unassigned verified enquiries',value:summary?.unowned,hint:'Claim or delegate to an authorized reviewer',tone:'gold'},
      {label:'Overdue promises / tasks',value:summary?.overdue,hint:'Real deadlines, not estimates',tone:'attention'}
    ]}/>
    <div className="ips4-grid split">
      <Panel title="Decisions on your desk" description="An actionable case or deadline—not a decorative status count." aside={<LinkButton to="/admin/case-desk">Open action centre →</LinkButton>}>
        {!work.available?<Empty>{work.busy?'Loading accountable company work…':'Company case evidence unavailable.'}</Empty>:
          !decisions.length?<Empty>No exceptions require your immediate attention. Ordinary tasks remain in Action Centre.</Empty>:
          decisions.map(c=><Link className="ips4-row" key={c.kind+':'+c.ref} to={caseUrl(c)}>
            <div className="ips4-row-text"><strong>{c.subject||c.ref}</strong><small>{c.kind.toUpperCase()} · {c.person||'Private client'} · {c.owner||'Awaiting owner'} · {dateTime(c.due_at)}</small></div>
            <Tag tone={isOverdueCompanyCase(c)?'danger':needsCompanyCaseOwner(c)?'warn':'neutral'}>{isOverdueCompanyCase(c)?'Overdue':needsCompanyCaseOwner(c)?'Unassigned':'Review'}</Tag>
          </Link>)}
      </Panel>
      <div className="ips4-stack">
        <Panel title={admin?.isRoot?"Leadership coverage":"Your department team"} description={admin?.isRoot?"The company owner is outside every reporting line. Vacancies remain visible until a real manager is appointed.":"Only your actual delegated department and direct reports are shown."}
          aside={hasAdminPermission('team.manage')?<LinkButton to="/admin/access">Manage team →</LinkButton>:null}>
          {!people.available&&!people.error?<Empty>{people.busy?'Reading the reporting structure…':'Leadership records restricted to authorized management.'}</Empty>:
            people.error?<Notice kind="danger">{people.error}</Notice>:
            !admin?.isRoot?<div className="ips4-stack">
              <div className="ips4-row"><div><strong>Accountable manager</strong><small>{admin?.name||'You'} · {COMPANY_DEPARTMENTS[admin?.department]?.label||'Assigned department'}</small></div><Tag tone="good">You</Tag></div>
              <div className="ips4-row"><div><strong>Your active direct reports</strong><small>Restricted to staff assigned to your management line</small></div><strong>{people.records.filter(m=>m.company_role==='staff'&&m.status==='Active').length}</strong></div>
            </div>:
            vacant?.length===0?<Notice>Every company department has a currently active manager.</Notice>:
            vacant?.map(([id,info])=><div className="ips4-row" key={id}><div className="ips4-row-text"><strong>{info.label}</strong><small>Manager not appointed</small></div><Tag tone="warn">Vacant</Tag></div>)}
        </Panel>
        <Panel title="Operational integrity" description="Nothing here assumes that a quotation is a payment or that an approved specialist is email-verified.">
          <div className="ips4-row"><div><strong>Client-facing transactions</strong><small>Written service, verified identities and consent</small></div><Tag tone="good">Governed</Tag></div>
          <div className="ips4-row"><div><strong>Real-money checkout</strong><small>Provider still pending integration</small></div><Tag tone="warn">Not active</Tag></div>
          <div className="ips4-row"><div><strong>Specialist assignment</strong><small>Paid + qualified + authorized</small></div><Tag>Backend gated</Tag></div>
          <LinkButton to="/admin/journeys">Inspect full customer journey →</LinkButton>
        </Panel>
      </div>
    </div>
  </>;
}
export function DepartmentBridge(){
  const {admin,hasAdminPermission}=useAuth();
  const team=useFeed('/api/admin/company-team/roster','members',hasAdminPermission('team.manage'));
  const work=useFeed('/api/admin/company-cases','cases');
  const canManage=hasAdminPermission('team.manage');
  const visibleDepartments=managementDepartments(admin);
  return <>
    <Title kicker="COMPANY STRUCTURE / ACCOUNTABILITY" title="Departments and responsible leadership"
      description="Operate the company through actual management mandates and reporting lines—not arbitrary menus or root-owned employee tasks."
      actions={<Button onClick={()=>{team.refresh();work.refresh();}}>Refresh organization</Button>}/>
    {team.error&&<Notice kind="danger">{team.error}</Notice>}
    <div className="ips4-grid thirds">
      {visibleDepartments.map(([id,info])=>{
        const managers=admin?.isRoot?coverage(team.records,id):team.available&&admin?.companyRole==='manager'?[{name:admin?.name||'You'}]:[];
        const members=(team.records||[]).filter(x=>x.department===id&&x.company_role==='staff'&&x.status==='Active');
        const permitted=admin?.isRoot||!admin?.department||admin.department===id;
        return <Panel key={id} title={info.label} description={responsibilities[id]||'Authorized company responsibility'}>
          <div className="ips4-row"><div className="ips4-row-text"><strong>Accountable leadership</strong><small>{canManage?managers.map(m=>m.name).join(', ')||'Not appointed':'Scoped personnel access'}</small></div>
            {canManage&&<Tag tone={managers.length?'good':'warn'}>{managers.length?'Covered':'Vacant'}</Tag>}</div>
          <div className="ips4-row"><div><strong>Active team members</strong><small>Only verified staff in the department</small></div>
            <strong>{canManage?members.length:'Restricted'}</strong></div>
          {canManage&&permitted&&<LinkButton to={'/admin/access?department='+id}>Govern this department →</LinkButton>}
        </Panel>;
      })}
    </div>
  </>;
}
export function JourneyBridge(){
  const feed=useFeed('/api/admin/company-cases','cases');
  const projects=(feed.records||[]).filter(c=>c.kind==='project'&&isOpenCompanyCase(c));
  const quotes=(feed.records||[]).filter(c=>c.kind==='enquiry'&&isOpenCompanyCase(c));
  return <>
    <Title kicker="COMPLETE BUSINESS JOURNEY" title="One client journey, seven governed decisions"
      description="A confidential enquiry must remain connected to the approved quote, payment proof, qualified specialist, delivery history, QA approval and private customer handover."/>
    <div className="ips4-journey">
      {staged.map(([id,title,detail])=><div key={id} className="ips4-journey-step"><span>{id}</span><strong>{title}</strong><small>{detail}</small></div>)}
    </div>
    <div className="ips4-grid split" style={{marginTop:20}}>
      <Panel title="Open source journeys" description="Real cases and academic projects only, never sample revenue.">
        {feed.error&&<Notice kind="danger">{feed.error}</Notice>}
        <GroupTotals items={[
          {label:'Open requests',value:feed.available?quotes.length:null,hint:'Awaiting written review'},
          {label:'Open projects',value:feed.available?projects.length:null,hint:'Subject to payment and QA'}]}/>
        <div className="ips4-toolbar"><LinkButton to="/admin/enquiries" kind="gold">Manage intake and quotation</LinkButton><LinkButton to="/admin/services">Govern delivery</LinkButton></div>
      </Panel>
      <Panel title="Mandatory company handoff rules">
        {staged.slice(0,5).map(([n,title,desc])=><div className="ips4-row" key={n}><div><strong>{title}</strong><small>{desc}</small></div></div>)}
        <div className="ips4-note">The payment provider is currently disabled. A prepared project may not be represented as paid, assigned or delivered without the appropriate verified transition.</div>
      </Panel>
    </div>
  </>;
}
export function CompanyInsights({kind='reports'}){
  const {hasAdminPermission}=useAuth();
  const feed=useFeed('/api/admin/company-cases','cases');
  const staff=useFeed('/api/admin/company-team/roster','members',hasAdminPermission('team.manage'));
  const clients=useFeed('/api/clients','clients',hasAdminPermission('clients.view'));
  const writers=useFeed('/api/writers','writers',hasAdminPermission('providers.view'));
  const pulse=summarizeCompanyCases(feed.records);
  if(kind==='finance')return <>
    <Title kicker="FINANCIAL GOVERNANCE" title="Finance without imaginary balances" description="Quotations are not revenue, client acceptance is not settlement, and refund or specialist-payout decisions require real provider evidence."/>
    <div className="ips4-note" style={{marginBottom:22}}>Payment integration remains disabled. No checkout, collection, payout or settlement can be represented as completed.</div>
    <GroupTotals items={[{label:'Payment provider',value:'PENDING',hint:'No live merchant settlement',tone:'gold'},
      {label:'Open quotation cases',value:pulse?.counts.enquiry,hint:'Source-bound written requests'},
      {label:'Academic production cases',value:pulse?.counts.project,hint:'Not proof of payment'}]}/>
    <Panel title="Finance operating responsibilities" description="These are gates to operate, not non-existent sales metrics.">
      {[['Quotation authorization','Itemize services, fees and expiry. The customer must accept.'],
        ['Payment verification','A real provider callback and ledger must match the exact paid engagement.'],
        ['Refund approval','Document reason, eligibility, provider receipt and reconciliation.'],
        ['Specialist payout','Verified completed delivery, independent QA and finance authorization.'],
        ['Accounting and audit','Approved financial events, expenses, settlement and unaltered evidence.']].map(([title,desc])=>
        <div className="ips4-row" key={title}><div><strong>{title}</strong><small>{desc}</small></div><Tag tone={title==='Quotation authorization'?'good':'warn'}>{title==='Quotation authorization'?'Reviewable':'Provider gated'}</Tag></div>)}
    </Panel>
  </>;
  if(kind==='security')return <>
    <Title kicker="GOVERNANCE / RISK / COMPANY POLICY" title="Trust and authority"
      description="Protect the company’s root principal, client privacy, credential recovery, staff delegation and operational history."/>
    <GroupTotals items={[{label:'Root Admin',value:'Nyoro',hint:'Environment-backed identity, no manager'},
      {label:'Operating departments',value:Object.keys(COMPANY_DEPARTMENTS).length,hint:'Delegated management units'},
      {label:'Managers appointed',value:staff.records?staff.records.filter(m=>m.company_role==='manager'&&m.status==='Active').length:null,hint:'Actual signed-in accountable leaders'},
      {label:'Leadership vacancies',value:staff.records?Object.keys(COMPANY_DEPARTMENTS).filter(id=>!coverage(staff.records,id).length).length:null,hint:'Never silently delegated to root'}]}/>
    <Panel title="Non-negotiable company controls">
      {[['Sovereign Root Admin','Nyoro cannot be treated as a managed employee, assigned a manager or silently deleted.'],
        ['Email verification','Clients and specialists automatically receive one-click verification messages when they register. Only mailbox owners can prove identity.'],
        ['Secure password reset','Authorized staff email a time-limited reset link. No one in IPS sees or sets the recipient’s new password.'],
        ['Work and permissions','Staff see authorized records and delegated functions; manager role and active sessions are revalidated server-side.'],
        ['Privacy','Pseudonymous academic clients; verified professional identities for specialists; no phone calls.'],
        ['Financial truth','No payment is considered paid until authenticated provider settlement verification.']].map(([title,desc])=>
        <div className="ips4-row" key={title}><div><strong>{title}</strong><small>{desc}</small></div><Tag tone="good">Policy</Tag></div>)}
    </Panel>
  </>;
  const byKind=(key)=>feed.records?feed.records.filter(c=>c.kind===key&&isOpenCompanyCase(c)).length:null;
  return <>
    <Title kicker="COMPANY PERFORMANCE / SOURCE EVIDENCE" title="Operating intelligence"
      description="Metrics are computed from actual authorized records. Unavailable sources appear as unavailable; financial revenue is not fabricated." actions={<Button onClick={()=>{feed.refresh();staff.refresh();clients.refresh();writers.refresh();}}>Refresh reports</Button>}/>
    {feed.error&&<Notice kind="danger">{feed.error}</Notice>}
    <GroupTotals items={[{label:'Open work',value:pulse?.open,hint:'Real company cases'},
      {label:'Require action',value:pulse?.attention,hint:'Work requiring a decision',tone:'attention'},
      {label:'Overdue',value:pulse?.overdue,hint:'Expired deadlines and tasks',tone:'attention'},
      {label:'Unowned',value:pulse?.unowned,hint:'Verified client cases awaiting owner',tone:'gold'}]}/>
    <div className="ips4-grid">
      <Panel title="Actual active pipeline">{[['enquiry','Written enquiries','/admin/enquiries'],
        ['project','Academic delivery','/admin/services'],['support','Support cases','/admin/support'],
        ['telegram','Telegram conversations','/admin/external-chats']].map(([k,label,to])=>
        <Link className="ips4-row" key={k} to={to}><div className="ips4-row-text"><strong>{label}</strong><small>Source-authorized company records</small></div><strong>{byKind(k)??'—'}</strong></Link>)}
      </Panel>
      <Panel title="Business identity and workforce readiness">
        <div className="ips4-row"><div><strong>Verified active clients</strong><small>Mailbox-confirmed, not merely status Active</small></div><strong>{clients.records?clients.records.filter(x=>x.status==='Active'&&x.email_verified_at).length:'—'}</strong></div>
        <div className="ips4-row"><div><strong>Verified approved specialists</strong><small>Eligible only while active</small></div><strong>{writers.records?writers.records.filter(x=>x.status==='Active'&&x.application_status==='approved'&&x.email_verified_at).length:'—'}</strong></div>
        <div className="ips4-row"><div><strong>Active departmental staff</strong><small>Excludes Nyoro, the Root Admin</small></div><strong>{staff.records?staff.records.filter(x=>x.company_role==='staff'&&x.status==='Active').length:'—'}</strong></div>
        <div className="ips4-note info">Quality rejection rates, actual service turnaround and revenue require complete timed event data and settled payment records, not approximations from case status.</div>
      </Panel>
    </div>
  </>;
}
