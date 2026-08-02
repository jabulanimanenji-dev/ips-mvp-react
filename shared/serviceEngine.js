export const SERVICE_LIFECYCLE_STATUSES = [
  'draft',
  'published',
  'paused',
  'archived'
];

export const SERVICE_TEMPLATE_KINDS = [
  'academic',
  'cleaning',
  'delivery',
  'digital',
  'consultation',
  'other'
];

export const SERVICE_ENGINE_TOGGLE_DEFINITIONS = [
  ['homepageVisible', 'Homepage visibility'],
  ['navigationVisible', 'Navigation visibility'],
  ['searchVisible', 'Search visibility'],
  ['providerApplicationsOpen', 'Provider applications'],
  ['acceptingRequests', 'Accepting requests'],
  ['remoteAllowed', 'Remote services'],
  ['onsiteAllowed', 'On-site services'],
  ['instantQuotesAllowed', 'Instant estimates'],
  ['manualQuotesAllowed', 'Manual quotes'],
  ['negotiationAllowed', 'Negotiable quotes'],
  ['schedulingAllowed', 'Scheduling'],
  ['recurringAllowed', 'Recurring bookings'],
  ['publicPricingAllowed', 'Public pricing'],
  ['reviewsAllowed', 'Service reviews'],
  ['fileUploadsAllowed', 'File uploads'],
  ['imageUploadsAllowed', 'Image uploads']
].map(([key, label]) => ({
  key,
  label,
  description: 'Inherited from platform to category to service.'
}));

export const DEFAULT_SERVICE_ENGINE_TOGGLES = Object.fromEntries(
  SERVICE_ENGINE_TOGGLE_DEFINITIONS.map(({ key }) => [key, true])
);

export const SERVICE_QUESTION_TYPES = [
  ['short_text', 'Short text'],
  ['long_text', 'Long text'],
  ['email', 'Email'],
  ['phone', 'Phone'],
  ['url', 'Website URL'],
  ['number', 'Number'],
  ['currency', 'Currency'],
  ['date', 'Date'],
  ['time', 'Time'],
  ['datetime', 'Date and time'],
  ['select', 'Dropdown'],
  ['multi_select', 'Multiple choice'],
  ['radio', 'Radio buttons'],
  ['checkbox', 'Checkboxes'],
  ['boolean', 'Yes / No'],
  ['file', 'File upload'],
  ['image', 'Image upload'],
  ['heading', 'Heading'],
  ['paragraph', 'Information text']
].map(([value, label]) => ({
  value,
  label
}));

export const SERVICE_CONDITION_OPERATORS = [
  'equals',
  'not_equals',
  'contains',
  'not_contains',
  'in',
  'not_in',
  'greater_than',
  'less_than',
  'is_answered',
  'is_not_answered',
  'is_empty',
  'is_not_empty'
];

export const serviceSlug = value =>
  String(value || '')
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 100);

const text = (value, limit = 1000) =>
  String(value || '')
    .trim()
    .slice(0, limit);

const numberOrBlank = value => {
  if (
    value === '' ||
    value == null ||
    !Number.isFinite(Number(value))
  ) {
    return undefined;
  }

  return Number(value);
};

const option = (item, index) => {
  if (typeof item === 'string') {
    return {
      label: text(item, 120),
      value: serviceSlug(item) || `option-${index + 1}`
    };
  }

  return {
    label: text(item?.label || item?.value, 120),
    value:
      serviceSlug(item?.value || item?.label) ||
      `option-${index + 1}`
  };
};

