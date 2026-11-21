import React,{useEffect,useState} from 'react';

// One source-bound private inbox for both customer and specialist workspaces.
// Role and recipient are verified on every request by the API, not by this UI.
export default function PrivateNotificationInbox({role,recipientId}){
  const [records,setRecords]=useState([]);
  const [loading,setLoading]=useState(true);
  const [error,setError]=useState('');
  const [stamp,setStamp]=useState(0);
  const [busyId,setBusyId]=useState('');
  const valid=Boolean(['client','writer'].includes(role)&&recipientId);
  const url=valid?'/api/notifications/'+encodeURIComponent(role)+'/'+encodeURIComponent(recipientId):'';

  useEffect(()=>{
    if(!valid){setRecords([]);setLoading(false);setError('');return;}
    let active=true;
    const controller=new AbortController();
    setLoading(true);setError('');
    fetch(url,{credentials:'same-origin',cache:'no-store',signal:controller.signal})
      .then(async response=>{
        const data=await response.json().catch(()=>({}));
        if(!response.ok||data.success!==true||!Array.isArray(data.notifications))
          throw Error(data.error||'Your private notifications could not be loaded.');
        return data.notifications;
      }).then(items=>{if(active)setRecords(items);})
      .catch(err=>{if(active&&err.name!=='AbortError'){setRecords([]);setError(err.message);}})
      .finally(()=>{if(active)setLoading(false);});
    return()=>{active=false;controller.abort();};
  },[url,valid,stamp]);

  async function acknowledge(item){
    if(!valid||!item?._id||busyId)return;
    setBusyId(String(item._id));setError('');
    try{
      const response=await fetch(url+'/'+encodeURIComponent(item._id)+'/read',{
        method:'PATCH',credentials:'same-origin',cache:'no-store',
        headers:{'Content-Type':'application/json'},body:'{}'
      });
      const data=await response.json().catch(()=>({}));
      if(!response.ok||data.success!==true)throw Error(data.error||'Could not acknowledge this update.');
      setRecords(old=>old.map(n=>n._id===item._id?{...n,read:true}:n));
    }catch(err){setError(err.message||'Your notification was not acknowledged.');}
    finally{setBusyId('');}
  }
  if(!valid)return null;
  const unread=records.filter(x=>!x.read).length;
  const visible=records.slice(0,12);
  return <section className="card" aria-label="My private IPS notifications" style={{marginBottom:'1.5rem'}}>
    <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',gap:12,flexWrap:'wrap'}}>
      <div><h2 style={{margin:0,fontSize:'1.25rem'}}>My private updates {unread>0?'· '+unread+' unread':''}</h2>
        <p style={{color:'var(--text-muted)',margin:'.35rem 0 .65rem'}}>Account-owned project, service and company notifications. Only you can read or acknowledge these updates.</p></div>
      <button type="button" className="btn btn-sm btn-ghost" disabled={loading}
        onClick={()=>setStamp(n=>n+1)}>Refresh updates</button>
    </div>
    {error&&<p role="alert" style={{color:'var(--danger)'}}>{error}</p>}
    {loading?<p role="status">Checking your private notifications…</p>:
      !visible.length?<p style={{color:'var(--text-muted)',margin:'1rem 0'}}>No account updates yet. New notices will appear here when IPS records them.</p>:
      <div style={{display:'grid',gap:9}} aria-live="polite">
        {visible.map(item=><div key={item._id} style={{
          padding:'12px 14px',borderRadius:10,border:'1px solid var(--border)',
          background:item.read?'transparent':'var(--bg-surface)',display:'flex',
          alignItems:'center',justifyContent:'space-between',gap:12,flexWrap:'wrap'
        }}>
          <div style={{flex:'1 1 260px'}}>
            <small style={{color:'var(--text-muted)',display:'block',marginBottom:5}}>
              {item.read?'READ':'NEW'} · {item.createdAt?new Date(item.createdAt).toLocaleString():'Recorded by IPS'}
            </small>
            <strong style={{overflowWrap:'anywhere'}}>{item.message}</strong>
            {item.order_id&&<small style={{display:'block',color:'var(--text-muted)',marginTop:5}}>
              Reference {item.order_id}</small>}
          </div>
          {!item.read&&<button type="button" className="btn btn-sm btn-ghost"
            disabled={Boolean(busyId)} onClick={()=>void acknowledge(item)}>
            {busyId===String(item._id)?'Saving…':'Mark as read'}
          </button>}
        </div>)}
      </div>}
  </section>;
}
