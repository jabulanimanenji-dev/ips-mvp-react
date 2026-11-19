import React, { useEffect, useState } from 'react';

export default function ChannelLinkControls(){
  const [config,setConfig]=useState(null);
  const [linked,setLinked]=useState([]);
  const [command,setCommand]=useState('');
  const [expires,setExpires]=useState('');
  const [error,setError]=useState('');
  const [busy,setBusy]=useState(false);
  const configured=Boolean(config?.telegram||config?.whatsapp);

  useEffect(()=>{
    let alive=true;
    Promise.all([fetch('/api/contact-channels/config').then(r=>r.json()),fetch('/api/contact-channels/me').then(r=>r.json())])
      .then(([a,b])=>{if(alive){setConfig(a.success?a:null);setLinked(b.success?b.contacts||[]:[]);}})
      .catch(()=>{});
    return ()=>{alive=false;};
  },[]);

  async function createCode(){
    setError('');setBusy(true);
    try{
      const response=await fetch('/api/contact-channels/link-code',{method:'POST'});
      const data=await response.json();
      if(!response.ok)throw Error(data.error||'Unable to generate a code.');
      setCommand(data.command);setExpires(data.expires_at);
    }catch(err){setError(err.message);}
    finally{setBusy(false);}
  }
  async function unlink(channel){
    setError('');
    try{
      const response=await fetch('/api/contact-channels/unlink',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({channel})});
      const data=await response.json();
      if(!response.ok)throw Error(data.error||'Unable to unlink channel.');
      setLinked(previous=>previous.filter(item=>item.channel!==channel));
    }catch(err){setError(err.message);}
  }
  return <section className="card" style={{marginTop:'1rem'}}>
    <h3>Message IPS on WhatsApp or Telegram</h3>
    <p>Optional written-only communication for updates and questions. IPS never calls you. Confidential files, quotations and payments remain in your secure IPS workspace.</p>
    <p style={{fontSize:'.83rem',color:'var(--text-muted)'}}>Telegram bots do not support end-to-end encrypted Secret Chats. WhatsApp Business may use cloud processing. Avoid sensitive files, personal research data, passwords or bank details in external chats.</p>
    {linked.length>0&&<div aria-label="Linked external channels">{linked.map(item=><div key={item.channel} style={{display:'flex',gap:12,alignItems:'center',flexWrap:'wrap',marginBottom:7}}>
      <strong>{item.channel==='telegram'?'Telegram':'WhatsApp'} account linked</strong>
      <button type="button" className="btn btn-ghost btn-sm" onClick={()=>unlink(item.channel)}>Disconnect</button>
    </div>)}</div>}
    {configured?<><div style={{display:'flex',gap:10,flexWrap:'wrap',marginBottom:12}}>
      {config.whatsapp&&<a className="btn btn-ghost" href={config.whatsapp.url} target="_blank" rel="noopener noreferrer">Open WhatsApp ↗</a>}
      {config.telegram&&<a className="btn btn-ghost" href={config.telegram.url} target="_blank" rel="noopener noreferrer">Open Telegram ↗</a>}
    </div>
      <button className="btn btn-primary" type="button" onClick={createCode} disabled={busy}>{busy?'Generating…':'Generate a one-time verification code'}</button>
      {command&&<div style={{background:'var(--bg-surface-2)',padding:16,marginTop:12,borderRadius:9}}>
        <p>Send the following command directly to IPS using either configured channel. Do not share it with anyone else.</p>
        <code style={{overflowWrap:'anywhere'}}>{command}</code>
        <button className="btn btn-ghost btn-sm" type="button" style={{marginLeft:10}} onClick={()=>navigator.clipboard?.writeText(command)}>Copy</button>
        <p><small>Expires: {new Date(expires).toLocaleTimeString()}. The code can be used once.</small></p>
      </div>}
    </>:<p role="status">External chat integration is awaiting business account verification. Use IPS Messages in the meantime.</p>}
    {error&&<p role="alert" style={{color:'var(--danger)'}}>{error}</p>}
  </section>;
}
