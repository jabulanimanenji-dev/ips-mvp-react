export const ADMIN_PERMISSION_CATALOG = [
  ['platform.access', 'Access admin portal', 'Open Mission Control and shared admin APIs.'],
  ['dashboard.view', 'View dashboard', 'View operational summaries and activity.'],
  ['orders.view', 'View academic orders', 'Inspect academic orders and workspaces.'],
  ['orders.manage', 'Manage academic orders', 'Update, assign, approve, or delete academic orders.'],
  ['services.view', 'View service operations', 'Inspect professional and odd-job requests.'],
  ['services.manage', 'Manage service operations', 'Quote, assign, update, and close service requests.'],
  ['clients.view', 'View clients', 'View client profiles and history.'],
  ['clients.manage', 'Manage clients', 'Edit, suspend, or remove clients.'],
  ['providers.view', 'View providers', 'View provider profiles and work.'],
  ['providers.manage', 'Manage providers', 'Create, edit, suspend, and assign providers.'],
  ['files.view', 'View files and evidence', 'Inspect governed job files.'],
  ['files.manage', 'Govern files and evidence', 'Approve, reject, release, archive, and upload files.'],
  ['messages.view', 'View communications', 'Read permitted direct and job conversations.'],
  ['messages.manage', 'Manage communications', 'Reply, assign, escalate, redact, and resolve conversations.'],
  ['support.view', 'View support tickets', 'Inspect client support cases.'],
  ['support.manage', 'Manage support tickets', 'Reply, assign, prioritize, resolve, and close cases.'],
  ['actions.view', 'View action centre', 'View pending approvals and operational tasks.'],
  ['actions.manage', 'Manage action centre', 'Approve, reject, assign, and resolve tasks.'],
  ['payments.view', 'View financial tracking', 'View milestones, quotes, and tracked value.'],
  ['payments.manage', 'Manage financial records', 'Update payment and reconciliation records.'],
  ['reports.view', 'View reports', 'View analytics across platform services.'],
  ['data.export', 'Export platform data', 'Download sanitized business-data exports.'],
  ['settings.view', 'View settings', 'View database and platform settings.'],
  ['settings.manage', 'Manage settings', 'Change operational platform settings.'],
  ['design.view', 'View Visual Builder', 'Open drafts, previews, and version history.'],
  ['design.edit', 'Edit Visual Builder drafts', 'Edit pages, layout, navigation, content, and theme drafts.'],
  ['design.publish', 'Publish Visual Builder', 'Publish, schedule, or roll back visual releases.'],
  ['media.manage', 'Manage media library', 'Upload, edit, replace, and remove visual assets.'],
  ['administrators.manage', 'Manage administrators', 'Create, reset, suspend, and permission administrators.'],
  ['audit.view', 'View security audit', 'Inspect administrator and system audit events.']
].map(([id, label, description]) => ({ id, label, description }));

const all = ADMIN_PERMISSION_CATALOG.map(item => item.id);

export const BUILT_IN_ADMIN_ROLES = {
  superadmin: {
    label: 'Super Admin',
    description: 'Full God Mode authority across the platform.',
    permissions: ['*'],
    protected: true
  },
  admin: {
    label: 'Administrator',
    description: 'Full operational management without administrator ownership controls.',
    permissions: all.filter(id => id !== 'administrators.manage'),
    protected: true
  },
  moderator: {
    label: 'Moderator',
    description: 'Moderates support, communications, files, and pending actions.',
    permissions: [
      'platform.access', 'dashboard.view', 'orders.view', 'services.view', 'clients.view',
      'providers.view', 'files.view', 'files.manage', 'messages.view', 'messages.manage',
      'support.view', 'support.manage', 'actions.view', 'actions.manage', 'reports.view'
    ],
    protected: true
  },
  support: {
    label: 'Support Agent',
    description: 'Handles clients, support tickets, and permitted communications.',
    permissions: [
      'platform.access', 'dashboard.view', 'clients.view', 'orders.view', 'services.view',
      'messages.view', 'messages.manage', 'support.view', 'support.manage', 'actions.view'
    ],
    protected: true
  },
  finance: {
    label: 'Finance Manager',
    description: 'Manages payment tracking, quotes, finance reports, and exports.',
    permissions: [
      'platform.access', 'dashboard.view', 'orders.view', 'services.view', 'clients.view',
      'payments.view', 'payments.manage', 'reports.view', 'data.export'
    ],
    protected: true
  },
  content: {
    label: 'Content Designer',
    description: 'Creates visual drafts and manages media without publishing authority.',
    permissions: ['platform.access', 'dashboard.view', 'design.view', 'design.edit', 'media.manage'],
    protected: true
  },
  auditor: {
    label: 'Audit Viewer',
    description: 'Read-only access to reports, settings inventory, and audit records.',
    permissions: [
      'platform.access', 'dashboard.view', 'orders.view', 'services.view', 'clients.view',
      'providers.view', 'files.view', 'messages.view', 'support.view', 'actions.view',
      'payments.view', 'reports.view', 'settings.view', 'audit.view'
    ],
    protected: true
  }
};

