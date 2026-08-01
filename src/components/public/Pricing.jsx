import React, { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { useCMS } from '../../context/CMSContext';
import { fmtCur } from '../../utils/formatters';

export default function Pricing() {
  const { config } = useCMS();
  const catalog=config.serviceCatalog||{categories:[],services:[]};
  const categories=useMemo(()=> (catalog.categories||[]).filter(c=>c.active && (catalog.services||[]).some(s=>s.active&&s.categoryId===c.id)),[catalog]);
  const [selected,setSelected]=useState(categories.find(c=>c.id==='academic')?.id || categories[0]?.id || 'academic');
  const items=(catalog.services||[]).filter(s=>s.active&&s.categoryId===selected).sort((a,b)=>Number(b.featured)-Number(a.featured)||a.order-b.order).slice(0,8);
  return <section id="pricing" className="section"><div className="container">
    <div className="section-header"><div className="label">Services & Pricing</div><h2 className="section-title">Start with academics. Explore everything IPS can deliver.</h2><p className="section-subtitle">Academic rates remain transparent. Broader professional services receive a tailored quote based on scope and deadline.</p></div>
    <div style={{display:'flex',gap:10,justifyContent:'center',flexWrap:'wrap',marginBottom:'2rem'}}>{categories.map(c=><button key={c.id} className={`btn ${selected===c.id?'btn-primary':'btn-ghost'}`} onClick={()=>setSelected(c.id)}>{c.icon} {c.shortName||c.name}</button>)}</div>
    <div className="grid grid-4 gap-6">{items.map((item,idx)=><div key={item.id} className={`card text-center animate-fade-in-up ${item.featured?'card-gradient-1':''}`} style={{animationDelay:`${idx*.06}s`}}>
      <h3 style={{fontSize:'1rem',fontWeight:750,marginBottom:'.6rem'}}>{item.name}</h3>
      <div style={{fontSize:item.startingPrice?'2rem':'1.35rem',fontWeight:800,marginBottom:'.25rem'}}>{item.startingPrice?`From ${fmtCur(item.startingPrice)}`:'Tailored quote'}</div>
      <div style={{fontSize:'.8rem',opacity:.8,marginBottom:'1rem'}}>{item.unit}</div><p style={{fontSize:'.88rem',lineHeight:1.6,marginBottom:'1.5rem'}}>{item.description}</p>
      <Link to={`/quote?service=${encodeURIComponent(item.id)}`} className={`btn w-full ${item.featured?'btn-gold':'btn-primary'}`}>Request Quote</Link>
    </div>)}</div>
    <div className="text-center" style={{marginTop:'2rem'}}><Link to="/services" className="btn btn-ghost">Explore all service categories</Link></div>
  </div></section>;
}
