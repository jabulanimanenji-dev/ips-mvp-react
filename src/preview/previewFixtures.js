import { PREVIEW_ORDER_ID, PREVIEW_SERVICE_ID } from '../../shared/platformPreview.js';

const now = new Date();
const future = days => new Date(now.getTime() + days * 86400000).toISOString();
const past = days => new Date(now.getTime() - days * 86400000).toISOString();

export const previewOrder = {
  _id: PREVIEW_ORDER_ID,
  id: PREVIEW_ORDER_ID,
  order_id: 'IPS-ACADEMIC-1042',
  clientId: 'preview-client-001',
  client_id: 'preview-client-001',
  writer_id: 'preview-provider-001',
  provider_id: 'preview-provider-001',
  client_name: 'Preview Client',
  client_email: 'client.preview@ips.local',
  writer_name: 'Preview Service Provider',
  topic: 'Digital transformation strategy for growing organisations',
  topic_title: 'Digital transformation strategy for growing organisations',
  title: 'Digital transformation strategy for growing organisations',
  service: 'Thesis Writing',
  service_type: 'Thesis',
  academic_level: 'Masters',
  level: 'Masters',
  pages: 24,
  word_count: 7200,
  deadline: future(12),
  status: 'In Progress',
  progress: 58,
  price: 540,
  total_fee_usd: 540,
  totalPrice: 540,
  total_price: 540,
  amount: 540,
  currency: 'USD',
  instructions: 'Prepare a structured research chapter using the supplied outline and sources.',
  requirements: 'Prepare a structured research chapter using the supplied outline and sources.',
  subject: 'Business and management',
  description: 'Preview academic workspace data. No real client information is displayed.',
  createdAt: past(8),
  updatedAt: past(1),
  milestones: [
    { _id: 'milestone-1', stage: 1, name: 'Research and outline', label: 'Research and outline', title: 'Research and outline', status: 'completed', completed: true, paid: true, amount: 180, due_date: past(2) },
    { _id: 'milestone-2', stage: 2, name: 'First draft', label: 'First draft', title: 'First draft', status: 'active', completed: false, paid: false, amount: 220, due_date: future(5) },
    { _id: 'milestone-3', stage: 3, name: 'Review and delivery', label: 'Review and delivery', title: 'Review and delivery', status: 'pending', completed: false, paid: false, amount: 140, due_date: future(12) }
  ],
  files: [],
  messages: []
};

export const previewService = {
  _id: PREVIEW_SERVICE_ID,
  id: PREVIEW_SERVICE_ID,
  request_id: PREVIEW_SERVICE_ID,
  client_id: 'preview-client-001',
  provider_id: 'preview-provider-001',
  writer_id: 'preview-provider-001',
  family: 'professional',
  category: 'Business Services',
  service: 'Business Plan',
  title: 'Investor-ready business plan and financial model',
  description: 'Create a polished plan, market analysis and three-year financial forecast.',
  status: 'In Progress',
  progress: 42,
  budget: 850,
  price: 850,
  deadline: future(16),
  location: 'Remote',
  delivery_mode: 'Remote delivery',
  urgency: 'Standard',
  createdAt: past(5),
  updatedAt: past(1),
  quote: { amount: 850, total: 850, labor: 620, currency: 'USD', accepted: true, status: 'accepted' }
};

const previewWriter = {
  _id: 'preview-provider-001',
  writer_id: 'preview-provider-001',
  full_name: 'Preview Service Provider',
  email: 'provider.preview@ips.local',
  primary_expertise: 'Business and academic research',
  applicationStatus: 'approved',
  status: 'Active',
  availability: 'Available',
  rating: 4.9,
  projects_completed: 128
};

const previewClient = {
  _id: 'preview-client-001',
  client_id: 'preview-client-001',
  full_name: 'Preview Client',
  email: 'client.preview@ips.local',
  status: 'Active',
  createdAt: past(120)
};

