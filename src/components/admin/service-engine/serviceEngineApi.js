const BASE_URL = '/api/admin/service-engine';

const jsonRequest = async (path = '', options = {}) => {
  const response = await fetch(`${BASE_URL}${path}`, {
    credentials: 'same-origin',
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...(options.headers || {})
    }
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok || !data.success) {
    const error = new Error(data.error || data.message || 'The Service Engine request could not be completed.');
    error.status = response.status;
    error.details = data;
    throw error;
  }
  return data;
};

const idPath = id => encodeURIComponent(String(id || ''));

export const serviceEngineApi = {
  bootstrap: () => jsonRequest(),
  audit: () => jsonRequest('/audit'),
  updateSettings: settings => jsonRequest('/settings', {
    method: 'PUT',
    body: JSON.stringify(settings)
  }),

  createCategory: category => jsonRequest('/categories', {
    method: 'POST',
    body: JSON.stringify(category)
  }),
  updateCategory: (id, category) => jsonRequest(`/categories/${idPath(id)}`, {
    method: 'PATCH',
    body: JSON.stringify(category)
  }),
  deleteCategory: id => jsonRequest(`/categories/${idPath(id)}`, { method: 'DELETE' }),
  categoryAction: (id, action) => jsonRequest(`/categories/${idPath(id)}/${idPath(action)}`, {
    method: 'POST',
    body: '{}'
  }),

  createService: service => jsonRequest('/services', {
    method: 'POST',
    body: JSON.stringify(service)
  }),
  updateService: (id, service) => jsonRequest(`/services/${idPath(id)}`, {
    method: 'PATCH',
    body: JSON.stringify(service)
  }),
  deleteService: id => jsonRequest(`/services/${idPath(id)}`, { method: 'DELETE' }),
  serviceAction: (id, action) => jsonRequest(`/services/${idPath(id)}/${idPath(action)}`, {
    method: 'POST',
    body: '{}'
  }),

  createTemplate: template => jsonRequest('/templates', {
    method: 'POST',
    body: JSON.stringify(template)
  }),
  updateTemplate: (id, template) => jsonRequest(`/templates/${idPath(id)}`, {
    method: 'PATCH',
    body: JSON.stringify(template)
  }),
  deleteTemplate: id => jsonRequest(`/templates/${idPath(id)}`, { method: 'DELETE' }),
  applyTemplate: (serviceId, templateId) => jsonRequest(`/services/${idPath(serviceId)}/apply-template`, {
    method: 'POST',
    body: JSON.stringify({ templateId })
  }),

  saveQuestions: (serviceId, questions) => jsonRequest(`/services/${idPath(serviceId)}/questions`, {
    method: 'PUT',
    body: JSON.stringify({ questions })
  }),
  copyQuestions: (serviceId, sourceServiceId) => jsonRequest(`/services/${idPath(serviceId)}/questions/copy`, {
    method: 'POST',
    body: JSON.stringify({ sourceServiceId })
  }),

  createQuestionSet: questionSet => jsonRequest('/question-sets', {
    method: 'POST',
    body: JSON.stringify(questionSet)
  }),
  updateQuestionSet: (id, questionSet) => jsonRequest(`/question-sets/${idPath(id)}`, {
    method: 'PATCH',
    body: JSON.stringify(questionSet)
  }),
  deleteQuestionSet: id => jsonRequest(`/question-sets/${idPath(id)}`, { method: 'DELETE' }),
  createQuestionSetFromService: payload => jsonRequest('/question-sets/from-service', {
    method: 'POST',
    body: JSON.stringify(payload)
  }),
  applyQuestionSet: (serviceId, questionSetId) => jsonRequest(`/services/${idPath(serviceId)}/apply-question-set`, {
    method: 'POST',
    body: JSON.stringify({ questionSetId })
  })
};

export default serviceEngineApi;
