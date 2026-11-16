import React from 'react';
import StudentSupportPage from './StudentSupportPage.jsx';
import { Link } from 'react-router-dom';
import Hero from '../components/public/Hero';
import Services from '../components/public/Services';
import HowItWorks from '../components/public/HowItWorks';
import Pricing from '../components/public/Pricing';
import FAQ from '../components/public/FAQ';
import Testimonials from '../components/public/Testimonials';
import About from '../components/public/About';
import { useCMS } from '../context/CMSContext';

export default function HomePage() {
  const { config } = useCMS();
  if (import.meta.env.VITE_STUDENT_LAUNCH === 'true') return <StudentSupportPage />;
  const sections = {
    hero: <Hero />,
    services: <Services />,
    howItWorks: <HowItWorks />,
    pricing: <Pricing />,
    faq: <FAQ />,
    testimonials: <Testimonials />,
    about: <About />
  };

  return (
    <>
      <section className="container" style={{ padding: '1.6rem 1rem' }}>
        <div className="card" style={{ padding: '1.5rem', borderLeft: '5px solid var(--primary)', display: 'flex', alignItems: 'center', flexWrap: 'wrap', justifyContent: 'space-between', gap: '1rem' }}>
          <div><small style={{ color: 'var(--primary)', fontWeight: 800 }}>STUDENT SERVICES</small><h2 style={{ margin: '.3rem 0' }}>Assignments, theses and research projects</h2><p style={{ margin: 0 }}>Academic coaching, draft feedback, methods guidance, data support and editing.</p></div>
          <Link className="btn btn-primary" to="/student-support">Explore student support →</Link>
        </div>
      </section>
      {(config.homeSections || [])
        .filter(section => section.visible && sections[section.id])
        .sort((a, b) => a.order - b.order)
        .map(section => <div key={section.id} data-builder-section={section.id} className="builder-section-boundary">{sections[section.id]}</div>)}
    </>
  );
}
