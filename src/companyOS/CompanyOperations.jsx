import React,{useState} from 'react';
import {Link} from 'react-router-dom';
import {useAuth} from '../context/AuthContext.jsx';
import {COMPANY_DEPARTMENTS} from '../../shared/companyGovernance.js';
import {PageHeading,Panel,ErrorState,Empty,Refresh,Status,useCompanyResource} from './data.jsx';
import {departmentCoverage,DEPARTMENT_DESCRIPTIONS,caseOpen,caseNeedsDecision,caseLate,caseNeedsOwner,caseUrl,shortDate} from './model.js';
import AdminIcon from '../components/admin/AdminIcon.jsx';

export function CompanyDepartments(){
  const {admin,hasAdminPermission}=useAuth();
  const team=useCompanyResource('/api/admin/company-team/roster','members',hasAdminPermission('team.manage'));
  const cases=useCompanyResource('/api/admin/company-cases','cases');
  const coverage=departmentCoverage(team.value);
  const getWork=(id)=>{
    const kinds=id==='client_relations'?['enquiry','support']:id==='academic_delivery'?['project']:id==='specialist_network'?['project']:
      id==='communications'?['telegram','enquiry','support']:id==='quality_assurance'?['project']:id==='finance'?['project','enquiry']:['enquiry','support','project','telegram'];
    return (cases.value||[]).filter(c=>caseOpen(c)&&kinds.includes(c.kind));
  };
  return <>
    <PageHeading eyebrow="ORGANIZATION / THE REPORTING LINE" title="Run departments, not screens"
      description="Every department has a defined operating responsibility, an accountable manager and a supervised workload. Only the root appoints managers; managers supervise their own people.">
      <Refresh onClick={()=>{team.refresh();cases.refresh();}} loading={team.loading||cases.loading}/>
    </PageHeading>
    <ErrorState error={cases.error} retry={cases.refresh}/>
    {hasAdminPermission('team.manage')?<ErrorState error={team.error} retry={team.refresh}/>:
      <div className="os-command-note" style={{marginBottom:20}}>Department staff can review only their authorized operational work. Personnel and manager rosters are restricted to the company owner and department managers.</div>}
    <div className="os-grid three">
      <div className="os-stat"><span>Operating departments</span><strong>{Object.keys(COMPANY_DEPARTMENTS).length}</strong><small>Company responsibility domains</small></div>
      <div className="os-stat"><span>Accountable leadership</span><strong>{coverage?coverage.filter(x=>x.managers.length).length:'—'}</strong><small>Departments with an active manager</small></div>
      <div className="os-stat urgent"><span>Unfilled management</span><strong>{coverage?coverage.filter(x=>!x.managers.length).length:'—'}</strong><small>Root owner is never substituted for staff</small></div>
    </div>
    <div className="os-grid three">
      {Object.entries(COMPANY_DEPARTMENTS).map(([id,info])=>{
        const c=coverage?.find(x=>x.id===id);
        const work=getWork(id);
        const authorized=hasAdminPermission('team.manage')&&(admin?.isRoot||admin?.department===id);
        const permitted=admin?.isRoot||!admin?.department||admin?.department===id;
        return <section className="os-panel os-dept" key={id}>
          <span className="os-eyebrow">{id.replaceAll('_',' ').toUpperCase()}</span>
          <h2>{info.label}</h2>
          <p>{DEPARTMENT_DESCRIPTIONS[id]}</p>
          {authorized&&<div className="os-coverage"><strong>{c?.managers.length??'—'}</strong> active managers
            <p>{c?.managers.map(m=>m.name).join(', ')||'Leadership vacancy'} · {c?.team.length||0} staff</p></div>}
          {cases.value&&permitted&&<div className="os-coverage"><strong>{work.length}</strong> open related records · {work.filter(caseNeedsDecision).length} exceptions</div>}
          <div className="os-row">
            {admin?.isRoot&&<Link className="os-action secondary" to={'/admin/access?department='+id}><AdminIcon name="access" size={16}/> {c?.managers.length?'Manage leadership':'Appoint manager'}</Link>}
            {!admin?.isRoot&&admin?.department===id&&hasAdminPermission('team.manage')&&<Link className="os-action secondary" to="/admin/access">Govern my team</Link>}
            {id==='client_relations'&&hasAdminPermission('support.view')&&<Link to="/admin/enquiries">Intake →</Link>}
            {id==='academic_delivery'&&hasAdminPermission('services.view')&&<Link to="/admin/services">Delivery →</Link>}
            {id==='specialist_network'&&hasAdminPermission('providers.view')&&<Link to="/admin/writers">Specialists →</Link>}
            {id==='communications'&&hasAdminPermission('messages.view')&&<Link to="/admin/external-chats">Channels →</Link>}
            {id==='quality_assurance'&&hasAdminPermission('services.view')&&<Link to="/admin/quality">Review →</Link>}
            {id==='finance'&&hasAdminPermission('payments.view')&&<Link to="/admin/payments">Billing →</Link>}
            {id==='governance'&&hasAdminPermission('settings.view')&&<Link to="/admin/settings">Policy →</Link>}
          </div>
        </section>;
      })}
    </div>
  </>;
}

