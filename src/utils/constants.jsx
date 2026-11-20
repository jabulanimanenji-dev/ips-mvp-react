import { cloneHeroResponsiveDefaults } from '../../shared/heroResponsive.js';

export const DEFAULT_CMS = {
  brand: { name: 'I P S', tagline: 'Professional Services. One Trusted Platform.', email: 'contact@ipsglobalservice.com', whatsapp: '' },
  authNavigation: {
    signInLabel: 'Sign in',
    signUpLabel: 'Sign up',
    clientLoginLabel: 'Seeking support',
    clientLoginDescription: 'Your requests, quotations and messages in one place.',
    providerLoginLabel: 'Working with IPS',
    providerLoginDescription: 'Review assigned work and collaborate with the IPS team.',
    clientSignupLabel: 'Create an IPS account',
    clientSignupDescription: 'Request and manage IPS services.',
    providerSignupLabel: 'Apply to work with IPS',
    providerSignupDescription: 'Tell us about your experience, interests and skills.'
  },
  join: {
    badge: 'YOUR IPS JOURNEY',
    headline: 'Find your place with IPS.',
    subheadline: 'Get the support you need or explore opportunities to contribute your expertise.',
    clientEyebrow: 'STUDENTS, RESEARCHERS & PROFESSIONALS',
    clientTitle: 'I need academic support',
    clientDescription: 'Create an account to request support, review quotations and follow project updates in one place.',
    clientButton: 'Create an account',
    providerEyebrow: 'SPECIALISTS & COLLABORATORS',
    providerTitle: 'I’d like to work with IPS',
    providerDescription: 'Share your skills and interests. IPS considers applications against current project opportunities. Experience and a CV are optional.',
    providerButton: 'Apply to work with IPS',
    closedMessage: 'This registration option is temporarily unavailable.'
  },
  hero: {
    visible: true,
    badge: 'Academic expertise—and trusted help for everything beyond it',
    eyebrow: 'IPS Global Services',
    headline: 'Professional Services.',
    highlightedText: 'One Trusted Platform.',
    highlightColor: '#C4A06A',
    subheadline: 'Private academic coaching, editorial review, methods guidance, analysis and professional consulting — all centrally reviewed and managed by IPS.',
    backgroundType: 'image',
    backgroundMedia: '/images/hero-bg.jpg',
    posterMedia: '/images/hero-bg.jpg',
    fallbackImage: '/images/hero-bg.jpg',
    backgroundPosition: 'center',
    overlayColor: '#102A43',
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
    popularSearches: ['Research methodology', 'Business plan', 'Website development', 'Editing and formatting', 'Data analysis'],
    trustItems: ['Human-reviewed requests', 'Private written contact', 'Approved specialists', 'Managed delivery'],
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
    { q: 'Can I submit the delivered materials as my own assessed work?', a: 'IPS provides legitimate research coaching, editing, methodology and data support. Your assessed academic submissions must remain your own and follow your institution’s policies.' },
    { q: 'How do payments work?', a: 'An IPS reviewer issues a written quotation. Online payment integration is pending, so IPS does not yet collect payments through the platform.' },
    { q: 'What currencies are available?', a: 'Your quotation states its currency and total. Supported payment methods and currencies will be confirmed when secure checkout is activated.' },
    { q: 'How do I track progress?', a: 'Every client gets a private portal with real-time milestone tracking, file sharing, and direct communication with our admin team. Access via your unique Client ID.' },
    { q: 'Who works on projects?', a: 'IPS reviews and approves specialists before allocating eligible work. Qualifications and availability are assessed for each assignment, with client communication managed centrally.' },
    { q: 'What if I need revisions?', a: 'Revisions follow the written scope and terms agreed for a project. Submit and track your requests in the private IPS workspace.' }
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
  testimonials: [], // No unverified customer reviews are published without explicit consent.
  about: {
    headline: 'We Exist to Eliminate Barriers',
    p1: 'We believe every student, researcher, and professional worldwide deserves access to quality academic and professional services they can afford and trust.',
    p2: 'IPS coordinates private academic coaching, professional editing, methods support and independent consulting under human management. Academic submissions remain the student’s own responsibility and must meet institutional rules.',
    stat1: 'Private', stat1Label: 'Client Requests',
    stat2: 'Written', stat2Label: 'Communication',
    stat3: 'Managed', stat3Label: 'Service Review'
  },
  trustBadges: ['🔒 Private Accounts', '🛡️ Confidential Workflow', '✉ Written Responses', '✓ Human Review'],
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
