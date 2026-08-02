export const SERVICE_LIFECYCLE_STATUSES = ['draft', 'published', 'paused', 'archived'];
export const SERVICE_TEMPLATE_KINDS = ['academic', 'cleaning', 'delivery', 'digital', 'consultation', 'other'];

export const SERVICE_ENGINE_TOGGLE_DEFINITIONS = [
  ['homepageVisible', 'Homepage visibility'], ['navigationVisible', 'Navigation visibility'],
  ['searchVisible', 'Search visibility'], ['providerApplicationsOpen', 'Provider applications'],
  ['acceptingRequests', 'Accepting requests'], ['remoteAllowed', 'Remote services'],
  ['onsiteAllowed', 'On-site services'], ['instantQuotesAllowed', 'Instant estimates'],
  ['manualQuotesAllowed', 'Manual quotes'], ['negotiationAllowed', 'Negotiable quotes'],
  ['schedulingAllowed', 'Scheduling'], ['recurringAllowed', 'Recurring bookings'],
  ['publicPricingAllowed', 'Public pricing'], ['reviewsAllowed', 'Service reviews'],
  ['fileUploadsAllowed', 'File uploads'], ['imageUploadsAllowed', 'Image uploads']
].map(([key, label]) => ({ key, label, description: 'Inherited from platform to category to service.' }));

export const DEFAULT_SERVICE_ENGINE_TOGGLES = Object.fromEntries(SERVICE_ENGINE_TOGGLE_DEFINITIONS.map(({ key }) => [key, true]));

export const SERVICE_QUESTION_TYPES = [
  ['short_text', 'Short text'], ['long_text', 'Long text'], ['email', 'Email'], ['phone', 'Phone'],
  ['url', 'Website URL'], ['number', 'Number'], ['currency', 'Currency'], ['date', 'Date'],
  ['time', 'Time'], ['datetime', 'Date and time'], ['select', 'Dropdown'], ['multi_select', 'Multiple choice'],
  ['radio', 'Radio buttons'], ['checkbox', 'Checkboxes'], ['boolean', 'Yes / No'], ['file', 'File upload'],
  ['image', 'Image upload'], ['heading', 'Heading'], ['paragraph', 'Information text']
].map(([value, label]) => ({ value, label }));

export const SERVICE_CONDITION_OPERATORS = ['equals', 'not_equals', 'contains', 'not_contains', 'in', 'not_in', 'greater_than', 'less_than', 'is_answered', 'is_not_answered', 'is_empty', 'is_not_empty'];

export const serviceSlug = value => String(value || '').trim().toLowerCase()
  .replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 100);

const text = (value, limit = 1000) => String(value || '').trim().slice(0, limit);
const numberOrBlank = value => value === '' || value == null || !Number.isFinite(Number(value)) ? undefined : Number(value);
const option = (item, index) => typeof item === 'string'
  ? { label: text(item, 120), value: serviceSlug(item) || `option-${index + 1}` }
  : { label: text(item?.label || item?.value, 120), value: serviceSlug(item?.value || item?.label) || `option-${index + 1}` };

export function normaliseServiceQuestions(input = []) {
  return (Array.isArray(input) ? input : []).slice(0, 200).map((item, index) => {
    const id = text(item?.id || item?.questionId || item?.question_id || `question-${index + 1}`, 100);
    const type = SERVICE_QUESTION_TYPES.some(entry => entry.value === item?.type) ? item.type : 'short_text';
    return {
      id,
      key: text(item?.key || serviceSlug(item?.label).replace(/-/g, '_') || id.replace(/-/g, '_'), 100).toLowerCase().replace(/[^a-z0-9_]/g, '_'),
      type,
      label: text(item?.label || 'New question', 180),
      helpText: text(item?.helpText || item?.help_text, 500), placeholder: text(item?.placeholder, 240),
      required: item?.required === true, step: Math.max(1, Math.min(20, Number(item?.step) || 1)),
      order: Number.isFinite(Number(item?.order)) ? Number(item.order) : index,
      options: (Array.isArray(item?.options) ? item.options : []).slice(0, 50).map(option),
      validation: {
        min: numberOrBlank(item?.validation?.min), max: numberOrBlank(item?.validation?.max),
        minLength: numberOrBlank(item?.validation?.minLength ?? item?.validation?.min_length),
        maxLength: numberOrBlank(item?.validation?.maxLength ?? item?.validation?.max_length),
        pattern: text(item?.validation?.pattern, 240), minSelections: numberOrBlank(item?.validation?.minSelections),
        maxSelections: numberOrBlank(item?.validation?.maxSelections)
      },
      condition: {
        enabled: item?.condition?.enabled === true,
        questionId: text(item?.condition?.questionId || item?.condition?.question_id, 100),
        operator: SERVICE_CONDITION_OPERATORS.includes(item?.condition?.operator) ? item.condition.operator : 'equals',
        value: item?.condition?.value ?? ''
      },
      upload: {
        accept: text(item?.upload?.accept, 240), maxFiles: Math.max(1, Math.min(20, Number(item?.upload?.maxFiles) || 1)),
        maxSizeMb: Math.max(1, Math.min(100, Number(item?.upload?.maxSizeMb) || 10)),
        imageOnly: type === 'image' || item?.upload?.imageOnly === true
      }
    };
  }).sort((a, b) => a.order - b.order).map((item, order) => ({ ...item, order }));
}

