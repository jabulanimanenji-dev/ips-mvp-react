import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import * as serviceEngine from '../shared/serviceEngine.js';
import { DEFAULT_PLATFORM_CONFIG, PAGE_CATALOG, normalisePlatformConfig } from '../shared/platformConfig.js';
import { permissionForAdminRequest } from '../shared/adminPermissions.js';
import ServiceEngineSettings from '../models/ServiceEngineSettings.js';
import ServiceCategory from '../models/ServiceCategory.js';
import ServiceDefinition from '../models/ServiceDefinition.js';
import ServiceTemplate from '../models/ServiceTemplate.js';
import ServiceQuestionSet from '../models/ServiceQuestionSet.js';

const scriptsDir = path.dirname(fileURLToPath(import.meta.url));
const projectDir = path.resolve(scriptsDir, '..');
const read = relative => readFile(path.join(projectDir, relative), 'utf8');

const exportedFunction = (preferredNames, pattern) => {
  for (const name of preferredNames) {
    if (typeof serviceEngine[name] === 'function') return serviceEngine[name];
  }
  const match = Object.entries(serviceEngine).find(([name, value]) => typeof value === 'function' && pattern.test(name));
  assert.ok(match, `shared/serviceEngine.js must export ${preferredNames.join(' or ')}.`);
  return match[1];
};

const collectionValues = value => {
  if (!Array.isArray(value)) return [];
  return value.flatMap(item => typeof item === 'string'
    ? [item]
    : [item?.value, item?.type, item?.template_type, item?.kind, item?.id, item?.key, item?.slug]
  ).map(item => String(item || '')).filter(Boolean);
};

const exportedCollection = (preferredNames, requiredValues) => {
  const candidates = [
    ...preferredNames.map(name => serviceEngine[name]),
    ...Object.values(serviceEngine)
  ];
  const match = candidates.find(value => {
    const values = new Set(collectionValues(value));
    return requiredValues.every(required => values.has(required));
  });
  assert.ok(match, `shared/serviceEngine.js must declare ${requiredValues.join(', ')}.`);
  return match;
};

const slugify = exportedFunction(
  ['serviceSlug', 'normaliseServiceSlug', 'normalizeServiceSlug', 'normaliseSlug', 'normalizeSlug', 'slugify'],
  /slug/i
);
assert.equal(slugify('  Advanced & DIGITAL / Consulting!  '), 'advanced-digital-consulting');
assert.equal(slugify('Academic   Support'), slugify('academic-support'));
assert.equal(slugify('---'), '');

const requiredQuestionTypes = [
  'short_text', 'long_text', 'number', 'email', 'phone', 'url', 'select', 'radio',
  'checkbox', 'boolean', 'date', 'time', 'datetime', 'file', 'image'
];
const questionTypeCatalog = exportedCollection(
  ['SERVICE_QUESTION_TYPES', 'QUESTION_TYPES', 'QUESTION_TYPE_CATALOG'],
  requiredQuestionTypes
);
const declaredQuestionTypes = collectionValues(questionTypeCatalog);
assert.equal(new Set(declaredQuestionTypes).size, declaredQuestionTypes.length, 'Question type declarations must be unique.');
assert.ok(declaredQuestionTypes.includes('file'));
assert.ok(declaredQuestionTypes.includes('image'));

const starterKinds = ['academic', 'cleaning', 'delivery', 'digital', 'consultation', 'other'];
const starterTemplates = exportedCollection(
  ['STARTER_SERVICE_TEMPLATES', 'SERVICE_STARTER_TEMPLATES', 'STARTER_TEMPLATES', 'SERVICE_TEMPLATE_KINDS'],
  starterKinds
);
assert.deepEqual(
  [...new Set(collectionValues(starterTemplates).filter(kind => starterKinds.includes(kind)))].sort(),
  [...starterKinds].sort(),
  'The six starter template kinds must be declared exactly once.'
);

