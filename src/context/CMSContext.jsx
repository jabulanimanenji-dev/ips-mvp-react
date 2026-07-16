import { DEFAULT_CMS } from '../utils/constants';
import React, { createContext, useContext, useCallback } from 'react';
import { useLocalStorage } from '../hooks/useLocalStorage';

const CMSContext = createContext();

export function CMSProvider({ children }) {
  const [cms, setCMS, removeCMS] = useLocalStorage('ips-cms-config', DEFAULT_CMS);

  const updateCMS = useCallback((section, data) => {
    setCMS(prev => ({ ...prev, [section]: { ...prev[section], ...data } }));
  }, [setCMS]);

  const updateCMSField = useCallback((section, field, value) => {
    setCMS(prev => {
      const sectionData = prev[section];
      if (Array.isArray(sectionData)) {
        const arr = [...sectionData];
        arr[field] = value;
        return { ...prev, [section]: arr };
      }
      return { ...prev, [section]: { ...sectionData, [field]: value } };
    });
  }, [setCMS]);

  const resetCMS = useCallback(() => {
    if (window.confirm('Reset ALL CMS content to default? This cannot be undone.')) {
      removeCMS();
      setCMS(DEFAULT_CMS);
    }
  }, [removeCMS, setCMS]);

  const exportCMS = useCallback(() => {
    const blob = new Blob([JSON.stringify(cms, null, 2)], { type: 'application/json' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = 'ips-cms-config.json';
    a.click();
  }, [cms]);

  const saveCMS = useCallback((newCMS) => {
    setCMS(newCMS);
  }, [setCMS]);

  // ─── NEW: Add/Remove CMS Items ───
  const addService = useCallback((service) => {
    setCMS(prev => ({ ...prev, services: [...prev.services, service] }));
  }, [setCMS]);

  const removeService = useCallback((idx) => {
    setCMS(prev => ({ ...prev, services: prev.services.filter((_, i) => i !== idx) }));
  }, [setCMS]);

  const addFAQ = useCallback((faq) => {
    setCMS(prev => ({ ...prev, faq: [...prev.faq, faq] }));
  }, [setCMS]);

  const removeFAQ = useCallback((idx) => {
    setCMS(prev => ({ ...prev, faq: prev.faq.filter((_, i) => i !== idx) }));
  }, [setCMS]);

  const addTestimonial = useCallback((testimonial) => {
    setCMS(prev => ({ ...prev, testimonials: [...prev.testimonials, testimonial] }));
  }, [setCMS]);

  const removeTestimonial = useCallback((idx) => {
    setCMS(prev => ({ ...prev, testimonials: prev.testimonials.filter((_, i) => i !== idx) }));
  }, [setCMS]);

  const addTrustBadge = useCallback((badge) => {
    setCMS(prev => ({ ...prev, trustBadges: [...prev.trustBadges, badge] }));
  }, [setCMS]);

  const removeTrustBadge = useCallback((idx) => {
    setCMS(prev => ({ ...prev, trustBadges: prev.trustBadges.filter((_, i) => i !== idx) }));
  }, [setCMS]);

  return (
    <CMSContext.Provider value={{ 
      cms, updateCMS, updateCMSField, resetCMS, exportCMS, saveCMS,
      addService, removeService, addFAQ, removeFAQ, 
      addTestimonial, removeTestimonial, addTrustBadge, removeTrustBadge
    }}>
      {children}
    </CMSContext.Provider>
  );
}

export const useCMS = () => useContext(CMSContext);