export const rolePermissions = (role, explicit = []) => {
  if (role === 'superadmin') return ['*'];
  if (role === 'custom') {
    return [...new Set(['platform.access', ...((Array.isArray(explicit) ? explicit : []).filter(id => all.includes(id)))])];
  }
  if (BUILT_IN_ADMIN_ROLES[role]) return [...BUILT_IN_ADMIN_ROLES[role].permissions];
  if (Array.isArray(explicit) && explicit.length) return [...new Set(['platform.access', ...explicit.filter(id => all.includes(id))])];
  return [...(BUILT_IN_ADMIN_ROLES[role]?.permissions || BUILT_IN_ADMIN_ROLES.moderator.permissions)];
};

export const hasAdminPermission = (access, permission) =>
  Boolean(access?.isSuperAdmin || access?.permissions?.includes('*') || access?.permissions?.includes(permission));

export const ADMIN_NAV_PERMISSIONS = {
  '/admin/dashboard': 'dashboard.view',
  '/admin/orders': 'orders.view',
  '/admin/services': 'services.view',
  '/admin/clients': 'clients.view',
  '/admin/writers': 'providers.view',
  '/admin/payments': 'payments.view',
  '/admin/cms': 'design.view',
  '/admin/messages': 'messages.view',
  '/admin/support': 'support.view',
  '/admin/actions': 'actions.view',
  '/admin/reports': 'reports.view',
  '/admin/settings': 'settings.view',
  '/admin/access': 'administrators.manage'
};

const mutationPermission = (method, view, manage) => method === 'GET' ? view : manage;

export const permissionForAdminRequest = (method, path) => {
  if (!String(path).startsWith('/api/')) return null;
  if ([
    '/api/admin/login', '/api/admin/me', '/api/logout', '/api/health', '/api/platform-config'
  ].includes(String(path))) return null;
  if (/^\/api\/media\/[^/]+$/.test(path) && method === 'GET') return null;
  if (path.startsWith('/api/admins') || path.startsWith('/api/admin-roles') || path.startsWith('/api/admin/permissions')) return 'administrators.manage';
  if (path.startsWith('/api/admin/platform-config')) {
    if (method === 'GET') return 'design.view';
    if (path.includes('/publish') || path.includes('/rollback')) return 'design.publish';
    return 'design.edit';
  }
  if (path.startsWith('/api/admin/service-engine')) {
    if (method === 'GET') return 'design.view';
    if (/\/(publish|pause|archive|restore)$/.test(path)) return 'design.publish';
    return 'design.edit';
  }
  if (path.startsWith('/api/admin/media')) return method === 'GET' ? 'design.view' : 'media.manage';
  if (path.startsWith('/api/admin/audit-logs')) return 'audit.view';
  if (path.startsWith('/api/admin/export')) return 'data.export';
  if (path.startsWith('/api/admin/data-summary')) return 'settings.view';
  if (path.startsWith('/api/admin/analytics')) return 'reports.view';
  if (path.startsWith('/api/clients')) return mutationPermission(method, 'clients.view', 'clients.manage');
  if (path.startsWith('/api/writers')) return mutationPermission(method, 'providers.view', 'providers.manage');
  if (path.startsWith('/api/orders')) {
    if (path.includes('/files')) return mutationPermission(method, 'files.view', 'files.manage');
    if (path.includes('/messages') || path.includes('/workspace')) return mutationPermission(method, 'messages.view', 'messages.manage');
    return mutationPermission(method, 'orders.view', 'orders.manage');
  }
  if (path.startsWith('/api/services')) return mutationPermission(method, 'services.view', 'services.manage');
  if (path.startsWith('/api/support-tickets')) return mutationPermission(method, 'support.view', 'support.manage');
  if (path.startsWith('/api/actions')) return mutationPermission(method, 'actions.view', 'actions.manage');
  if (path.startsWith('/api/conversations') || path.startsWith('/api/direct-') || path.startsWith('/api/admin/inbox')) {
    return mutationPermission(method, 'messages.view', 'messages.manage');
  }
  if (path.includes('/files')) return mutationPermission(method, 'files.view', 'files.manage');
  if (path.includes('/decisions') || path.includes('/expenses')) return mutationPermission(method, 'actions.view', 'actions.manage');
  if (path.startsWith('/api/notifications')) return mutationPermission(method, 'messages.view', 'messages.manage');
  return 'platform.access';
};