const normaliseQuestions = exportedFunction(
  ['normaliseServiceQuestions', 'normalizeServiceQuestions', 'normaliseQuestions', 'normalizeQuestions'],
  /normali[sz]e.*question/i
);
const rawQuestions = declaredQuestionTypes.map((type, index) => ({
  id: `question-${index + 1}`,
  key: `question_${index + 1}`,
  type,
  label: `${type} question`,
  required: index % 2 === 0,
  step: index < 2 ? 1 : 2,
  order: declaredQuestionTypes.length - index,
  options: ['select', 'radio', 'checkbox'].includes(type)
    ? [{ label: 'First option', value: 'first' }, { label: 'Second option', value: 'second' }]
    : [],
  validation: type === 'number'
    ? { min: 1, max: 10 }
    : type === 'short_text' ? { minLength: 2, maxLength: 80 } : {},
  condition: index === 1
    ? { enabled: true, questionId: 'question-1', operator: 'equals', value: 'yes' }
    : { enabled: false },
  upload: ['file', 'image'].includes(type)
    ? { accept: type === 'image' ? 'image/*' : '.pdf,.docx', maxFiles: 3, maxSizeMb: 8, imageOnly: type === 'image' }
    : undefined
}));
const questionResult = normaliseQuestions(rawQuestions);
const questions = Array.isArray(questionResult) ? questionResult : questionResult?.questions;
assert.ok(Array.isArray(questions), 'The question normalizer must return an ordered question array.');
assert.equal(questions.length, declaredQuestionTypes.length);
assert.deepEqual(new Set(questions.map(question => question.type)), new Set(declaredQuestionTypes));
assert.ok(questions.some(question => question.required === true));
assert.ok(questions.some(question => question.required === false));
assert.ok(questions.every(question => Number(question.step ?? question.stepNumber ?? question.step_number) >= 1));
assert.ok(new Set(questions.map(question => Number(question.step ?? question.stepNumber ?? question.step_number))).size >= 2);
assert.deepEqual(
  questions.map(question => Number(question.order)),
  [...questions.keys()],
  'Question order must be normalized to a stable zero-based sequence.'
);
const conditional = questions.find(question => String(question.id || question.questionId || question.question_id) === 'question-2');
const condition = conditional?.condition || conditional?.conditional;
assert.equal(Boolean(condition?.enabled), true);
assert.equal(String(condition?.questionId || condition?.question_id), 'question-1');
const fileQuestion = questions.find(question => question.type === 'file');
const imageQuestion = questions.find(question => question.type === 'image');
assert.ok(fileQuestion?.upload || fileQuestion?.validation, 'File questions must retain upload validation.');
assert.ok(imageQuestion?.upload || imageQuestion?.validation, 'Image questions must retain upload validation.');

const questionValidator = Object.entries(serviceEngine).find(([name, value]) =>
  typeof value === 'function' && /validat.*question|question.*validat/i.test(name)
)?.[1];
if (questionValidator) {
  const validationResult = questionValidator(questions);
  const errors = Array.isArray(validationResult)
    ? validationResult
    : validationResult?.errors || (validationResult?.valid === false ? ['invalid'] : []);
  assert.deepEqual(errors, [], 'A valid multi-step conditional question set must pass shared validation.');
}

const toggleResolver = Object.entries(serviceEngine).find(([name, value]) =>
  typeof value === 'function' && /effective.*toggle|toggle.*effective|resolve.*toggle/i.test(name)
)?.[1];
assert.ok(toggleResolver, 'shared/serviceEngine.js must export an effective-toggle resolver.');
const globalScope = { enabled: true, toggles: { quoteEnabled: false, fileUploads: true } };
const categoryScope = { enabled: true, toggles: { quoteEnabled: true, fileUploads: null } };
const serviceScope = { enabled: true, toggles: { quoteEnabled: null, fileUploads: false } };
const toggleCalls = [
  () => toggleResolver(globalScope, categoryScope, serviceScope),
  () => toggleResolver({ settings: globalScope, category: categoryScope, service: serviceScope }),
  () => toggleResolver(globalScope.toggles, categoryScope.toggles, serviceScope.toggles)
];
const toggleValue = (result, key) => {
  const value = result?.effectiveToggles?.[key]
    ?? result?.effective_toggles?.[key]
    ?? result?.values?.[key]
    ?? result?.[key]?.value
    ?? result?.[key];
  return typeof value === 'boolean' ? value : undefined;
};
let resolvedToggles;
for (const call of toggleCalls) {
  try {
    const result = call();
    if (toggleValue(result, 'quoteEnabled') === true && toggleValue(result, 'fileUploads') === false) {
      resolvedToggles = result;
      break;
    }
  } catch {
    // Try the next supported resolver signature.
  }
}
assert.ok(resolvedToggles, 'Effective toggles must prefer service, then category, then platform values.');