export function validateServiceQuestions(input = []) {
  const questions = normaliseServiceQuestions(input);
  const errors = [];
  const ids = new Set(); const keys = new Set();
  for (const question of questions) {
    if (!question.id || ids.has(question.id)) errors.push(`Duplicate question id: ${question.id}`); else ids.add(question.id);
    if (!question.key || keys.has(question.key)) errors.push(`Duplicate question key: ${question.key}`); else keys.add(question.key);
    if (!question.label) errors.push(`Question ${question.id} needs a label.`);
    if (['select', 'radio', 'checkbox'].includes(question.type) && question.options.length < 1) errors.push(`${question.label} needs options.`);
  }
  for (const question of questions) {
    if (!question.condition.enabled) continue;
    if (!ids.has(question.condition.questionId) || question.condition.questionId === question.id) errors.push(`${question.label} has an invalid condition.`);
  }
  const edges = new Map(questions.filter(q => q.condition.enabled).map(q => [q.id, q.condition.questionId]));
  for (const id of edges.keys()) {
    const seen = new Set([id]); let cursor = edges.get(id);
    while (cursor && edges.has(cursor)) { if (seen.has(cursor)) { errors.push('Conditional questions cannot contain a cycle.'); break; } seen.add(cursor); cursor = edges.get(cursor); }
  }
  return [...new Set(errors)];
}

const freshId = (prefix, index) => `${prefix}-${Date.now().toString(36)}-${index + 1}-${Math.random().toString(36).slice(2, 7)}`;
export function cloneServiceQuestions(input = [], prefix = 'question') {
  const source = normaliseServiceQuestions(input); const remap = new Map(source.map((q, index) => [q.id, freshId(prefix, index)]));
  return source.map((q, order) => ({ ...q, id: remap.get(q.id), key: `${q.key}_${Math.random().toString(36).slice(2, 6)}`, order,
    options: q.options.map(entry => ({ ...entry })), validation: { ...q.validation }, upload: { ...q.upload },
    condition: { ...q.condition, questionId: remap.get(q.condition.questionId) || '' } }));
}

const ownToggle = (scope, key) => {
  const value = scope?.toggles?.[key] ?? scope?.[key];
  return typeof value === 'boolean' ? value : null;
};
export function resolveEffectiveToggles(platform = {}, category = {}, service = {}) {
  if (arguments.length === 1 && platform?.settings) ({ settings: platform, category, service } = platform);
  const settings = platform?.settings || platform;
  const effectiveToggles = {}; const toggleSources = {};
  for (const { key } of SERVICE_ENGINE_TOGGLE_DEFINITIONS) {
    let value = ownToggle(settings, key) ?? DEFAULT_SERVICE_ENGINE_TOGGLES[key]; let source = 'Platform';
    const categoryValue = ownToggle(category, key); if (categoryValue !== null) { value = categoryValue; source = 'Category'; }
    const serviceValue = ownToggle(service, key); if (serviceValue !== null) { value = serviceValue; source = 'Service'; }
    if (settings?.enabled === false || ['paused', 'archived'].includes(category?.status) || ['paused', 'archived'].includes(service?.status)) value = false;
    effectiveToggles[key] = value; toggleSources[key] = source;
  }
  return { effectiveToggles, toggleSources };
}

const q = (id, label, type = 'short_text', required = false, step = 1, options = []) => ({ id, key: id.replace(/-/g, '_'), label, type, required, step, options, order: 0 });
export const STARTER_SERVICE_TEMPLATES = [
  { kind: 'academic', name: 'Academic', slug: 'academic', description: 'Academic project intake.', questions: [q('academic-topic', 'Topic or title', 'short_text', true), q('academic-deadline', 'Deadline', 'date', true), q('academic-files', 'Supporting files', 'file')] },
  { kind: 'cleaning', name: 'Cleaning', slug: 'cleaning', description: 'Cleaning visit intake.', questions: [q('cleaning-address', 'Service address', 'long_text', true), q('cleaning-date', 'Preferred date', 'date', true), q('cleaning-images', 'Property images', 'image')] },
  { kind: 'delivery', name: 'Delivery', slug: 'delivery', description: 'Pickup and delivery intake.', questions: [q('delivery-pickup', 'Pickup address', 'long_text', true), q('delivery-dropoff', 'Delivery address', 'long_text', true), q('delivery-date', 'Required date', 'date', true)] },
  { kind: 'digital', name: 'Digital', slug: 'digital', description: 'Digital project intake.', questions: [q('digital-goal', 'Project goal', 'long_text', true), q('digital-platform', 'Platform', 'short_text'), q('digital-assets', 'Existing assets', 'file')] },
  { kind: 'consultation', name: 'Consultation', slug: 'consultation', description: 'Consultation intake.', questions: [q('consultation-topic', 'Consultation topic', 'long_text', true), q('consultation-date', 'Preferred date', 'date'), q('consultation-time', 'Preferred time', 'time')] },
  { kind: 'other', name: 'Other', slug: 'other', description: 'Flexible custom request.', questions: [q('other-request', 'What do you need?', 'long_text', true), q('other-outcome', 'Desired outcome', 'long_text'), q('other-files', 'Supporting files', 'file')] }
].map(template => ({ ...template, builtIn: true, protected: true, questions: normaliseServiceQuestions(template.questions) }));
