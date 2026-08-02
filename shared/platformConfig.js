import { normaliseHeroResponsive } from './heroResponsive.js';
import { emptyNativeEditing, normaliseNativeEditing } from './nativeEditing.js';

export const HOME_SECTION_CATALOG = [
  { id: 'hero', label: 'Hero', description: 'Headline and primary calls to action.' },
  { id: 'services', label: 'Services', description: 'Academic and professional service cards.' },
  { id: 'howItWorks', label: 'How it works', description: 'The four-step customer journey.' },
  { id: 'pricing', label: 'Pricing', description: 'Pricing tiers and rush fees.' },
  { id: 'faq', label: 'FAQ', description: 'Frequently asked questions.' },
  { id: 'testimonials', label: 'Testimonials', description: 'Client stories and social proof.' },
  { id: 'about', label: 'About', description: 'Company story and performance statistics.' }
];


const DEFAULT_SERVICE_CATEGORIES = [
  { id: 'academic', name: 'Academic Services', shortName: 'Academic', icon: '🎓', description: 'Theses, dissertations, assignments, research, editing and data analysis.', family: 'professional', featured: true, active: true, order: 0 },
  { id: 'business', name: 'Business Services', shortName: 'Business', icon: '💼', description: 'Business plans, proposals, market research, pitch decks and administration.', family: 'professional', featured: true, active: true, order: 1 },
  { id: 'technology', name: 'Technology Services', shortName: 'Technology', icon: '💻', description: 'Websites, software, automation, AI solutions and technical support.', family: 'professional', featured: true, active: true, order: 2 },
  { id: 'creative', name: 'Creative & Design', shortName: 'Creative', icon: '🎨', description: 'Branding, graphics, presentations, video, animation and UI/UX.', family: 'professional', featured: true, active: true, order: 3 },
  { id: 'career', name: 'Career Services', shortName: 'Career', icon: '↗', description: 'CVs, cover letters, LinkedIn profiles and interview preparation.', family: 'professional', featured: true, active: true, order: 4 },
  { id: 'translation', name: 'Translation & Language', shortName: 'Translation', icon: '🌍', description: 'Translation, transcription, localization and language support.', family: 'professional', featured: true, active: true, order: 5 },
  { id: 'assistance', name: 'Personal & Local Assistance', shortName: 'Assistance', icon: '✓', description: 'Relocation, errands, appointments, forms, travel and practical support.', family: 'odd_job', featured: true, active: true, order: 6 }
];

