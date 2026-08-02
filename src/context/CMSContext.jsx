import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { DEFAULT_CMS } from '../utils/constants';
import { DEFAULT_PLATFORM_CONFIG, normalisePlatformConfig } from '../../shared/platformConfig';
import { normaliseHeroResponsive } from '../../shared/heroResponsive.js';
import { serviceSlug } from '../../shared/serviceEngine.js';
import { useTheme } from './ThemeContext';

const CMSContext = createContext();

const mergeContent = content => ({
  ...DEFAULT_CMS,
  ...(content || {}),
  brand: { ...DEFAULT_CMS.brand, ...(content?.brand || {}) },
  authNavigation: { ...DEFAULT_CMS.authNavigation, ...(content?.authNavigation || {}) },
  join: { ...DEFAULT_CMS.join, ...(content?.join || {}) },
  hero: {
    ...DEFAULT_CMS.hero,
    ...(content?.hero || {}),
    responsive: normaliseHeroResponsive(content?.hero?.responsive || DEFAULT_CMS.hero.responsive, content?.hero || DEFAULT_CMS.hero)
  },
  process: { ...DEFAULT_CMS.process, ...(content?.process || {}), steps: content?.process?.steps || DEFAULT_CMS.process.steps },
  pricing: { ...DEFAULT_CMS.pricing, ...(content?.pricing || {}) },
  about: { ...DEFAULT_CMS.about, ...(content?.about || {}) },
  footer: { ...DEFAULT_CMS.footer, ...(content?.footer || {}) }
});

const fontStack = family => ({
  Inter: "'Inter', system-ui, -apple-system, sans-serif",
  System: "system-ui, -apple-system, sans-serif",
  Georgia: "Georgia, 'Times New Roman', serif",
  Arial: "Arial, Helvetica, sans-serif",
  Verdana: "Verdana, Geneva, sans-serif"
}[family] || "'Inter', system-ui, -apple-system, sans-serif");

const themeVariables = (config, theme) => {
  const palette = config.theme?.[theme] || config.theme?.light;
  return {
    '--font': fontStack(config.theme?.fontFamily),
    '--primary': palette.primary,
    '--primary-dark': palette.primaryDark,
    '--accent-gold': palette.accent,
    '--bg-body': palette.background,
    '--bg-surface': palette.surface,
    '--bg-surface-2': palette.surfaceAlt,
    '--bg-card': palette.surface,
    '--bg-header': palette.surface,
    '--text-primary': palette.text,
    '--text-secondary': palette.textSecondary,
    '--text-muted': palette.textMuted,
    '--border': palette.border,
    '--border-strong': palette.border,
    '--border-focus': palette.primaryDark,
    '--success': palette.success,
    '--danger': palette.danger,
    '--grad-hero': `linear-gradient(135deg, ${config.theme?.gradientStart} 0%, ${config.theme?.gradientEnd} 100%)`,
    '--grad-card-1': `linear-gradient(135deg, ${palette.primaryDark} 0%, ${palette.primary} 100%)`,
    '--grad-card-3': `linear-gradient(135deg, ${palette.accent} 0%, ${config.theme?.gradientEnd} 100%)`,
    '--radius-md': `${config.theme?.buttonRadius ?? 10}px`,
    '--radius-lg': `${config.theme?.cardRadius ?? 16}px`,
    '--content-max': `${config.layouts?.public?.contentWidth || 1200}px`,
    '--section-spacing': `${config.layouts?.public?.sectionSpacing || 80}px`
  };
};