const previewTicket = {
  _id: 'preview-ticket-001',
  ticket_id: 'TKT-1042',
  subject: 'Confirming delivery requirements',
  category: 'Order support',
  priority: 'normal',
  status: 'Open',
  createdAt: past(2),
  messages: [{ _id: 'ticket-message-1', sender_role: 'admin', body: 'This is safe sample preview content.', createdAt: past(1) }]
};

const previewConversation = {
  _id: 'preview-conversation-001',
  key: 'preview-conversation-001',
  conversation_id: 'preview-conversation-001',
  subject: 'Project progress and next steps',
  type: 'client_provider',
  work_id: PREVIEW_SERVICE_ID,
  channel: 'client_admin',
  title: 'Investor-ready business plan and financial model',
  category: 'Business Services',
  client_name: 'Preview Client',
  provider_name: 'Preview Service Provider',
  status: 'open',
  priority: 'normal',
  unread_count: 1,
  latest_message: 'The latest draft is ready for review.',
  latest_message_at: past(1),
  latest_at: past(1),
  latest_sender_role: 'writer',
  conversation_status: 'open',
  open_decisions: 0,
  pending_expenses: 0,
  escalated: false,
  tags: ['preview'],
  last_message_preview: 'The latest draft is ready for review.',
  participants: [
    { id: 'preview-client-001', role: 'client', name: 'Preview Client' },
    { id: 'preview-provider-001', role: 'writer', name: 'Preview Service Provider' }
  ]
};

const previewMessages = [
  { _id: 'preview-message-1', sender_id: 'preview-provider-001', sender_role: 'writer', body: 'The latest draft is ready for review.', attachments: [], createdAt: past(1) },
  { _id: 'preview-message-2', sender_id: 'preview-client-001', sender_role: 'client', body: 'Thank you. I will review the document today.', attachments: [], createdAt: past(0) }
];

const previewAction = {
  key: 'preview-action-001',
  source: 'deadline',
  source_id: PREVIEW_ORDER_ID,
  work_id: PREVIEW_ORDER_ID,
  title: 'Review the next project milestone',
  reason: 'The first-draft checkpoint is approaching.',
  category: 'deadlines',
  priority: 'high',
  status: 'pending',
  overdue: false,
  created_at: past(1),
  due_at: future(2),
  work: { id: 'IPS-ACADEMIC-1042', mongo_id: PREVIEW_ORDER_ID, kind: 'academic', client: 'Preview Client', provider: 'Preview Service Provider', category: 'Academic Services' }
};

const basePayload = {
  success: true,
  preview: true,
  message: 'Preview mode uses deterministic sample data.',
  orders: [previewOrder],
  order: previewOrder,
  requests: [previewService],
  request: previewService,
  services: [previewService],
  writers: [previewWriter],
  writer: previewWriter,
  clients: [previewClient],
  client: previewClient,
  tickets: [previewTicket],
  ticket: previewTicket,
  conversations: [previewConversation],
  conversation: previewConversation,
  messages: previewMessages,
  viewer_id: 'preview-admin-001',
  actions: [previewAction],
  files: [],
  quotes: [{ _id: 'preview-quote-001', amount: 850, currency: 'USD', status: 'accepted', createdAt: past(3) }],
  decisions: [],
  expenses: [],
  payments: [],
  audit: [],
  direct_contact_enabled: false,
  summary: { total: 1, urgent: 0, overdue: 0, in_progress: 1 },
  analytics: {
    counts: {
      academicOrders: 1284,
      serviceRequests: 317,
      activeWork: 42,
      newSignups30d: 38,
      openTickets: 6,
      clients: 642,
      providers: 86
    },
    finance: {
      paidAcademic: 184250,
      outstandingAcademic: 12600,
      acceptedServiceValue: 48900,
      trackedValue: 245750
    },
    attention: [previewOrder],
    recentActivity: [{ kind: 'academic', id: PREVIEW_ORDER_ID, text: 'Preview order moved into progress', target: `/admin/orders/${PREVIEW_ORDER_ID}`, date: past(1), status: 'In Progress' }],
    outstandingAcademicOrders: [{ ...previewOrder, client_name: 'Preview Client', outstanding: 360 }],
    byService: [
      { type: 'Academic', service: 'Thesis Writing', value: 184250, count: 1284 },
      { type: 'Professional', service: 'Business Plans', value: 48900, count: 92 }
    ],
    byCountry: [
      { country: 'United Kingdom', count: 426, value: 98200 },
      { country: 'United States', count: 351, value: 87550 }
    ]
  },
  directory: {
    clients: [previewClient],
    writers: [previewWriter],
    providers: [previewWriter],
    admins: [{ id: 'preview-admin-001', full_name: 'Preview Super Admin', email: 'admin.preview@ips.local' }],
    jobs: [{ work_id: PREVIEW_SERVICE_ID, title: previewService.title, kind: 'service' }]
  },
  jobs: [{ work_id: PREVIEW_SERVICE_ID, title: previewService.title, kind: 'service' }]
};

