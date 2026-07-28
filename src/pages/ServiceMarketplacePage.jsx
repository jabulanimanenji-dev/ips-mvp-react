import React, { useMemo, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import './service-marketplace.css';

const professional = [
  ['Business & Admin', 'Plans, proposals, research, virtual assistance', '◆'],
  ['Career Studio', 'CVs, cover letters, LinkedIn and interviews', '↗'],
  ['Writing & Editing', 'Editing, web copy, technical and creative work', '✦'],
  ['Research & Data', 'Research, analysis, reports and visualization', '⌁'],
  ['Design & Digital', 'Branding, presentations, websites and content', '◈'],
  ['Technology Support', 'Setup, troubleshooting, automation and data', '⌘']
];
const oddJobs = [
  ['Accommodation & Relocation', 'Property searches, viewing coordination and moving', '⌂'],
  ['Personal Administration', 'Appointments, forms, travel and reservations', '✓'],
  ['Local Errands', 'Collection, delivery, printing and local assistance', '→'],
  ['Events & Personal Support', 'Venues, vendors, itineraries and planning', '✺'],
  ['Remote Assistance', 'Research, purchasing, accounts and organization', '◎'],
  ['Skilled Local Tasks', 'Verified cleaning, assembly, repairs and tutoring', '◇']
];

export default function ServiceMarketplacePage() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const initialFamily = searchParams.get('type') === 'odd_job' ? 'odd_job' : 'professional';
  const [family, setFamily] = useState(initialFamily);
  const categories = family === 'professional' ? professional : oddJobs;
  const [form, setForm] = useState({ category: categories[0][0], title: '', description: '', desired_outcome: '', delivery_mode: 'remote', location: '', deadline: '', budget_min: '', budget_max: '', urgency: 'standard' });
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  const selected = useMemo(() => categories.find(item => item[0] === form.category) || categories[0], [categories, form.category]);
  const switchFamily = value => {
    setFamily(value);
    const next = value === 'professional' ? professional : oddJobs;
    setForm(current => ({ ...current, category: next[0][0], delivery_mode: value === 'professional' ? 'remote' : 'in_person' }));
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
          {categories.map(([name, text, icon]) => <button key={name} className={`service-market-card ${form.category === name ? 'selected' : ''}`} onClick={() => setForm(current => ({ ...current, category: name }))}><b>{icon}</b><h3>{name}</h3><p>{text}</p><span>Explore request →</span></button>)}
        </div>
      </section>

      <section className="market-request-wrap">
        <div className="container market-request-grid">
          <div className="request-intro"><span>CONCIERGE REQUEST</span><h2>Describe the result.<br />We’ll design the route.</h2><p>Your request is privately reviewed, clarified where necessary, priced transparently and assigned to the best available provider.</p><ol><li><b>01</b> Submit your outcome</li><li><b>02</b> Review a tailored quote</li><li><b>03</b> Track delivery in your portal</li></ol></div>
          <form className="market-form" onSubmit={submit}>
            <div className="market-form-top"><div className="service-symbol">{selected[2]}</div><div><small>{family === 'professional' ? 'PROFESSIONAL SERVICE' : 'ODD JOB'}</small><h3>{selected[0]}</h3></div></div>
            <label>What do you need?<input required value={form.title} onChange={e => setForm({ ...form, title: e.target.value })} placeholder="Give your request a clear title" /></label>
            <label>Brief and context<textarea required value={form.description} onChange={e => setForm({ ...form, description: e.target.value })} placeholder="What needs to happen? Include the important details." /></label>
            <label>Successful outcome<textarea value={form.desired_outcome} onChange={e => setForm({ ...form, desired_outcome: e.target.value })} placeholder="What should a successful result look like?" /></label>
            <div className="market-form-row"><label>Delivery<select value={form.delivery_mode} onChange={e => setForm({ ...form, delivery_mode: e.target.value })}><option value="remote">Remote</option><option value="in_person">In person</option><option value="hybrid">Hybrid</option></select></label><label>Urgency<select value={form.urgency} onChange={e => setForm({ ...form, urgency: e.target.value })}><option value="standard">Standard</option><option value="priority">Priority</option><option value="urgent">Urgent</option></select></label></div>
            <div className="market-form-row"><label>Location<input value={form.location} onChange={e => setForm({ ...form, location: e.target.value })} placeholder="City or remote" /></label><label>Deadline<input type="date" value={form.deadline} onChange={e => setForm({ ...form, deadline: e.target.value })} /></label></div>
            <div className="market-form-row"><label>Budget from<input type="number" value={form.budget_min} onChange={e => setForm({ ...form, budget_min: e.target.value })} placeholder="$0" /></label><label>Budget to<input type="number" value={form.budget_max} onChange={e => setForm({ ...form, budget_max: e.target.value })} placeholder="$500" /></label></div>
            {error && <div className="market-error">{error}</div>}
            <button className="market-submit" disabled={submitting}>{submitting ? 'Submitting securely…' : user ? 'Submit private request →' : 'Sign in to submit →'}</button>
            <small className="market-fine">No payment is taken now. An administrator reviews every request before quoting.</small>
          </form>
        </div>
      </section>
      <section className="container market-final"><span>Not sure which category fits?</span><h2>Start with the outcome. IPS handles the complexity.</h2><Link to={user ? '/client/services' : '/signup'}>{user ? 'Open my service hub' : 'Create your private account'} →</Link></section>
    </div>
  );
}
