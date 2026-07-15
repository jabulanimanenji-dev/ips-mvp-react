import React from 'react';
import Hero from '../components/public/Hero';
import Services from '../components/public/Services';
import HowItWorks from '../components/public/HowItWorks';
import Pricing from '../components/public/Pricing';
import FAQ from '../components/public/FAQ';
import Testimonials from '../components/public/Testimonials';
import About from '../components/public/About';

export default function HomePage() {
  return (
    <>
      <Hero />
      <Services />
      <HowItWorks />
      <Pricing />
      <FAQ />
      <Testimonials />
      <About />
    </>
  );
}