export function normaliseServiceQuestions(input = []) {
  const source = Array.isArray(input) ? input : [];

  return source
    .slice(0, 200)
    .map((item, index) => {
      const id = text(
        item?.id ||
          item?.questionId ||
          item?.question_id ||
          `question-${index + 1}`,
        100
      );

      const type = SERVICE_QUESTION_TYPES.some(
        entry => entry.value === item?.type
      )
        ? item.type
        : 'short_text';

      return {
        id,

        key: text(
          item?.key ||
            serviceSlug(item?.label).replace(/-/g, '_') ||
            id.replace(/-/g, '_'),
          100
        )
          .toLowerCase()
          .replace(/[^a-z0-9_]/g, '_'),

        type,

        label: text(item?.label || 'New question', 180),

        helpText: text(
          item?.helpText || item?.help_text,
          500
        ),

        placeholder: text(item?.placeholder, 240),

        required: item?.required === true,

        step: Math.max(
          1,
          Math.min(20, Number(item?.step) || 1)
        ),

        order: Number.isFinite(Number(item?.order))
          ? Number(item.order)
          : index,

        options: (
          Array.isArray(item?.options)
            ? item.options
            : []
        )
          .slice(0, 50)
          .map(option),

        validation: {
          min: numberOrBlank(item?.validation?.min),

          max: numberOrBlank(item?.validation?.max),

          minLength: numberOrBlank(
            item?.validation?.minLength ??
              item?.validation?.min_length
          ),

          maxLength: numberOrBlank(
            item?.validation?.maxLength ??
              item?.validation?.max_length
          ),

          pattern: text(
            item?.validation?.pattern,
            240
          ),

          minSelections: numberOrBlank(
            item?.validation?.minSelections
          ),

          maxSelections: numberOrBlank(
            item?.validation?.maxSelections
          )
        },

        condition: {
          enabled: item?.condition?.enabled === true,

          questionId: text(
            item?.condition?.questionId ||
              item?.condition?.question_id,
            100
          ),

          operator: SERVICE_CONDITION_OPERATORS.includes(
            item?.condition?.operator
          )
            ? item.condition.operator
            : 'equals',

          value: item?.condition?.value ?? ''
        },

        upload: {
          accept: text(
            item?.upload?.accept,
            240
          ),

          maxFiles: Math.max(
            1,
            Math.min(
              20,
              Number(item?.upload?.maxFiles) || 1
            )
          ),

          maxSizeMb: Math.max(
            1,
            Math.min(
              100,
              Number(item?.upload?.maxSizeMb) || 10
            )
          ),

          imageOnly:
            type === 'image' ||
            item?.upload?.imageOnly === true
        }
      };
    })
    .sort((a, b) => a.order - b.order)
    .map((item, order) => ({
      ...item,
      order
    }));
}

export function validateServiceQuestions(input = []) {
  const questions = normaliseServiceQuestions(input);
  const errors = [];
  const ids = new Set();
  const keys = new Set();

  for (const question of questions) {
    if (!question.id || ids.has(question.id)) {
      errors.push(
        `Duplicate question id: ${question.id}`
      );
    } else {
      ids.add(question.id);
    }

    if (!question.key || keys.has(question.key)) {
      errors.push(
        `Duplicate question key: ${question.key}`
      );
    } else {
      keys.add(question.key);
    }

    if (!question.label) {
      errors.push(
        `Question ${question.id} needs a label.`
      );
    }

    if (
      ['select', 'radio', 'checkbox'].includes(
        question.type
      ) &&
      question.options.length < 1
    ) {
      errors.push(
        `${question.label} needs options.`
      );
    }
  }

  for (const question of questions) {
    if (!question.condition.enabled) {
      continue;
    }

    if (
      !ids.has(question.condition.questionId) ||
      question.condition.questionId === question.id
    ) {
      errors.push(
        `${question.label} has an invalid condition.`
      );
    }
  }

  const edges = new Map(
    questions
      .filter(question => question.condition.enabled)
      .map(question => [
        question.id,
        question.condition.questionId
      ])
  );

  for (const id of edges.keys()) {
    const seen = new Set([id]);
    let cursor = edges.get(id);

    while (cursor && edges.has(cursor)) {
      if (seen.has(cursor)) {
        errors.push(
          'Conditional questions cannot contain a cycle.'
        );
        break;
      }

      seen.add(cursor);
      cursor = edges.get(cursor);
    }
  }

  return [...new Set(errors)];
}

const freshId = (prefix, index) =>
  `${prefix}-${Date.now().toString(36)}-${index + 1}-${Math.random()
    .toString(36)
    .slice(2, 7)}`;