const serviceCatalogFromEngine = (currentCatalog = {}, payload = {}) => {
  const engineCatalog = payload?.catalog || payload;
  if (!Array.isArray(engineCatalog?.categories) || !Array.isArray(engineCatalog?.services)) return currentCatalog;

  const categoryIds = new Map();
  const usedCategoryIds = new Set();
  const categories = engineCatalog.categories.map((item, index) => {
    const sourceId = String(item?.categoryId || item?.id || item?.slug || `category-${index + 1}`);
    const baseId = serviceSlug(sourceId) || `category-${index + 1}`;
    let id = baseId;
    while (usedCategoryIds.has(id)) id = `${baseId}-${index + 1}`;
    usedCategoryIds.add(id);
    categoryIds.set(sourceId, id);
    if (item?.categoryId) categoryIds.set(String(item.categoryId), id);
    if (item?.id) categoryIds.set(String(item.id), id);

    const toggles = item?.effectiveToggles || {};
    return {
      id,
      name: item?.name,
      shortName: item?.shortName || item?.name,
      icon: item?.icon,
      description: item?.description,
      family: item?.family,
      featured: item?.featured,
      active: item?.status ? item.status === 'published' : item?.active !== false,
      homepageVisible: toggles.homepageVisible ?? item?.homepageVisible ?? true,
      navigationVisible: toggles.navigationVisible ?? item?.navigationVisible ?? true,
      searchVisible: toggles.searchVisible ?? item?.searchVisible ?? true,
      acceptingRequests: toggles.acceptingRequests ?? item?.acceptingRequests ?? true,
      publicPricingAllowed: toggles.publicPricingAllowed ?? item?.publicPricingAllowed ?? true,
      order: item?.order ?? index
    };
  });

  const defaultCategoryId = categories[0]?.id || 'academic';
  const services = engineCatalog.services.map((item, index) => {
    const sourceCategoryId = String(item?.categoryId || '');
    const toggles = item?.effectiveToggles || {};
    return {
      id: serviceSlug(item?.serviceId || item?.id || item?.slug) || `service-${index + 1}`,
      categoryId: categoryIds.get(sourceCategoryId) || serviceSlug(sourceCategoryId) || defaultCategoryId,
      name: item?.name,
      description: item?.description,
      pricingType: item?.pricingType,
      startingPrice: item?.startingPrice,
      unit: item?.unit,
      featured: item?.featured,
      active: item?.status ? item.status === 'published' : item?.active !== false,
      homepageVisible: toggles.homepageVisible ?? item?.homepageVisible ?? true,
      navigationVisible: toggles.navigationVisible ?? item?.navigationVisible ?? true,
      searchVisible: toggles.searchVisible ?? item?.searchVisible ?? true,
      acceptingRequests: toggles.acceptingRequests ?? item?.acceptingRequests ?? true,
      publicPricingAllowed: toggles.publicPricingAllowed ?? item?.publicPricingAllowed ?? true,
      quoteEnabled: toggles.manualQuotesAllowed ?? item?.quoteEnabled ?? true,
      order: item?.order ?? index
    };
  });

  return { ...currentCatalog, categories, services };
};

