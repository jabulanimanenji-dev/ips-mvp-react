import React, { useEffect, useMemo, useState } from 'react';

const inputType = type => ({ email: 'email', phone: 'tel', url: 'url', number: 'number', currency: 'number', date: 'date', time: 'time', datetime: 'datetime-local' }[type] || 'text');
const hasAnswer = value => Array.isArray(value) ? value.length > 0 : value !== '' && value != null && value !== false;
const visible = (question, answers) => {
  if (!question?.condition?.enabled) return true;
  const actual = answers[question.condition.questionId]; const expected = question.condition.value;
  switch (question.condition.operator) {
    case 'equals': return String(actual ?? '') === String(expected ?? '');
    case 'not_equals': return String(actual ?? '') !== String(expected ?? '');
    case 'contains': return Array.isArray(actual) ? actual.map(String).includes(String(expected)) : String(actual ?? '').includes(String(expected ?? ''));
    case 'not_contains': return Array.isArray(actual) ? !actual.map(String).includes(String(expected)) : !String(actual ?? '').includes(String(expected ?? ''));
    case 'greater_than': return Number(actual) > Number(expected);
    case 'less_than': return Number(actual) < Number(expected);
    case 'is_answered': case 'is_not_empty': return hasAnswer(actual);
    case 'is_not_answered': case 'is_empty': return !hasAnswer(actual);
    default: return true;
  }
};

function Field({ question, value, error, onChange }) {
  if (question.type === 'heading') return <h4 className="dynamic-form-heading">{question.label}</h4>;
  if (question.type === 'paragraph') return <p className="dynamic-form-copy">{question.helpText || question.label}</p>;
  const common = { id: question.id, required: question.required, value: value ?? '', placeholder: question.placeholder || '', onChange: e => onChange(e.target.value) };
  let control;
  if (question.type === 'long_text') control = <textarea {...common} />;
  else if (question.type === 'select' || question.type === 'radio') control = <select {...common}><option value="">Select…</option>{question.options?.map(option => <option key={option.value} value={option.value}>{option.label}</option>)}</select>;
  else if (question.type === 'boolean') control = <select {...common}><option value="">Select…</option><option value="yes">Yes</option><option value="no">No</option></select>;
  else if (question.type === 'checkbox' || question.type === 'multi_select') {
    const chosen = Array.isArray(value) ? value : [];
    control = <div className="dynamic-choice-list">{question.options?.map(option => <label key={option.value}><input type="checkbox" checked={chosen.includes(option.value)} onChange={e => onChange(e.target.checked ? [...chosen, option.value] : chosen.filter(item => item !== option.value))} /> {option.label}</label>)}</div>;
  } else if (question.type === 'file' || question.type === 'image') control = <input type="file" accept={question.upload?.accept || (question.type === 'image' ? 'image/*' : undefined)} multiple={(question.upload?.maxFiles || 1) > 1} onChange={e => onChange([...e.target.files].map(file => ({ name: file.name, size: file.size, type: file.type })))} />;
  else control = <input {...common} type={inputType(question.type)} min={question.validation?.min} max={question.validation?.max} minLength={question.validation?.minLength} maxLength={question.validation?.maxLength} />;
  return <label className="dynamic-field" htmlFor={question.id}><span>{question.label}{question.required ? ' *' : ''}</span>{question.helpText && <small>{question.helpText}</small>}{control}{error && <b className="dynamic-field-error">{error}</b>}</label>;
}