const STAGES=[
  {number:'01',title:'Confidential enquiry',desc:'Pseudonymous client chooses a service and private written contact method. Intake captures consent and verified channel.',href:'/admin/enquiries',kind:'enquiry'},
  {number:'02',title:'Review and quotation',desc:'Authorized staff clarifies the brief, assigns a case owner, promises a response and issues an itemized quotation.',href:'/admin/enquiries',kind:'enquiry'},
  {number:'03',title:'Client acceptance',desc:'Only the client accepts their quotation. Admin cannot forge acceptance. Revisions and messages are audit-linked.',href:'/admin/services',kind:'project'},
  {number:'04',title:'Payment verification',desc:'Payment provider is pending. The actual paid gate must be verified before assigning new paid work.',href:'/admin/payments',kind:'project'},
  {number:'05',title:'Specialist delivery',desc:'Verified qualified specialist receives authorized work, scoped files, milestones, messages and deadlines.',href:'/admin/services',kind:'project'},
  {number:'06',title:'Independent quality',desc:'A separate reviewer checks delivery, records corrections or approves evidence for release.',href:'/admin/quality',kind:'project'},
  {number:'07',title:'Private handover',desc:'Approved deliverables reach the authenticated client. Revisions and completion are recorded in one case history.',href:'/admin/services',kind:'project'}
];
export function CompanyJourneys(){
  const {hasAdminPermission}=useAuth();
  const cases=useCompanyResource('/api/admin/company-cases','cases');
  const [selected,setSelected]=useState('all');
  const grouped=(cases.value||[]).filter(c=>caseOpen(c)&&
    (selected==='all'||selected===c.kind));
  return <>
    <PageHeading eyebrow="WORKFLOW / ONE CONTINUOUS COMPANY SERVICE" title="The complete business journey"
      description="Intake is not a disconnected inbox. Every real engagement must preserve its originating client request, accepted scope, authorized payment, delivery, independent review and private handover.">
      <Refresh onClick={cases.refresh} loading={cases.loading}/>
    </PageHeading>
    <div className="os-command-note" style={{marginBottom:23}}><AdminIcon name="lock" size={16}/> Business journey is built around real transitions. Payments remain intentionally disabled. Every later paid stage must be blocked until a legitimate payment provider verifies the transaction.</div>
    <div className="os-process" style={{gridTemplateColumns:'repeat(auto-fit,minmax(170px,1fr))'}}>
      {STAGES.map(s=><Link key={s.number} className="os-process-step" to={s.href}><b>{s.number}</b><strong>{s.title}</strong><small>{s.desc}</small></Link>)}
    </div>
    <div className="os-split os-section-gap">
      <Panel title="Operating rules at every handoff" subtitle="A company-wide guarantee, enforced through existing identity and payment-aware service endpoints.">
        {[['Client privacy','Chosen usernames; no legal name required until necessary; no phone calls; written preference is honored.'],
          ['Ownership','An authorized worker claims a verified case or a manager delegates it with an auditable deadline.'],
          ['Scope and acceptance','Quote content is itemized; staff cannot accept on behalf of the client.'],
          ['Qualified assignment','Email-verified and approved specialist; no paid allocation without payment confirmation.'],
          ['Independent quality','Review and correction decisions are tracked before delivery can be released.'],
          ['Closure','Client handover, support issues and follow-up tasks stay attached to the actual service identity.']].map(([t,d])=><div className="os-row" key={t}>
          <div><strong>{t}</strong><small>{d}</small></div><AdminIcon name="shield" size={17}/></div>)}
      </Panel>
      <Panel title="Open real journey records" subtitle="Select work from its company source, not from simulated demonstration transactions." href="/admin/case-desk">
        <ErrorState error={cases.error} retry={cases.refresh}/>
        <div className="os-pill-bar">{[['all','All'],['enquiry','Intake'],['project','Delivery'],['support','Support']].map(([v,l])=><button key={v} className="os-pill" type="button" aria-pressed={selected===v} onClick={()=>setSelected(v)}>{l}</button>)}</div>
        {!grouped.length?<Empty>No actual open records for this journey stage.</Empty>:grouped.slice(0,12).map(c=><Link to={caseUrl(c)} key={c.kind+':'+c.ref} className="os-row"><div><strong>{c.subject}</strong><small>{c.kind} · {c.status} · {c.owner||'Unassigned'} · {shortDate(c.updated_at)}</small></div><AdminIcon name="arrow" size={15}/></Link>)}
      </Panel>
    </div>
  </>;
}

