import React,{useEffect,useMemo,useState} from 'react';
import {Link,useParams} from 'react-router-dom';
import {useAuth} from '../context/AuthContext.jsx';
import {isIpsAcademicProject,isIpsQaFixtureEmail} from '../../shared/ipsCompanyScope.js';
import {allowedAdminServiceStatuses} from '../../shared/serviceTransitions.js';
import {request,useFeed,useAction,Title,Panel,Button,LinkButton,Dialog,Tag,Notice,Empty,Feedback,GroupTotals,dateTime} from './core.jsx';

const QA=['Submitted for Review','Correction Required','Ready for Client','Disputed'];
const active=s=>!['Completed','Cancelled'].includes(s);
const price=q=>Number(q?.total)>0?new Intl.NumberFormat('en-GB',{style:'currency',currency:q.currency||'PLN'}).format(q.total):'No quote issued';
export function ProductionRegister({quality=false}){
  const {hasAdminPermission}=useAuth();
  const data=useFeed('/api/services','requests',hasAdminPermission('services.view'));
  const writers=useFeed('/api/writers','writers',hasAdminPermission('providers.view'));
  const action=useAction(data.refresh);
  const [filter,setFilter]=useState(quality?'qa':'active'),[search,setSearch]=useState(''),[focus,setFocus]=useState(null),
    [mode,setMode]=useState('status'),[quote,setQuote]=useState({labor:0,service_fee:0,expenses:0,notes:'',expires_at:''});
  const manage=hasAdminPermission('services.manage');
  const records=(data.records||[]).filter(isIpsAcademicProject);
  const permitted=(writers.records||[]).filter(w=>w.application_status==='approved'&&w.status==='Active'&&w.email_verified_at&&!isIpsQaFixtureEmail(w.email));
  const visible=useMemo(()=>records.filter(p=>(filter==='all'||(filter==='active'?active(p.status):
    filter==='qa'?QA.includes(p.status):filter==='done'?p.status==='Completed':p.payment_status!=='paid'))&&
    [p.title,p.request_id,p.client_name,p.status,p.source_quote_id].join(' ').toLowerCase().includes(search.toLowerCase())),[data.records,filter,search]);
  const open=p=>{
    setFocus(p);setMode('status');setQuote({labor:String(p.quote?.labor??0),service_fee:String(p.quote?.service_fee??0),
      expenses:String(p.quote?.expenses??0),notes:p.quote?.notes||'',expires_at:p.quote?.expires_at?String(p.quote.expires_at).slice(0,10):''});action.setError('');
  };
  const canQuote=focus&&manage&&['Under Review','Clarification Required','Quoted'].includes(focus.status)&&focus.payment_status!=='paid';
  const canAssign=focus&&manage&&writers.available&&focus.payment_status==='paid'&&
    ['Quote Accepted','Awaiting Assignment','Assigned'].includes(focus.status)&&(focus.status!=='Assigned'||Number(focus.progress||0)===0);
  async function update(payload,msg){
    if(!focus||!manage)return;
    const ok=await action.run('/api/services/'+encodeURIComponent(focus.request_id),'PATCH',payload,msg);
    if(ok)setFocus(null);
  }
  async function saveQuote(e){
    e.preventDefault();if(!canQuote)return;
    const labor=Number(quote.labor),service_fee=Number(quote.service_fee),expenses=Number(quote.expenses);
    if(![labor,service_fee,expenses].every(x=>Number.isFinite(x)&&x>=0&&x<=100000)||!quote.notes.trim()||!quote.expires_at||
      labor+service_fee+expenses<=0)return action.setError('A valid itemized fee, scope and quote expiry are required.');
    await update({quote:{...quote,labor,service_fee,expenses,total:labor+service_fee+expenses,currency:'PLN',accepted:false},
      status:'Quoted',reason:'Authorized academic quotation prepared and documented'},
      'Client quotation issued. It remains unpaid until verified payment is received.');
  }
  return <>
    <Title kicker={quality?'INDEPENDENT QUALITY / PROOF BEFORE RELEASE':'ACADEMIC PRODUCTION / REAL WORK FILES'}
      title={quality?'Quality, corrections and release':'Academic project command'}
      description={quality?'Review real submissions, evidence and corrections. Neither staff nor specialists can forge the final client approval.':
        'Manage scope, quote, qualified allocation, progress, protected files and written client handover with accountable project owners.'}
      actions={<Button onClick={()=>{data.refresh();writers.refresh();}} disabled={data.busy}>Refresh production</Button>}/>
    {data.error&&<Notice kind="danger">{data.error}</Notice>}<Feedback error={action.error} notice={action.notice}/>
    <GroupTotals items={[{label:'Unpaid / preparing',value:data.available?records.filter(p=>p.payment_status!=='paid'&&active(p.status)).length:null,hint:'Assignment blocked without payment'},
      {label:'In specialist delivery',value:data.available?records.filter(p=>['Assigned','Scheduled','In Progress','Waiting for Client'].includes(p.status)).length:null,hint:'Genuinely authorized work'},
      {label:'QA decisions',value:data.available?records.filter(p=>QA.includes(p.status)).length:null,hint:'Independent review or correction',tone:'attention'},
      {label:'Completed',value:data.available?records.filter(p=>p.status==='Completed').length:null,hint:'Final customer approval recorded'}]}/>
    <div className="ips4-note" style={{marginBottom:19}}>Payment collection is still disabled. Accepted quotation ≠ collected money. Status transitions and specialist assignment must pass the server's paid-work and approval gates.</div>
    <Panel title={quality?'Independent QA decision register':'Active academic engagements'} description="Source-bound service records, not unrelated legacy marketplace services.">
      <div className="ips4-toolbar"><input aria-label="Find academic projects" type="search" value={search} onChange={e=>setSearch(e.target.value)} placeholder="Find academic project or linked quotation…"/>
        {[['active','Active'],['qa','QA / corrections'],['unpaid','Financial gate'],['done','Completed'],['all','All']].map(([v,l])=><button type="button" className="ips4-tab" key={v} aria-pressed={filter===v} onClick={()=>setFilter(v)}>{l}</button>)}</div>
      {!data.available?<Empty>Loading real academic project records…</Empty>:!visible.length?<Empty>No source-bound academic projects match this filter.</Empty>:
        <div className="ips4-table-wrap"><table className="ips4-table"><thead><tr><th>Academic service</th><th>Specialist</th><th>Governed status</th><th>Financial proof</th><th>Progress</th><th>Controls</th></tr></thead><tbody>
          {visible.map(p=><tr key={p.request_id}>
            <td><strong>{p.title||p.request_id}</strong><small>{p.request_id} · From {p.source_quote_id||'unlinked source'} · {p.client_name||'Private customer'}</small></td>
            <td>{p.provider_name||'Not assigned'}</td>
            <td><Tag tone={QA.includes(p.status)?'warn':p.status==='Completed'?'good':'neutral'}>{p.status}</Tag></td>
            <td><Tag tone={p.payment_status==='paid'?'good':'warn'}>{p.payment_status==='paid'?'Paid / verified':'Not verified'}</Tag></td>
            <td>{Number(p.progress||0)}%</td>
            <td><div style={{display:'flex',gap:7,flexWrap:'wrap'}}><Button onClick={()=>open(p)}>Govern</Button>
              <LinkButton to={'/admin/services/'+encodeURIComponent(p.request_id)}>Full file ↗</LinkButton></div></td>
          </tr>)}</tbody></table></div>}
    </Panel>
    {focus&&<Dialog title={focus.title||focus.request_id} subtitle={'Linked academic service · '+focus.request_id} onClose={()=>setFocus(null)}>
      <div className="ips4-toolbar">{[['status','Transitions'],['assignment','Qualified specialist'],['quote','Quotation & terms']].map(([v,l])=><button className="ips4-tab" key={v} aria-pressed={mode===v} onClick={()=>setMode(v)} type="button">{l}</button>)}</div>
      <div className="ips4-detail-facts">{[['Customer',focus.client_name||'Private'],['Quote',price(focus.quote)],
        ['Payment',focus.payment_status||'Unverified'],['Specialist',focus.provider_name||'Not allocated'],
        ['Status',focus.status],['Progress',(focus.progress||0)+'%']].map(([k,v])=><div className="ips4-fact" key={k}><small>{k}</small><strong>{v}</strong></div>)}</div>
      {mode==='status'&&<div className="ips4-stack">
        {manage?<label className="ips4-field">Authorized lifecycle transition<select value={focus.status} onChange={e=>void update({status:e.target.value,reason:'Documented IPS academic production or QA decision'},'Academic project status changed.')}>
          {allowedAdminServiceStatuses(focus).map(s=><option key={s}>{s}</option>)}</select></label>:<div className="ips4-note info">Read-only company delivery role.</div>}
        <LinkButton to={'/admin/services/'+encodeURIComponent(focus.request_id)} kind="gold">Review full work file, proof and documents ↗</LinkButton>
      </div>}
      {mode==='assignment'&&<div className="ips4-stack">
        {canAssign?<label className="ips4-field">Approved verified specialist<select value={focus.provider_id||''} onChange={e=>{
          const writer=permitted.find(x=>x.writer_id===e.target.value);
          void update({provider_id:e.target.value,provider_name:writer?.full_name||'',
            status:e.target.value?'Assigned':'Awaiting Assignment',reason:e.target.value?'Approved verified specialist assigned':'Unstarted specialist allocation withdrawn'},'Eligible assignment recorded.');
        }}>
          <option value="">Awaiting qualified specialist</option>{permitted.map(w=><option value={w.writer_id} key={w.writer_id}>{w.full_name} — {w.primary_expertise||'General'}</option>)}
        </select></label>:<div className="ips4-blocked"><div><strong>Specialist assignment gated</strong><p>{focus.payment_status!=='paid'?'A real verified paid transaction is required. No administrator can claim that an unpaid quotation is settled.':
          !writers.available?'Verified specialist directory not available to this department.':'An eligible project transition and no irreversible started specialist work are required.'}</p></div></div>}
      </div>}
      {mode==='quote'&&<div className="ips4-stack">
        {!canQuote?<div className="ips4-note">Quotation editing is locked at this lifecycle stage or after verified payment. Client acceptance cannot be forged by IPS administration.</div>:
        <form className="ips4-form" onSubmit={saveQuote}>
          <div className="ips4-fields three">{[['labor','Specialist labor'],['service_fee','IPS service fee'],['expenses','Approved expenses']].map(([k,l])=>
            <label className="ips4-field" key={k}>{l} · PLN<input type="number" min="0" step=".01" value={quote[k]} onChange={e=>setQuote(q=>({...q,[k]:e.target.value}))}/></label>)}</div>
          <label className="ips4-field">Scope, deliverables, conditions<textarea required value={quote.notes} onChange={e=>setQuote(q=>({...q,notes:e.target.value}))}/></label>
          <label className="ips4-field">Quotation valid through<input type="date" required value={quote.expires_at} onChange={e=>setQuote(q=>({...q,expires_at:e.target.value}))}/></label>
          <Button kind="gold" type="submit" disabled={action.pending}>Issue approved itemized quotation</Button>
        </form>}
      </div>}
      <Feedback error={action.error}/>
    </Dialog>}
  </>;
}

