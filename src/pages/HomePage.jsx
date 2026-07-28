import React from 'react';
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
      {(config.homeSections || [])
        .filter(section => section.visible && sections[section.id])
        .sort((a, b) => a.order - b.order)
        .map(section => <React.Fragment key={section.id}>{sections[section.id]}</React.Fragment>)}
    </>
  );
}
