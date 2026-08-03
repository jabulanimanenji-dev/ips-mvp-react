import assert from 'node:assert/strict';
import fs from 'node:fs';
import { buildServiceRequestSnapshot, isServiceQuestionVisible, validateServiceRuntimeAnswers } from '../shared/serviceEngine.js';

const questions = [
  { id: 'need', key: 'need', label: 'Do you need details?', type: 'boolean', required: true, step: 1 },
  { id: 'details', key: 'details', label: 'Details', type: 'short_text', required: true, step: 2, condition: { enabled: true, questionId: 'need', operator: 'equals', value: 'yes' } }
];
assert.equal(isServiceQuestionVisible(questions[1], { need: 'yes' }), true);
assert.equal(isServiceQuestionVisible(questions[1], { need: 'no' }), false);
assert.equal(validateServiceRuntimeAnswers(questions, { need: 'no' }).valid, true);
const missing = validateServiceRuntimeAnswers(questions, { need: 'yes' });
assert.equal(missing.valid, false); assert.ok(missing.errors.details);
const snapshot = buildServiceRequestSnapshot({ service: { serviceId: 'SVC-VERIFY', slug: 'verify', name: 'Verify', revision: 4, questions }, category: { categoryId: 'CAT-VERIFY', name: 'Verify category' }, answers: { need: 'no' } });
assert.equal(snapshot.serviceRevision, 4); assert.equal(snapshot.answers.details, undefined);
const server = fs.readFileSync(new URL('../server.js', import.meta.url), 'utf8');
const ui = fs.readFileSync(new URL('../src/components/public/DynamicServiceRequestForm.jsx', import.meta.url), 'utf8');
for (const token of ["/api/service-catalog/:slug/runtime", "/api/service-catalog/:slug/requests", 'service_engine_request_created']) assert.ok(server.includes(token), `Missing ${token}`);
for (const token of ['dynamic-stepbar', 'fieldErrors', 'onSubmitted', 'api/service-catalog/']) assert.ok(ui.includes(token), `Missing ${token}`);
console.log('Phase 17A.3 and 17A.4 verification passed.');
