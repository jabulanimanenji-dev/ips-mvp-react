export const HOME_SECTION_CATALOG = [
  { id: 'hero', label: 'Hero', description: 'Headline and primary calls to action.' },
  { id: 'services', label: 'Services', description: 'Academic and professional service cards.' },
  { id: 'howItWorks', label: 'How it works', description: 'The four-step customer journey.' },
  { id: 'pricing', label: 'Pricing', description: 'Pricing tiers and rush fees.' },
  { id: 'faq', label: 'FAQ', description: 'Frequently asked questions.' },
  { id: 'testimonials', label: 'Testimonials', description: 'Client stories and social proof.' },
  { id: 'about', label: 'About', description: 'Company story and performance statistics.' }
];

export const PORTAL_LABELS = {
  public: 'Public website',
  client: 'Client portal',
  writer: 'Provider portal',
  admin: 'Admin portal'
};

export const DASHBOARD_WIDGET_CATALOG = {
  client: [
    { id: 'hero', label: 'Welcome & quick start', width: 'full' },
    { id: 'stats', label: 'Job statistics', width: 'full' },
    { id: 'serviceLaunchers', label: 'Service shortcuts', width: 'full' },
    { id: 'activity', label: 'Recent activity', width: 'full' }
  ],
  writer: [
    { id: 'hero', label: 'Provider command center', width: 'full' },
    { id: 'attention', label: 'Attention alert', width: 'full' },
    { id: 'stats', label: 'Work statistics', width: 'full' },
    { id: 'queue', label: 'Work queue', width: 'full' }
  ],
  admin: [
    { id: 'stats', label: 'Platform statistics', width: 'full' },
    { id: 'attention', label: 'Orders needing attention', width: 'wide' },
    { id: 'quickActions', label: 'Quick actions', width: 'standard' },
    { id: 'activity', label: 'Recent activity', width: 'wide' },
    { id: 'cmsStatus', label: 'CMS status', width: 'standard' }
  ]
};

export const SAFE_ROUTE_OPTIONS = {
  public: [
    ['/', 'Home'],
    ['/services', 'Services'],
    ['/quote', 'Request a quote'],
    ['#pricing', 'Pricing section'],
    ['#about', 'About section'],
    ['#faq', 'FAQ section'],
    ['/login', 'Client login'],
    ['/signup', 'Client signup']
  ],
  client: [
    ['/client/overview', 'Overview'],
    ['/services?type=professional', 'Request professional service'],
    ['/services?type=odd_job', 'Request odd job'],
    ['/client/services', 'Service Hub'],
    ['/client/orders', 'Academic & Writing'],
    ['/client/order', 'New academic order'],
    ['/client/messages', 'Messages'],
    ['/client/profile', 'Profile'],
    ['/client/support', 'Support']
  ],
  writer: [
    ['/writer/dashboard', 'Dashboard'],
    ['/writer/services', 'Service Jobs'],
    ['/writer/orders', 'Assigned Jobs'],
    ['/writer/messages?category=messages', 'Messages'],
    ['/writer/actions', 'Action Center']
  ],
  admin: [
    ['/admin/dashboard', 'Dashboard'],
    ['/admin/orders', 'Orders'],
    ['/admin/services', 'Service Operations'],
    ['/admin/clients', 'Clients'],
    ['/admin/writers', 'Service Providers'],
    ['/admin/payments', 'Payments'],
    ['/admin/cms', 'Visual Builder'],
    ['/admin/messages', 'Messages'],
    ['/admin/support', 'Support Tickets'],
    ['/admin/actions', 'Action Center'],
    ['/admin/reports', 'Reports'],
    ['/admin/settings', 'Settings']
  ]
};

