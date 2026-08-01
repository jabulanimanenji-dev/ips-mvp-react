import React, { useRef, useState } from 'react';
import { Link } from 'react-router-dom';

const initialForm = {
  full_name: '', email: '', password: '', confirm_password: '', phone: '', country: '', city: '',
  experience_level: 'entry-level', has_professional_experience: 'no', professional_title: '',
  primary_expertise: '', secondary_expertise: '', academic_level: '', years_of_experience: 0,
  services: '', skills: '', languages: '', availability: 'Flexible', portfolio_url: '',
  linkedin_url: '', bio: '', motivation: ''
};

const readFileAsDataUrl = file => new Promise((resolve, reject) => {
  const reader = new FileReader();
  reader.onload = () => resolve(reader.result);
  reader.onerror = () => reject(new Error('The CV could not be read.'));
  reader.readAsDataURL(file);
});

export default function ProviderApplicationPage() {
  const [form, setForm] = useState(initialForm);
  const [cvFile, setCvFile] = useState(null);
  const fileInput = useRef(null);
  const [state, setState] = useState({ working: false, error: '', success: false, id: '' });
  const update = event => setForm(previous => ({ ...previous, [event.target.name]: event.target.value }));

  const chooseCv = event => {
    const file = event.target.files?.[0] || null;
    if (!file) return setCvFile(null);
    const extension = file.name.toLowerCase().slice(file.name.lastIndexOf('.'));
    if (!['.pdf', '.doc', '.docx'].includes(extension)) {
      event.target.value = '';
      setCvFile(null);
      return setState(previous => ({ ...previous, error: 'CV must be a PDF, DOC or DOCX file.' }));
    }
    if (file.size > 5 * 1024 * 1024) {
      event.target.value = '';
      setCvFile(null);
      return setState(previous => ({ ...previous, error: 'CV must be 5 MB or smaller.' }));
    }
    setCvFile(file);
    setState(previous => ({ ...previous, error: '' }));
  };

  const submit = async event => {
    event.preventDefault();
    if (form.password !== form.confirm_password) {
      setState({ working: false, error: 'The passwords do not match.', success: false, id: '' });
      return;
    }
    setState({ working: true, error: '', success: false, id: '' });
    try {
      let cv = null;
      if (cvFile) {
        cv = { name: cvFile.name, size: cvFile.size, type: cvFile.type, data: await readFileAsDataUrl(cvFile) };
      }
      const { confirm_password, ...application } = form;
      const response = await fetch('/api/provider/register', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...application, has_professional_experience: application.has_professional_experience === 'yes', cv })
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Application could not be submitted.');
      setState({ working: false, error: '', success: true, id: data.application?.writer_id || '' });
      setForm(initialForm);
      setCvFile(null);
      if (fileInput.current) fileInput.current.value = '';
    } catch (error) {
      setState({ working: false, error: error.message, success: false, id: '' });
    }
  };

  if (state.success) return (
    <main className="container" style={{ padding: '5rem 1rem', maxWidth: 760 }}>
      <div className="card" style={{ textAlign: 'center', padding: '3rem' }}>
        <div className="badge badge-success">Application received</div>
        <h1 style={{ marginTop: '1rem' }}>Thank you for applying</h1>
        <p style={{ color: 'var(--text-muted)' }}>Your reference is <strong>{state.id}</strong>. IPS reviews every applicant fairly, including beginners without a professional profile or CV.</p>
        <div className="flex gap-2 justify-center" style={{ flexWrap: 'wrap', marginTop: '1.5rem' }}>
          <Link className="btn btn-primary" to="/writer/login">Provider sign in</Link>
          <Link className="btn btn-secondary" to="/">Return home</Link>
        </div>
      </div>
    </main>
  );

  const experienced = form.has_professional_experience === 'yes';
  return (
    <main className="container" style={{ padding: '3rem 1rem 5rem', maxWidth: 980 }}>
      <div style={{ textAlign: 'center', marginBottom: '2rem' }}>
        <div className="badge badge-review">Join the IPS provider network</div>
        <h1 style={{ fontSize: 'clamp(2rem, 5vw, 3.4rem)', margin: '1rem 0 .75rem' }}>Become a Service Provider</h1>
        <p style={{ color: 'var(--text-muted)', maxWidth: 760, margin: '0 auto' }}>Professional experience, a portfolio and a CV are optional. Tell us what you can do and why you want to join.</p>
      </div>
      {state.error && <div className="toast error" style={{ position: 'static', marginBottom: '1rem' }}>{state.error}</div>}
      <form className="card" onSubmit={submit}>
        <h2>Account and contact details</h2>
        <div className="provider-grid">
          <label className="form-group"><span className="form-label">Full name *</span><input className="form-input" name="full_name" value={form.full_name} onChange={update} required /></label>
          <label className="form-group"><span className="form-label">Email *</span><input className="form-input" type="email" name="email" value={form.email} onChange={update} required /></label>
          <label className="form-group"><span className="form-label">Password *</span><input className="form-input" type="password" minLength={8} name="password" value={form.password} onChange={update} required /></label>
          <label className="form-group"><span className="form-label">Confirm password *</span><input className="form-input" type="password" minLength={8} name="confirm_password" value={form.confirm_password} onChange={update} required /></label>
          <label className="form-group"><span className="form-label">Phone *</span><input className="form-input" name="phone" value={form.phone} onChange={update} required /></label>
          <label className="form-group"><span className="form-label">Country *</span><input className="form-input" name="country" value={form.country} onChange={update} required /></label>
          <label className="form-group"><span className="form-label">City</span><input className="form-input" name="city" value={form.city} onChange={update} /></label>
          <label className="form-group"><span className="form-label">Application level *</span><select className="form-select" name="experience_level" value={form.experience_level} onChange={update}><option value="entry-level">Entry-level / starting out</option><option value="student-trainee">Student or trainee</option><option value="experienced">Experienced provider</option></select></label>
        </div>

        <h2 style={{ marginTop: '1.5rem' }}>Your skills and interests</h2>
        <div className="provider-grid">
          <label className="form-group"><span className="form-label">Do you have professional experience?</span><select className="form-select" name="has_professional_experience" value={form.has_professional_experience} onChange={update}><option value="no">No, I am starting out</option><option value="yes">Yes</option></select></label>
          <label className="form-group"><span className="form-label">Area you want to work in</span><input className="form-input" name="primary_expertise" value={form.primary_expertise} onChange={update} placeholder="Writing, design, development, research…" /></label>
          <label className="form-group"><span className="form-label">Other area of interest</span><input className="form-input" name="secondary_expertise" value={form.secondary_expertise} onChange={update} /></label>
          <label className="form-group"><span className="form-label">Education or training</span><select className="form-select" name="academic_level" value={form.academic_level} onChange={update}><option value="">Prefer not to say</option><option>Secondary school</option><option>Certificate or diploma</option><option>Bachelor</option><option>Master</option><option>PhD</option><option>Professional certification</option><option>Self-taught</option></select></label>
          <label className="form-group"><span className="form-label">Services you could offer</span><input className="form-input" name="services" value={form.services} onChange={update} placeholder="Comma-separated" /></label>
          <label className="form-group"><span className="form-label">Skills</span><input className="form-input" name="skills" value={form.skills} onChange={update} placeholder="Comma-separated" /></label>
          <label className="form-group"><span className="form-label">Languages</span><input className="form-input" name="languages" value={form.languages} onChange={update} placeholder="English, Polish…" /></label>
          <label className="form-group"><span className="form-label">Availability</span><select className="form-select" name="availability" value={form.availability} onChange={update}><option>Available</option><option>Part-time</option><option>Weekends</option><option>Flexible</option></select></label>
        </div>

        <h2 style={{ marginTop: '1.5rem' }}>Optional professional information</h2>
        <p style={{ color: 'var(--text-muted)' }}>Leave this section blank when you do not yet have a professional profile.</p>
        <div className="provider-grid">
          <label className="form-group"><span className="form-label">Professional title</span><input className="form-input" name="professional_title" value={form.professional_title} onChange={update} placeholder="Designer, researcher, developer…" /></label>
          <label className="form-group"><span className="form-label">Years of experience</span><input className="form-input" type="number" min="0" max="80" name="years_of_experience" value={form.years_of_experience} onChange={update} disabled={!experienced} /></label>
          <label className="form-group"><span className="form-label">Portfolio URL</span><input className="form-input" type="url" name="portfolio_url" value={form.portfolio_url} onChange={update} /></label>
          <label className="form-group"><span className="form-label">LinkedIn URL</span><input className="form-input" type="url" name="linkedin_url" value={form.linkedin_url} onChange={update} /></label>
          <label className="form-group provider-wide"><span className="form-label">Attach CV or résumé (optional)</span><input ref={fileInput} className="form-input" type="file" accept=".pdf,.doc,.docx,application/pdf,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document" onChange={chooseCv} /><small style={{ color: 'var(--text-muted)' }}>PDF, DOC or DOCX, maximum 5 MB. You may continue without a CV.</small>{cvFile && <small><strong>Selected:</strong> {cvFile.name}</small>}</label>
          <label className="form-group provider-wide"><span className="form-label">About you</span><textarea className="form-textarea" rows="5" name="bio" value={form.bio} onChange={update} placeholder="Share relevant projects, studies, volunteer work, interests or strengths." /></label>
          <label className="form-group provider-wide"><span className="form-label">Why do you want to join IPS? *</span><textarea className="form-textarea" rows="5" name="motivation" value={form.motivation} onChange={update} required placeholder="Tell us what you hope to contribute and learn." /></label>
        </div>
        <label style={{ display: 'flex', gap: '.65rem', alignItems: 'flex-start', margin: '1rem 0' }}><input type="checkbox" required style={{ marginTop: 4 }} /><span style={{ color: 'var(--text-muted)' }}>I confirm that the information supplied is accurate and understand that submission does not guarantee approval.</span></label>
        <button className="btn btn-primary" disabled={state.working}>{state.working ? 'Submitting application…' : 'Submit provider application'}</button>
      </form>
      <style>{`.provider-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:1rem}.provider-wide{grid-column:1/-1}@media(max-width:700px){.provider-grid{grid-template-columns:1fr}.provider-wide{grid-column:auto}}`}</style>
    </main>
  );
}