export function CompanyIntelligence({view='reports'}){
  const {admin,hasAdminPermission}=useAuth();
  const cases=useCompanyResource('/api/admin/company-cases','cases');
  const team=useCompanyResource('/api/admin/company-team/roster','members',hasAdminPermission('team.manage'));
  const clients=useCompanyResource('/api/clients','clients',hasAdminPermission('clients.view'));
  const specialists=useCompanyResource('/api/writers','writers',hasAdminPermission('providers.view'));
  const companyCases=cases.value||[];
  const open=companyCases.filter(caseOpen);
  const covered=departmentCoverage(team.value);
  const counts={
    enquiry:open.filter(c=>c.kind==='enquiry').length,project:open.filter(c=>c.kind==='project').length,
    support:open.filter(c=>c.kind==='support').length,telegram:open.filter(c=>c.kind==='telegram').length
  };
  const overdue=open.filter(caseLate),unowned=open.filter(caseNeedsOwner);
  const staff=(team.value||[]).filter(x=>['staff','manager'].includes(x.company_role));
  return <>
    <PageHeading eyebrow={view==='security'?'POLICY / AUDIT':view==='payments'?'FINANCE / PAYMENT INTEGRATION':'INTELLIGENCE / ACCOUNTABILITY'}
      title={view==='payments'?'Billing and financial readiness':view==='security'?'Security, governance and controls':'Actual company intelligence'}
      description={view==='payments'?'No fake invoices or successful payments: billing remains pending until a verified payment provider is integrated.':
      view==='security'?'Root sovereignty, least privilege, verified identities, source access and evidence-based administration.':
      'Visible metrics come from actual authorized cases, workforce and identity records. If a source cannot be reached, the metric is unavailable—not invented.'}>
      <Refresh onClick={()=>{cases.refresh();team.refresh();clients.refresh();specialists.refresh();}} loading={cases.loading}/>
    </PageHeading>
    <ErrorState error={cases.error} retry={cases.refresh}/>
    {view==='payments'?<>
      <div className="os-command-note">PAYMENT COLLECTION IS OFF. IPS has no authorization to mark unpaid work paid, trigger disbursements or treat quotation acceptance as a settled transaction.</div>
      <div className="os-grid three"><div className="os-stat"><span>Payment provider</span><strong style={{fontSize:25}}>Pending</strong><small>Provider credentials, real settlement and webhooks not enabled</small></div>
      <div className="os-stat"><span>Open quotation cases</span><strong>{cases.value?counts.enquiry:'—'}</strong><small>Approval and contact can proceed without payment</small></div>
      <div className="os-stat"><span>Open academic project cases</span><strong>{cases.value?counts.project:'—'}</strong><small>Payment must be verified before assignment</small></div></div>
      <Panel title="Finance responsibilities" subtitle="The company can already review quote totals, case records and protected client communication. Actual payment reconciliation will be enabled only against real provider evidence.">
        <div className="os-row"><div><strong>Quotation review and documented client acceptance</strong><small>Active nonpayment workflow</small></div><Link className="os-action secondary" to="/admin/services">View quotes</Link></div>
        <div className="os-row"><div><strong>Payment capture and settlement</strong><small>Blocked until real provider and signed webhook qualification</small></div><Status tone="warn">Pending integration</Status></div>
        <div className="os-row"><div><strong>Specialist payouts and refunds</strong><small>Cannot proceed against imaginary balances</small></div><Status tone="warn">Not active</Status></div>
      </Panel>
    </>:view==='security'?<>
      <div className="os-grid three"><div className="os-stat"><span>Owner authority</span><strong style={{fontSize:22}}>Protected</strong><small>Environment-backed identity outside team roster</small></div>
        <div className="os-stat"><span>Active managers</span><strong>{covered?covered.reduce((n,d)=>n+d.managers.length,0):'—'}</strong><small>Department-specific, least-privilege roles</small></div>
        <div className="os-stat urgent"><span>Management vacancies</span><strong>{covered?covered.filter(d=>!d.managers.length).length:'—'}</strong><small>Require root appointments</small></div></div>
      <Panel title="Company control rules" subtitle="Security is implemented as a server-side operating rule, not a button hidden with CSS.">
        {[['Root ownership','No manager over root. Root cannot be adopted into staff, suspended, deleted or demoted through departmental APIs.'],
          ['Employee delegation','Root invites managers; managers invite only their staff; permission ceilings are checked on the server.'],
          ['Session security','Company sessions are signed and permissions are rechecked against stored employee status.'],
          ['Customer recovery','Verified-mailbox one-use recovery links. No manager sees or sets client passwords.'],
          ['Confidential academic intake','Customer consent and email verification before private quotations and materials.'],
          ['Evaluation isolation','Synthetic records never qualify as verified live company clients or specialists.'],
          ['Payments','Provider integration pending. Paid work cannot be treated as settled without verification.']].map(([t,d])=><div key={t} className="os-row"><div><strong>{t}</strong><small>{d}</small></div><AdminIcon name="shield" size={18}/></div>)}
      </Panel>
    </>:<>
      <div className="os-grid">
        <div className="os-stat"><span>Open source cases</span><strong>{cases.value?open.length:'—'}</strong><small>Actual authorized workload</small></div>
        <div className="os-stat urgent"><span>Expired response deadlines</span><strong>{cases.value?overdue.length:'—'}</strong><small>Cases needing escalation</small></div>
        <div className="os-stat gold"><span>Without accountable owner</span><strong>{cases.value?unowned.length:'—'}</strong><small>Requires team assignment</small></div>
        <div className="os-stat"><span>Active managed employees</span><strong>{team.value?staff.filter(x=>x.status==='Active').length:'—'}</strong><small>Root is never counted as a staff member</small></div>
      </div>
      <div className="os-split">
        <Panel title="Work by accountable department" subtitle="Case records appear once in their source. Department categories describe operational responsibility, not duplicates.">
          {Object.entries(counts).map(([k,v])=><Link key={k} className="os-row" to={'/admin/case-desk?filter='+k}><div><strong>{({enquiry:'Quotations',project:'Academic projects',support:'Client support',telegram:'Telegram'})[k]}</strong><small>Open cases awaiting normal decisions or closure</small></div><strong>{cases.value?v:'—'}</strong></Link>)}
        </Panel>
        <Panel title="Workforce and account confidence" subtitle="Eligibility requires the relevant verification and approval gates.">
          <div className="os-row"><div><strong>Client records</strong><small>Searchable only with client permission</small></div><strong>{clients.value?clients.value.length:'—'}</strong></div>
          <div className="os-row"><div><strong>Specialist records</strong><small>Searchable only with specialist permission</small></div><strong>{specialists.value?specialists.value.length:'—'}</strong></div>
          <div className="os-row"><div><strong>Company departments</strong><small>Managed coverage evidence</small></div><strong>{covered?covered.filter(x=>x.managers.length).length+'/'+covered.length:'—'}</strong></div>
          <div className="os-command-note">Response-time distribution and release quality rates require timestamped event instrumentation and a verified denominator. They are not guessed from card totals.</div>
        </Panel>
      </div>
    </>}
  </>;
}