const navigation = {
  public: [
    { id: 'public-home', label: 'Home', icon: '', target: '/', visible: true },
    { id: 'public-services', label: 'Services', icon: '', target: '/services', visible: true },
    { id: 'public-quote', label: 'Quote', icon: '', target: '/quote', visible: true },
    { id: 'public-about', label: 'About', icon: '', target: '#about', visible: true },
    { id: 'public-faq', label: 'FAQ', icon: '', target: '#faq', visible: true }
  ],
  client: [
    { id: 'client-home', label: 'Home', icon: '◆', target: '/client/overview', visible: true },
    { id: 'client-services', label: 'Service Hub', icon: 'S', target: '/client/services', visible: true },
    { id: 'client-orders', label: 'Academic & Writing', icon: '▤', target: '/client/orders', visible: true },
    { id: 'client-messages', label: 'Messages', icon: '●', target: '/client/messages', visible: true },
    { id: 'client-profile', label: 'Profile', icon: '◉', target: '/client/profile', visible: true },
    { id: 'client-support', label: 'Support', icon: '✉', target: '/client/support', visible: true }
  ],
  writer: [
    { id: 'writer-dashboard', label: 'Dashboard', icon: '▦', target: '/writer/dashboard', visible: true },
    { id: 'writer-services', label: 'Service Jobs', icon: 'S', target: '/writer/services', visible: true },
    { id: 'writer-orders', label: 'Assigned Jobs', icon: '▤', target: '/writer/orders', visible: true },
    { id: 'writer-messages', label: 'Messages', icon: '●', target: '/writer/messages?category=messages', visible: true },
    { id: 'writer-actions', label: 'Action Center', icon: '!', target: '/writer/actions', visible: true }
  ],
  admin: [
    { id: 'admin-dashboard', label: 'Dashboard', icon: '▦', target: '/admin/dashboard', visible: true },
    { id: 'admin-orders', label: 'Orders', icon: '◆', target: '/admin/orders', visible: true },
    { id: 'admin-services', label: 'Service Operations', icon: 'S', target: '/admin/services', visible: true },
    { id: 'admin-clients', label: 'Clients', icon: '●', target: '/admin/clients', visible: true },
    { id: 'admin-writers', label: 'Service Providers', icon: '✎', target: '/admin/writers', visible: true },
    { id: 'admin-payments', label: 'Payments', icon: '▣', target: '/admin/payments', visible: true },
    { id: 'admin-cms', label: 'Visual Builder', icon: '⚡', target: '/admin/cms', visible: true },
    { id: 'admin-messages', label: 'Messages', icon: '●', target: '/admin/messages', visible: true },
    { id: 'admin-support', label: 'Support Tickets', icon: '?', target: '/admin/support', visible: true },
    { id: 'admin-actions', label: 'Action Center', icon: '!', target: '/admin/actions', visible: true },
    { id: 'admin-reports', label: 'Reports', icon: '↗', target: '/admin/reports', visible: true },
    { id: 'admin-settings', label: 'Settings', icon: '⚙', target: '/admin/settings', visible: true }
  ]
};

