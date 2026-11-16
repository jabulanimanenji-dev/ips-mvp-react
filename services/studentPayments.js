import crypto from 'node:crypto';
import { isStudentSupportRequest } from '../shared/studentOffers.js';

const allowedCurrencies = new Set(['usd', 'eur', 'pln']);
const safeError = error => error instanceof Error ? error.message : 'Unexpected payment error';

export function validateStudentQuote(order, now = new Date()) {
  if (!isStudentSupportRequest(order)) throw new Error('This checkout is only available for student-support requests.');
  if (['Cancelled', 'Disputed', 'Completed'].includes(order.status)) throw new Error('This request cannot be paid in its current state.');
  if (!order.quote?.accepted || order.quote.accepted_by !== order.client_id) throw new Error('Accept the current quotation before paying.');
  if (order.quote.expires_at && new Date(order.quote.expires_at) <= now) throw new Error('This quotation has expired.');
  const total = Number(order.quote.total);
  const currency = String(order.quote.currency || '').toLowerCase();
  if (!Number.isFinite(total) || total < 1 || total > 100000 || Math.round(total * 100) !== total * 100) {
    throw new Error('The quotation amount is invalid.');
  }
  if (!allowedCurrencies.has(currency)) throw new Error('This quotation currency is not supported.');
  return { amountMinor: Math.round(total * 100), currency, quoteVersion: Number(order.quote.version || 0) };
}

export function verifyStripeSignature(payload, header, secret, now = Date.now()) {
  if (!Buffer.isBuffer(payload) || !secret || typeof header !== 'string') return false;
  const parts = header.split(',').map(part => part.trim());
  const ts = Number(parts.find(part => part.startsWith('t='))?.slice(2));
  const signatures = parts.filter(part => part.startsWith('v1=')).map(part => part.slice(3));
  if (!Number.isSafeInteger(ts) || Math.abs(Math.floor(now / 1000) - ts) > 300) return false;
  const expected = crypto.createHmac('sha256', secret).update(Buffer.from(String(ts) + '.')).update(payload).digest();
  return signatures.some(value => {
    if (!/^[a-f0-9]{64}$/i.test(value)) return false;
    return crypto.timingSafeEqual(expected, Buffer.from(value, 'hex'));
  });
}

export function registerStudentWebhook(app, express, { StudentPayment, ServiceRequest }) {
  // This route MUST be registered before express.json so Stripe signs the exact raw bytes.
  app.post('/api/student-payments/stripe-webhook', express.raw({ type: 'application/json', limit: '256kb' }), async (req, res) => {
    if (!verifyStripeSignature(req.body, req.headers['stripe-signature'], process.env.STRIPE_WEBHOOK_SECRET)) {
      return res.status(400).json({ success: false, error: 'Invalid payment signature.' });
    }
    try {
      const event = JSON.parse(req.body.toString('utf8'));
      const session = event.data?.object || {};
      if (!event.id || !session.id || !event.type) return res.status(400).json({ success: false, error: 'Malformed payment event.' });
      const supported = new Set(['checkout.session.completed', 'checkout.session.async_payment_succeeded', 'checkout.session.async_payment_failed', 'checkout.session.expired']);
      if (!supported.has(event.type)) return res.json({ received: true });
      const payment = await StudentPayment.findOne({ provider_session_id: session.id });
      if (!payment) return res.status(404).json({ success: false, error: 'Payment session was not registered.' });
      const isSuccess = event.type === 'checkout.session.async_payment_succeeded' || (event.type === 'checkout.session.completed' && session.payment_status === 'paid');
      if (isSuccess) {
        if (session.client_reference_id !== payment.request_id || Number(session.amount_total) !== payment.amount_minor || String(session.currency || '').toLowerCase() !== payment.currency) {
          await StudentPayment.updateOne({ _id: payment._id, status: { $ne: 'paid' } }, { $set: { status: 'review_required', problem: 'Provider amount, currency or order identity mismatch', last_event_id: event.id } });
          return res.json({ received: true, review_required: true });
        }
        const order = await ServiceRequest.findOne({ request_id: payment.request_id, client_id: payment.client_id });
        if (!order || Number(order.quote?.version || 0) !== payment.quote_version || !order.quote?.accepted || Number(order.quote?.total) * 100 !== payment.amount_minor) {
          await StudentPayment.updateOne({ _id: payment._id, status: { $ne: 'paid' } }, { $set: { status: 'review_required', problem: 'Quote changed after checkout', last_event_id: event.id } });
          return res.json({ received: true, review_required: true });
        }
        await StudentPayment.updateOne({ _id: payment._id }, { $set: { status: 'paid', paid_at: payment.paid_at || new Date(), provider_payment_intent: session.payment_intent || '', last_event_id: event.id } });
        // Independent, idempotent order transition. Repeated callbacks cannot duplicate the fulfillment entry.
        await ServiceRequest.updateOne(
          { request_id: payment.request_id, client_id: payment.client_id, payment_status: { $ne: 'paid' }, 'quote.version': payment.quote_version, 'quote.accepted': true },
          { $set: { payment_status: 'paid' }, $push: { status_history: { status: order.status, actor_id: 'stripe', actor_role: 'system', reason: 'Verified payment received' } } }
        );
      } else if (event.type === 'checkout.session.completed') {
        await StudentPayment.updateOne({ _id: payment._id, status: { $nin: ['paid', 'review_required'] } }, { $set: { status: 'processing', last_event_id: event.id } });
      } else {
        await StudentPayment.updateOne({ _id: payment._id, status: { $nin: ['paid', 'review_required'] } }, { $set: { status: event.type.endsWith('expired') ? 'expired' : 'failed', last_event_id: event.id } });
      }
      res.json({ received: true });
    } catch (error) {
      console.error('Student payment webhook failed:', safeError(error));
      res.status(500).json({ success: false, error: 'Payment event could not be processed.' });
    }
  });
}