const setNested = (target, dottedPath, value) => {
  const segments = dottedPath.split('.');
  let cursor = target;
  segments.forEach((segment, index) => {
    if (index === segments.length - 1) cursor[segment] = value;
    else cursor = cursor[segment] ||= {};
  });
};

const valueForSchemaPath = (name, schemaType) => {
  if (schemaType.enumValues?.length) return schemaType.enumValues[0];
  if (/slug/i.test(name)) return `verify-${name.replace(/[^a-z0-9]+/gi, '-').toLowerCase()}`;
  if (/questions/i.test(name)) return [];
  if (schemaType.instance === 'String') return `verify-${name.replace(/[^a-z0-9]+/gi, '-').toLowerCase()}`;
  if (schemaType.instance === 'Number') return 1;
  if (schemaType.instance === 'Boolean') return true;
  if (schemaType.instance === 'Date') return new Date('2026-08-02T00:00:00.000Z');
  if (schemaType.instance === 'Array') return [];
  if (schemaType.instance === 'Map' || schemaType.instance === 'Mixed') return {};
  return {};
};

const validDocument = Model => {
  const payload = {};
  Model.schema.eachPath((name, schemaType) => {
    if (name === '_id' || name === '__v' || !schemaType.options?.required) return;
    setNested(payload, name, valueForSchemaPath(name, schemaType));
  });
  return new Model(payload);
};

const models = [
  ServiceEngineSettings,
  ServiceCategory,
  ServiceDefinition,
  ServiceTemplate,
  ServiceQuestionSet
];
for (const Model of models) {
  assert.ok(Model?.schema, `${Model?.modelName || 'Phase 17 model'} must export a Mongoose model.`);
  await validDocument(Model).validate();
}

const hasUniqueIndex = (Model, candidates) => {
  if (candidates.some(name => Model.schema.path(name)?.options?.unique === true)) return true;
  return Model.schema.indexes().some(([fields, options]) =>
    options?.unique === true && candidates.some(name => Object.hasOwn(fields, name))
  );
};
assert.ok(hasUniqueIndex(ServiceEngineSettings, ['key', 'settings_id']), 'Service Engine settings must have a singleton unique key.');
for (const [Model, idPath] of [
  [ServiceCategory, 'category_id'],
  [ServiceDefinition, 'service_id'],
  [ServiceTemplate, 'template_id'],
  [ServiceQuestionSet, 'question_set_id']
]) {
  assert.equal(Boolean(Model.schema.path(idPath)?.options?.required), true, `${Model.modelName}.${idPath} must be required.`);
  assert.ok(hasUniqueIndex(Model, [idPath]), `${Model.modelName}.${idPath} must be unique.`);
}
for (const Model of [ServiceCategory, ServiceDefinition, ServiceTemplate, ServiceQuestionSet]) {
  assert.ok(hasUniqueIndex(Model, ['slug']), `${Model.modelName} must enforce unique slugs at database level.`);
}
for (const Model of [ServiceCategory, ServiceDefinition]) {
  const statusPath = Model.schema.path('status');
  assert.ok(statusPath, `${Model.modelName} must store lifecycle status.`);
  for (const status of ['draft', 'published', 'paused', 'archived']) {
    assert.ok(statusPath.enumValues.includes(status), `${Model.modelName} must support ${status}.`);
  }
  const invalid = validDocument(Model);
  invalid.status = 'not-a-service-engine-status';
  await assert.rejects(invalid.validate(), /status/i);
}
assert.ok(ServiceDefinition.schema.path('questions'), 'Service definitions must store ordered intake questions.');
assert.ok(ServiceTemplate.schema.path('questions'), 'Service templates must store intake questions.');
assert.ok(ServiceQuestionSet.schema.path('questions'), 'Reusable question sets must store intake questions.');

