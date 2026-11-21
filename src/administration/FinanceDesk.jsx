import React,{useState} from 'react';
import {useAuth} from '../context/AuthContext.jsx';
import {useFeed,Title,Panel,Button,Tag,Notice,Empty,GroupTotals,dateTime} from './core.jsx';

const minor=(amount,currency)=>Number.isFinite(Number(amount))?
  (Number(amount)/100).toLocaleString(undefined,{minimumFractionDigits:2,maximumFractionDigits:2})+
  ' '+String(currency||'PLN').toUpperCase():'Unavailable';
const quoteMoney=(amount,currency)=>Number.isFinite(Number(amount))?
  Number(amount).toLocaleString(undefined,{minimumFractionDigits:2,maximumFractionDigits:2})+
  ' '+String(currency||'PLN').toUpperCase():'Unavailable';
const tone=status=>['paid','succeeded','Completed'].includes(status)?'good':
  ['review_required','failed','requires_action','refunded'].includes(status)?'danger':'warn';
const tabs=[['quotes','Quotation cases'],['payments','Payment events'],
  ['payouts','Specialist settlements'],['refunds','Refunds']];

export default function FinanceDesk(){
  const {hasAdminPermission}=useAuth();
  const feed=useFeed('/api/admin/finance/operating-ledger','financial_cases',hasAdminPermission('payments.view'));
  const [tab,setTab]=useState('quotes');
  const data=feed.payload,counts=data?.counts||{};
  const cases=data?.financial_cases||[];
  const payments=data?.payments||[];
  const payouts=data?.payouts||[];
  const refunds=data?.refunds||[];
  const entries={quotes:cases,payments,payouts,refunds}[tab]||[];
  return <>
    <Title kicker="FINANCIAL GOVERNANCE / ACTUAL RECORDS"
      title="Finance without imaginary balances"
      description="Inspect recorded quotations, provider payment events, specialist settlement approvals and refunds. Customer acceptance is not revenue; pending payout approval is not proof of transfer."
      actions={<Button disabled={feed.busy} onClick={feed.refresh}>Refresh financial evidence</Button>}/>
    {feed.error&&<Notice kind="danger">{feed.error}</Notice>}
    <div className="ips4-note" style={{marginBottom:20}}>
      Live payment integration remains pending. IPS cannot claim money collected, settled or transferred without verifiable provider or bank evidence. This is an authorized operating ledger, not an invented sales dashboard.
    </div>
    <GroupTotals items={[
      {label:'Actual quote cases',value:feed.available?counts.quote_requests:null,hint:'All protected academic support quote cases'},
      {label:'Client accepted',value:feed.available?counts.client_accepted_quotes:null,hint:'Acceptance is not proof of payment'},
      {label:'Payment review',value:feed.available?counts.payments_requiring_review:null,hint:'Provider-event mismatches requiring investigation',tone:'attention'},
      {label:'Payouts pending',value:feed.available?counts.approved_payouts_pending:null,hint:'Approved but no recorded transfer',tone:'gold'}
    ]}/>
    <Panel title="Actual financial record register"
      description={'Most recent 100 records per ledger. Counts above use the company database; records are never represented as complete settlement evidence.'}>
      <div className="ips4-toolbar" role="tablist" aria-label="Finance record categories">
        {tabs.map(([key,name])=><button type="button" role="tab" aria-selected={tab===key}
          className="ips4-tab" aria-pressed={tab===key} key={key} onClick={()=>setTab(key)}>{name}</button>)}
      </div>
      {!feed.available?<Empty>{feed.busy?'Retrieving protected finance records…':'Finance data cannot be confirmed. No balances are assumed.'}</Empty>:
        !entries.length?<Empty>No {tabs.find(x=>x[0]===tab)?.[1].toLowerCase()} match this source register.</Empty>:
        <div className="ips4-table-wrap" role="tabpanel">
          <table className="ips4-table">
            <thead><tr><th>Reference</th><th>Recorded amount</th><th>Financial state</th><th>Business context</th><th>Recorded date</th></tr></thead>
            <tbody>
              {tab==='quotes'&&cases.map(x=><tr key={x.request_id}>
                <td><strong>{x.request_id}</strong></td>
                <td>{quoteMoney(x.quote_total,x.currency)}</td>
                <td><Tag tone={tone(x.payment_status)}>{x.payment_status||'unpaid'}</Tag></td>
                <td>{x.quote_accepted?'Client accepted':'Not accepted'}<small>Version {x.quote_version} · {x.project_status}</small></td>
                <td>{dateTime(x.updated_at)}</td>
              </tr>)}
              {tab==='payments'&&payments.map((x,i)=><tr key={x.request_id+'-'+i}>
                <td><strong>{x.request_id}</strong></td>
                <td>{minor(x.amount_minor,x.currency)}</td>
                <td><Tag tone={tone(x.status)}>{x.status}</Tag></td>
                <td>Refunded record: {minor(x.refunded_minor,x.currency)}<small>Provider event evidence, not a bank balance</small></td>
                <td>{dateTime(x.paid_at||x.created_at)}</td>
              </tr>)}
              {tab==='payouts'&&payouts.map(x=><tr key={x.request_id}>
                <td><strong>{x.request_id}</strong></td>
                <td>{minor(x.amount_minor,x.currency)}</td>
                <td><Tag tone={tone(x.status)}>{x.status}</Tag></td>
                <td>Specialist {x.writer_id}<small>{x.status==='paid'?'Recorded transfer':'Awaiting verified transfer'}</small></td>
                <td>{dateTime(x.paid_at||x.approved_at)}</td>
              </tr>)}
              {tab==='refunds'&&refunds.map(x=><tr key={x.refund_id}>
                <td><strong>{x.request_id}</strong><small>{x.refund_id}</small></td>
                <td>{minor(x.amount_minor,x.currency)}</td>
                <td><Tag tone={tone(x.status)}>{x.status}</Tag></td>
                <td>Provider reconciliation required before a final settlement claim</td>
                <td>{dateTime(x.completed_at||x.requested_at)}</td>
              </tr>)}
            </tbody>
          </table>
        </div>}
    </Panel>
    <div className="ips4-grid" style={{marginTop:20}}>
      <Panel title="Finance exceptions requiring follow-up">
        <div className="ips4-row"><strong>Pending / uncertain refunds</strong><Tag tone={counts.refunds_pending?'warn':'neutral'}>
          {feed.available?counts.refunds_pending:'—'}</Tag></div>
        <div className="ips4-row"><strong>Provider mismatches</strong><Tag tone={counts.payments_requiring_review?'danger':'neutral'}>
          {feed.available?counts.payments_requiring_review:'—'}</Tag></div>
        <div className="ips4-note info">A finance manager reviews the exact source record, traces provider evidence and records an authorized business decision. No fabricated settlement or automatic refund approval occurs here.</div>
      </Panel>
      <Panel title="Controlled financial transitions">
        {[
          ['Quotation issued','Written scope and version recorded; no money collected'],
          ['Client accepted',"A customer's explicit authorization, not settlement"],
          ['Payment verified','Only a correctly signed provider event can establish payment'],
          ['Specialist payout','Completed work and a verified settlement agreement'],
          ['Refund reviewed','Verified original payment and strict replay-safe reconciliation']
        ].map(([title,description])=><div className="ips4-row" key={title}><div>
          <strong>{title}</strong><small>{description}</small></div></div>)}
      </Panel>
    </div>
  </>;
}