export function cloneServiceQuestions(
  input = [],
  prefix = 'question'
) {
  const source = normaliseServiceQuestions(input);

  const remap = new Map(
    source.map((question, index) => [
      question.id,
      freshId(prefix, index)
    ])
  );

  return source.map((question, order) => ({
    ...question,

    id: remap.get(question.id),

    key: `${question.key}_${Math.random()
      .toString(36)
      .slice(2, 6)}`,

    order,

    options: question.options.map(entry => ({
      ...entry
    })),

    validation: {
      ...question.validation
    },

    upload: {
      ...question.upload
    },

    condition: {
      ...question.condition,
      questionId:
        remap.get(question.condition.questionId) || ''
    }
  }));
}

const toggleValues = scope => {
  if (!scope || typeof scope !== 'object') {
    return {};
  }

  if (
    scope.toggles &&
    typeof scope.toggles === 'object' &&
    !Array.isArray(scope.toggles)
  ) {
    return scope.toggles;
  }

  return scope;
};

const ownToggle = (scope, key) => {
  const value = toggleValues(scope)[key];

  return typeof value === 'boolean'
    ? value
    : null;
};

const collectToggleKeys = (...scopes) => {
  const keys = new Set(
    SERVICE_ENGINE_TOGGLE_DEFINITIONS.map(
      ({ key }) => key
    )
  );

  for (const scope of scopes) {
    for (const key of Object.keys(toggleValues(scope))) {
      if (
        !['enabled', 'status', 'toggles'].includes(key)
      ) {
        keys.add(key);
      }
    }
  }

  return [...keys];
};

export function resolveEffectiveToggles(
  platform = {},
  category = {},
  service = {}
) {
  if (
    arguments.length === 1 &&
    platform?.settings
  ) {
    const input = platform;

    platform = input.settings || {};
    category = input.category || {};
    service = input.service || {};
  }

  const settings = platform?.settings || platform;
  const effectiveToggles = {};
  const toggleSources = {};

  const keys = collectToggleKeys(
    settings,
    category,
    service
  );

  for (const key of keys) {
    const platformValue = ownToggle(
      settings,
      key
    );

    const defaultValue =
      Object.prototype.hasOwnProperty.call(
        DEFAULT_SERVICE_ENGINE_TOGGLES,
        key
      )
        ? DEFAULT_SERVICE_ENGINE_TOGGLES[key]
        : null;

    let value =
      platformValue ?? defaultValue;

    let source = 'Platform';

    const categoryValue = ownToggle(
      category,
      key
    );

    if (categoryValue !== null) {
      value = categoryValue;
      source = 'Category';
    }

    const serviceValue = ownToggle(
      service,
      key
    );

    if (serviceValue !== null) {
      value = serviceValue;
      source = 'Service';
    }

    const globallyDisabled =
      settings?.enabled === false;

    const categoryDisabled =
      category?.enabled === false ||
      ['paused', 'archived'].includes(
        category?.status
      );

    const serviceDisabled =
      service?.enabled === false ||
      ['paused', 'archived'].includes(
        service?.status
      );

    if (
      globallyDisabled ||
      categoryDisabled ||
      serviceDisabled
    ) {
      value = false;
    }

    if (typeof value === 'boolean') {
      effectiveToggles[key] = value;
      toggleSources[key] = source;
    }
  }

  return {
    effectiveToggles,
    toggleSources
  };
}

const q = (
  id,
  label,
  type = 'short_text',
  required = false,
  step = 1,
  options = []
) => ({
  id,
  key: id.replace(/-/g, '_'),
  label,
  type,
  required,
  step,
  options,
  order: 0
});