const DEFAULT_SERVICE_ITEMS = [
  { id: 'thesis-writing', categoryId: 'academic', name: 'Thesis Writing', description: 'Structured support for undergraduate and postgraduate theses.', pricingType: 'per_page', startingPrice: 15, unit: 'per page', featured: true, active: true, quoteEnabled: true, order: 0 },
  { id: 'dissertation', categoryId: 'academic', name: 'Dissertation Support', description: 'Research, literature review, methodology, analysis and full dissertation support.', pricingType: 'per_page', startingPrice: 25, unit: 'per page', featured: true, active: true, quoteEnabled: true, order: 1 },
  { id: 'assignments', categoryId: 'academic', name: 'Assignments & Coursework', description: 'Essays, reports, case studies, presentations and coursework.', pricingType: 'per_page', startingPrice: 12, unit: 'per page', featured: true, active: true, quoteEnabled: true, order: 2 },
  { id: 'phd-research', categoryId: 'academic', name: 'PhD Research Support', description: 'Advanced doctoral research, journal articles and specialist analysis.', pricingType: 'per_page', startingPrice: 40, unit: 'per page', featured: true, active: true, quoteEnabled: true, order: 3 },
  { id: 'editing-proofreading', categoryId: 'academic', name: 'Editing & Proofreading', description: 'Language, structure, formatting, citations and academic presentation.', pricingType: 'quote', startingPrice: 0, unit: 'custom quote', featured: false, active: true, quoteEnabled: true, order: 4 },
  { id: 'data-analysis', categoryId: 'academic', name: 'Research & Data Analysis', description: 'SPSS, Excel, qualitative analysis, visualization and interpretation.', pricingType: 'quote', startingPrice: 0, unit: 'custom quote', featured: true, active: true, quoteEnabled: true, order: 5 },
  { id: 'business-plan', categoryId: 'business', name: 'Business Plans', description: 'Investor-ready business plans with strategy, market and financial sections.', pricingType: 'quote', startingPrice: 0, unit: 'custom quote', featured: true, active: true, quoteEnabled: true, order: 0 },
  { id: 'market-research', categoryId: 'business', name: 'Market Research', description: 'Competitor, customer and opportunity research for confident decisions.', pricingType: 'quote', startingPrice: 0, unit: 'custom quote', featured: true, active: true, quoteEnabled: true, order: 1 },
  { id: 'website-development', categoryId: 'technology', name: 'Website Development', description: 'Business websites, portals, landing pages and web applications.', pricingType: 'quote', startingPrice: 0, unit: 'custom quote', featured: true, active: true, quoteEnabled: true, order: 0 },
  { id: 'automation-ai', categoryId: 'technology', name: 'Automation & AI', description: 'Workflow automation, AI integrations and productivity solutions.', pricingType: 'quote', startingPrice: 0, unit: 'custom quote', featured: true, active: true, quoteEnabled: true, order: 1 },
  { id: 'graphic-design', categoryId: 'creative', name: 'Graphic Design & Branding', description: 'Logos, identity systems, social assets and branded materials.', pricingType: 'quote', startingPrice: 0, unit: 'custom quote', featured: true, active: true, quoteEnabled: true, order: 0 },
  { id: 'presentation-design', categoryId: 'creative', name: 'Presentation Design', description: 'Professional slide decks for academic, business and investor audiences.', pricingType: 'quote', startingPrice: 0, unit: 'custom quote', featured: true, active: true, quoteEnabled: true, order: 1 },
  { id: 'cv-linkedin', categoryId: 'career', name: 'CV & LinkedIn', description: 'ATS-ready CVs, cover letters and optimized LinkedIn profiles.', pricingType: 'quote', startingPrice: 0, unit: 'custom quote', featured: true, active: true, quoteEnabled: true, order: 0 },
  { id: 'translation', categoryId: 'translation', name: 'Translation & Localization', description: 'Clear, audience-appropriate translation and localization.', pricingType: 'quote', startingPrice: 0, unit: 'custom quote', featured: true, active: true, quoteEnabled: true, order: 0 },
  { id: 'relocation', categoryId: 'assistance', name: 'Relocation Assistance', description: 'Accommodation search, viewing coordination and moving support.', pricingType: 'quote', startingPrice: 0, unit: 'custom quote', featured: true, active: true, quoteEnabled: true, order: 0 },
  { id: 'personal-admin', categoryId: 'assistance', name: 'Personal Administration', description: 'Appointments, forms, reservations, purchasing and organization.', pricingType: 'quote', startingPrice: 0, unit: 'custom quote', featured: true, active: true, quoteEnabled: true, order: 1 }
];

export const PORTAL_LABELS = {
  public: 'Public website',
  client: 'Client portal',
  writer: 'Provider portal',
  admin: 'Admin portal'
};

