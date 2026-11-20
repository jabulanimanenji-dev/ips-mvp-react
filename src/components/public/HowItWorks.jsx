import React from 'react';
import { useCMS } from '../../context/CMSContext';

const STEPS = [
  {
    number: '01',
    title: 'Request a Private Quote',
    description: 'Tell IPS what kind of support you need and select a private written contact channel. Requests enter a human review queue.'
  },
  {
    number: '02',
    title: 'Review & Confirm',
    description: 'Receive an itemized scope and quotation after review. Online payments are not yet active; no money is collected through this portal.'
  },
  {
    number: '03',
    title: 'Follow Your Project',
    description: 'After service authorization, follow messages, milestones, document review and specialist work in your protected workspace.'
  },
  {
    number: '04',
    title: 'Receive & Review',
    description: 'Check the agreed consultation or deliverables and request eligible revisions. Academic submissions must follow institutional rules.'
  }
];
const unsafeLegacy=/within hours|pay the deposit|begin immediately|certificate of ownership transfer|publish it as your own/i;
export default function HowItWorks() {
  const { cms } = useCMS();
  const process = cms?.process || {};
  const steps = (Array.isArray(process.steps)&&process.steps.length?process.steps:STEPS)
    .map((step,i)=>{
      const fallback=STEPS[i]||STEPS[STEPS.length-1];
      return unsafeLegacy.test(String(step?.description||''))
        ? {...step,title:fallback.title,description:fallback.description}
        : step;
    });
  return (
    <section className="section" style={{ background: 'var(--bg-surface)' }}>
      <div className="container">
        <div className="section-header">
          <div className="label">{process.label || 'The Process'}</div>
          <h2 className="section-title">{process.headline || 'How It Works'}</h2>
          <p className="section-subtitle">
            {process.subheadline || 'A clear, centrally managed process from first enquiry through review and approved service delivery.'}
          </p>
        </div>
        <div className="grid grid-4 gap-6">
          {steps.map((step, idx) => (
            <div key={idx} className="card text-center animate-fade-in-up" style={{ animationDelay: `${idx * 0.1}s` }}>
              <div style={{
                width:48,height:48,borderRadius:'var(--radius-md)',
                background:'#183b53',color:'#fff',display:'inline-flex',
                alignItems:'center',justifyContent:'center',fontWeight:800,
                fontSize:'.9rem',marginBottom:'1rem'
              }}>{step.number}</div>
              <h3 style={{ fontSize:'1.05rem',fontWeight:700,marginBottom:'.5rem',color:'var(--text-primary)' }}>
                {step.title}
              </h3>
              <p style={{ fontSize:'.88rem',color:'var(--text-secondary)',lineHeight:1.6 }}>
                {step.description}
              </p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
