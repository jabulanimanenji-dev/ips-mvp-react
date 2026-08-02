import React, { useMemo, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useCMS } from '../context/CMSContext';
import './service-marketplace.css';
import DynamicServiceRequestForm from '../components/public/DynamicServiceRequestForm';

export default function ServiceMarketplacePage() {
  const { user } = useAuth();
  const { config } = useCMS();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const initialFamily = searchParams.get('type') === 'odd_job' ? 'odd_job' : 'professional';
  const [family, setFamily] = useState(initialFamily);
  const categoryRecords = (config.serviceCatalog?.categories || []).filter(item => item.active && item.searchVisible !== false && item.acceptingRequests !== false && item.family === family).sort((a,b)=>a.order-b.order);
  const categories = categoryRecords.map(item => [item.name, item.description, item.icon, item.id]);
  const initialCategory = searchParams.get('category');
  const initialRecord = categoryRecords.find(item => item.id === initialCategory) || categoryRecords[0];
  const [form, setForm] = useState({ category: initialRecord?.name || '', title: '', description: '', desired_outcome: '', delivery_mode: 'remote', location: '', deadline: '', budget_min: '', budget_max: '', urgency: 'standard' });
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  const selected = useMemo(() => categories.find(item => item[0] === form.category) || categories[0], [categories, form.category]);
  const switchFamily = value => {
    setFamily(value);
    const next = (config.serviceCatalog?.categories || []).filter(item => item.active && item.searchVisible !== false && item.acceptingRequests !== false && item.family === value).sort((a,b)=>a.order-b.order);
    setForm(current => ({ ...current, category: next[0]?.name || '', delivery_mode: value === 'professional' ? 'remote' : 'in_person' }));
  };
  const submit = async event => {
    event.preventDefault();
    if (!user) return navigate('/login', { state: { returnTo: '/services' } });
    setSubmitting(true); setError('');
    try {
      const response = await fetch('/api/services', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...form, family, client_id: user.client_id, client_name: user.full_name, client_email: user.email, budget_min: Number(form.budget_min || 0), budget_max: Number(form.budget_max || 0) })
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Request could not be submitted.');
      navigate('/client/services');
    } catch (err) { setError(err.message); } finally { setSubmitting(false); }
  };

  return (
    <div className="marketplace">
      <section className="market-hero">
        <div className="market-orb market-orb-a" /><div className="market-orb market-orb-b" />
        <div className="container market-hero-grid">
          <div>
            <span className="market-kicker">IPS SERVICE MARKETPLACE</span>
            <h1>One trusted place to get <em>anything important</em> done.</h1>
            <p>From business strategy and digital work to relocation, errands and skilled local help—tell us the outcome, and we orchestrate the right people, process and proof.</p>
            <div className="market-proof"><span>Admin managed</span><span>Verified providers</span><span>Milestone tracked</span><span>Private delivery</span></div>
          </div>
          <div className="market-visual">
            <div className="market-float-card card-one"><small>ACTIVE REQUEST</small><strong>Relocation shortlist</strong><div className="mini-progress"><i /></div><span>72% complete</span></div>
            <div className="market-float-card card-two"><small>PROVIDER MATCH</small><strong>Business strategy</strong><span>Specialist assigned in 18 min</span></div>
            <div className="market-core"><span>IPS</span><strong>Concierge<br />Operations</strong></div>
          </div>
        </div>
      </section>

      <section className="container market-section">
        <div className="family-switch">
          <button className={family === 'professional' ? 'active' : ''} onClick={() => switchFamily('professional')}>Professional Services</button>
          <button className={family === 'odd_job' ? 'active' : ''} onClick={() => switchFamily('odd_job')}>Odd Jobs & Assistance</button>
        </div>
        <div className="market-heading"><div><span>CURATED CAPABILITIES</span><h2>{family === 'professional' ? 'Expertise without the overhead.' : 'Practical help, precisely coordinated.'}</h2></div><p>Select a category to shape your request. Every job is reviewed by an IPS administrator before assignment.</p></div>
        <div className="service-card-grid">
          {categories.map(([name, text, icon, id]) => <button key={id || name} className={`service-market-card ${form.category === name ? 'selected' : ''}`} onClick={() => setForm(current => ({ ...current, category: name }))}><b>{icon}</b><h3>{name}</h3><p>{text}</p><span>Explore request →</span></button>)}
        </div>
      </section>

      <section className="market-request-wrap">
        <div className="container market-request-grid">
          <div className="request-intro"><span>CONCIERGE REQUEST</span><h2>Describe the result.<br />We’ll design the route.</h2><p>Your request is privately reviewed, clarified where necessary, priced transparently and assigned to the best available provider.</p><ol><li><b>01</b> Submit your outcome</li><li><b>02</b> Review a tailored quote</li><li><b>03</b> Track delivery in your portal</li></ol></div>
          <DynamicServiceRequestForm user={user} navigate={navigate} onSubmitted={() => navigate('/client/services')} />
        </div>
      </section>
      <section className="container market-final"><span>Not sure which category fits?</span><h2>Start with the outcome. IPS handles the complexity.</h2><Link to={user ? '/client/services' : '/signup'}>{user ? 'Open my service hub' : 'Create your private account'} →</Link></section>
    </div>
  );
}
