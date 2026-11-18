import React from 'react';
import {Link} from 'react-router-dom';
import {useCMS} from '../context/CMSContext';
import './academic-interior.css';

export default function JoinPage(){
  const {cms,config}=useCMS();
  const join=cms.join||{},features=config.features||{};
  const options=[
    {
      id:'client',enabled:features.clientRegistration!==false,
      eyebrow:join.clientEyebrow||'STUDENTS, RESEARCHERS & PROFESSIONALS',
      title:join.clientTitle||'I need academic support',
      description:join.clientDescription||'Create a private account to request support, review quotations and manage project communication.',
      button:join.clientButton||'Create an account',
      target:'/signup'
    },
    {
      id:'provider',enabled:features.providerApplications!==false,
      eyebrow:join.providerEyebrow||'SPECIALISTS & COLLABORATORS',
      title:join.providerTitle||'I’d like to work with IPS',
      description:join.providerDescription||'Share your skills and interests. IPS reviews applications and discusses suitable opportunities when available.',
      button:join.providerButton||'Apply to work with IPS',
      target:'/become-a-provider'
    }
  ];
  return <section className="ipsa-interior" aria-labelledby="ipsa-join-title">
    <div className="ipsa-interior-wrap">
      <header className="ipsa-interior-header">
        <span className="ipsa-interior-label">{join.badge||'YOUR IPS JOURNEY'}</span>
        <h1 id="ipsa-join-title">{join.headline||<>Find the right <em>way forward.</em></>}</h1>
        <p>{join.subheadline||'Choose how you would like to work with IPS. Each path has its own secure account and workflow.'}</p>
      </header>
      <div className="ipsa-journeys">
        {options.map(option=><article key={option.id} className="ipsa-journey-card">
          <span className="ipsa-journey-label">{option.eyebrow}</span>
          <h2>{option.title}</h2>
          <p>{option.description}</p>
          {option.enabled?
            <Link className="ipsa-journey-cta" to={option.target}><span>{option.button}</span><span aria-hidden="true">↗</span></Link>:
            <p role="status" className="ipsa-journey-disabled">{join.closedMessage||'This application route is temporarily unavailable.'}</p>}
        </article>)}
      </div>
      <p className="ipsa-auth-help">Not sure which path fits? <a className="ipsa-auth-link" href="mailto:contact@ipsglobalservice.com">Ask IPS for guidance</a>.</p>
    </div>
  </section>;
}
