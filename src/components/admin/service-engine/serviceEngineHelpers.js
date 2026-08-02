export const STARTER_TEMPLATE_TYPES = [
  { id: 'academic', label: 'Academic', description: 'Research, coursework, editing, deadlines and supporting files.' },
  { id: 'cleaning', label: 'Cleaning', description: 'Property details, rooms, access, supplies and special instructions.' },
  { id: 'delivery', label: 'Delivery', description: 'Pickup, destination, item details, timing and recipient information.' },
  { id: 'digital', label: 'Digital', description: 'Goals, platforms, assets, technical requirements and launch timing.' },
  { id: 'consultation', label: 'Consultation', description: 'Topic, context, preferred format, availability and desired outcome.' },
  { id: 'other', label: 'Other', description: 'A flexible starting point for services outside the standard families.' }
];

export const FALLBACK_QUESTION_TYPES = [
  ['short_text', 'Short text'],
  ['long_text', 'Long text'],
  ['number', 'Number'],
  ['email', 'Email'],
  ['phone', 'Phone'],
  ['url', 'Website URL'],
  ['select', 'Dropdown'],
  ['radio', 'Single choice'],
  ['checkbox', 'Checkboxes'],
  ['boolean', 'Yes / No'],
  ['date', 'Date'],
  ['time', 'Time'],
  ['datetime', 'Date and time'],
  ['file', 'File upload'],
  ['image', 'Image upload']
].map(([value, label]) => ({ value, label }));

export const ENGINE_SECTIONS = [
  ['dashboard', 'Dashboard'],
  ['categories', 'Categories'],
  ['services', 'Services'],
  ['templates', 'Templates'],
  ['questions', 'Question Builder'],
  ['settings', 'Settings'],
  ['audit', 'Audit']
];

export const STATUS_ACTIONS = {
  draft: ['publish', 'archive'],
  published: ['pause', 'archive'],
  paused: ['publish', 'archive'],
  archived: ['restore']
};

export const idOf = record => String(
  record?.id
  || record?.categoryId
  || record?.category_id
  || record?.serviceId
  || record?.service_id
  || record?.templateId
  || record?.template_id
  || record?.questionSetId
  || record?.question_set_id
  || record?._id
  || ''
);

export const categoryIdOf = service => String(
  service?.categoryId
  || service?.category_id
  || service?.category?.id
  || service?.category?._id
  || service?.category
  || ''
);

export const slugify = value => String(value || '')
  .trim()
  .toLowerCase()
  .replace(/[^a-z0-9]+/g, '-')
  .replace(/^-+|-+$/g, '')
  .slice(0, 100);

export const normalizeStatus = record => String(record?.status || (record?.active === false ? 'paused' : 'draft')).toLowerCase();

export const normalizeToggleValue = value => {
  if (value === true || value === 'true' || value === 'enabled') return true;
  if (value === false || value === 'false' || value === 'disabled') return false;
  return null;
};

export const normalizeToggleDefinitions = definitions => {
  if (Array.isArray(definitions) && definitions.length) {
    return definitions.map(item => typeof item === 'string'
      ? { key: item, label: titleFromKey(item), description: '' }
      : {
          key: item.key || item.id,
          label: item.label || titleFromKey(item.key || item.id),
          description: item.description || ''
        }
    ).filter(item => item.key);
  }
  return [
    { key: 'enabled', label: 'Service availability', description: 'Allow this scope to appear and accept requests.' },
    { key: 'quoteEnabled', label: 'Quote requests', description: 'Allow clients to request a tailored quote.' },
    { key: 'providerMatching', label: 'Provider matching', description: 'Allow provider assignment and matching.' },
    { key: 'fileUploads', label: 'File uploads', description: 'Allow supporting files in service questions.' }
  ];
};

export const normalizeQuestionTypes = types => {
  if (!Array.isArray(types) || !types.length) return FALLBACK_QUESTION_TYPES;
  return types.map(item => {
    if (typeof item === 'string') return { value: item, label: titleFromKey(item) };
    return {
      value: item.value || item.id || item.type,
      label: item.label || titleFromKey(item.value || item.id || item.type),
      description: item.description || ''
    };
  }).filter(item => item.value);
};

export function titleFromKey(value) {
  return String(value || '')
    .replace(/[_-]+/g, ' ')
    .replace(/([a-z])([A-Z])/g, '$1 $2')
    .replace(/\b\w/g, character => character.toUpperCase());
}