export const PAGE_CATALOG = [
  { id: 'public.home', portal: 'public', label: 'Home', path: '/' },
  { id: 'public.services', portal: 'public', label: 'Service marketplace', path: '/services' },
  { id: 'public.quote', portal: 'public', label: 'Request a quote', path: '/quote' },
  { id: 'public.login', portal: 'public', label: 'Client sign in', path: '/login' },
  { id: 'public.signup', portal: 'public', label: 'Client sign up', path: '/signup' },
  { id: 'public.join', portal: 'public', label: 'Join IPS', path: '/join' },
  { id: 'public.provider-application', portal: 'public', label: 'Provider application', path: '/become-a-provider' },
  { id: 'client.overview', portal: 'client', label: 'Client overview', path: '/client/overview' },
  { id: 'client.orders', portal: 'client', label: 'Academic orders', path: '/client/orders' },
  { id: 'client.order-detail', portal: 'client', label: 'Academic order workspace', path: '/client/orders/:id' },
  { id: 'client.new-order', portal: 'client', label: 'New academic order', path: '/client/order' },
  { id: 'client.services', portal: 'client', label: 'Client service hub', path: '/client/services' },
  { id: 'client.service-detail', portal: 'client', label: 'Service request workspace', path: '/client/services/:id' },
  { id: 'client.messages', portal: 'client', label: 'Client messages', path: '/client/messages' },
  { id: 'client.profile', portal: 'client', label: 'Client profile', path: '/client/profile' },
  { id: 'client.support', portal: 'client', label: 'Client support', path: '/client/support' },
  { id: 'writer.login', portal: 'writer', label: 'Provider sign in', path: '/writer/login' },
  { id: 'writer.dashboard', portal: 'writer', label: 'Provider dashboard', path: '/writer/dashboard' },
  { id: 'writer.orders', portal: 'writer', label: 'Provider academic jobs', path: '/writer/orders' },
  { id: 'writer.order-detail', portal: 'writer', label: 'Provider academic workspace', path: '/writer/orders/:id' },
  { id: 'writer.services', portal: 'writer', label: 'Provider service jobs', path: '/writer/services' },
  { id: 'writer.service-detail', portal: 'writer', label: 'Provider service workspace', path: '/writer/services/:id' },
  { id: 'writer.messages', portal: 'writer', label: 'Provider messages', path: '/writer/messages' },
  { id: 'writer.actions', portal: 'writer', label: 'Provider action centre', path: '/writer/actions' },
  { id: 'admin.login', portal: 'admin', label: 'Hidden admin sign in', path: '@admin-entry' },
  { id: 'admin.dashboard', portal: 'admin', label: 'Admin dashboard', path: '/admin/dashboard' },
  { id: 'admin.orders', portal: 'admin', label: 'Admin orders', path: '/admin/orders' },
  { id: 'admin.order-detail', portal: 'admin', label: 'Admin order workspace', path: '/admin/orders/:id' },
  { id: 'admin.services', portal: 'admin', label: 'Admin service operations', path: '/admin/services' },
  { id: 'admin.service-detail', portal: 'admin', label: 'Admin service workspace', path: '/admin/services/:id' },
  { id: 'admin.clients', portal: 'admin', label: 'Admin clients', path: '/admin/clients' },
  { id: 'admin.writers', portal: 'admin', label: 'Admin providers', path: '/admin/writers' },
  { id: 'admin.payments', portal: 'admin', label: 'Admin payments', path: '/admin/payments' },
  { id: 'admin.cms', portal: 'admin', label: 'Platform Studio', path: '/admin/cms' },
  { id: 'admin.access', portal: 'admin', label: 'Administrator access', path: '/admin/access' },
  { id: 'admin.messages', portal: 'admin', label: 'Admin messages', path: '/admin/messages' },
  { id: 'admin.job-messages', portal: 'admin', label: 'Admin job messages', path: '/admin/job-messages' },
  { id: 'admin.actions', portal: 'admin', label: 'Admin action centre', path: '/admin/actions' },
  { id: 'admin.support', portal: 'admin', label: 'Admin support tickets', path: '/admin/support' },
  { id: 'admin.reports', portal: 'admin', label: 'Admin reports', path: '/admin/reports' },
  { id: 'admin.settings', portal: 'admin', label: 'Admin settings', path: '/admin/settings' }
];

