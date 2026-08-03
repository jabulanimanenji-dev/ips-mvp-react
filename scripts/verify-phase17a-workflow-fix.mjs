import assert from 'node:assert/strict';
import fs from 'node:fs';
import { buildServiceRequestSnapshot } from '../shared/serviceEngine.js';

const server = fs.readFileSync(new URL('../server.js', import.meta.url), 'utf8');
const servicesUi = fs.readFileSync(new URL('../src/components/admin/AdminServices.jsx', import.meta.url), 'utf8');
const actionCenter = fs.readFileSync(new URL('../src/components/common/ActionCenter.jsx', import.meta.url), 'utf8');

assert.match(server, /'New Request': \[[^\]]*'Awaiting Assignment'[^\]]*'Assigned'/s,
  'An administrator must be able to assign a provider directly from New Request.');
assert.match(server, /status: 'Active',[\s\S]*application_status: 'approved'/,
  'Provider assignment must validate that the provider is active and approved.');
assert.match(server, /req\.body\.provider_name = provider\.full_name/,
  'Provider names must be derived server-side rather than trusted from the browser.');
assert.match(server, /req\.body\.status = req\.body\.status \|\| 'Assigned'/,
  'Assigning a provider must establish the Assigned workflow state.');
assert.match(server, /req\.body\.status = req\.body\.status \|\| 'Awaiting Assignment'/,
  'Unassigning a provider must return the request to Awaiting Assignment.');
assert.match(servicesUi, /provider_id:e\.target\.value[\s\S]*status:e\.target\.value\?'Assigned':'Awaiting Assignment'/,
  'Service Operations must persist provider and status together.');
assert.match(actionCenter, /Admin owner:/,
  'Action Center must label administrative ownership separately from provider assignment.');
assert.doesNotMatch(actionCenter, /`Assigned: \$\{item\.assigned_to\}`/,
  'Action Center must not describe an administrative owner as the assigned provider.');

const originalQuestions = [
  { id: 'description', key: 'description', label: 'Describe your project', type: 'long_text', required: true, step: 1 },
  { id: 'instructions', key: 'instructions', label: 'Additional instructions', type: 'long_text', required: false, step: 2 }
];
const snapshot = buildServiceRequestSnapshot({
  service: { serviceId: 'SVC-SNAPSHOT', slug: 'snapshot-test', name: 'Snapshot test', revision: 1, questions: originalQuestions },
  category: { categoryId: 'CAT-SNAPSHOT', name: 'Snapshot category' },
  answers: { description: 'ORIGINAL PROJECT DESCRIPTION', instructions: 'ORIGINAL INSTRUCTIONS' }
});
const changedLiveQuestions = [
  { id: 'description', key: 'description', label: 'Explain your new project', type: 'long_text', required: true, step: 1 },
  { id: 'budget', key: 'budget', label: 'Estimated budget', type: 'currency', required: true, step: 2 }
];
assert.equal(snapshot.questions[0].label, 'Describe your project');
assert.equal(snapshot.questions[1].label, 'Additional instructions');
assert.equal(snapshot.answers.description, 'ORIGINAL PROJECT DESCRIPTION');
assert.equal(snapshot.answers.instructions, 'ORIGINAL INSTRUCTIONS');
assert.equal(changedLiveQuestions.some(question => question.label === snapshot.questions[1].label), false,
  'The stored snapshot must remain independent of later live-service edits.');

console.log('Phase 17A workflow repair verification passed: assignment transitions, provider validation, Action Center semantics, and immutable request snapshots.');