const optionFrom = (option, index) => typeof option === 'string'
  ? { label: option, value: slugify(option) || `option-${index + 1}` }
  : {
      label: option?.label || option?.value || `Option ${index + 1}`,
      value: option?.value || slugify(option?.label) || `option-${index + 1}`
    };

export const normalizeQuestion = (question = {}, index = 0) => {
  const id = String(question.id || question.questionId || question.question_id || question.key || `question-${index + 1}`);
  return {
    ...question,
    id,
    key: String(question.key || slugify(question.label) || id),
    type: String(question.type || 'short_text'),
    label: String(question.label || 'New question'),
    helpText: String(question.helpText || question.help_text || ''),
    placeholder: String(question.placeholder || ''),
    required: Boolean(question.required),
    step: Math.max(1, Number(question.step || 1)),
    order: Number.isFinite(Number(question.order)) ? Number(question.order) : index,
    options: (Array.isArray(question.options) ? question.options : []).map(optionFrom),
    validation: {
      min: question.validation?.min ?? '',
      max: question.validation?.max ?? '',
      minLength: question.validation?.minLength ?? question.validation?.min_length ?? '',
      maxLength: question.validation?.maxLength ?? question.validation?.max_length ?? '',
      pattern: question.validation?.pattern || ''
    },
    condition: {
      enabled: Boolean(question.condition?.enabled || question.conditional?.enabled),
      questionId: String(question.condition?.questionId || question.condition?.question_id || question.conditional?.questionId || ''),
      operator: String(question.condition?.operator || question.conditional?.operator || 'equals'),
      value: question.condition?.value ?? question.conditional?.value ?? ''
    },
    upload: {
      accept: String(question.upload?.accept || ''),
      maxFiles: Math.max(1, Number(question.upload?.maxFiles || question.upload?.max_files || 1)),
      maxSizeMb: Math.max(1, Number(question.upload?.maxSizeMb || question.upload?.max_size_mb || 10)),
      imageOnly: Boolean(question.upload?.imageOnly || question.upload?.image_only || question.type === 'image')
    }
  };
};

export const createQuestion = (type = 'short_text', count = 0) => normalizeQuestion({
  id: `question-${Date.now()}-${count + 1}`,
  key: `question_${count + 1}`,
  type,
  label: 'New question',
  required: false,
  step: 1,
  order: count
}, count);

export const normalizeQuestions = questions => (Array.isArray(questions) ? questions : [])
  .map(normalizeQuestion)
  .sort((a, b) => a.order - b.order)
  .map((question, order) => ({ ...question, order }));

export const emptyCategory = definitions => ({
  name: '',
  slug: '',
  description: '',
  icon: '',
  family: 'professional',
  order: 0,
  toggles: Object.fromEntries(definitions.map(item => [item.key, null]))
});

export const emptyService = (definitions, categoryId = '') => ({
  categoryId,
  name: '',
  slug: '',
  description: '',
  order: 0,
  featured: false,
  toggles: Object.fromEntries(definitions.map(item => [item.key, null]))
});

export const emptyTemplate = {
  name: '',
  slug: '',
  type: 'custom',
  description: '',
  questions: []
};

export const emptyQuestionSet = {
  name: '',
  slug: '',
  description: '',
  questions: []
};

export const statusLabel = status => titleFromKey(status || 'draft');

export const displayDate = value => {
  if (!value) return 'Not recorded';
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? String(value) : date.toLocaleString();
};

export const toggleEffectiveValue = (record, definition, parents = []) => {
  const ownValue = normalizeToggleValue(record?.toggles?.[definition.key]);
  const recordLifecycle = String(record?.status || '').toLowerCase();
  const recordAllows = record?.enabled !== false && !['paused', 'archived'].includes(recordLifecycle);
  const parentsAllow = parents.filter(Boolean).every(item => {
    const parentValue = normalizeToggleValue(item?.toggles?.[definition.key]);
    const lifecycle = String(item?.status || '').toLowerCase();
    return item?.enabled !== false
      && !['paused', 'archived'].includes(lifecycle)
      && parentValue !== false;
  });
  if (ownValue !== null) return parentsAllow && recordAllows && ownValue;
  const explicitEffective = record?.effectiveToggles?.[definition.key] ?? record?.effective_toggles?.[definition.key];
  if (typeof explicitEffective === 'boolean') return explicitEffective;
  return parentsAllow && recordAllows;
};

export const toggleSource = (record, definition, fallback = 'Platform') => {
  const ownValue = normalizeToggleValue(record?.toggles?.[definition.key]);
  if (ownValue !== null) return 'This level';
  return record?.toggleSources?.[definition.key]
    || record?.toggle_sources?.[definition.key]
    || fallback;
};
