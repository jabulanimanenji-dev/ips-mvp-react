import React, { useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { STUDENT_OFFERS, getStudentOffer } from '../../shared/studentOffers.js';

const box = { border: '1px solid var(--border)', borderRadius: 18, padding: '1.4rem', background: 'var(--bg-card)' };

export default function StudentSupportPage() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [params, setParams] = useSearchParams();
  const offer = getStudentOffer(params.get('service')) || STUDENT_OFFERS[0];
  const [subject, setSubject] = useState('');
  const [level, setLevel] = useState('Undergraduate');
  const [deadline, setDeadline] = useState('');
  const [brief, setBrief] = useState('');
  const [working, setWorking] = useState(false);
  const [error, setError] = useState('');
  const [agree, setAgree] = useState(false);

  async function submit(event) {
    event.preventDefault();
    setError('');
    if (!user) {
      navigate('/login', { state: { returnTo: '/student-support?service=' + encodeURIComponent(offer.id) } });
      return;
    }
    if (!agree) return setError('Please confirm that this request is for legitimate academic support.');
    if (subject.trim().length < 3 || brief.trim().length < 20) return setError('Provide a subject and at least 20 characters of requirements.');
    setWorking(true);
    try {
      const response = await fetch('/api/services', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          family: 'professional', category: 'Academic Support', service_slug: offer.id,
          title: offer.title + ' — ' + subject.trim().slice(0, 100),
          description: brief.trim(), desired_outcome: offer.summary,
          delivery_mode: 'remote', deadline: deadline || undefined, urgency: 'standard',
          intake_answers: { academic_level: level, subject: subject.trim(), service: offer.id },
          budget_min: 0, budget_max: 0
        })
      });
      const result = await response.json();
      if (!response.ok || !result.request?.request_id) throw new Error(result.error || 'We could not create your request.');
      navigate('/client/services/' + encodeURIComponent(result.request.request_id));
    } catch (err) {
      setError(err.message);
    } finally {
      setWorking(false);
    }
  }

  return <main className="container" style={{ padding: '3rem 1rem 5rem', maxWidth: 1180 }}>
    <section style={{ padding: '2.5rem', borderRadius: 26, background: 'linear-gradient(135deg,#091b35,#542062)', color: '#fff', marginBottom: '2rem' }}>
      <small style={{ letterSpacing: '.12em', fontWeight: 800 }}>IPS STUDENT SUPPORT</small>
      <h1 style={{ color: '#fff', fontSize: 'clamp(2rem, 4vw, 3.4rem)', margin: '1rem 0' }}>Support for assignments, theses and research projects</h1>
      <p style={{ maxWidth: 760, color: '#eef0f7' }}>Coaching, draft feedback, research-method guidance, editing and data assistance. You remain responsible for your own assessed work.</p>
    </section>
    <h2>Choose your study support</h2>
    <div className="grid grid-3 gap-4" style={{ margin: '1rem 0 2rem' }}>
      {STUDENT_OFFERS.map(item => <button key={item.id} type="button" aria-pressed={offer.id === item.id} onClick={() => { setParams({ service: item.id }); setError(''); }} style={{ ...box, cursor: 'pointer', textAlign: 'left', border: offer.id === item.id ? '2px solid var(--primary)' : '1px solid var(--border)' }}>
        <strong style={{ fontSize: '1.1rem' }}>{item.title}</strong>
        <p style={{ color: 'var(--text-secondary)', lineHeight: 1.55 }}>{item.summary}</p>
        <span style={{ color: 'var(--primary)', fontWeight: 700 }}>Request tailored quote →</span>
      </button>)}
    </div>
    <div className="grid grid-2 gap-4">
      <section style={box}>
        <h2>What's included</h2>
        <p style={{ color: 'var(--text-secondary)' }}>{offer.questions}</p>
        <ul>{offer.deliverables.map(line => <li key={line} style={{ marginBottom: 8 }}>{line}</li>)}</ul>
        <h3>How it works</h3>
        <ol>
          <li>Choose the support and describe your requirements.</li>
          <li>Sign in, submit the request and upload relevant files in your private workspace.</li>
          <li>Review the scope, deadline and formal quotation.</li>
          <li>Accept the quote, pay securely and track your support request.</li>
          <li>Receive agreed feedback or learning materials and request an eligible revision.</li>
        </ol>
        <p style={{ fontSize: '.87rem', color: 'var(--text-secondary)' }}>Pricing is quoted after reviewing the scope. An order is not paid until the payment provider confirms it. We do not sell ready-to-submit assessed work or impersonate students.</p>
      </section>
      <section style={box}>
        <h2>Tell us what you need</h2>
        {!user ? <div><p>Sign in or create your student account before entering your requirements. Your selected service will stay available when you return.</p><Link className="btn btn-primary" to="/login" state={{ returnTo: '/student-support?service=' + encodeURIComponent(offer.id) }}>Sign in</Link> <Link className="btn btn-secondary" to="/signup" state={{ returnTo: '/student-support?service=' + encodeURIComponent(offer.id) }}>Create account</Link></div> : <form onSubmit={submit}>
          <label className="form-group"><span className="form-label">Subject or discipline *</span><input required className="form-input" value={subject} onChange={e=>setSubject(e.target.value)} placeholder="Nursing, economics, engineering…" /></label>
          <label className="form-group"><span className="form-label">Academic level *</span>
            <select className="form-select" value={level} onChange={e=>setLevel(e.target.value)}><option>Undergraduate</option><option>Master's</option><option>Doctoral</option><option>Other</option></select>
          </label>
          <label className="form-group"><span className="form-label">Requested deadline</span><input className="form-input" type="date" value={deadline} min={new Date().toISOString().slice(0,10)} onChange={e=>setDeadline(e.target.value)} /></label>
          <label className="form-group"><span className="form-label">Your requirements *</span><textarea className="form-textarea" rows={6} required minLength={20} value={brief} onChange={e=>setBrief(e.target.value)} placeholder="Explain your assignment, chapter or project and what you'd like help understanding or improving." /></label>
          <label style={{ display: 'flex', alignItems: 'start', gap: 10, margin: '1rem 0', fontSize: '.9rem' }}><input type="checkbox" checked={agree} onChange={e=>setAgree(e.target.checked)} /> I am seeking study support, feedback, editing or coaching—not work to submit falsely as my own.</label>
          {error && <p role="alert" style={{ color: 'var(--danger)' }}>{error}</p>}
          <button className="btn btn-primary w-full" type="submit" disabled={working}>{working ? 'Submitting request…' : user ? 'Submit support request' : 'Sign in to continue'}</button>
          {!user && <p style={{ marginTop: 12, fontSize: '.9rem' }}>New student? <Link to="/signup" state={{ returnTo: '/student-support?service=' + encodeURIComponent(offer.id) }}>Create an account</Link> first.</p>}
        </form>}
      </section>
    </div>
  </main>;
}