export const STARTER_SERVICE_TEMPLATES = [
  {
    kind: 'academic',
    name: 'Academic',
    slug: 'academic',
    description: 'Academic project intake.',
    questions: [
      q(
        'academic-topic',
        'Topic or title',
        'short_text',
        true
      ),
      q(
        'academic-deadline',
        'Deadline',
        'date',
        true
      ),
      q(
        'academic-files',
        'Supporting files',
        'file'
      )
    ]
  },

  {
    kind: 'cleaning',
    name: 'Cleaning',
    slug: 'cleaning',
    description: 'Cleaning visit intake.',
    questions: [
      q(
        'cleaning-address',
        'Service address',
        'long_text',
        true
      ),
      q(
        'cleaning-date',
        'Preferred date',
        'date',
        true
      ),
      q(
        'cleaning-images',
        'Property images',
        'image'
      )
    ]
  },

  {
    kind: 'delivery',
    name: 'Delivery',
    slug: 'delivery',
    description: 'Pickup and delivery intake.',
    questions: [
      q(
        'delivery-pickup',
        'Pickup address',
        'long_text',
        true
      ),
      q(
        'delivery-dropoff',
        'Delivery address',
        'long_text',
        true
      ),
      q(
        'delivery-date',
        'Required date',
        'date',
        true
      )
    ]
  },

  {
    kind: 'digital',
    name: 'Digital',
    slug: 'digital',
    description: 'Digital project intake.',
    questions: [
      q(
        'digital-goal',
        'Project goal',
        'long_text',
        true
      ),
      q(
        'digital-platform',
        'Platform',
        'short_text'
      ),
      q(
        'digital-assets',
        'Existing assets',
        'file'
      )
    ]
  },

  {
    kind: 'consultation',
    name: 'Consultation',
    slug: 'consultation',
    description: 'Consultation intake.',
    questions: [
      q(
        'consultation-topic',
        'Consultation topic',
        'long_text',
        true
      ),
      q(
        'consultation-date',
        'Preferred date',
        'date'
      ),
      q(
        'consultation-time',
        'Preferred time',
        'time'
      )
    ]
  },

  {
    kind: 'other',
    name: 'Other',
    slug: 'other',
    description: 'Flexible custom request.',
    questions: [
      q(
        'other-request',
        'What do you need?',
        'long_text',
        true
      ),
      q(
        'other-outcome',
        'Desired outcome',
        'long_text'
      ),
      q(
        'other-files',
        'Supporting files',
        'file'
      )
    ]
  }
].map(template => ({
  ...template,
  builtIn: true,
  protected: true,
  questions: normaliseServiceQuestions(
    template.questions
  )
}));

const runtimeScalar = value =>
  value == null ? '' : value;

const answered = value => {
  if (Array.isArray(value)) {
    return value.length > 0;
  }

  return (
    value !== '' &&
    value != null &&
    value !== false
  );
};

export function isServiceQuestionVisible(
  question,
  answers = {}
) {
  if (!question?.condition?.enabled) {
    return true;
  }

  const source =
    answers[question.condition.questionId];

  const expected =
    question.condition.value;

  switch (question.condition.operator) {
    case 'equals':
      return (
        String(source ?? '') ===
        String(expected ?? '')
      );

    case 'not_equals':
      return (
        String(source ?? '') !==
        String(expected ?? '')
      );

    case 'contains':
      return Array.isArray(source)
        ? source
            .map(String)
            .includes(String(expected))
        : String(source ?? '').includes(
            String(expected ?? '')
          );

    case 'not_contains':
      return Array.isArray(source)
        ? !source
            .map(String)
            .includes(String(expected))
        : !String(source ?? '').includes(
            String(expected ?? '')
          );

    case 'in':
      return Array.isArray(expected)
        ? expected
            .map(String)
            .includes(String(source))
        : String(expected ?? '')
            .split(',')
            .map(value => value.trim())
            .includes(String(source));

    case 'not_in':
      return Array.isArray(expected)
        ? !expected
            .map(String)
            .includes(String(source))
        : !String(expected ?? '')
            .split(',')
            .map(value => value.trim())
            .includes(String(source));

    case 'greater_than':
      return Number(source) > Number(expected);

    case 'less_than':
      return Number(source) < Number(expected);

    case 'is_answered':
    case 'is_not_empty':
      return answered(source);

    case 'is_not_answered':
    case 'is_empty':
      return !answered(source);

    default:
      return true;
  }
}