const defaultPageDesign = page => ({
  id: page.id,
  enabled: true,
  background: {
    type: 'theme',
    color: '#00010D',
    gradientStart: '#321A6B',
    gradientEnd: '#A305A6',
    assetId: '',
    posterAssetId: '',
    positionX: 50,
    positionY: 50,
    overlayColor: '#00010D',
    overlayOpacity: 0,
    responsive: Object.fromEntries(['desktop', 'tablet', 'mobile'].map(device => [device, {
      type: 'inherit',
      assetId: '',
      posterAssetId: '',
      positionX: 50,
      positionY: 50
    }]))
  },
  minHeight: 0,
  contentMaxWidth: 0,
  padding: {
    desktop: 0,
    tablet: 0,
    mobile: 0
  },
  elements: [],
  nativeEditing: emptyNativeEditing(),
  seo: {
    title: '',
    description: '',
    socialImageAssetId: '',
    indexable: true
  }
});

const routeMatches = (pattern, pathname) => {
  if (pattern === pathname) return true;
  const patternParts = pattern.split('/').filter(Boolean);
  const pathParts = pathname.split('/').filter(Boolean);
  return patternParts.length === pathParts.length && patternParts.every((part, index) =>
    part.startsWith(':') || part === pathParts[index]
  );
};

export const resolvePageDefinition = (pathname, adminEntryPath = '') => {
  const cleanPath = String(pathname || '/').replace(/\/+$/, '') || '/';
  if (adminEntryPath && cleanPath === adminEntryPath) return PAGE_CATALOG.find(page => page.id === 'admin.login');
  return PAGE_CATALOG
    .filter(page => page.path.startsWith('/'))
    .sort((a, b) => Number(a.path.includes(':')) - Number(b.path.includes(':')))
    .find(page => routeMatches(page.path, cleanPath));
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
    ['/signup', 'Client signup'],
    ['/join', 'Choose account type'],
    ['/become-a-provider', 'Provider application'],
    ['/writer/login', 'Provider login']
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
    ['/admin/cms', 'Platform Studio'],
    ['/admin/access', 'Access Control'],
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
    { id: 'admin-cms', label: 'Platform Studio', icon: '⚡', target: '/admin/cms', visible: true },
    { id: 'admin-access', label: 'Access Control', icon: 'A', target: '/admin/access', visible: true },
    { id: 'admin-messages', label: 'Messages', icon: '●', target: '/admin/messages', visible: true },
    { id: 'admin-support', label: 'Support Tickets', icon: '?', target: '/admin/support', visible: true },
    { id: 'admin-actions', label: 'Action Center', icon: '!', target: '/admin/actions', visible: true },
    { id: 'admin-reports', label: 'Reports', icon: '↗', target: '/admin/reports', visible: true },
    { id: 'admin-settings', label: 'Settings', icon: '⚙', target: '/admin/settings', visible: true }
  ]
};

