import React,{useEffect,useMemo,useState} from 'react';
import {Link,useSearchParams} from 'react-router-dom';
import {useAuth} from '../context/AuthContext.jsx';
import {isIpsQaFixtureEmail} from '../../shared/ipsCompanyScope.js';
import {useFeed,useAction,Title,Panel,Button,LinkButton,Tag,Notice,Empty,Feedback,dateTime} from './core.jsx';

const stage=['new','in_progress','waiting_for_customer','closed'];
const canSendTo=c=>Boolean(c?.contact_verified&&c?.contact_consent&&
  ['email','workspace'].includes(c?.preferred_channel)&&c?.status!=='closed');
const overdue=c=>Boolean(c?.next_update_at&&c.status!=='closed'&&Date.parse(c.next_update_at)<Date.now());
export default function IntakeDesk(){
  const {hasAdminPermission}=useAuth();
  const [params,setParams]=useSearchParams();
  const feed=useFeed('/api/contact-enquiries/admin','enquiries',hasAdminPermission('support.view'));
  const delivery=useFeed('/api/contact-enquiries/config','email_replies_configured');
  const [selected,setSelected]=useState(params.get('case')||''),[search,setSearch]=useState(''),[filter,setFilter]=useState('open'),
    [reply,setReply]=useState(''),[updateAt,setUpdateAt]=useState(''),[number,setNumber]=useState(''),
    [reference,setReference]=useState(''),[attest,setAttest]=useState(false),[withdraw,setWithdraw]=useState(false);
  const action=useAction(feed.refresh);
  const records=(feed.records||[]).filter(x=>!isIpsQaFixtureEmail(x.email)&&!/^(?:TEST|DEMO|EVAL)-/i.test(x.enquiry_id||''));
  const visible=useMemo(()=>records.filter(c=>(filter==='all'||(filter==='open'?c.status!=='closed':
    filter==='overdue'?overdue(c):filter==='verify'?!c.contact_verified:c.status===filter))&&
    [c.enquiry_id,c.subject,c.username,c.email,c.service].join(' ').toLowerCase().includes(search.toLowerCase())).sort(
    (a,b)=>Number(overdue(b))-Number(overdue(a))||Date.parse(b.last_activity_at||0)-Date.parse(a.last_activity_at||0)),[feed.records,filter,search]);
  const current=records.find(c=>c.enquiry_id===selected)||null,manage=hasAdminPermission('support.manage');
  useEffect(()=>{const id=params.get('case');if(id&&id!==selected)setSelected(id);},[params.get('case')]);
  useEffect(()=>{setUpdateAt(current?.next_update_at?new Date(current.next_update_at).toISOString().slice(0,16):'');setReply('');},[selected,current?.next_update_at]);
  const choose=id=>{setSelected(id);const q=new URLSearchParams(params);q.set('case',id);setParams(q);action.setError('');action.setNotice('');};
  const root=current?'/api/contact-enquiries/admin/'+encodeURIComponent(current.enquiry_id):'';
  async function update(body,msg){await action.run(root,'PATCH',body,msg);}
  async function writtenResponse(e){
    e.preventDefault();if(!current||!reply.trim()||!canSendTo(current))return;
    const path=current.preferred_channel==='workspace'
      ?'/api/quote-requests/admin/'+encodeURIComponent(current.enquiry_id)+'/workspace-reply':root+'/email-reply';
    const okay=await action.run(path,'POST',{message:reply.trim()},
      current.preferred_channel==='workspace'?'Message saved to verified customer workspace.':
        'Verified IPS mail provider accepted the email. Delivery to the recipient inbox is not guaranteed.');
    if(okay)setReply('');
  }
  return <>
    <Title kicker="CLIENT SERVICES / ENQUIRY TO APPROVED QUOTE" title="Quotation intake and review"
      description="A consent-aware case desk where anonymous academic enquiries become verified, owned, written quotations and linked delivery files. No telephone callbacks."
      actions={<Button onClick={feed.refresh} disabled={feed.busy}>Refresh client enquiries</Button>}/>
    {feed.error&&<Notice kind="danger">{feed.error}</Notice>}<Feedback error={action.error} notice={action.notice}/>
    <div className="ips4-stats">
      {[['New private enquiries',records.filter(x=>x.status==='new').length,'Human review required'],
        ['Awaiting proof',records.filter(x=>!x.contact_verified&&x.status!=='closed').length,'Client must prove their chosen route'],
        ['Assigned case owners',records.filter(x=>Boolean(x.assigned_admin_id)&&x.status!=='closed').length,'Human accountability'],
        ['Written updates overdue',records.filter(overdue).length,'Contact promise needing action']].map(([k,v,h])=><div className="ips4-stat" key={k}><span>{k}</span><strong>{feed.available?v:'—'}</strong><small>{h}</small></div>)}
    </div>
    <div className="ips4-record-layout">
      <Panel title="Incoming written cases" description="Choose a real client request and its entire correspondence.">
        <div className="ips4-toolbar"><input type="search" aria-label="Find quote" placeholder="Find client reference or brief…" value={search} onChange={e=>setSearch(e.target.value)}/></div>
        <div className="ips4-toolbar">{[['open','Open'],['new','New'],['verify','Awaiting verification'],['overdue','Overdue'],['closed','Closed'],['all','All']].map(([v,l])=><button type="button" className="ips4-tab" key={v} aria-pressed={filter===v} onClick={()=>setFilter(v)}>{l}</button>)}</div>
        <div className="ips4-record-list">{!feed.available?<Empty>Loading real private client enquiries…</Empty>:!visible.length?<Empty>No enquiries match this case filter.</Empty>:
          visible.map(c=><button type="button" className="ips4-record-entry" key={c.enquiry_id} aria-pressed={selected===c.enquiry_id} onClick={()=>choose(c.enquiry_id)}>
            <span>{c.enquiry_id} · {c.preferred_channel||'workspace'}</span><strong>{c.subject||c.service||'Private request'}</strong>
            <small>{c.username||'Private client'} · {c.assigned_admin_id||'Not claimed'} · {dateTime(c.last_activity_at)}</small>
            <div>{overdue(c)?<Tag tone="danger">Overdue</Tag>:c.contact_verified?<Tag tone="good">Verified contact</Tag>:<Tag tone="warn">Consent / verification pending</Tag>}</div>
          </button>)}</div>
      </Panel>
      <Panel title={current?.subject||'Select a client quotation'} description={current?current.enquiry_id:'Written-first business review, real case ownership and compliant client communication.'}>
        {!current?<Empty>Select an enquiry to see the scope, verified contact channel, correspondence, accountability and service handoff.</Empty>:<>
          <div className="ips4-detail-facts">{[['Client alias',current.username||'Private visitor'],
            ['Requested service',current.service||'Not specified'],['Academic field',current.discipline||'Not provided'],
            ['Academic level',current.study_level||'Not supplied'],
            ['Preferred channel',current.preferred_channel||'workspace'],['Consent / verification',current.contact_verified&&current.contact_consent?'Verified':'Not verified'],
            ['Reviewer',current.assigned_admin_id||'Not assigned'],['Next written update',dateTime(current.next_update_at)]].map(([k,v])=>
            <div className="ips4-fact" key={k}><small>{k}</small><strong>{v}</strong></div>)}</div>
          {!current.contact_verified&&<div className="ips4-blocked"><div><strong>Contact is not verified</strong>
            <p>Client must prove control over their selected written channel. The operator cannot mark a public email verified by assumption or send academic records to an unconfirmed address.</p></div></div>}
          <div className="ips4-toolbar">
            {manage&&!current.assigned_admin_id&&current.contact_verified&&<Button kind="gold" disabled={action.pending} onClick={()=>action.run(root+'/claim','POST',{},'You now own this verified client review.')}>Take review ownership</Button>}
            {current.service_request_id?<LinkButton to={'/admin/services/'+encodeURIComponent(current.service_request_id)}>Open linked academic project →</LinkButton>:
              hasAdminPermission('services.manage')&&current.client_id&&current.contact_verified&&current.contact_consent?
                <Button disabled={action.pending} onClick={()=>action.run('/api/quote-requests/admin/'+encodeURIComponent(current.enquiry_id)+'/create-project',
                  'POST',{},'A centrally managed academic project was created from this customer-approved source.')}>Create linked managed project</Button>:null}
          </div>
          <div className="ips4-stack">
            {manage&&<div className="ips4-fields">
              <label className="ips4-field">Current quotation state<select value={current.status} disabled={action.pending} onChange={e=>void update({status:e.target.value},'Client enquiry state updated.')}>{[...new Set([...stage,current.status])].map(s=><option key={s}>{s}</option>)}</select></label>
              <label className="ips4-field">Next promised update (local time)<input type="datetime-local" disabled={action.pending||current.status==='closed'} value={updateAt} onChange={e=>setUpdateAt(e.target.value)}/></label>
              <Button disabled={!updateAt||action.pending} onClick={()=>void update({next_update_at:new Date(updateAt).toISOString()},'Documented client response deadline saved.')}>Commit written response time</Button>
            </div>}
            <div><h3 style={{marginBottom:9,fontSize:15}}>Real client correspondence</h3><div className="ips4-chat" style={{maxHeight:320}}>
              {!(current.messages||[]).length?<Empty>There is no recorded message history for this request.</Empty>:(current.messages||[]).map((m,i)=><div className={'ips4-bubble'+(m.direction==='outbound'?' sent':'')} key={m._id||i}>
                <small>{m.direction==='outbound'?'IPS staff':'Customer'} · {m.channel||current.preferred_channel} · {m.delivery_status||'Recorded'} · {dateTime(m.created_at)}</small>{m.body}
              </div>)}</div></div>
            {canSendTo(current)&&manage&&<form onSubmit={writtenResponse} className="ips4-form">
              <label className="ips4-field">Send via {current.preferred_channel==='email'?'the verified IPS business email sender':'the authenticated private client workspace'}
                <textarea maxLength={3500} required value={reply} onChange={e=>setReply(e.target.value)} placeholder="Write a helpful human quotation response that respects the verified channel…"/></label>
              <Button type="submit" kind="gold" disabled={action.pending||!reply.trim()||current.preferred_channel==='email'&&delivery.records!==true}>Send authorized written reply</Button>
              {current.preferred_channel==='email'&&delivery.records!==true&&<Notice kind="danger">Company email replies are unavailable until the verified mail provider accepts outbound delivery.</Notice>}
            </form>}
            {current.preferred_channel==='telegram'&&<div className="ips4-note info">Telegram responses belong in the protected Telegram console, not via an unverified email fallback. Open the official IPS conversation and respect the reply-eligibility status. {current.contact_thread_id&&<Link to={'/admin/external-chats?thread='+encodeURIComponent(current.contact_thread_id)}>Open verified Telegram thread →</Link>}</div>}
            {current.preferred_channel==='whatsapp'&&<div className="ips4-stack">
              <div className="ips4-note">WhatsApp is a separate direct and manual written channel. It is not automatically imported into Telegram. IPS must verify the sender and reference before discussing a private request.</div>
              {!current.contact_verified&&manage&&<form className="ips4-form" onSubmit={async e=>{e.preventDefault();
                const ok=await action.run(root+'/whatsapp-manual-verify','POST',{observed_phone:number.trim(),observed_reference:reference.trim(),attested:attest},'Direct WhatsApp sender attested by authorized staff. The conversation stays outside this inbox.');
                if(ok){setNumber('');setReference('');setAttest(false);}}}>
                <label className="ips4-field">Number actually observed in customer-initiated WhatsApp conversation<input required value={number} onChange={e=>setNumber(e.target.value)}/></label>
                <label className="ips4-field">Exact customer-submitted quotation reference<input required value={reference} onChange={e=>setReference(e.target.value)}/></label>
                <label style={{display:'flex',alignItems:'center',gap:10,fontSize:12}}><input type="checkbox" checked={attest} onChange={e=>setAttest(e.target.checked)}/> I personally verified both values in the business WhatsApp chat.</label>
                <Button kind="gold" type="submit" disabled={!attest||action.pending}>Record actual WhatsApp contact proof</Button>
              </form>}
              {current.contact_verified&&current.phone&&<a href={'https://wa.me/'+current.phone.replace(/[^0-9]/g,'')} target="_blank" rel="noopener noreferrer" className="ips4-btn">Open verified WhatsApp written chat ↗</a>}
            </div>}
          </div>
        </>}
      </Panel>
    </div>
  </>;
}