const [server, permissions, adminCms, studio, apiClient, legacyAdminServices, packageSource] = await Promise.all([
  read('server.js'),
  read('shared/adminPermissions.js'),
  read('src/components/admin/AdminCMS.jsx'),
  read('src/components/admin/service-engine/ServiceEngineStudio.jsx'),
  read('src/components/admin/service-engine/serviceEngineApi.js'),
  read('src/components/admin/AdminServices.jsx'),
  read('package.json')
]);

for (const route of [
  "app.get('/api/service-catalog'",
  "app.get('/api/admin/service-engine'",
  "app.put('/api/admin/service-engine/settings'",
  "app.post('/api/admin/service-engine/categories'",
  "app.patch('/api/admin/service-engine/categories/:id'",
  "app.delete('/api/admin/service-engine/categories/:id'",
  "app.post('/api/admin/service-engine/categories/:id/:action'",
  "app.post('/api/admin/service-engine/services'",
  "app.patch('/api/admin/service-engine/services/:id'",
  "app.delete('/api/admin/service-engine/services/:id'",
  "app.post('/api/admin/service-engine/services/:id/:action'",
  "app.post('/api/admin/service-engine/templates'",
  "app.post('/api/admin/service-engine/services/:id/apply-template'",
  "app.put('/api/admin/service-engine/services/:id/questions'",
  "app.post('/api/admin/service-engine/services/:id/questions/copy'",
  "app.post('/api/admin/service-engine/question-sets'",
  "app.post('/api/admin/service-engine/question-sets/from-service'",
  "app.post('/api/admin/service-engine/services/:id/apply-question-set'",
  "app.get('/api/admin/service-engine/audit'"
]) {
  assert.ok(server.includes(route), `Missing Phase 17A endpoint: ${route}`);
}
assert.match(server, /11000/);
assert.match(server, /duplicate|already exists|slug/i);
assert.match(server, /service_engine|service engine/i);

const readPermission = permissionForAdminRequest('GET', '/api/admin/service-engine');
const managePermission = permissionForAdminRequest('POST', '/api/admin/service-engine/categories');
const lifecyclePermission = permissionForAdminRequest('POST', '/api/admin/service-engine/services/test-service/publish');
assert.equal(readPermission, 'design.view');
assert.equal(managePermission, 'design.edit');
assert.equal(lifecyclePermission, 'design.publish');
assert.match(permissions, /\/api\/admin\/service-engine/);

assert.match(adminCms, /ServiceEngineStudio/);
assert.match(adminCms, /Service Engine/);
assert.match(studio, /Dashboard/);
for (const label of ['Categories', 'Services', 'Templates', 'Question Builder', 'Settings', 'Audit']) {
  assert.ok(studio.includes(label) || (await read('src/components/admin/service-engine/serviceEngineHelpers.js')).includes(label));
}
assert.match(apiClient, /\/api\/admin\/service-engine/);
assert.match(apiClient, /apply-template/);
assert.match(apiClient, /questions\/copy/);
assert.match(apiClient, /question-sets/);

assert.ok(server.includes("app.get('/api/services'"), 'Legacy service-request listing must remain available.');
assert.ok(server.includes("app.post('/api/services'"), 'Legacy service-request creation must remain available.');
assert.ok(server.includes("app.patch('/api/services/:id'"), 'Legacy service-request updates must remain available.');
assert.match(legacyAdminServices, /Service Operations/);
const platformDefaults = normalisePlatformConfig(DEFAULT_PLATFORM_CONFIG);
assert.equal(platformDefaults.schemaVersion, 6);
assert.equal(PAGE_CATALOG.length, 41);

const packageJson = JSON.parse(packageSource);
assert.equal(packageJson.scripts['verify:phase17a'], 'node scripts/verify-phase17a.mjs');
assert.match(packageJson.scripts.check, /verify:phase17a/);

console.log(`Phase 17A Service Engine verification passed: ${declaredQuestionTypes.length} question types, six starter templates, five database models, protected APIs, Platform Studio integration, and Phase 9–16 compatibility.`);
