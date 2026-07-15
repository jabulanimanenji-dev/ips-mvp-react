export const DEFAULT_CMS = {
  brand: { name: 'I P S', tagline: 'Your Academic Success, Our Expert Craft', email: 'admin@ips-services.com', whatsapp: '+1 234 567 8900' },
  hero: {
    badge: '🎓 Trusted by 2,000+ students worldwide',
    headline: 'Expert Academic Writing Services — Original Work, Full Ownership',
    subheadline: 'Theses, Dissertations, Assignments, Projects & Professional Odd Jobs. Confidential. Secure. Yours Alone.',
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
  testimonials: [
    { text: 'I P S handled my entire Master\'s thesis. The milestone system made it affordable, and the final work was publishable quality.', client: 'Client, Nigeria' },
    { text: 'Found accommodation in London within a week through their odd jobs service. Professional, fast, and incredibly helpful.', client: 'Client, United Kingdom' },
    { text: 'The ownership certificate gave me complete peace of mind. My PhD dissertation was original, well-researched, and delivered on every milestone.', client: 'Client, India' }
  ],
  about: {
    headline: 'We Exist to Eliminate Barriers',
    p1: 'We believe every student, researcher, and professional worldwide deserves access to quality academic and professional services they can afford and trust.',
    p2: 'I P S operates as a professional ghostwriting and academic consulting service — legally analogous to hiring a speechwriter or memoir ghostwriter. We provide original, custom-written work as a work-for-hire, with full copyright transfer to you upon payment.',
    stat1: '2,000+', stat1Label: 'Clients Served',
    stat2: '50+', stat2Label: 'Countries',
    stat3: '98%', stat3Label: 'Satisfaction'
  },
  trustBadges: ['🔒 Secure Payments', '🛡️ Confidential Process', '✅ 100% Original', '📄 Full Ownership'],
  footer: { copyright: '2026 I P S' }
};

export const ADMIN_CREDENTIALS = { email: 'admin@ips.com', password: 'admin123' };

export const DEMO_CLIENT = { client_id: 'CID-001', full_name: 'Amara Okafor', email: 'amara@example.com', phone: '+234 801 234 5678', country: 'Nigeria', registration_date: '2026-01-15' };

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