export const DEFAULT_PLATFORM_CONFIG = {
  schemaVersion: 2,
  theme: {
    light: {
      primary: '#A305A6',
      primaryDark: '#7A4BA8',
      accent: '#D07E47',
      background: '#F8F4E9',
      surface: '#FFFFFF',
      surfaceAlt: '#F6DBC0',
      text: '#131F38',
      textSecondary: '#465083',
      textMuted: '#748B91',
      border: '#E4DFD6',
      success: '#16A34A',
      danger: '#DC2626'
    },
    dark: {
      primary: '#A305A6',
      primaryDark: '#7A4BA8',
      accent: '#ED9E6F',
      background: '#00010D',
      surface: '#0C111F',
      surfaceAlt: '#131F38',
      text: '#F8F4E9',
      textSecondary: '#B9CDEE',
      textMuted: '#748B91',
      border: '#26324A',
      success: '#22C55E',
      danger: '#EF4444'
    },
    gradientStart: '#321A6B',
    gradientEnd: '#A305A6',
    fontFamily: 'Inter',
    buttonRadius: 10,
    cardRadius: 16
  },
  layouts: {
    public: { contentWidth: 1200, contentPadding: 24, sectionSpacing: 80, density: 'comfortable' },
    client: { sidebarWidth: 260, contentPadding: 32, density: 'comfortable' },
    writer: { sidebarWidth: 240, contentPadding: 32, density: 'comfortable' },
    admin: { sidebarWidth: 260, contentPadding: 32, density: 'comfortable' }
  },
  homeSections: HOME_SECTION_CATALOG.map((section, index) => ({
    id: section.id,
    visible: true,
    order: index
  })),
  navigation,
  dashboardWidgets: Object.fromEntries(
    Object.entries(DASHBOARD_WIDGET_CATALOG).map(([portal, widgets]) => [
      portal,
      widgets.map((widget, order) => ({ ...widget, visible: true, order }))
    ])
  ),
  buttons: {
    heroPrimary: {
      id: 'heroPrimary',
      portal: 'public',
      area: 'hero',
      label: 'Request a Quote',
      icon: '',
      actionType: 'route',
      target: '/quote',
      variant: 'primary',
      backgroundColor: '',
      textColor: '',
      position: 0,
      visible: true,
      showOn: 'all'
    },
    heroSecondary: {
      id: 'heroSecondary',
      portal: 'public',
      area: 'hero',
      label: 'View Pricing',
      icon: '',
      actionType: 'anchor',
      target: '#pricing',
      variant: 'ghost',
      backgroundColor: '',
      textColor: '',
      position: 1,
      visible: true,
      showOn: 'all'
    },
    publicLogin: {
      id: 'publicLogin',
      portal: 'public',
      area: 'authentication',
      label: 'Log in',
      icon: '',
      actionType: 'route',
      target: '/login',
      variant: 'ghost',
      backgroundColor: '',
      textColor: '',
      position: 0,
      visible: true,
      showOn: 'all'
    },
    publicSignup: {
      id: 'publicSignup',
      portal: 'public',
      area: 'authentication',
      label: 'Sign up',
      icon: '',
      actionType: 'route',
      target: '/signup',
      variant: 'primary',
      backgroundColor: '',
      textColor: '',
      position: 1,
      visible: true,
      showOn: 'all'
    },
    clientRequestService: {
      id: 'clientRequestService', portal: 'client', area: 'hero', label: 'Request a service', icon: '',
      actionType: 'route', target: '/services?type=professional', variant: 'primary',
      backgroundColor: '#FFFFFF', textColor: '#40105D', position: 0, visible: true, showOn: 'all'
    },
    clientAcademicOrder: {
      id: 'clientAcademicOrder', portal: 'client', area: 'hero', label: 'Academic & writing order', icon: '',
      actionType: 'route', target: '/client/order', variant: 'ghost',
      backgroundColor: '', textColor: '#FFFFFF', position: 1, visible: true, showOn: 'all'
    },
    clientOpenServiceHub: {
      id: 'clientOpenServiceHub', portal: 'client', area: 'activity', label: 'Open Service Hub', icon: '',
      actionType: 'route', target: '/client/services', variant: 'secondary',
      backgroundColor: '', textColor: '', position: 0, visible: true, showOn: 'all'
    },
    writerServiceJobs: {
      id: 'writerServiceJobs', portal: 'writer', area: 'hero', label: 'Open service jobs', icon: '',
      actionType: 'route', target: '/writer/services', variant: 'primary',
      backgroundColor: '#FFFFFF', textColor: '#40105D', position: 0, visible: true, showOn: 'all'
    },
    writerAcademicJobs: {
      id: 'writerAcademicJobs', portal: 'writer', area: 'hero', label: 'Academic assignments', icon: '',
      actionType: 'route', target: '/writer/orders', variant: 'ghost',
      backgroundColor: '', textColor: '#FFFFFF', position: 1, visible: true, showOn: 'all'
    },
    adminManageOrders: {
      id: 'adminManageOrders', portal: 'admin', area: 'quickActions', label: 'Manage Orders', icon: '',
      actionType: 'route', target: '/admin/orders', variant: 'primary',
      backgroundColor: '', textColor: '', position: 0, visible: true, showOn: 'all'
    },
    adminViewClients: {
      id: 'adminViewClients', portal: 'admin', area: 'quickActions', label: 'View Clients', icon: '',
      actionType: 'route', target: '/admin/clients', variant: 'secondary',
      backgroundColor: '', textColor: '', position: 1, visible: true, showOn: 'all'
    },
    adminAssignProviders: {
      id: 'adminAssignProviders', portal: 'admin', area: 'quickActions', label: 'Assign Providers', icon: '',
      actionType: 'route', target: '/admin/writers', variant: 'secondary',
      backgroundColor: '', textColor: '', position: 2, visible: true, showOn: 'all'
    },
    adminPayments: {
      id: 'adminPayments', portal: 'admin', area: 'quickActions', label: 'Open Payments', icon: '',
      actionType: 'route', target: '/admin/payments', variant: 'gold',
      backgroundColor: '', textColor: '', position: 3, visible: true, showOn: 'all'
    },
    adminVisualBuilder: {
      id: 'adminVisualBuilder', portal: 'admin', area: 'quickActions', label: 'Open Visual Builder', icon: '',
      actionType: 'route', target: '/admin/cms', variant: 'ghost',
      backgroundColor: '', textColor: '', position: 4, visible: true, showOn: 'all'
    }
  },
  content: {}
};