export function CMSProvider({ children }) {
  const { theme } = useTheme();
  const [config, setConfig] = useState(() => normalisePlatformConfig(DEFAULT_PLATFORM_CONFIG));
  const [loading, setLoading] = useState(true);
  const [publishedVersion, setPublishedVersion] = useState(1);

  const refreshConfig = useCallback(async () => {
    try {
      const response = await fetch('/api/platform-config', { cache: 'no-store' });
      const data = await response.json();
      if (response.ok && data.success) {
        let nextConfig = data.config;
        try {
          const catalogResponse = await fetch('/api/service-catalog', { cache: 'no-store' });
          const catalogData = await catalogResponse.json();
          if (catalogResponse.ok && catalogData.success) {
            nextConfig = {
              ...nextConfig,
              serviceCatalog: serviceCatalogFromEngine(nextConfig?.serviceCatalog, catalogData)
            };
          }
        } catch {
          // Older deployments can continue using the published Studio catalogue.
        }
        setConfig(normalisePlatformConfig(nextConfig));
        setPublishedVersion(data.version || 1);
      }
    } catch {
      // The validated default keeps the public site usable while the API is unavailable.
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    refreshConfig();
  }, [refreshConfig]);

  useEffect(() => {
    const root = document.documentElement;
    Object.entries(themeVariables(config, theme)).forEach(([name, value]) => value != null && root.style.setProperty(name, value));
  }, [config, theme]);

  const cms = useMemo(() => mergeContent(config.content), [config.content]);

  const updateContent = useCallback(updater => {
    setConfig(previous => {
      const currentContent = mergeContent(previous.content);
      const nextContent = typeof updater === 'function' ? updater(currentContent) : updater;
      return normalisePlatformConfig({ ...previous, content: nextContent });
    });
  }, []);

  const updateCMS = useCallback((section, data) => {
    updateContent(previous => ({ ...previous, [section]: { ...previous[section], ...data } }));
  }, [updateContent]);

  const updateCMSField = useCallback((section, field, value) => {
    updateContent(previous => {
      const sectionData = previous[section];
      if (Array.isArray(sectionData)) {
        const items = [...sectionData];
        items[field] = value;
        return { ...previous, [section]: items };
      }
      return { ...previous, [section]: { ...sectionData, [field]: value } };
    });
  }, [updateContent]);

  const resetCMS = useCallback(() => {
    if (window.confirm('Reset the local preview content to the platform defaults?')) {
      setConfig(previous => normalisePlatformConfig({ ...previous, content: DEFAULT_CMS }));
    }
  }, []);

  const exportCMS = useCallback(() => {
    const blob = new Blob([JSON.stringify(config, null, 2)], { type: 'application/json' });
    const anchor = document.createElement('a');
    anchor.href = URL.createObjectURL(blob);
    anchor.download = `ips-platform-config-v${publishedVersion}.json`;
    anchor.click();
    URL.revokeObjectURL(anchor.href);
  }, [config, publishedVersion]);

  const saveCMS = useCallback(newCMS => {
    updateContent(newCMS);
  }, [updateContent]);

  const addItem = useCallback((section, item) => {
    updateContent(previous => ({ ...previous, [section]: [...(previous[section] || []), item] }));
  }, [updateContent]);
  const removeItem = useCallback((section, index) => {
    updateContent(previous => ({ ...previous, [section]: (previous[section] || []).filter((_, itemIndex) => itemIndex !== index) }));
  }, [updateContent]);

  return (
    <CMSContext.Provider value={{
      cms,
      config,
      loading,
      publishedVersion,
      previewDevice: null,
      refreshConfig,
      updateCMS,
      updateCMSField,
      resetCMS,
      exportCMS,
      saveCMS,
      addService: item => addItem('services', item),
      removeService: index => removeItem('services', index),
      addFAQ: item => addItem('faq', item),
      removeFAQ: index => removeItem('faq', index),
      addTestimonial: item => addItem('testimonials', item),
      removeTestimonial: index => removeItem('testimonials', index),
      addTrustBadge: item => addItem('trustBadges', item),
      removeTrustBadge: index => removeItem('trustBadges', index)
    }}>
      {children}
    </CMSContext.Provider>
  );
}

export function CMSPreviewProvider({ config: previewConfig, previewDevice = 'desktop', children }) {
  const { theme } = useTheme();
  const normalised = useMemo(() => normalisePlatformConfig(previewConfig || DEFAULT_PLATFORM_CONFIG), [previewConfig]);
  const value = useMemo(() => {
    return {
      cms: mergeContent(normalised.content),
      config: normalised,
      loading: false,
      publishedVersion: 0,
      previewDevice,
      refreshConfig: async () => {},
      updateCMS: () => {},
      updateCMSField: () => {},
      resetCMS: () => {},
      exportCMS: () => {},
      saveCMS: () => {},
      addService: () => {},
      removeService: () => {},
      addFAQ: () => {},
      removeFAQ: () => {},
      addTestimonial: () => {},
      removeTestimonial: () => {},
      addTrustBadge: () => {},
      removeTrustBadge: () => {}
    };
  }, [normalised, previewDevice]);

  return (
    <CMSContext.Provider value={value}>
      <div className="cms-preview-theme" data-theme={theme} style={themeVariables(normalised, theme)}>{children}</div>
    </CMSContext.Provider>
  );
}

export const useCMS = () => useContext(CMSContext);
