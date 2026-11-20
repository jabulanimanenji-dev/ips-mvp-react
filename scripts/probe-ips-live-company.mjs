// Read-only IPS post-cutover qualification against the actual company domain.
// Never submit test accounts, consume business API keys or write customer data.
import assert from 'node:assert/strict';

const host = 'https://www.ipsglobalservice.com';
const outcomes = [];
async function request(path, expectedType = 'json') {
  const response = await fetch(host + path, {
    method: 'GET', redirect: 'error',
    headers: { Accept: expectedType === 'html' ? 'text/html' : 'application/json', 'Cache-Control': 'no-store' },
    signal: AbortSignal.timeout(15000)
  });
  const type = response.headers.get('content-type') || '';
  const body = expectedType === 'html'
    ? await response.text()
    : await response.json().catch(() => null);
  return { status: response.status, type, body };
}

try {
  const health = await request('/api/health');
  assert.equal(health.status, 200, 'Production health must answer HTTP 200');
  assert.equal(health.body?.ready, true);
  assert.equal(health.body?.database, 'connected');
  assert.equal(health.body?.storage, 'r2');
  outcomes.push('production-mongodb-r2-health:PASS');

  const channels = await request('/api/contact-channels/config');
  assert.equal(channels.status, 200);
  assert.equal(channels.body?.telegram?.available, true);
  assert.equal(channels.body?.whatsapp?.available, true);
  assert.equal(channels.body?.whatsapp?.mode, 'direct');
  assert.equal(channels.body?.whatsapp?.connected, false);
  assert.equal(channels.body?.whatsapp?.manual_confirmation, true);
  assert.equal(channels.body?.whatsapp?.url, 'https://wa.me/48794088714');
  outcomes.push('public-channels-telegram-and-manual-whatsapp:PASS');

  const quote = await request('/api/quote-requests/config');
  assert.equal(quote.status, 200);
  for (const property of ['success','accepting_requests','email','workspace','whatsapp','telegram','no_calls']) {
    assert.equal(quote.body?.[property], true, 'Quote configuration: ' + property);
  }
  outcomes.push('private-quote-intake-accepting:PASS');

  const enquiries = await request('/api/contact-enquiries/config');
  assert.equal(enquiries.status, 200);
  assert.equal(enquiries.body?.accepting_requests, true);
  assert.equal(enquiries.body?.email_replies_configured, true);
  outcomes.push('managed-enquiries-and-business-email-config:PASS');

  const payments = await request('/api/student-payments/config');
  assert.equal(payments.status, 200);
  assert.equal(payments.body?.enabled, false);
  assert.equal(payments.body?.pending, true);
  outcomes.push('payments-disabled:PASS');

  for (const [path, label] of [
    ['/api/contact-enquiries/admin','admin-enquiry-privacy'],
    ['/api/contact-channels/admin/threads','admin-channel-privacy'],
    ['/api/quote-requests/me','client-private-quotes-privacy'],
    ['/api/clients','client-directory-privacy'],
    ['/api/writers','specialist-directory-privacy'],
    ['/api/admins','staff-directory-privacy'],
    ['/api/services','private-projects-privacy']
  ]) {
    const result = await request(path);
    assert.equal(result.status, 401, label + ' must reject anonymous visitors');
    outcomes.push(label + ':PASS');
  }

  const archivedStudio = await request('/api/admin/service-engine');
  assert.equal(archivedStudio.status, 410, 'Archived universal-platform admin API must not be available in live IPS.');
  outcomes.push('no-cross-project-service-studio-api:PASS');

  for (const [path, label] of [
    ['/','public-website'],
    ['/login','client-login'],
    ['/writer/login','specialist-login'],
    ['/ips-mission-control','administrator-entry']
  ]) {
    const result = await request(path, 'html');
    assert.equal(result.status, 200, label + ' must be served');
    assert.match(result.type, /text\/html/i);
    assert.match(result.body, /<div id="root"><\/div>/i);
    outcomes.push(label + ':PASS');
  }

  console.log('IPS_LIVE_POSTCUTOVER_READONLY ' + JSON.stringify({host, outcomes}));
  console.log('SCOPE: HTTPS, API configuration, anonymous permission boundaries, HTML role entrypoints. Not provider delivery receipt or authenticated production lifecycle.');
} catch (error) {
  console.error('IPS_LIVE_POSTCUTOVER_BLOCKED ' + String(error?.message || error));
  process.exitCode = 1;
}