export const clonePlatformConfig = value => JSON.parse(JSON.stringify(value || DEFAULT_PLATFORM_CONFIG));

const clamp = (value, min, max, fallback) => {
  const number = Number(value);
  return Number.isFinite(number) ? Math.min(max, Math.max(min, number)) : fallback;
};

const cleanText = (value, max = 160) => String(value ?? '').replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/g, '').slice(0, max);
const cleanColor = (value, fallback) => /^#[0-9a-f]{6}$/i.test(String(value || '')) ? String(value) : fallback;
const cleanOptionalColor = value => /^#[0-9a-f]{6}$/i.test(String(value || '')) ? String(value) : '';
const cleanTarget = (value, fallback = '/') => {
  const target = cleanText(value, 160);
  return /^(\/|#)[A-Za-z0-9/_?&=#.%+-]*$/.test(target) ? target : fallback;
};

const safeJson = (value, depth = 0) => {
  if (depth > 7 || value == null) return value == null ? value : undefined;
  if (typeof value === 'string') return cleanText(value, 5000);
  if (typeof value === 'number') return Number.isFinite(value) ? value : 0;
  if (typeof value === 'boolean') return value;
  if (Array.isArray(value)) return value.slice(0, 100).map(item => safeJson(item, depth + 1)).filter(item => item !== undefined);
  if (typeof value !== 'object') return undefined;
  return Object.fromEntries(
    Object.entries(value)
      .filter(([key]) => !['__proto__', 'constructor', 'prototype'].includes(key))
      .slice(0, 100)
      .map(([key, item]) => [cleanText(key, 80), safeJson(item, depth + 1)])
      .filter(([, item]) => item !== undefined)
  );
};

const normaliseNav = (items, portal) => {
  const fallback = DEFAULT_PLATFORM_CONFIG.navigation[portal];
  if (!Array.isArray(items)) return clonePlatformConfig(fallback);
  const seen = new Set();
  const cleaned = items.slice(0, 20).map((item, index) => {
    const fallbackItem = fallback.find(entry => entry.id === item?.id) || fallback[index] || {};
    const id = cleanText(item?.id || fallbackItem.id || `${portal}-${index}`, 60).replace(/[^a-zA-Z0-9-_]/g, '-');
    if (!id || seen.has(id)) return null;
    seen.add(id);
    return {
      id,
      label: cleanText(item?.label || fallbackItem.label || 'Navigation item', 50),
      icon: cleanText(item?.icon ?? fallbackItem.icon ?? '', 8),
      target: cleanTarget(item?.target, fallbackItem.target || '/'),
      visible: item?.visible !== false
    };
  }).filter(Boolean);
  fallback.forEach(item => {
    if (!seen.has(item.id)) {
      cleaned.push(clonePlatformConfig(item));
      seen.add(item.id);
    }
  });
  if (portal === 'admin') {
    const required = fallback.find(item => item.id === 'admin-cms');
    const existing = cleaned.find(item => item.id === 'admin-cms');
    if (existing) {
      existing.visible = true;
      existing.target = required.target;
    }
    else cleaned.push(clonePlatformConfig(required));
  }
  return cleaned;
};

export function normalisePlatformConfig(input = {}) {
  const base = clonePlatformConfig(DEFAULT_PLATFORM_CONFIG);
  const source = input && typeof input === 'object' ? input : {};
  const result = clonePlatformConfig(base);
  const theme = source.theme || {};

  ['light', 'dark'].forEach(mode => {
    const modeSource = theme[mode] || {};
    Object.keys(base.theme[mode]).forEach(key => {
      result.theme[mode][key] = cleanColor(modeSource[key], base.theme[mode][key]);
    });
  });
  result.theme.gradientStart = cleanColor(theme.gradientStart, base.theme.gradientStart);
  result.theme.gradientEnd = cleanColor(theme.gradientEnd, base.theme.gradientEnd);
  result.theme.fontFamily = ['Inter', 'System', 'Georgia', 'Arial', 'Verdana'].includes(theme.fontFamily) ? theme.fontFamily : base.theme.fontFamily;
  result.theme.buttonRadius = clamp(theme.buttonRadius, 0, 40, base.theme.buttonRadius);
  result.theme.cardRadius = clamp(theme.cardRadius, 0, 40, base.theme.cardRadius);

  Object.keys(base.layouts).forEach(portal => {
    const layout = source.layouts?.[portal] || {};
    result.layouts[portal] = {
      ...base.layouts[portal],
      ...(portal === 'public' ? {
        contentWidth: clamp(layout.contentWidth, 900, 1600, base.layouts.public.contentWidth),
        sectionSpacing: clamp(layout.sectionSpacing, 32, 140, base.layouts.public.sectionSpacing)
      } : {
        sidebarWidth: clamp(layout.sidebarWidth, 200, 360, base.layouts[portal].sidebarWidth)
      }),
      contentPadding: clamp(layout.contentPadding, 12, 64, base.layouts[portal].contentPadding),
      density: ['compact', 'comfortable', 'spacious'].includes(layout.density) ? layout.density : base.layouts[portal].density
    };
  });

  const requestedSections = Array.isArray(source.homeSections) ? source.homeSections : base.homeSections;
  const sectionMap = new Map(requestedSections.map((section, index) => [section?.id, {
    id: section?.id,
    visible: section?.visible !== false,
    order: index
  }]));
  result.homeSections = HOME_SECTION_CATALOG
    .map((section, defaultIndex) => sectionMap.get(section.id) || { id: section.id, visible: true, order: defaultIndex })
    .sort((a, b) => a.order - b.order)
    .map((section, order) => ({ ...section, order }));

  Object.keys(base.navigation).forEach(portal => {
    result.navigation[portal] = normaliseNav(source.navigation?.[portal], portal);
  });

  result.dashboardWidgets = {};
  Object.entries(DASHBOARD_WIDGET_CATALOG).forEach(([portal, catalog]) => {
    const requested = Array.isArray(source.dashboardWidgets?.[portal]) ? source.dashboardWidgets[portal] : base.dashboardWidgets[portal];
    const requestedMap = new Map(requested.map((widget, index) => [widget?.id, {
      id: widget?.id,
      visible: widget?.visible !== false,
      width: ['standard', 'wide', 'full'].includes(widget?.width) ? widget.width : undefined,
      order: index
    }]));
    result.dashboardWidgets[portal] = catalog
      .map((widget, defaultIndex) => ({
        id: widget.id,
        visible: requestedMap.get(widget.id)?.visible ?? true,
        width: requestedMap.get(widget.id)?.width || widget.width,
        order: requestedMap.get(widget.id)?.order ?? defaultIndex
      }))
      .sort((a, b) => a.order - b.order)
      .map((widget, order) => ({ ...widget, order }));
  });

  Object.keys(base.buttons).forEach(id => {
    const button = source.buttons?.[id] || {};
    const fallback = base.buttons[id];
    result.buttons[id] = {
      id,
      portal: fallback.portal,
      area: fallback.area,
      label: cleanText(button.label || fallback.label, 60),
      icon: cleanText(button.icon ?? fallback.icon, 8),
      actionType: ['route', 'anchor'].includes(button.actionType) ? button.actionType : fallback.actionType,
      target: cleanTarget(button.target, fallback.target),
      variant: ['primary', 'secondary', 'ghost', 'gold'].includes(button.variant) ? button.variant : fallback.variant,
      backgroundColor: cleanOptionalColor(button.backgroundColor),
      textColor: cleanOptionalColor(button.textColor),
      position: clamp(button.position, 0, 20, fallback.position),
      visible: button.visible !== false,
      showOn: ['all', 'desktop', 'mobile'].includes(button.showOn) ? button.showOn : fallback.showOn
    };
  });

  result.content = safeJson(source.content || {}) || {};
  return result;
}
