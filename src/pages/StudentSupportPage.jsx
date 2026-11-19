import React, { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { STUDENT_DEPARTMENTS, STUDENT_OFFERS, getStudentOffer } from '../../shared/studentOffers.js';
import './student-support.css';
import ContactOptions from '../components/public/ContactOptions.jsx';
import QuoteRequestForm from '../components/public/QuoteRequestForm.jsx';

const photos = Object.freeze({
  hero: 'https://images.unsplash.com/photo-1758270705317-3ef6142d306f?auto=format&fit=crop&w=1300&q=82',
  library: 'https://images.unsplash.com/photo-1741699427799-3fbb70fce948?auto=format&fit=crop&w=1200&q=78',
  research: 'https://images.unsplash.com/photo-1776571661811-c311d42634d9?auto=format&fit=crop&w=950&q=78',
  collaboration: 'https://images.unsplash.com/photo-1758691737467-fe12934ddc58?auto=format&fit=crop&w=1200&q=78'
});
const subjects = ['Nursing & Health Sciences', 'Economics & Finance', 'Business & Management', 'Computer Science', 'Engineering & Technology', 'Social Sciences', 'Education & Psychology', 'Humanities & Languages', 'Law & Public Policy', 'Natural Sciences', 'Other disciplines'];
const faqs = [
  ['Can I request help on a full thesis or large project?', 'Yes. You can request an extended support plan covering the complete research journey, or comprehensive editing, formatting and analysis assistance. Your assessed academic work must remain your own. We review the brief and agree the permitted deliverables privately.'],
  ['How much does academic support cost?', 'Pricing depends on the type of support, subject, length, complexity and deadline. Submit a free request and review the itemized quotation before deciding whether to pay.'],
  ['How long does IPS take to reply?', 'IPS confirms a successfully submitted request immediately, but a person must review your requirements before preparing a quotation. Review times depend on staffing and complexity. We do not promise an instant price or a fixed turnaround unless IPS gives you a specific written update time. Use your selected verified contact method for updates.'],
  ['Who will support my project?', 'Requests are reviewed and scoped before any work is assigned. The specialist and review arrangement depends on the discipline and verified availability. We will not imply a named expert is assigned until that is confirmed.'],
  ['Can I share my assignment instructions or existing draft?', 'Yes. After submitting a request you can use your private workspace and its controlled file-upload functionality. Do not upload personal information or research participant data unless its handling has been agreed.'],
  ['Can someone complete my graded work for me?', 'IPS provides coaching, consultation, editorial work, data services and independently commissioned deliverables where appropriate. We do not offer work intended to be falsely submitted as your own assessed assignment or thesis.'],
  ['How do payment and delivery work?', 'An administrator reviews your scope and issues a quotation. You decide whether to accept; the payment provider confirms a successful transaction. Agreed deliverables and updates then appear in your private workspace.']
];
const subjectIcons = ['✦','◇','◈','⌘','⌁','◉','✧','▦','◊','∿','＋'];

function SectionTitle({ eyebrow, title, copy, inverse = false }) {
  return <div className={'ipsa-section-head' + (inverse ? ' ipsa-inverse' : '')}>
    <span className="ipsa-eyebrow">{eyebrow}</span>
    <h2>{title}</h2>
    {copy && <p>{copy}</p>}
  </div>;
}

export default function StudentSupportPage() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [params, setParams] = useSearchParams();
  const offer = getStudentOffer(params.get('service')) || STUDENT_OFFERS[0];
  const [department, setDepartment] = useState('all');
  const [search, setSearch] = useState('');
  const [subject, setSubject] = useState('');
  const [level, setLevel] = useState('Undergraduate');
  const [deadline, setDeadline] = useState('');
  const [brief, setBrief] = useState('');
  const [working, setWorking] = useState(false);
  const [error, setError] = useState('');
  const [agree, setAgree] = useState(false);
  const [notice, setNotice] = useState('');

  const visibleOffers = useMemo(() => {
    const q = search.trim().toLowerCase();
    return STUDENT_OFFERS.filter(item => (department === 'all' || item.department === department) &&
      (!q || [item.title, item.summary, item.short, item.department, ...item.deliverables].join(' ').toLowerCase().includes(q)));
  }, [department, search]);

  const select = (id, jump = false) => {
    if (!getStudentOffer(id)) return;
    setParams({ service: id });
    setError('');
    if (jump) window.requestAnimationFrame(() => document.getElementById('request-support')?.scrollIntoView({ behavior: 'smooth', block: 'start' }));
  };
  useEffect(() => {
    const hash = window.location.hash;
    if (hash && /^#[a-z-]+$/.test(hash)) {
      const task = setTimeout(() => document.querySelector(hash)?.scrollIntoView({ block: 'start' }), 60);
      return () => clearTimeout(task);
    }
  }, []);

  async function submit(event) {
    event.preventDefault();
    setError(''); setNotice('');
    if (!user) {
      navigate('/login', { state: { returnTo: '/student-support?service=' + encodeURIComponent(offer.id) } });
      return;
    }
    if (!agree) return setError('Confirm that your request is for permitted academic assistance.');
    if (subject.trim().length < 3 || brief.trim().length < 20) return setError('Add a subject and at least 20 characters describing your request.');
    setWorking(true);
    try {
      const response = await fetch('/api/services', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
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
      if (!response.ok || !result.request?.request_id) throw new Error(result.error || 'Your request could not be saved.');
      setNotice('Request created. Opening your private workspace.');
      navigate('/client/services/' + encodeURIComponent(result.request.request_id));
    } catch (err) { setError(err.message); }
    finally { setWorking(false); }
  }

  return <div className="ipsa">
    {import.meta.env.VITE_DESIGN_PREVIEW === 'true' && <div role="status" style={{ background: '#fff0c9', color: '#44331b', textAlign: 'center', padding: '10px 16px', fontSize: '.82rem', fontWeight: 650 }}>
      Website design preview — service search and navigation are interactive; accounts, actual orders and payments are not connected here.
    </div>}
    <section className="ipsa-hero" id="top">
      <div className="ipsa-hero-copy">
        <div className="ipsa-kicker"><span className="ipsa-kicker-dot" /> ACADEMIC SERVICES · PERSONALIZED SUPPORT</div>
        <h1>Exceptional academic work starts with <em>the right guidance.</em></h1>
        <p>Assignments, dissertations, research projects, academic editing and data analysis — structured support for every stage of your academic journey.</p>
        <div className="ipsa-hero-actions">
          <a className="ipsa-btn ipsa-btn-gold" href="/#services">Explore academic services <span aria-hidden="true">↗</span></a>
          <a className="ipsa-btn ipsa-btn-outline-light" href="/#request-support">Get a Quote <span aria-hidden="true">→</span></a>
        </div>
        <div className="ipsa-hero-trust" aria-label="Service principles">
          <span><b>01</b> Dedicated project workspace</span>
          <span><b>02</b> Individual scope & quotation</span>
          <span><b>03</b> Documented review process</span>
        </div>
      </div>
      <div className="ipsa-hero-media">
        <img src={photos.hero} alt="University students collaborating around a laptop" fetchPriority="high" />
        <div className="ipsa-hero-media-overlay"/>
        <div className="ipsa-hero-media-tag"><span className="ipsa-tag-icon">✧</span><div><strong>Built around your academic goals</strong><small>From coursework to research milestones</small></div></div>
      </div>
    </section>

    <section className="ipsa-intro-strip" aria-label="Key service assurances">
      <div className="ipsa-wrap ipsa-intro-inner">
        <div><span className="ipsa-intro-symbol">◈</span><p><strong>Discipline-aware</strong><small>Help tailored to subject and study level</small></p></div>
        <div><span className="ipsa-intro-symbol">▤</span><p><strong>Clear project structure</strong><small>Requirements, quotations and milestones</small></p></div>
        <div><span className="ipsa-intro-symbol">⌁</span><p><strong>Private workspace</strong><small>Files, messages and agreed deliveries</small></p></div>
        <div><span className="ipsa-intro-symbol">◎</span><p><strong>Transparent process</strong><small>Review scope before making a payment</small></p></div>
      </div>
    </section>

    <section className="ipsa-section ipsa-catalogue" id="services">
      <div className="ipsa-wrap">
        <div className="ipsa-section-title-row">
          <SectionTitle eyebrow="OUR ACADEMIC PRACTICE" title={<>Whatever the academic challenge, <em>find your next step.</em></>} copy="Explore focused support across coursework, research, data, editing and presentation. Every service begins with a clear, individually reviewed request." />
          <a href="/#request-support" className="ipsa-simple-link">Not sure where to start? <span>↗</span></a>
        </div>
        <div className="ipsa-feature-grid">
          <article className="ipsa-feature ipsa-feature-primary">
            <img src={photos.library} alt="Student working in a historic university library" loading="lazy" />
            <div className="ipsa-feature-shade" />
            <div className="ipsa-feature-text"><span className="ipsa-feature-label">01 / RESEARCH & WRITING</span><h3>Theses & dissertations</h3><p>Research planning, chapter support, methodology coaching and comprehensive editing.</p><button type="button" onClick={() => select('thesis-support', true)}>Explore this service <span>↗</span></button></div>
          </article>
          <article className="ipsa-feature ipsa-feature-secondary">
            <div className="ipsa-feature-top"><span>02 / COURSEWORK</span><span className="ipsa-feature-stamp">IPS <small>ACADEMIC</small></span></div>
            <h3>Clarity for your assignments.</h3><p>Work through your brief, improve your drafts and build stronger academic arguments.</p>
            <button type="button" onClick={() => select('assignment-support', true)}>View assignment support <span>↗</span></button>
            <div className="ipsa-feature-art" aria-hidden="true"><div className="ipsa-paper"><span /><span /><span /><span /></div><div className="ipsa-art-circle">✳</div></div>
          </article>
          <article className="ipsa-feature ipsa-feature-tertiary">
            <img src={photos.research} alt="Students studying together in a university library" loading="lazy" />
            <div><span>03 / METHODS & DATA</span><h3>Research that makes sense.</h3><p>Statistical consultation, data organization and interpretation support.</p><button type="button" onClick={() => select('statistics-support', true)}>Explore research support <span>↗</span></button></div>
          </article>
        </div>
        <div className="ipsa-explore-head">
          <div><span className="ipsa-eyebrow">EXPLORE THE FULL CATALOGUE</span><h3>Find the support you need.</h3></div>
          <label className="ipsa-search"><span className="ipsa-search-symbol" aria-hidden="true">⌕</span><span className="ipsa-sr-only">Search services</span><input type="search" placeholder="Search services, topics, methods…" value={search} onChange={e=>setSearch(e.target.value)} /></label>
        </div>
        <div className="ipsa-tabs" role="group" aria-label="Filter by academic department">
          {STUDENT_DEPARTMENTS.map(item=><button key={item.id} type="button" className={department===item.id?'ipsa-tab ipsa-tab-active':'ipsa-tab'} aria-pressed={department===item.id} onClick={()=>setDepartment(item.id)}>{item.label}</button>)}
        </div>
        <div className="ipsa-offer-count" role="status">{visibleOffers.length} service{visibleOffers.length===1?'':'s'} available to explore</div>
        <div className="ipsa-service-grid">
          {visibleOffers.map((item,i) => <article className="ipsa-service-card" key={item.id}>
            <div className="ipsa-service-number">{String(i+1).padStart(2,'0')} <span>↗</span></div>
            <h4>{item.title}</h4><p>{item.short}</p>
            <button type="button" aria-label={'Request '+item.title} onClick={() => select(item.id,true)}>Explore service <span aria-hidden="true">↗</span></button>
          </article>)}
        </div>
        {!visibleOffers.length && <div className="ipsa-empty"><h4>No exact matches</h4><p>Try a different keyword or browse all our services.</p><button type="button" onClick={()=>{setSearch('');setDepartment('all');}}>Show all services</button></div>}
      </div>
    </section>

    <section className="ipsa-disciplines" id="disciplines">
      <div className="ipsa-wrap ipsa-disciplines-grid">
        <div className="ipsa-disciplines-intro">
          <SectionTitle eyebrow="ACROSS DISCIPLINES" title={<>Every discipline is different. <em>So is the support.</em></>} copy="From health sciences to engineering, we begin with your field, study level and institutional requirements. Availability and specialist fit are confirmed during review." />
          <a className="ipsa-btn ipsa-btn-dark" href="/#request-support">Discuss your subject <span>↗</span></a>
        </div>
        <div className="ipsa-subject-list">
          {subjects.map((sub,i)=><button type="button" key={sub} onClick={()=>{setSubject(sub);document.getElementById('request-support')?.scrollIntoView({behavior:'smooth'});}}>
            <span className="ipsa-subject-glyph">{subjectIcons[i]}</span><span>{sub}</span><span className="ipsa-subject-arrow">↗</span>
          </button>)}
        </div>
      </div>
    </section>

    <section className="ipsa-section ipsa-people" id="approach">
      <div className="ipsa-wrap ipsa-people-layout">
        <div className="ipsa-people-media">
          <img src={photos.collaboration} alt="Professionals collaborating at a computer in an illustrative workplace photograph" loading="lazy"/>
          <div className="ipsa-media-caption">Illustrative photography — not IPS personnel</div>
        </div>
        <div className="ipsa-people-content">
          <SectionTitle eyebrow="A COORDINATED APPROACH" title={<>Good academic support is <em>thoughtfully organized.</em></>} copy="Different requests need different skills. Rather than assuming every project is the same, we build the workflow around what the work actually requires." />
          <div className="ipsa-role-list">
            <div><span>01</span><p><strong>Intake & scope review</strong><small>Clarify the brief, requirements, boundaries and quotation.</small></p></div>
            <div><span>02</span><p><strong>Subject-matched consultation</strong><small>Determine the relevant disciplinary knowledge and available support.</small></p></div>
            <div><span>03</span><p><strong>Methods or editorial review</strong><small>Apply the appropriate checks to the agreed coaching or deliverables.</small></p></div>
            <div><span>04</span><p><strong>Client delivery & follow-up</strong><small>Use the workspace to share outcomes and manage agreed revisions.</small></p></div>
          </div>
          <p className="ipsa-honesty">This describes the service workflow, not a claim that every role is currently staffed by a separate person. Individual expertise and availability are confirmed before assignment.</p>
        </div>
      </div>
    </section>

    <section className="ipsa-process" id="how-it-works">
      <div className="ipsa-wrap">
        <SectionTitle inverse eyebrow="SIMPLE & TRANSPARENT" title={<>From first question to <em>finished support.</em></>} copy="Know what happens next, what you're paying for, and where to find your project updates." />
        <div className="ipsa-process-grid">
          {[
            ['01','Tell us what you need','Choose a service, describe the brief and share your academic stage.'],
            ['02','We review your request','Your requirements and available support are assessed before a quotation is issued.'],
            ['03','Approve the scope & pay','Accept the quote and complete secure checkout once payment is configured.'],
            ['04','Follow your project','Use the private workspace for messages, relevant files, progress and delivery.']
          ].map(row => <article key={row[0]}><span>{row[0]}</span><div className="ipsa-process-rule"/><h3>{row[1]}</h3><p>{row[2]}</p></article>)}
        </div>
      </div>
    </section>

    <section className="ipsa-section ipsa-request-section" id="request-support">
      <div className="ipsa-wrap ipsa-request-grid">
        <div className="ipsa-request-intro">
          <SectionTitle eyebrow="START HERE" title={<>Request support with <em>confidence.</em></>} copy="Describe your requirements without sharing your legal name. Choose how IPS contacts you in writing after reviewing your request; no calls or payment are required."/>
          <div className="ipsa-request-assurances"><p><span>✓</span> No compulsory legal name</p><p><span>✓</span> Choose written email, workspace or messaging contact</p><p><span>✓</span> No calls, marketing consent or upfront payment</p></div>
          <div className="ipsa-request-photo"><img src={photos.library} alt="Quiet university library study space" loading="lazy" /></div>
        </div>
        <div className="ipsa-request-card">
          <div className="ipsa-request-header"><span>CONFIDENTIAL QUOTATION REQUEST</span><h3>Your work, your choice.</h3><p>Choose your support and preferred written contact method.</p></div>
          <QuoteRequestForm selectedService={offer.id}/>
        </div>
      </div>
    </section>

    <ContactOptions />
    <section className="ipsa-section ipsa-privacy" id="privacy" aria-labelledby="ipsa-privacy-heading">
      <div className="ipsa-wrap ipsa-privacy-grid">
        <div>
          <span className="ipsa-eyebrow">PRIVACY & CONFIDENTIALITY</span>
          <h2 id="ipsa-privacy-heading">Your academic work deserves <em>discretion.</em></h2>
          <p>IPS does not ask Students / Researchers for a legal name to browse services, create an account or request a quote. Choose your own username instead.</p>
          <p>We collect the request details and contact method you choose, and restrict project access to authorized IPS personnel and specialists assigned to the work. No academic information is published as a testimonial or portfolio without separate permission.</p>
        </div>
        <div className="ipsa-privacy-points">
          <article><strong>Only the details we need</strong><p>No compulsory legal name, institution or phone number for ordinary enquiries. Relevant billing details may be requested only when an agreed paid engagement requires them.</p></article>
          <article><strong>Written communication, your choice</strong><p>Choose email, private IPS workspace or a connected messaging channel. IPS makes no telephone or voice calls. We never silently change your contact preference.</p></article>
          <article><strong>Understand messenger limits</strong><p>Telegram bot chats are not end-to-end encrypted Secret Chats. Ordinary email and business messaging have different confidentiality limits. Keep confidential documents and research participant data in your secure workspace.</p></article>
          <article><strong>Control of your records</strong><p>Unverified guest requests are scheduled to expire after 30 days. Once contact is verified, record retention follows the service and legal requirements; ask IPS for details or request deletion where applicable. Contact IPS to request access, correction or appropriate deletion.</p></article>
        </div>
      </div>
      <div className="ipsa-wrap ipsa-privacy-end">Questions about confidentiality? <a href="mailto:privacy@ipsglobalservice.com">Email our privacy team</a>. We do not sell customer information or use quotation details for marketing without separate permission.</div>
    </section>
    <section className="ipsa-section ipsa-faq" id="questions">
      <div className="ipsa-wrap ipsa-faq-layout"><SectionTitle eyebrow="BEFORE YOU BEGIN" title={<>Your questions, <em>answered.</em></>} copy="Straightforward answers about services, privacy, academic integrity and the process."/>
        <div className="ipsa-faq-list">{faqs.map(([q,a])=><details key={q}><summary>{q}<span aria-hidden="true">＋</span></summary><p>{a}</p></details>)}</div>
      </div>
    </section>
    <section className="ipsa-final-cta"><div className="ipsa-wrap"><div><span>READY WHEN YOU ARE</span><h2>Let's make the next chapter <em>more manageable.</em></h2><p>Get a tailored academic-support quotation with a clear scope and timeline.</p></div><a className="ipsa-btn ipsa-btn-gold" href="/#request-support">Start your request <span>↗</span></a></div></section>
  </div>;
}