export const DEFAULT_PLATFORM_CONFIG = {
  schemaVersion: 6,
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
  serviceCatalog: {
    heading: 'What do you need today?',
    subheading: 'Start with academics—our flagship expertise—or explore trusted help for business, technology, creative work and everyday needs.',
    searchPlaceholder: 'Search thesis writing, business plans, websites, design, translation…',
    categories: DEFAULT_SERVICE_CATEGORIES,
    services: DEFAULT_SERVICE_ITEMS
  },
  features: {
    publicWebsite: true,
    clientRegistration: true,
    providerApplications: true,
    clientLogin: true,
    providerLogin: true,
    quoteRequests: true,
    serviceMarketplace: true,
    pricing: true,
    testimonials: true,
    faq: true,
    contact: true,
    newsletter: false,
    clientOrders: true,
    clientMessaging: true,
    clientFileUploads: true,
    providerAssignments: true,
    providerMessaging: true,
    providerFileUploads: true,
    providerEarnings: false,
    payments: false,
    maintenanceMode: false
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
  pageDesigns: Object.fromEntries(PAGE_CATALOG.map(page => [page.id, defaultPageDesign(page)])),
  globalNativeEditing: emptyNativeEditing(),
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
const cleanId = (value, fallback = '') => cleanText(value || fallback, 80).replace(/[^a-zA-Z0-9_.:-]/g, '-');

const normalisePlacement = (value, fallback) => ({
  x: clamp(value?.x, 0, 100, fallback.x),
  y: clamp(value?.y, 0, 5000, fallback.y),
  width: clamp(value?.width, 60, 1600, fallback.width),
  height: clamp(value?.height, 36, 1200, fallback.height)
});

const normalisePageElement = (item, index) => {
  const type = ['button', 'text', 'image', 'video', 'banner', 'card'].includes(item?.type) ? item.type : 'text';
  const desktop = normalisePlacement(item?.placement?.desktop, { x: 50, y: 80 + (index * 70), width: 280, height: 64 });
  return {
    id: cleanId(item?.id, `element-${index + 1}`),
    type,
    text: cleanText(item?.text || (type === 'button' ? 'Open' : 'New element'), 500),
    assetId: cleanId(item?.assetId),
    alt: cleanText(item?.alt, 180),
    target: cleanTarget(item?.target, '/'),
    backgroundColor: cleanOptionalColor(item?.backgroundColor),
    textColor: cleanOptionalColor(item?.textColor),
    borderRadius: clamp(item?.borderRadius, 0, 80, 12),
    zIndex: clamp(item?.zIndex, 1, 50, index + 1),
    visible: item?.visible !== false,
    showOn: ['all', 'desktop', 'tablet', 'mobile'].includes(item?.showOn) ? item.showOn : 'all',
    placement: {
      desktop,
      tablet: normalisePlacement(item?.placement?.tablet, { ...desktop, width: Math.min(desktop.width, 640) }),
      mobile: normalisePlacement(item?.placement?.mobile, { x: 50, y: desktop.y, width: Math.min(desktop.width, 320), height: desktop.height })
    }
  };
};

const normalisePageDesign = (input, page) => {
  const fallback = defaultPageDesign(page);
  const background = input?.background || {};
  return {
    id: page.id,
    enabled: input?.enabled !== false,
    background: {
      type: ['theme', 'color', 'gradient', 'image', 'video'].includes(background.type) ? background.type : fallback.background.type,
      color: cleanColor(background.color, fallback.background.color),
      gradientStart: cleanColor(background.gradientStart, fallback.background.gradientStart),
      gradientEnd: cleanColor(background.gradientEnd, fallback.background.gradientEnd),
      assetId: cleanId(background.assetId),
      posterAssetId: cleanId(background.posterAssetId),
      positionX: clamp(background.positionX, 0, 100, 50),
      positionY: clamp(background.positionY, 0, 100, 50),
      overlayColor: cleanColor(background.overlayColor, fallback.background.overlayColor),
      overlayOpacity: clamp(background.overlayOpacity, 0, 0.95, 0),
      responsive: Object.fromEntries(['desktop', 'tablet', 'mobile'].map(device => {
        const source = background.responsive?.[device] || {};
        return [device, {
          type: ['inherit', 'image', 'video'].includes(source.type) ? source.type : 'inherit',
          assetId: cleanId(source.assetId),
          posterAssetId: cleanId(source.posterAssetId),
          positionX: clamp(source.positionX, 0, 100, 50),
          positionY: clamp(source.positionY, 0, 100, 50)
        }];
      }))
    },
    minHeight: clamp(input?.minHeight, 0, 6000, 0),
    contentMaxWidth: clamp(input?.contentMaxWidth, 0, 2400, 0),
    padding: {
      desktop: clamp(input?.padding?.desktop, 0, 240, 0),
      tablet: clamp(input?.padding?.tablet, 0, 180, 0),
      mobile: clamp(input?.padding?.mobile, 0, 120, 0)
    },
    elements: Array.isArray(input?.elements)
      ? input.elements.slice(0, 40).map(normalisePageElement)
      : [],
    nativeEditing: normaliseNativeEditing(input?.nativeEditing),
    seo: {
      title: cleanText(input?.seo?.title, 120),
      description: cleanText(input?.seo?.description, 320),
      socialImageAssetId: cleanId(input?.seo?.socialImageAssetId),
      indexable: input?.seo?.indexable !== false
    }
  };
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
    ['admin-cms', 'admin-access'].forEach(id => {
      const required = fallback.find(item => item.id === id);
      const existing = cleaned.find(item => item.id === id);
      if (existing) {
        existing.visible = true;
        existing.target = required.target;
      } else cleaned.push(clonePlatformConfig(required));
    });
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

  const catalogSource = source.serviceCatalog || {};
  const rawCategories = Array.isArray(catalogSource.categories) ? catalogSource.categories : base.serviceCatalog.categories;
  const categoryIds = new Set();
  result.serviceCatalog = {
    heading: cleanText(catalogSource.heading || base.serviceCatalog.heading, 120),
    subheading: cleanText(catalogSource.subheading || base.serviceCatalog.subheading, 320),
    searchPlaceholder: cleanText(catalogSource.searchPlaceholder || base.serviceCatalog.searchPlaceholder, 160),
    categories: rawCategories.slice(0, 50).map((item, index) => {
      const fallbackId = `category-${index + 1}`;
      let id = cleanText(item?.id || fallbackId, 60).toLowerCase().replace(/[^a-z0-9-]+/g, '-').replace(/^-|-$/g, '') || fallbackId;
      while (categoryIds.has(id)) id = `${id}-${index + 1}`;
      categoryIds.add(id);
      return {
        id,
        name: cleanText(item?.name || 'New category', 100),
        shortName: cleanText(item?.shortName || item?.name || 'Category', 50),
        icon: cleanText(item?.icon || '◆', 12),
        description: cleanText(item?.description || '', 320),
        family: item?.family === 'odd_job' ? 'odd_job' : 'professional',
        featured: item?.featured !== false,
        active: item?.active !== false,
        order: clamp(item?.order, 0, 999, index)
      };
    }).sort((a, b) => a.order - b.order).map((item, order) => ({ ...item, order })),
    services: []
  };
  const validCategoryIds = new Set(result.serviceCatalog.categories.map(item => item.id));
  const defaultCategoryId = result.serviceCatalog.categories[0]?.id || 'academic';
  const rawServices = Array.isArray(catalogSource.services) ? catalogSource.services : base.serviceCatalog.services;
  result.serviceCatalog.services = rawServices.slice(0, 300).map((item, index) => ({
    id: cleanText(item?.id || `service-${index + 1}`, 80).toLowerCase().replace(/[^a-z0-9-]+/g, '-').replace(/^-|-$/g, '') || `service-${index + 1}`,
    categoryId: validCategoryIds.has(item?.categoryId) ? item.categoryId : defaultCategoryId,
    name: cleanText(item?.name || 'New service', 120),
    description: cleanText(item?.description || '', 500),
    pricingType: ['per_page', 'fixed', 'hourly', 'quote'].includes(item?.pricingType) ? item.pricingType : 'quote',
    startingPrice: clamp(item?.startingPrice, 0, 1000000, 0),
    unit: cleanText(item?.unit || 'custom quote', 60),
    featured: item?.featured === true,
    active: item?.active !== false,
    quoteEnabled: item?.quoteEnabled !== false,
    order: clamp(item?.order, 0, 999, index)
  }));

  result.features = Object.fromEntries(
    Object.entries(base.features).map(([key, fallback]) => [key, source.features?.[key] == null ? fallback : source.features[key] === true])
  );

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
      showOn: ['all', 'desktop', 'tablet', 'mobile'].includes(button.showOn) ? button.showOn : fallback.showOn
    };
  });

  result.pageDesigns = Object.fromEntries(PAGE_CATALOG.map(page => [
    page.id,
    normalisePageDesign(source.pageDesigns?.[page.id], page)
  ]));
  result.globalNativeEditing = normaliseNativeEditing(source.globalNativeEditing);

  result.content = safeJson(source.content || {}) || {};
  result.content.hero = {
    ...(result.content.hero || {}),
    responsive: normaliseHeroResponsive(result.content.hero?.responsive, result.content.hero || {})
  };
  return result;
}
