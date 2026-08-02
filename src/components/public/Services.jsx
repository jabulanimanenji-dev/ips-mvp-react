import React, { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { useCMS } from '../../context/CMSContext';

export default function Services() {
  const { config } = useCMS();
  const catalog = config.serviceCatalog || { categories: [], services: [] };
  const categories = useMemo(() => (catalog.categories || []).filter(item => item.active && item.homepageVisible !== false).sort((a,b) => a.order-b.order), [catalog.categories]);
  const [query, setQuery] = useState('');
  const services = useMemo(() => {
    const term = query.trim().toLowerCase();
    return (catalog.services || []).filter(item => item.active && item.homepageVisible !== false && item.searchVisible !== false && item.acceptingRequests !== false && (!term || `${item.name} ${item.description}`.toLowerCase().includes(term)));
  }, [catalog.services, query]);

  return <section className="section" id="services">
    <div className="container">
      <div className="section-header">
        <div className="label">Explore IPS</div>
        <h2 className="section-title">{catalog.heading}</h2>
        <p className="section-subtitle">{catalog.subheading}</p>
      </div>
      <div style={{maxWidth:760,margin:'0 auto 2rem'}}>
        <input className="form-input" value={query} onChange={e=>setQuery(e.target.value)} placeholder={catalog.searchPlaceholder} aria-label="Search services" style={{fontSize:'1rem',padding:'1rem 1.2rem'}} />
      </div>
      {!query && <div className="grid grid-4 gap-6">
        {categories.map((category, idx) => {
          const count=(catalog.services||[]).filter(s=>s.active&&s.homepageVisible!==false&&s.acceptingRequests!==false&&s.categoryId===category.id).length;
          return <Link key={category.id} to={`/services?category=${encodeURIComponent(category.id)}`} className="card text-center animate-fade-in-up" style={{animationDelay:`${idx*.06}s`,textDecoration:'none',border:category.id==='academic'?'1px solid var(--primary)':'1px solid var(--border)'}}>
            <div style={{fontSize:'2.5rem',marginBottom:'1rem'}}>{category.icon}</div>
            {category.id==='academic' && <div className="label" style={{marginBottom:8}}>Flagship category</div>}
            <h3 style={{fontSize:'1.08rem',fontWeight:750,marginBottom:'.5rem',color:'var(--text-primary)'}}>{category.name}</h3>
            <p style={{fontSize:'.9rem',color:'var(--text-secondary)',lineHeight:1.6}}>{category.description}</p>
            <small style={{display:'block',marginTop:'1rem',color:'var(--primary)'}}>{count} services · Explore →</small>
          </Link>;
        })}
      </div>}
      {query && <div className="grid grid-3 gap-6">
        {services.map(service => <Link key={service.id} to={`/quote?service=${encodeURIComponent(service.id)}`} className="card" style={{textDecoration:'none'}}><h3>{service.name}</h3><p style={{color:'var(--text-secondary)'}}>{service.description}</p><strong style={{color:'var(--primary)'}}>Request quote →</strong></Link>)}
        {!services.length && <div className="card"><h3>No exact match yet</h3><p>Tell IPS what outcome you need and we will find the right route.</p><Link className="btn btn-primary" to="/quote">Request a custom quote</Link></div>}
      </div>}
    </div>
  </section>;
}
