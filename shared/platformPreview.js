import { PAGE_CATALOG } from './platformConfig.js';

export const PREVIEW_ORDER_ID = 'preview-order-001';
export const PREVIEW_SERVICE_ID = 'preview-service-001';

const PATH_OVERRIDES = {
  'client.order-detail': `/client/orders/${PREVIEW_ORDER_ID}`,
  'client.service-detail': `/client/services/${PREVIEW_SERVICE_ID}`,
  'writer.order-detail': `/writer/orders/${PREVIEW_ORDER_ID}`,
  'writer.service-detail': `/writer/services/${PREVIEW_SERVICE_ID}`,
  'admin.order-detail': `/admin/orders/${PREVIEW_ORDER_ID}`,
  'admin.service-detail': `/admin/services/${PREVIEW_SERVICE_ID}`
};

export const PREVIEW_DYNAMIC_PAGE_IDS = Object.freeze(Object.keys(PATH_OVERRIDES));

// Kept explicit so automated verification fails if a registry page is added
// without a corresponding safe renderer in PlatformPreviewApp.
export const PREVIEW_RENDERED_PAGE_IDS = Object.freeze([
  'public.home',
  'public.services',
  'public.quote',
  'public.login',
  'public.signup',
  'public.join',
  'public.provider-application',
  'client.overview',
  'client.orders',
  'client.order-detail',
  'client.new-order',
  'client.services',
  'client.service-detail',
  'client.messages',
  'client.profile',
  'client.support',
  'writer.login',
  'writer.dashboard',
  'writer.orders',
  'writer.order-detail',
  'writer.services',
  'writer.service-detail',
  'writer.messages',
  'writer.actions',
  'admin.login',
  'admin.dashboard',
  'admin.orders',
  'admin.order-detail',
  'admin.services',
  'admin.service-detail',
  'admin.clients',
  'admin.writers',
  'admin.payments',
  'admin.cms',
  'admin.access',
  'admin.messages',
  'admin.job-messages',
  'admin.actions',
  'admin.support',
  'admin.reports',
  'admin.settings'
]);

export function resolvePreviewPath(pageId, adminEntryPath = '/ips-mission-control') {
  if (pageId === 'admin.login') return adminEntryPath;
  if (PATH_OVERRIDES[pageId]) return PATH_OVERRIDES[pageId];
  return PAGE_CATALOG.find(page => page.id === pageId)?.path || '/';
}

export const isDynamicPreviewPage = pageId => PREVIEW_DYNAMIC_PAGE_IDS.includes(pageId);