export default function DynamicServiceRequestForm({ user, navigate, onSubmitted }) {
  const [catalog, setCatalog] = useState({ categories: [], services: [] });
  const [serviceSlug, setServiceSlug] = useState(''); const [runtime, setRuntime] = useState(null);
  const [answers, setAnswers] = useState({}); const [step, setStep] = useState(1); const [fieldErrors, setFieldErrors] = useState({});
  const [meta, setMeta] = useState({ title: '', description: '', deadline: '', location: '', delivery_mode: 'remote', urgency: 'standard', budget_min: '', budget_max: '' });
  const [loading, setLoading] = useState(true); const [submitting, setSubmitting] = useState(false); const [error, setError] = useState('');
  useEffect(() => { fetch('/api/service-catalog').then(r => r.json()).then(data => { const next = data.catalog || { categories: [], services: [] }; setCatalog(next); const first = next.services?.find(item => item.effectiveToggles?.acceptingRequests !== false); if (first) setServiceSlug(first.slug); }).catch(() => {}).finally(() => setLoading(false)); }, []);
  useEffect(() => { if (!serviceSlug) return setRuntime(null); setLoading(true); fetch(`/api/service-catalog/${encodeURIComponent(serviceSlug)}/runtime`).then(async r => { const data = await r.json(); if (!r.ok) throw new Error(data.error); return data; }).then(data => { setRuntime(data.runtime); setAnswers({}); setStep(1); setMeta(current => ({ ...current, title: data.runtime.service.name, description: `Request for ${data.runtime.service.name}` })); setError(''); }).catch(err => { setRuntime(null); setError(err.message); }).finally(() => setLoading(false)); }, [serviceSlug]);
  const steps = useMemo(() => runtime?.steps?.length ? [...runtime.steps].sort((a,b)=>a.order-b.order) : [{ id: 'step-1', title: 'Your request', order: 0 }], [runtime]);
  const questions = useMemo(() => (runtime?.questions || []).filter(q => visible(q, answers)), [runtime, answers]);
  const currentQuestions = questions.filter(q => Number(q.step || 1) === step);
  const validateStep = () => { const errors = {}; currentQuestions.forEach(q => { if (q.required && !['heading','paragraph'].includes(q.type) && !hasAnswer(answers[q.id])) errors[q.id] = `${q.label} is required.`; }); setFieldErrors(errors); return !Object.keys(errors).length; };
  const submit = async event => { event.preventDefault(); if (!user) return navigate('/login', { state: { returnTo: '/services' } }); if (!validateStep()) return; if (step < steps.length) return setStep(value => value + 1); setSubmitting(true); setError(''); try { const response = await fetch(`/api/service-catalog/${encodeURIComponent(serviceSlug)}/requests`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ ...meta, budget_min: Number(meta.budget_min || 0), budget_max: Number(meta.budget_max || 0), answers }) }); const data = await response.json(); if (!response.ok) { setFieldErrors(data.fieldErrors || {}); throw new Error(data.error || 'Request could not be submitted.'); } onSubmitted?.(data.request); } catch (err) { setError(err.message); } finally { setSubmitting(false); } };
  if (!catalog.services?.length && !loading) return null;
  return <form className="market-form dynamic-service-form" onSubmit={submit}>
    <div className="market-form-top"><div><small>UNIVERSAL SERVICE ENGINE</small><h3>{runtime?.service?.name || 'Choose a service'}</h3></div></div>
    <label>Service<select value={serviceSlug} onChange={e => setServiceSlug(e.target.value)}><option value="">Choose a service</option>{catalog.services?.filter(item => item.effectiveToggles?.acceptingRequests !== false).map(item => <option key={item.serviceId || item.slug} value={item.slug}>{item.name}</option>)}</select></label>
    {runtime && <><div className="dynamic-stepbar">{steps.map((item,index) => <span key={item.id} className={step === index + 1 ? 'active' : step > index + 1 ? 'done' : ''}>{index + 1}. {item.title}</span>)}</div>
      {step === 1 && <><label>Request title<input required value={meta.title} onChange={e => setMeta({ ...meta, title: e.target.value })} /></label><label>Brief description<textarea required value={meta.description} onChange={e => setMeta({ ...meta, description: e.target.value })} /></label></>}
      {currentQuestions.map(question => <Field key={question.id} question={question} value={answers[question.id]} error={fieldErrors[question.id]} onChange={value => setAnswers(current => ({ ...current, [question.id]: value }))} />)}
      {step === steps.length && <div className="market-form-row"><label>Deadline<input type="date" value={meta.deadline} onChange={e => setMeta({ ...meta, deadline: e.target.value })} /></label><label>Location<input value={meta.location} onChange={e => setMeta({ ...meta, location: e.target.value })} /></label></div>}
      {error && <div className="market-error">{error}</div>}<div className="dynamic-form-actions">{step > 1 && <button type="button" onClick={() => setStep(value => value - 1)}>Back</button>}<button className="market-submit" disabled={submitting || loading}>{submitting ? 'Submitting…' : step < steps.length ? 'Continue →' : user ? 'Submit private request →' : 'Sign in to submit →'}</button></div></>}
  </form>;
}
