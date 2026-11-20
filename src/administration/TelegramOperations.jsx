import React,{useEffect,useMemo,useState} from 'react';
import {useSearchParams} from 'react-router-dom';
import {useAuth} from '../context/AuthContext.jsx';
import {request,useFeed,useAction,Title,Panel,Button,Tag,Notice,Empty,dateTime} from './core.jsx';

export default function TelegramOperations(){
  const {hasAdminPermission}=useAuth();
  const [params,setParams]=useSearchParams();
  const threads=useFeed('/api/contact-channels/admin/threads','threads',hasAdminPermission('messages.view'));
  const items=(threads.records||[]).filter(x=>x.channel==='telegram');
  const [selected,setSelected]=useState(''),[thread,setThread]=useState(null),
    [messages,setMessages]=useState([]),[loading,setLoading]=useState(false),
    [error,setError]=useState(''),[filter,setFilter]=useState('all'),[search,setSearch]=useState(''),
    [draft,setDraft]=useState(''),[sending,setSending]=useState(false),[notice,setNotice]=useState('');
  const selectedItem=items.find(x=>String(x._id)===selected)||null;
  const canManage=hasAdminPermission('messages.manage');
  const canReply=canManage&&selectedItem?.status==='open'&&['verified','general_support'].includes(selectedItem.reply_mode);
  const publicSupport=selectedItem?.reply_mode==='general_support';
  const limit=publicSupport?650:2000;
  const visible=useMemo(()=>items.filter(x=>(filter==='all'||(filter==='new'?Number(x.unread_count||0)>0:
    filter==='reply'?x.reply_mode!=='unavailable':filter==='verified'?x.verified_contact:!x.verified_contact))&&
    [x.display_name,x.external_id,x.client_id,x.reply_mode].join(' ').toLowerCase().includes(search.trim().toLowerCase())),[threads.records,search,filter]);
  const open=async id=>{
    if(!id)return;setSelected(id);setMessages([]);setThread(null);setLoading(true);setError('');setNotice('');
    const next=new URLSearchParams(params);next.set('thread',id);setParams(next);
    try{
      const data=await request('/api/contact-channels/admin/threads/'+encodeURIComponent(id)+'/messages');
      setMessages(data.messages||[]);setThread(data.contact||null);threads.refresh();
    }catch(e){setError(e.message);}finally{setLoading(false);}
  };
  useEffect(()=>{
    const id=params.get('thread')||'';
    if(/^[a-f0-9]{24}$/i.test(id)&&id!==selected)void open(id);
  },[params.get('thread')]);
  async function send(e){
    e.preventDefault();if(!canReply||!draft.trim()||sending||draft.length>limit)return;
    setSending(true);setError('');setNotice('');
    try{
      const outcome=await request('/api/contact-channels/admin/threads/'+encodeURIComponent(selected)+'/reply',
        {method:'POST',body:{body:draft.trim()}});
      setNotice(outcome.delivery==='provider_accepted'
        ?'Telegram accepted the outgoing message. Customer reading and receipt are not confirmed.'
        :'The reply has been recorded.');
      setDraft('');
      const data=await request('/api/contact-channels/admin/threads/'+encodeURIComponent(selected)+'/messages');
      setMessages(data.messages||[]);setThread(data.contact||null);threads.refresh();
    }catch(e){setError(e.message||'Telegram provider did not accept the reply.');}
    finally{setSending(false);}
  }
  return <>
    <Title kicker="CUSTOMER COMMUNICATION / TELEGRAM" title="Telegram operations"
      description="A complete operator-facing conversation: full readable history, verified contact status, actual permission to reply and clear guidance when consent is missing."
      actions={<Button onClick={()=>{threads.refresh();if(selected)void open(selected);}} disabled={threads.busy||loading}>Refresh conversations</Button>}/>
    {threads.error&&<Notice kind="danger">{threads.error}</Notice>}
    <div className="ips4-note info" style={{marginBottom:18}}>This inbox is for verified IPS Telegram customer messages. WhatsApp remains direct and manual; it does not silently populate this Telegram inbox. No calls are offered.</div>
    <div className="ips4-record-layout">
      <Panel title={'Telegram conversations'+(threads.available?' ('+items.length+')':'')} description="Select the person who contacted the official IPS bot.">
        <div className="ips4-toolbar"><input aria-label="Find Telegram conversation" type="search" placeholder="Find username or contact…" value={search} onChange={e=>setSearch(e.target.value)}/></div>
        <div className="ips4-toolbar">{[['all','All'],['new','Unread'],['reply','Reply permitted'],['verified','Verified'],['unverified','Unverified']].map(([v,l])=>
          <button type="button" key={v} className="ips4-tab" aria-pressed={filter===v} onClick={()=>setFilter(v)}>{l}</button>)}</div>
        <div className="ips4-record-list">
          {threads.busy&&!threads.available?<Empty>Retrieving customer-initiated Telegram messages…</Empty>:
            !visible.length?<Empty>No Telegram conversations match this view.</Empty>:
            visible.map(x=><button type="button" key={x._id} aria-pressed={x._id===selected} className="ips4-record-entry" onClick={()=>void open(String(x._id))}>
              <span>{Number(x.unread_count||0)>0?x.unread_count+' UNREAD MESSAGE(S)':'TELEGRAM · '+(x.reply_mode==='verified'?'VERIFIED':'GENERAL CONTACT')}</span>
              <strong>{x.display_name||'Private Telegram visitor'}</strong>
              <small>{x.external_id?'Telegram user · '+String(x.external_id).slice(-6):'Not linked'} · {dateTime(x.last_message_at)}</small>
              <div><Tag tone={x.reply_mode==='verified'?'good':x.reply_mode==='general_support'?'warn':'neutral'}>
                {x.reply_mode==='verified'?'Verified quotation':x.reply_mode==='general_support'?'One support reply allowed':'Not authorized for reply'}</Tag></div>
            </button>)}
        </div>
      </Panel>
      <Panel title={selectedItem?.display_name||'Customer conversation'} description={selectedItem?('Telegram • '+dateTime(selectedItem.last_message_at)):'Choose an actual thread to inspect messages'}>
        {error&&<Notice kind="danger">{error}</Notice>}
        {notice&&<Notice>{notice}</Notice>}
        {!selected?<Empty>Select a Telegram contact to see the entire recorded conversation and the next permitted action.</Empty>:
        loading?<Empty>Opening protected Telegram history…</Empty>:<>
          {selectedItem&&<div className="ips4-detail-facts">
            {[[ 'Connection',selectedItem.status==='open'?'Open':'Closed'],
              ['Privacy',selectedItem.verified_contact?'Consented verified customer':'Unverified general contact'],
              ['Account link',selectedItem.client_id||'No account linked'],
              ['Reply rights',selectedItem.reply_mode==='verified'?'Verified private request':
                selectedItem.reply_mode==='general_support'?'One short general-support reply':'Not currently authorized']].map(([l,v])=>
              <div className="ips4-fact" key={l}><small>{l}</small><strong>{v}</strong></div>)}
          </div>}
          <div className="ips4-chat" aria-label="Telegram message history" aria-live="polite">
            {!messages.length?<Empty>No messages recorded for this contact.</Empty>:messages.map(m=><div className={'ips4-bubble'+(m.direction==='outbound'?' sent':'')} key={m._id}>
              <small>{m.direction==='outbound'?'IPS team':'Telegram customer'} · {dateTime(m.createdAt)} {m.status?' · '+m.status:''}</small>
              {m.body||'[Non-text message]'}
            </div>)}
          </div>
          {canReply?<form className="ips4-form" style={{marginTop:17}} onSubmit={send}>
            {publicSupport&&<div className="ips4-note">This customer initiated an eligible general message. You may send a short acknowledgement only (maximum 650 characters), without private quote references, links, financial details or account information. A new customer message is required for a further reply.</div>}
            <label className="ips4-field">{publicSupport?'Permitted general-support response':'Verified quotation or service reply'}
              <textarea value={draft} onChange={e=>setDraft(e.target.value)} maxLength={limit} required
                placeholder={publicSupport?'Acknowledge the enquiry and invite the customer to submit a confidential request.':'Reply in the customer-authorized written channel.'}/>
              <small>{draft.length}/{limit} characters · Sent through the official IPS Telegram bot</small></label>
            <Button kind="gold" type="submit" disabled={sending||draft.trim().length<1}>{sending?'Sending to Telegram…':'Send authorized Telegram reply'}</Button>
          </form>:<div className="ips4-blocked" style={{marginTop:16}}>
            <span aria-hidden="true">◈</span>
            <div><strong>Sending is not currently authorized.</strong>
              <p>{selectedItem?.status==='closed'?'The customer closed this conversation; do not contact them.':
                !canManage?'You can read Telegram records, but your department does not have outbound messaging permission.':
                'The recent messages do not constitute a verified project request or new substantive support enquiry. Ask the customer to send a fresh message to the official IPS bot or to verify a quotation through the private website.'}</p>
              <p>Historical customer messages remain visible. Never use a personal account or bypass customer consent.</p>
            </div>
          </div>}
        </>}
      </Panel>
    </div>
  </>;
}
