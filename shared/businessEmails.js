// Proposed IPS business email identities for ipsglobalservice.com.
// These addresses become operational ONLY after Cloudflare routing and
// the outbound provider have been independently configured and verified.
export const IPS_EMAIL_DOMAIN = 'ipsglobalservice.com';
export const IPS_EMAILS = Object.freeze({
  contact: 'contact@ipsglobalservice.com',
  support: 'support@ipsglobalservice.com',
  orders: 'orders@ipsglobalservice.com',
  billing: 'billing@ipsglobalservice.com',
  privacy: 'privacy@ipsglobalservice.com'
});
export const IPS_MAIL_SENDER_NAME = 'IPS Academic Services';
export const isIPSEmail = value =>
  typeof value === 'string' &&
  Object.values(IPS_EMAILS).includes(value.trim().toLowerCase());
