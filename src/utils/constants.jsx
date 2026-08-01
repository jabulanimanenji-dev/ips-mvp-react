import { cloneHeroResponsiveDefaults } from '../../shared/heroResponsive.js';

export const DEFAULT_CMS = {
  brand: { name: 'I P S', tagline: 'Professional Services. One Trusted Platform.', email: 'admin@ipsglobalservice.com', whatsapp: '+48 452 428 932' },
  authNavigation: {
    signInLabel: 'Sign in',
    signUpLabel: 'Sign up',
    clientLoginLabel: 'Client sign in',
    clientLoginDescription: 'Access orders, files and messages.',
    providerLoginLabel: 'Provider sign in',
    providerLoginDescription: 'Access assignments and provider tools.',
    clientSignupLabel: 'Create client account',
    clientSignupDescription: 'Request and manage IPS services.',
    providerSignupLabel: 'Apply as a provider',
    providerSignupDescription: 'Join the IPS provider network.'
  },
  join: {
    badge: 'Choose your IPS journey',
    headline: 'How would you like to join IPS?',
    subheadline: 'Select the account type that matches what you want to do.',
    clientEyebrow: 'For clients',
    clientTitle: 'I need a service',
    clientDescription: 'Create a client account to request services, manage orders, exchange files and track progress.',
    clientButton: 'Create client account',
    providerEyebrow: 'For service providers',
    providerTitle: 'I provide services',
    providerDescription: 'Apply to join the IPS provider network. Professional experience and a CV are optional.',
    providerButton: 'Apply as a provider',
    closedMessage: 'This registration option is temporarily unavailable.'
  },
  hero: {
    visible: true,
    badge: 'Academic expertise—and trusted help for everything beyond it',
    eyebrow: 'IPS Global Services',
    headline: 'Professional Services.',
    highlightedText: 'One Trusted Platform.',
    highlightColor: '#F3B37C',
    subheadline: 'Start with thesis writing, dissertations and assignments, or explore business, technology, creative, career, translation and practical support—all coordinated through IPS.',
    backgroundType: 'image',
    backgroundMedia: '/images/hero-bg.jpg',
    posterMedia: '/images/hero-bg.jpg',
    fallbackImage: '/images/hero-bg.jpg',
    backgroundPosition: 'center',
    overlayColor: '#35124C',
    overlayOpacity: 0.72,
    alignment: 'center',
    height: 620,
    contentWidth: 900,
    videoAutoplay: true,
    videoLoop: true,
    videoMuted: true,
    searchVisible: true,
    searchPlaceholder: 'What do you need help with today?',
    searchButtonLabel: 'Explore',
    popularSearches: ['Thesis writing', 'Business plan', 'Website development', 'Logo design', 'Data analysis'],
    trustItems: ['Academic experts', 'Business professionals', 'Fast response', 'Secure process'],
    responsive: cloneHeroResponsiveDefaults(),
    ctaPrimary: 'Request a Quote',
    ctaSecondary: 'View Pricing'
  },
  services: [
    { icon: '📖', title: 'Thesis & Dissertation', description: 'Undergraduate, Master\'s, and PhD level. Custom research, literature review, methodology, data analysis.' },
    { icon: '📝', title: 'Assignments & Coursework', description: 'Essays, reports, case studies, and presentations across all subjects and academic levels.' },
    { icon: '📊', title: 'Research Projects', description: 'Full project reports, business plans, technical documentation, data analysis and visualization.' },
    { icon: '🛠️', title: 'Odd Jobs', description: 'Accommodation finding, document processing, administrative tasks — any support you need.' }
  ],
  pricing: {
    undergraduate: 15, masters: 25, phd: 40, assignment: 12,
    projectFlat: 200, oddJobFlat: 100, rush7day: 50, rush48hour: 100
  },
  faq: [
    { q: 'Is the work really mine to publish?', a: 'Yes. Upon final payment, 100% ownership transfers to you. You receive a signed Certificate of Ownership Transfer. No attribution to I P S or writers is ever required.' },
    { q: 'How do installments work?', a: 'Pay per milestone. For a thesis: 20% deposit, then 20% per milestone. Work only proceeds after each payment is confirmed. No hidden fees, ever.' },
    { q: 'What currencies do you accept?', a: 'We accept all major currencies. Stripe auto-converts to your local currency at checkout. You see your price in your currency — we receive USD on our end.' },
    { q: 'How do I track progress?', a: 'Every client gets a private portal with real-time milestone tracking, file sharing, and direct communication with our admin team. Access via your unique Client ID.' },
    { q: 'Who are your writers?', a: 'Verified professionals with advanced degrees. Each writer is vetted, rated, and bound by strict NDAs. You never interact with them directly — we manage everything for your privacy.' },
    { q: 'What if I need revisions?', a: 'Two free revisions per milestone, provided the request is within the original scope. Additional revisions are available at a small fee. Your satisfaction is our priority.' }
  ],
  process: {
    label: 'The Process',
    headline: 'How It Works',
    subheadline: 'A simple, transparent workflow designed to keep you in control from start to finish.',
    steps: [
      { number: '01', title: 'Request a Quote', description: 'Tell us what you need, including the scope and deadline.' },
      { number: '02', title: 'Review & Confirm', description: 'Review the quote and delivery plan, then confirm when you are ready.' },
      { number: '03', title: 'Track Progress', description: 'Follow progress, decisions, files and messages in your private portal.' },
      { number: '04', title: 'Receive & Complete', description: 'Review the final delivery and keep every approved file in your workspace.' }
    ]
  },
  testimonials: [
    { text: 'I P S handled my entire Master\'s thesis. The milestone system made it affordable, and the final work was publishable quality.', client: 'Client, Nigeria' },
    { text: 'Found accommodation in London within a week through their odd jobs service. Professional, fast, and incredibly helpful.', client: 'Client, United Kingdom' },
    { text: 'The ownership certificate gave me complete peace of mind. My PhD dissertation was original, well-researched, and delivered on every milestone.', client: 'Client, India' }
  ],
  about: {
    headline: 'We Exist to Eliminate Barriers',
    p1: 'We believe every student, researcher, and professional worldwide deserves access to quality academic and professional services they can afford and trust.',
    p2: 'I P S operates as a professional ghostwriting and academic consulting service — legally analogous to hiring a speechwriter or memoir ghostwriter. We provide original, custom-written work as a work-for-hire, with full copyright transfer to you upon payment.',
    stat1: '1,500+', stat1Label: 'Clients Served',
    stat2: '20+', stat2Label: 'Countries',
    stat3: '98%', stat3Label: 'Satisfaction'
  },
  trustBadges: ['🔒 Secure Payments', '🛡️ Confidential Process', '✅ 100% Original', '📄 Full Ownership'],
  footer: { copyright: '2025 I P S' }
};

export const SERVICE_TYPES = ['Thesis', 'Assignment', 'Project Report', 'Odd Job'];
export const ACADEMIC_LEVELS = ['Undergraduate', 'Master', 'PhD', 'N/A'];
export const ORDER_STATUSES = ['New', 'In Progress', 'Under Review', 'Completed', 'Disputed', 'Cancelled'];

export const BADGE_STYLES = {
  'New': 'badge-new',
  'In Progress': 'badge-progress',
  'Under Review': 'badge-review',
  'Completed': 'badge-completed',
  'Disputed': 'badge-disputed',
  'Cancelled': 'badge-cancelled'
};

// ─── WRITER DEFAULTS ───
export const WRITER_DEFAULTS = {
  rating: 5.0,
  projects_completed: 0,
  availability: 'Available',
  status: 'Active',
  rate_per_page_usd: 10
};

// ─── ADMIN ROLES ───
export const ADMIN_ROLES = ['superadmin', 'admin', 'moderator'];
