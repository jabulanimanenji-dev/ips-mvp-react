import test from 'node:test';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import { STUDENT_DEPARTMENTS, STUDENT_OFFERS, getStudentOffer, isStudentSupportRequest } from '../shared/studentOffers.js';
import { validateStudentQuote, verifyStripeSignature } from '../services/studentPayments.js';

const approved = (overrides={}) => ({
  family: 'professional', category: 'Academic Support', status: 'Quote Accepted',
  client_id: 'C-123', quote: { accepted: true, accepted_by: 'C-123', currency: 'PLN', total: 199.90, version: 2 },
  ...overrides
});

test('exact student catalogue is unique and restricted to support', () => {
  assert.equal(STUDENT_OFFERS.length, 16);
  assert.equal(STUDENT_DEPARTMENTS.length, 6);
  assert.ok(STUDENT_OFFERS.every(item => STUDENT_DEPARTMENTS.some(dept => dept.id === item.department)));
  assert.equal(new Set(STUDENT_OFFERS.map(offer => offer.id)).size, 16);
  assert.ok(getStudentOffer('thesis-support'));
  assert.equal(getStudentOffer('unsupported'), null);
  assert.ok(isStudentSupportRequest(approved()));
  assert.ok(!isStudentSupportRequest({ family: 'odd_job', category: 'Academic Support' }));
});

test('accepted quote maps to trusted payment amount', () => {
  assert.deepEqual(validateStudentQuote(approved()), { amountMinor: 19990, currency: 'pln', quoteVersion: 2 });
});

test('students cannot pay an unaccepted or another clients quote', () => {
  assert.throws(() => validateStudentQuote(approved({ quote: { total: 199, currency: 'PLN', accepted: false } })), /Accept/);
  assert.throws(() => validateStudentQuote(approved({ quote: { total: 199, currency: 'PLN', accepted: true, accepted_by: 'C-999' } })), /Accept/);
  assert.throws(() => validateStudentQuote(approved({ category: 'Other' })), /only available/);
});

test('invalid, canceled, expired and non-money amounts are blocked', () => {
  assert.throws(() => validateStudentQuote(approved({ status: 'Cancelled' })), /cannot be paid/);
  assert.throws(() => validateStudentQuote(approved({ quote: { accepted: true, accepted_by:'C-123', total:0, currency:'PLN' } })), /invalid/);
  assert.throws(() => validateStudentQuote(approved({ quote: { accepted: true, accepted_by:'C-123', total:5, currency:'JPY' } })), /not supported/);
  assert.throws(() => validateStudentQuote(approved({ quote: { accepted: true, accepted_by:'C-123', total:5, currency:'PLN', expires_at: new Date(0) } })), /expired/);
});

test('valid Stripe signature passes, modified data and stale timestamps fail', () => {
  const raw = Buffer.from(JSON.stringify({ id:'evt_example', type:'checkout.session.completed' }));
  const ts = Math.floor(Date.now()/1000);
  const secret = 'whsec_test_only';
  const sig = crypto.createHmac('sha256',secret).update(Buffer.from(ts+'.')).update(raw).digest('hex');
  assert.equal(verifyStripeSignature(raw,'t='+ts+',v1='+sig,secret),true);
  assert.equal(verifyStripeSignature(Buffer.from('{}'),'t='+ts+',v1='+sig,secret),false);
  assert.equal(verifyStripeSignature(raw,'t='+(ts-400)+',v1='+sig,secret),false);
  assert.equal(verifyStripeSignature(raw,'t='+ts+',v1=bad',secret),false);
});
