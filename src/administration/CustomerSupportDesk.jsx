import React,{useEffect,useMemo,useState} from 'react';
import {useSearchParams} from 'react-router-dom';
import {useAuth} from '../context/AuthContext.jsx';
import {useFeed,useAction,Title,Panel,Button,Tag,Notice,Empty,dateTime} from './core.jsx';

export default function CustomerSupportDesk(){
  const {admin,hasAdminPermission}=useAuth();
  const [params,setParams]=useSearchParams();
  const data=useFeed('/api/support-tickets','tickets',hasAdminPermission('support.view'));
  const staff=useFeed('/api/admin/company-cases/staff','staff',hasAdminPermission('team.manage')&&hasAdminPermission('support.manage'));
  const action=useAction(data.refresh);
  const [selected,setSelected]=useState(params.get('ticket')||''),[text,setText]=useState(''),
    [search,setSearch]=useState(''),[filter,setFilter]=useState('open'),[assignment,setAssignment]=useState('');
  const items=data.records||[];
  const mine=items.find(t=>t.ticket_id===selected)||null;
  const manage=hasAdminPermission('support.manage');
  const canManageTeam=hasAdminPermission('team.manage');
  const assignedToMe=Boolean(admin?.id&&mine?.assigned_admin===admin.id);
  const supportPeople=(staff.records||[]).filter(p=>p.id!==undefined&&
    (admin?.isRoot?p.role==='manager':p.role==='staff'||p.id===admin?.id));
  const visible=useMemo(()=>items.filter(t=>(filter==='all'||(filter==='open'?!['Resolved','Closed'].includes(t.status):
    filter==='urgent'?t.priority==='urgent':t.status===filter))&&
    [t.subject,t.ticket_id,t.client_name,t.client_email].join(' ').toLowerCase().includes(search.toLowerCase())),[data.records,filter,search]);
  useEffect(()=>{const target=params.get('ticket');if(target&&target!==selected)setSelected(target);},[params.get('ticket')]);
  const choose=id=>{setSelected(id);setText('');setAssignment('');action.setError('');const q=new URLSearchParams(params);q.set('ticket',id);setParams(q);};
  async function update(payload){
    if(!mine||!manage)return;
    await action.run('/api/support-tickets/'+encodeURIComponent(mine.ticket_id),'PATCH',payload,'Client support case updated.');
  }
  async function reply(e){
    e.preventDefault();if(!mine||!text.trim()||!manage)return;
    const ok=await action.run('/api/support-tickets/'+encodeURIComponent(mine.ticket_id)+'/messages','POST',{message:text.trim()},
      'Support reply recorded in the authenticated client workspace.');
    if(ok)setText('');
  }
  return <>
    <Title kicker="CLIENT CARE / ACCOUNTABLE RESOLUTION" title="Customer support command"
      description="One protected case file per actual customer problem, with responsibility, priority, message history, resolution and secure written response."
      actions={<Button onClick={data.refresh} disabled={data.busy}>Refresh cases</Button>}/>
    {data.error&&<Notice kind="danger">{data.error}</Notice>}
    <div className="ips4-record-layout">
      <Panel title={'Customer support cases'+(data.available?' · '+items.length:'')} description="Resolve underlying client concerns; never close a case merely to hide it.">
        <div className="ips4-toolbar"><input aria-label="Search support tickets" type="search" placeholder="Search reference or customer alias…" value={search} onChange={e=>setSearch(e.target.value)}/></div>
        <div className="ips4-toolbar">{[['open','Open'],['urgent','Urgent'],['In Progress','In progress'],['Waiting for Client','Awaiting customer'],['Resolved','Resolved'],['all','All']].map(([v,l])=>
          <button className="ips4-tab" type="button" key={v} aria-pressed={filter===v} onClick={()=>setFilter(v)}>{l}</button>)}</div>
        <div className="ips4-record-list">{!data.available?<Empty>Loading protected customer cases…</Empty>:!visible.length?<Empty>No support cases match this filter.</Empty>:
          visible.map(t=><button type="button" key={t.ticket_id} className="ips4-record-entry" aria-pressed={selected===t.ticket_id} onClick={()=>choose(t.ticket_id)}>
            <span>{t.ticket_id} · {t.priority||'standard'}</span><strong>{t.subject||'Private support enquiry'}</strong>
            <small>{t.client_name||'Private client'} · {t.assigned_admin||'Not assigned'} · {dateTime(t.last_activity_at)}</small>
            <Tag tone={t.priority==='urgent'?'danger':['Resolved','Closed'].includes(t.status)?'good':'warn'}>{t.status}</Tag>
          </button>)}</div>
      </Panel>
      <Panel title={mine?.subject||'Select a support case'} description={mine?mine.ticket_id+' · Private customer service':'Inspect and reply through the authenticated IPS customer workspace.'}>
        {!mine?<Empty>Select a support case to inspect the issue, history and authorized resolution actions.</Empty>:<>
          <div className="ips4-detail-facts">{[['Private client',mine.client_name||'Anonymous alias'],
            ['Current status',mine.status],['Priority',mine.priority||'standard'],
            ['Responsible person',mine.assigned_admin||'Unassigned'],
            ['Issue type',mine.category||'General'],['Contact',mine.client_email||'Client workspace']].map(([k,v])=><div className="ips4-fact" key={k}><small>{k}</small><strong>{v}</strong></div>)}</div>
          {manage&&<div className="ips4-stack" style={{marginTop:18,marginBottom:18}}>
            {!mine.assigned_admin&&!admin?.isRoot&&<Button kind="gold" disabled={action.pending}
              onClick={()=>void update({assigned_admin:admin.id})}>Take accountable ownership</Button>}
            {canManageTeam&&<form className="ips4-form" onSubmit={async e=>{
              e.preventDefault();
              if(assignment)await update({assigned_admin:assignment});
            }}>
              <label className="ips4-field">Assign to an authorized team member
                <select value={assignment} onChange={e=>setAssignment(e.target.value)} required>
                  <option value="">Select a responsible person</option>
                  {supportPeople.map(p=><option key={p.id} value={p.id}>{p.name} · {p.role}</option>)}
                </select>
              </label>
              {staff.error&&<Notice kind="danger">{staff.error}</Notice>}
              <Button kind="gold" type="submit" disabled={!assignment||action.pending}>Save governed assignment</Button>
            </form>}
            {!canManageTeam&&!assignedToMe&&Boolean(mine.assigned_admin)&&
              <div className="ips4-note">Another employee owns this support case. Your manager must transfer responsibility before you can change it.</div>}
          </div>}
          {manage&&<div className="ips4-fields">
            <label className="ips4-field">Escalation priority<select value={mine.priority||'standard'} disabled={action.pending} onChange={e=>void update({priority:e.target.value})}><option value="standard">Standard</option><option value="urgent">Urgent</option></select></label>
            <label className="ips4-field">Case resolution status<select value={mine.status} disabled={action.pending} onChange={e=>void update({status:e.target.value})}>{['Open','In Progress','Waiting for Client','Resolved','Closed'].map(s=><option key={s}>{s}</option>)}</select></label>
          </div>}
          <h3 style={{fontSize:15,marginTop:20}}>Complete recorded support conversation</h3>
          <div className="ips4-chat">{!(mine.messages||[]).length?<Empty>No messages recorded on this support case.</Empty>:
            mine.messages.map((m,i)=><div className={'ips4-bubble'+(m.sender_role==='admin'?' sent':'')} key={m._id||i}>
              <small>{m.sender_role==='admin'?'IPS support':mine.client_name||'Customer'} · {dateTime(m.created_at)}</small>{m.body}
            </div>)}
          </div>
          {manage&&mine.status!=='Closed'&&<form className="ips4-form" style={{marginTop:17}} onSubmit={reply}>
            <label className="ips4-field">Reply privately to the authenticated client<textarea required maxLength={5000} value={text} onChange={e=>setText(e.target.value)} placeholder="Give a specific, helpful response or ask for a concrete clarification." /></label>
            <Button kind="gold" type="submit" disabled={action.pending||!text.trim()}>Send secure support response</Button>
          </form>}
          {!manage&&<div className="ips4-note info">This is a view-only support role. Only authorized Client Relations staff can send or change a support case.</div>}
          {action.error&&<Notice kind="danger">{action.error}</Notice>}
          {action.notice&&<Notice>{action.notice}</Notice>}
        </>}
      </Panel>
    </div>
  </>;
}