const jsonResponse = (payload = basePayload, status = 200) => new Response(JSON.stringify(payload), {
  status,
  headers: { 'Content-Type': 'application/json', 'X-IPS-Preview': 'true' }
});

const responseFor = rawUrl => {
  const url = new URL(typeof rawUrl === 'string' ? rawUrl : rawUrl.url, window.location.origin);
  const path = url.pathname;
  if (/\/api\/orders\/[^/]+\/workspace$/.test(path)) {
    return jsonResponse({ ...basePayload, order: previewOrder, files: [], messages: previewMessages, audit: [], expenses: [], direct_contact_enabled: false });
  }
  if (/\/api\/orders\/[^/]+$/.test(path)) return jsonResponse({ ...basePayload, order: previewOrder });
  if (/\/api\/services\/[^/]+$/.test(path)) return jsonResponse({ ...basePayload, request: previewService });
  if (/\/api\/conversations\/[^/]+\/messages$/.test(path)) {
    return jsonResponse({ ...basePayload, conversation: previewConversation, messages: previewMessages });
  }
  if (/\/api\/conversations\/[^/]+$/.test(path)) return jsonResponse({ ...basePayload, conversation: previewConversation });
  if (path === '/api/messaging/directory') return jsonResponse({ ...basePayload, ...basePayload.directory });
  if (path === '/api/admins') return jsonResponse({ ...basePayload, admins: [], rootAdmin: { id: 'preview-admin-001', name: 'Preview Super Admin', email: 'admin.preview@ips.local' } });
  if (path === '/api/admin-roles') return jsonResponse({ ...basePayload, roles: [] });
  if (path === '/api/admin/permissions') return jsonResponse({
    ...basePayload,
    permissions: [
      { id: 'platform.access', label: 'Platform access', description: 'Open Mission Control.' },
      { id: 'design.view', label: 'View Platform Studio', description: 'Review the public-site design workspace.' }
    ],
    builtInRoles: {
      superadmin: { label: 'Super Admin', description: 'Full platform authority.' },
      moderator: { label: 'Moderator', description: 'Operational access with controlled permissions.' }
    }
  });
  if (path === '/api/admin/audit-logs') return jsonResponse({ ...basePayload, logs: [] });
  if (path === '/api/admin/data-summary') return jsonResponse({ ...basePayload, collections: { clients: 642, writers: 86, orders: 1284, services: 317 } });
  return jsonResponse(basePayload);
};

export function installPreviewSafetyRuntime() {
  if (window.__IPS_PREVIEW_RUNTIME__) return;
  const nativeFetch = window.fetch.bind(window);
  window.__IPS_PREVIEW_RUNTIME__ = { nativeFetch };
  window.fetch = (input, options) => {
    const url = new URL(typeof input === 'string' ? input : input.url, window.location.origin);
    if (!url.pathname.startsWith('/api/')) return nativeFetch(input, options);
    return Promise.resolve(responseFor(input));
  };
  window.confirm = () => false;
  window.prompt = () => null;
  window.alert = () => {};
  window.open = () => null;
}
