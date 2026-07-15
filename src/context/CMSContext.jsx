import cmsJson from '../data/cms.json';
import React, { createContext, useContext, useCallback } from 'react';
import { useLocalStorage } from '../hooks/useLocalStorage';
const CMSContext = createContext();

export function CMSProvider({ children }) {
  const [cms, setCMS, removeCMS] = useLocalStorage('ips-cms-config', cmsJson);

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

  return (
    <CMSContext.Provider value={{ cms, updateCMS, updateCMSField, resetCMS, exportCMS, saveCMS }}>
      {children}
    </CMSContext.Provider>
  );
}

export const useCMS = () => useContext(CMSContext);