export function validateServiceRuntimeAnswers(
  questions = [],
  input = {}
) {
  const normalized =
    normaliseServiceQuestions(questions);

  const answers = Object.fromEntries(
    normalized.map(question => [
      question.id,
      input[question.id] ??
        input[question.key] ??
        ''
    ])
  );

  const errors = {};

  for (const question of normalized) {
    if (
      !isServiceQuestionVisible(
        question,
        answers
      ) ||
      ['heading', 'paragraph'].includes(
        question.type
      )
    ) {
      continue;
    }

    const value =
      answers[question.id];

    const empty =
      !answered(value);

    if (
      question.required &&
      empty
    ) {
      errors[question.id] =
        `${question.label} is required.`;

      continue;
    }

    if (empty) {
      continue;
    }

    const rule =
      question.validation || {};

    const length = Array.isArray(value)
      ? value.length
      : String(value).length;

    if (
      rule.minLength != null &&
      length < rule.minLength
    ) {
      errors[question.id] =
        `${question.label} must contain at least ${rule.minLength} characters.`;
    }

    if (
      rule.maxLength != null &&
      length > rule.maxLength
    ) {
      errors[question.id] =
        `${question.label} must contain no more than ${rule.maxLength} characters.`;
    }

    if (
      rule.min != null &&
      Number(value) < rule.min
    ) {
      errors[question.id] =
        `${question.label} must be at least ${rule.min}.`;
    }

    if (
      rule.max != null &&
      Number(value) > rule.max
    ) {
      errors[question.id] =
        `${question.label} must be no more than ${rule.max}.`;
    }

    if (rule.pattern) {
      try {
        if (
          !new RegExp(rule.pattern).test(
            String(value)
          )
        ) {
          errors[question.id] =
            `${question.label} has an invalid format.`;
        }
      } catch {
        // Ignore invalid custom regex patterns.
      }
    }

    if (
      rule.minSelections != null &&
      (
        !Array.isArray(value) ||
        value.length < rule.minSelections
      )
    ) {
      errors[question.id] =
        `${question.label} requires at least ${rule.minSelections} selections.`;
    }

    if (
      rule.maxSelections != null &&
      Array.isArray(value) &&
      value.length > rule.maxSelections
    ) {
      errors[question.id] =
        `${question.label} allows at most ${rule.maxSelections} selections.`;
    }

    if (
      question.type === 'email' &&
      !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(
        String(value)
      )
    ) {
      errors[question.id] =
        `${question.label} must be a valid email address.`;
    }

    if (question.type === 'url') {
      try {
        new URL(String(value));
      } catch {
        errors[question.id] =
          `${question.label} must be a valid URL.`;
      }
    }
  }

  return {
    valid:
      Object.keys(errors).length === 0,
    errors,
    answers
  };
}

export function buildServiceRequestSnapshot({
  service,
  category,
  answers = {},
  pricing = null
} = {}) {
  const questions =
    normaliseServiceQuestions(
      service?.questions || []
    );

  return {
    serviceId:
      service?.serviceId || '',

    serviceSlug:
      service?.slug || '',

    serviceName:
      service?.name || '',

    serviceRevision:
      service?.revision || 1,

    categoryId:
      category?.categoryId || '',

    categoryName:
      category?.name || '',

    templateId:
      service?.templateId || '',

    steps: Array.isArray(service?.steps)
      ? service.steps.map(step => ({
          id: step.id,
          title: step.title,
          order: step.order
        }))
      : [],

    questions: questions.map(question => ({
      id: question.id,
      key: question.key,
      type: question.type,
      label: question.label,
      step: question.step,
      required: question.required
    })),

    answers: Object.fromEntries(
      questions
        .filter(question =>
          isServiceQuestionVisible(
            question,
            answers
          )
        )
        .map(question => [
          question.id,
          runtimeScalar(
            answers[question.id] ??
              answers[question.key]
          )
        ])
    ),

    pricing:
      pricing || {
        mode: 'manual',
        amount: 0,
        currency: 'USD',
        breakdown: []
      },

    capturedAt:
      new Date().toISOString()
  };
}