export function ProjectCaseFile(){
  const {requestId}=useParams(),{hasAdminPermission}=useAuth();
  const work=useFeed('/api/services/'+encodeURIComponent(requestId),'request',hasAdminPermission('services.view'));
  const evidence=useFeed('/api/orders/'+encodeURIComponent(requestId)+'/workspace','files',hasAdminPermission('services.view'));
  const action=useAction(()=>{work.refresh();evidence.refresh();});
  const [tab,setTab]=useState('timeline'),[body,setBody]=useState(''),[channel,setChannel]=useState('client_admin'),
    [upload,setUpload]=useState(null),[audience,setAudience]=useState('admin'),[category,setCategory]=useState('Other'),
    [busy,setBusy]=useState(false),[reason,setReason]=useState(''),[review,setReview]=useState(null);
  const project=work.records,all=evidence.payload||{},files=all.files||[],messages=all.messages||[],history=all.audit||[];
  const manage=hasAdminPermission('services.manage'),canMessage=hasAdminPermission('messages.manage');
  async function recordMessage(e){
    e.preventDefault();if(!canMessage||!body.trim())return;
    const ok=await action.run('/api/orders/'+encodeURIComponent(requestId)+'/messages','POST',
      {channel,body:body.trim()},'The message was saved to the authenticated project channel.');
    if(ok)setBody('');
  }
  async function submitFile(e){
    e.preventDefault();if(!upload||!manage||busy)return;setBusy(true);action.setError('');
    try{
      const encoded=await new Promise((resolve,reject)=>{
        const reader=new FileReader();reader.onerror=reject;reader.onload=()=>resolve(reader.result);reader.readAsDataURL(upload);
      });
      const res=await request('/api/orders/'+encodeURIComponent(requestId)+'/files',{
        method:'POST',body:{name:upload.name,mime_type:upload.type,size:upload.size,
          data:encoded,visibility:audience,category,description:'Admin uploaded for controlled academic delivery'}});
      setUpload(null);evidence.refresh();action.setNotice('Protected file saved with verified upload storage and company audit reference.');
    }catch(e){action.setError(e.message);}finally{setBusy(false);}
  }
  async function reviewFile(e){
    e.preventDefault();if(!review||!manage)return;
    const okay=await action.run('/api/files/'+encodeURIComponent(review._id),'PATCH',
      {state:review.target_state,visibility:review.visibility,review_reason:reason.trim()||'IPS QA review and authorized document visibility decision'},
      'The file state and audience were updated with an audit entry.');
    if(okay){setReview(null);setReason('');}
  }
  return <>
    <Title kicker="ACADEMIC PRODUCTION / CONTROLLED MASTER FILE" title={project?.title||'Academic service record'}
      description={project?.description||'A protected evidence trail across quotation, specialist delivery, client review and company release.'}
      actions={<LinkButton to="/admin/services">← Academic register</LinkButton>}/>
    {work.error&&<Notice kind="danger">{work.error}</Notice>}{evidence.error&&<Notice kind="danger">{evidence.error}</Notice>}
    <Feedback error={action.error} notice={action.notice}/>
    {!project?<Empty>Opening the authenticated IPS academic service file…</Empty>:<>
      <div className="ips4-detail-facts">{[['Project ID',project.request_id],['Client reference',project.client_id],['Academic case status',project.status],
        ['Assigned specialist',project.provider_name||'Unassigned'],['Payment proof',project.payment_status||'Not verified'],
        ['Progress',Number(project.progress||0)+'%'],['Delivery target',dateTime(project.deadline)],['Quotation',price(project.quote)]].map(([l,v])=>
        <div className="ips4-fact" key={l}><small>{l}</small><strong>{v||'Not recorded'}</strong></div>)}</div>
      <div className="ips4-note" style={{margin:'17px 0'}}>Only verified paid projects may enter assigned or completed academic production. Unpaid work cannot be marked as settled or delivered.</div>
      <div className="ips4-toolbar">{[['timeline','History and decisions'],['messages','Authenticated conversation'],['files','Document review & release'],['quote','Quotation & scope']].map(([k,label])=>
        <button type="button" className="ips4-tab" key={k} aria-pressed={tab===k} onClick={()=>setTab(k)}>{label}</button>)}</div>
      {tab==='timeline'&&<Panel title="Case event history" description="Actual recorded changes, audit evidence, actor and timestamps.">
        {history.length?history.map((h,i)=><div key={h._id||i} className="ips4-row"><div><strong>{h.action}</strong>
          <small>{h.actor_role||'Admin'} · {h.actor_id||'IPS'} · {dateTime(h.createdAt)} · {JSON.stringify(h.details||{}).slice(0,200)}</small></div></div>):
          <Empty>No complete audit events are available for this file.</Empty>}
      </Panel>}
      {tab==='messages'&&<Panel title="Secure academic project correspondence" description="Each channel reaches authorized participants only, not a public Telegram or personal email.">
        <div className="ips4-chat">{!messages.length?<Empty>No recorded project messages.</Empty>:messages.map((m,i)=>
          <div key={m._id||i} className={'ips4-bubble'+(m.sender_role==='admin'?' sent':'')}>
            <small>{m.sender_role} · {m.channel} · {dateTime(m.createdAt)}</small>{m.body}</div>)}</div>
        {canMessage&&<form className="ips4-form" style={{marginTop:18}} onSubmit={recordMessage}>
          <label className="ips4-field">Authorized recipient channel<select value={channel} onChange={e=>setChannel(e.target.value)}>
            <option value="client_admin">Authenticated client</option><option value="writer_admin">Assigned specialist</option>
            <option value="admin_internal">IPS internal staff</option><option value="announcement">Project announcement</option></select></label>
          <label className="ips4-field">Company message<textarea required maxLength={5000} value={body} onChange={e=>setBody(e.target.value)}/></label>
          <Button kind="gold" type="submit" disabled={action.pending||!body.trim()}>Send protected project message</Button></form>}
      </Panel>}
      {tab==='files'&&<Panel title="Submission, protected documents and quality release" description="Inspect every uploaded file, actual reviewer state and audience before release.">
        {!files.length?<Empty>No project files have been submitted.</Empty>:<div className="ips4-table-wrap"><table className="ips4-table"><thead><tr><th>Protected document</th><th>Uploader</th><th>Review state</th><th>Access</th><th>Actions</th></tr></thead><tbody>
          {files.map(f=><tr key={f._id}><td><strong>{f.original_name}</strong><small>{f.category} · {Math.ceil((f.size||0)/1024)} KB · {dateTime(f.createdAt)}</small></td>
            <td>{f.uploader_role}</td><td><Tag tone={f.state==='released'?'good':f.state==='rejected'?'danger':'warn'}>{f.state}</Tag></td>
            <td>{f.visibility}</td><td><a className="ips4-btn" href={'/api/files/'+encodeURIComponent(f._id)+'/download'}>Download</a>
              {manage&&<Button onClick={()=>{setReview({...f,target_state:f.state});setReason('');}}>QA review</Button>}</td></tr>)}
        </tbody></table></div>}
        {manage&&<form className="ips4-form" style={{marginTop:19}} onSubmit={submitFile}>
          <h3>Upload a protected academic document</h3>
          <label className="ips4-field">Source document (maximum 25 MB)<input type="file" required accept=".pdf,.doc,.docx,.png,.jpg,.jpeg,.txt" onChange={e=>setUpload(e.target.files?.[0]||null)}/></label>
          <div className="ips4-fields"><label className="ips4-field">Document purpose<select value={category} onChange={e=>setCategory(e.target.value)}><option>Other</option><option>Deliverable</option><option>Reference</option><option>Revision</option><option>Quality Review</option></select></label>
            <label className="ips4-field">Who can open the file<select value={audience} onChange={e=>setAudience(e.target.value)}>
              <option value="admin">IPS administration only</option><option value="admin_client">Company and client</option>
              <option value="admin_writer">Company and specialist</option><option value="all">All authorized project participants</option></select></label></div>
          <Button type="submit" kind="gold" disabled={!upload||busy}>Upload to protected IPS storage</Button>
        </form>}
      </Panel>}
      {tab==='quote'&&<Panel title="Client-owned quotation and acceptance">
        <div className="ips4-detail-facts">{[['Current quote',price(project.quote)],['Client acceptance',project.quote?.accepted?'Recorded from client':'Not accepted'],
          ['Source quote',project.source_quote_id||'Not linked'],['Payment',project.payment_status||'Not verified']].map(([k,v])=><div className="ips4-fact" key={k}><small>{k}</small><strong>{v}</strong></div>)}</div>
        <p style={{color:'var(--muted)',lineHeight:1.7}}>{project.quote?.notes||'No itemized company scope has been issued.'}</p>
        <div className="ips4-note">The company cannot accept its own quote on behalf of the client and cannot make a payment appear verified. The client makes that decision in their account.</div>
      </Panel>}
    </>}
    {review&&<Dialog title={'File QA · '+review.original_name} subtitle="Independent permissioned review and document release decision" onClose={()=>setReview(null)}>
      <form className="ips4-form" onSubmit={reviewFile}>
        <label className="ips4-field">Document state<select value={review.target_state} onChange={e=>setReview(v=>({...v,target_state:e.target.value}))}>
          {['pending','approved','released','rejected','archived'].map(s=><option key={s}>{s}</option>)}</select></label>
        <label className="ips4-field">Authorized audience<select value={review.visibility} onChange={e=>setReview(v=>({...v,visibility:e.target.value}))}>
          {['admin','admin_writer','admin_client','all'].map(s=><option key={s}>{s}</option>)}</select></label>
        <label className="ips4-field">Review findings / release justification<textarea minLength={10} maxLength={1000} value={reason} onChange={e=>setReason(e.target.value)} required/></label>
        <Button kind="gold" type="submit" disabled={reason.trim().length<10||action.pending}>Save audited document decision</Button>
      </form>
    </Dialog>}
  </>;
}
