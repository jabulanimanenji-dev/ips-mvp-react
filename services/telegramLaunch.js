// Telegram Bot API production qualification and company webhook registration.
// Never log bot tokens, raw Telegram API JSON, chat IDs or private messages.
// All external calls happen before accepting strict production traffic.
const companyHostnames = new Set(['www.ipsglobalservice.com', 'ipsglobalservice.com']);

export async function qualifyCompanyTelegramWebhook({
  env = process.env, request = fetch, timeoutMs = 12000
} = {}) {
  if (env.NODE_ENV !== 'production' ||
      String(env.IPS_PUBLICATION_STRICT || '').toLowerCase() !== 'true' ||
      String(env.IPS_EVALUATION_MODE || '').toLowerCase() === 'true') {
    return { skipped: true };
  }
  const token = String(env.TELEGRAM_BOT_TOKEN || '').trim();
  const username = String(env.TELEGRAM_BOT_USERNAME || '').trim().replace(/^@/, '');
  const secret = String(env.TELEGRAM_WEBHOOK_SECRET || '').trim();
  if (!/^\d{5,15}:[A-Za-z0-9_-]{20,}$/.test(token))
    throw new Error('IPS Telegram token is missing or invalid; register the rotated production BotFather token in Render.');
  if (!/^[A-Za-z][A-Za-z0-9_]{4,31}$/.test(username))
    throw new Error('IPS Telegram bot username is invalid.');
  if (!/^[A-Za-z0-9_-]{16,256}$/.test(secret))
    throw new Error('IPS Telegram webhook secret must be 16-256 letters, digits, _ or - only.');
  let publicUrl;
  try {
    publicUrl = new URL(String(env.PUBLIC_APP_URL || ''));
    if (publicUrl.protocol !== 'https:' || !companyHostnames.has(publicUrl.hostname.toLowerCase()) ||
        publicUrl.port || publicUrl.search || publicUrl.hash || publicUrl.username || publicUrl.password ||
        publicUrl.pathname !== '/') throw Error('Invalid app origin');
  } catch {
    throw new Error('IPS Telegram webhook requires the verified company HTTPS origin.');
  }
  const expectedUrl = publicUrl.origin + '/api/channels/telegram/webhook';

  async function call(method, payload) {
    let response, data;
    try {
      response = await request('https://api.telegram.org/bot' + token + '/' + method, {
        method: 'POST', headers: {'Content-Type': 'application/json'},
        ...(payload ? { body: JSON.stringify(payload) } : {}),
        signal: AbortSignal.timeout(timeoutMs)
      });
      data = await response.json();
    } catch {
      throw new Error('IPS Telegram provider did not respond to ' + method + '.');
    }
    if (!response.ok || data?.ok !== true) {
      throw new Error('IPS Telegram provider rejected ' + method + '; check the live token, webhook and account permissions.');
    }
    return data.result;
  }

  const me = await call('getMe');
  if (!me?.is_bot || String(me.username || '').toLowerCase() !== username.toLowerCase())
    throw new Error('IPS Telegram BotFather token does not belong to the configured company bot.');

  const existing = await call('getWebhookInfo');
  const currentUrl = String(existing?.url || '');
  if (currentUrl && currentUrl !== expectedUrl) {
    throw new Error('IPS Telegram bot currently uses a different webhook; refusing to overwrite another service.');
  }
  const accepted = await call('setWebhook', {
    url: expectedUrl,
    secret_token: secret,
    allowed_updates: ['message'],
    drop_pending_updates: false,
    max_connections: 5
  });
  if (accepted !== true)
    throw new Error('IPS Telegram provider did not confirm webhook registration.');
  const verified = await call('getWebhookInfo');
  if (String(verified?.url || '') !== expectedUrl)
    throw new Error('IPS Telegram webhook readback does not match the company callback URL.');
  return { connected: true, bot: username, webhook_url: expectedUrl };
}