export function registerStudentPaymentRoutes(app, { requireSession, StudentPayment, ServiceRequest }) {
  app.get('/api/student-payments/status/:requestId', async (req, res) => {
    try {
      const session = requireSession(req, res);
      if (!session) return;
      const order = await ServiceRequest.findOne({ request_id: req.params.requestId });
      if (!order || !isStudentSupportRequest(order)) return res.status(404).json({ success: false, error: 'Student request not found.' });
      if (session.role !== 'admin' && !(session.role === 'client' && session.id === order.client_id)) return res.status(403).json({ success: false, error: 'Access denied.' });
      const payment = await StudentPayment.findOne({ request_id: order.request_id }).sort({ createdAt: -1 }).lean();
      res.json({ success: true, payment_status: order.payment_status || 'unpaid', payment: payment ? {
        status: payment.status, currency: payment.currency, amount_minor: payment.amount_minor, paid_at: payment.paid_at
      } : null });
    } catch (error) {
      console.error('Student payment status failed:', safeError(error));
      res.status(500).json({ success: false, error: 'Payment status is unavailable.' });
    }
  });

  app.post('/api/student-payments/checkout', async (req, res) => {
    try {
      const session = requireSession(req, res);
      if (!session) return;
      if (session.role !== 'client') return res.status(403).json({ success: false, error: 'Client access is required.' });
      const order = await ServiceRequest.findOne({ request_id: String(req.body?.request_id || ''), client_id: session.id });
      if (!order) return res.status(404).json({ success: false, error: 'Request not found.' });
      const { amountMinor, currency, quoteVersion } = validateStudentQuote(order);
      if (order.payment_status === 'paid') return res.status(409).json({ success: false, error: 'This order is already paid.' });
      if (!process.env.STRIPE_SECRET_KEY || !process.env.STRIPE_WEBHOOK_SECRET || !process.env.PUBLIC_APP_URL) {
        return res.status(503).json({ success: false, error: 'Secure checkout is not configured yet.' });
      }
      const appUrl = new URL(process.env.PUBLIC_APP_URL);
      if (!['https:', 'http:'].includes(appUrl.protocol) || (process.env.NODE_ENV === 'production' && appUrl.protocol !== 'https:')) {
        return res.status(503).json({ success: false, error: 'Secure checkout URL is misconfigured.' });
      }
      const previous = await StudentPayment.findOne({ request_id: order.request_id, quote_version: quoteVersion, status: 'pending', checkout_expires_at: { $gt: new Date(Date.now() + 60000) } }).sort({ createdAt: -1 });
      if (previous?.checkout_url) return res.json({ success: true, checkout_url: previous.checkout_url });
      const payment = await StudentPayment.create({
        payment_id: crypto.randomUUID(), request_id: order.request_id, client_id: session.id,
        quote_version: quoteVersion, amount_minor: amountMinor, currency, status: 'pending'
      });
      const params = new URLSearchParams();
      params.set('mode', 'payment');
      params.set('client_reference_id', order.request_id);
      params.set('customer_email', order.client_email);
      params.set('success_url', new URL('/client/services/' + encodeURIComponent(order.request_id) + '?checkout=returned', appUrl).toString());
      params.set('cancel_url', new URL('/client/services/' + encodeURIComponent(order.request_id) + '?checkout=cancelled', appUrl).toString());
      params.set('line_items[0][price_data][currency]', currency);
      params.set('line_items[0][price_data][unit_amount]', String(amountMinor));
      params.set('line_items[0][price_data][product_data][name]', order.title.slice(0, 160));
      params.set('line_items[0][quantity]', '1');
      params.set('metadata[request_id]', order.request_id);
      params.set('metadata[payment_id]', payment.payment_id);
      let response;
      try {
        response = await fetch('https://api.stripe.com/v1/checkout/sessions', {
          method: 'POST',
          headers: { Authorization: 'Bearer ' + process.env.STRIPE_SECRET_KEY, 'Content-Type': 'application/x-www-form-urlencoded', 'Idempotency-Key': payment.payment_id },
          body: params,
          signal: AbortSignal.timeout(15000)
        });
      } catch (error) {
        await StudentPayment.updateOne({ _id: payment._id }, { $set: { status: 'failed', problem: safeError(error).slice(0, 160) } });
        return res.status(502).json({ success: false, error: 'Payment provider is unavailable.' });
      }
      const provider = await response.json();
      if (!response.ok || !provider.id || !provider.url) {
        await StudentPayment.updateOne({ _id: payment._id }, { $set: { status: 'failed', problem: 'Provider session creation failed' } });
        return res.status(502).json({ success: false, error: 'Could not start secure checkout.' });
      }
      payment.provider_session_id = provider.id;
      payment.checkout_url = provider.url;
      payment.checkout_expires_at = new Date(Number(provider.expires_at) * 1000);
      await payment.save();
      res.json({ success: true, checkout_url: provider.url });
    } catch (error) {
      console.error('Student checkout failed:', safeError(error));
      res.status(400).json({ success: false, error: safeError(error) });
    }
  });
}
