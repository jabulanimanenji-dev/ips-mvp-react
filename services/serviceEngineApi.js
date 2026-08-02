import crypto from 'crypto';
import mongoose from 'mongoose';
import AuditLog from '../models/AuditLog.js';
import PlatformConfig from '../models/PlatformConfig.js';
import ServiceEngineSettings from '../models/ServiceEngineSettings.js';
import ServiceCategory from '../models/ServiceCategory.js';
import ServiceDefinition from '../models/ServiceDefinition.js';
import ServiceTemplate from '../models/ServiceTemplate.js';
import ServiceQuestionSet from '../models/ServiceQuestionSet.js';
import { DEFAULT_PLATFORM_CONFIG } from '../shared/platformConfig.js';
import {
  DEFAULT_SERVICE_ENGINE_TOGGLES, SERVICE_ENGINE_TOGGLE_DEFINITIONS, SERVICE_LIFECYCLE_STATUSES,
  SERVICE_QUESTION_TYPES, STARTER_SERVICE_TEMPLATES, cloneServiceQuestions, normaliseServiceQuestions,
  resolveEffectiveToggles, serviceSlug, validateServiceQuestions
} from '../shared/serviceEngine.js';

class ApiError extends Error { constructor(status, message) { super(message); this.status = status; } }
const required = (value, label, max = 120) => { const clean = String(value || '').trim().slice(0, max); if (!clean) throw new ApiError(400, `${label} is required.`); return clean; };
const optional = (value, max = 2000) => String(value || '').trim().slice(0, max);
const appId = prefix => `${prefix}-${Date.now().toString(36).toUpperCase()}-${crypto.randomBytes(3).toString('hex').toUpperCase()}`;
const actor = req => req.adminAccess?.adminId || 'admin';
const queryId = (field, value) => {
  const clauses = [{ [field]: String(value) }];
  if (mongoose.isValidObjectId(value)) clauses.push({ _id: value });
  return { $or: clauses };
};
const audit = (req, action, entity, id, details = {}) => AuditLog.create({ order_id: 'SERVICE-ENGINE', actor_id: actor(req), actor_role: 'admin', action, details: { entity, id, ...details } });
const overrides = input => Object.fromEntries(SERVICE_ENGINE_TOGGLE_DEFINITIONS.map(({ key }) => [key, typeof input?.[key] === 'boolean' ? input[key] : null]));
const globals = input => Object.fromEntries(SERVICE_ENGINE_TOGGLE_DEFINITIONS.map(({ key }) => [key, input?.[key] !== false]));
const duplicateCheck = async (Model, slug, idField, id) => {
  const query = { slug }; if (id) query[idField] = { $ne: id };
  if (await Model.exists(query)) throw new ApiError(409, `The slug “${slug}” already exists.`);
};
const questionPayload = input => {
  const questions = normaliseServiceQuestions(input);
  const errors = validateServiceQuestions(questions);
  if (errors.length) throw new ApiError(400, errors.join(' '));
  return questions;
};
const categoryPayload = body => ({
  name: required(body?.name, 'Category name'), slug: serviceSlug(body?.slug || body?.name),
  description: optional(body?.description, 1200), icon: optional(body?.icon, 32),
  family: ['professional', 'odd_job', 'other'].includes(body?.family) ? body.family : 'professional',
  order: Math.max(0, Math.min(999, Number(body?.order) || 0)), featured: body?.featured === true,
  toggles: overrides(body?.toggles)
});
const servicePayload = body => ({
  categoryId: required(body?.categoryId || body?.category_id, 'Category'), name: required(body?.name, 'Service name'),
  slug: serviceSlug(body?.slug || body?.name), description: optional(body?.description, 3000),
  order: Math.max(0, Math.min(999, Number(body?.order) || 0)), featured: body?.featured === true,
  toggles: overrides(body?.toggles)
});
const templatePayload = body => ({
  name: required(body?.name, 'Template name'), slug: serviceSlug(body?.slug || body?.name),
  kind: [...STARTER_SERVICE_TEMPLATES.map(item => item.kind), 'custom'].includes(body?.kind || body?.type) ? (body.kind || body.type) : 'custom',
  description: optional(body?.description, 1000), questions: questionPayload(body?.questions || [])
});
const setPayload = body => ({ name: required(body?.name, 'Question-set name'), slug: serviceSlug(body?.slug || body?.name), description: optional(body?.description, 1000), questions: questionPayload(body?.questions || []) });

const ensureEngine = async () => {
  await ServiceEngineSettings.findOneAndUpdate({ key: 'service-engine' }, { $setOnInsert: { enabled: true, toggles: DEFAULT_SERVICE_ENGINE_TOGGLES } }, { upsert: true, setDefaultsOnInsert: true });
  for (const starter of STARTER_SERVICE_TEMPLATES) {
    await ServiceTemplate.findOneAndUpdate({ slug: starter.slug }, { $setOnInsert: { templateId: `TPL-${starter.kind.toUpperCase()}`, name: starter.name, kind: starter.kind, description: starter.description, builtIn: true, protected: true, questions: starter.questions, createdBy: 'system', updatedBy: 'system' } }, { upsert: true, setDefaultsOnInsert: true });
  }
  if (await ServiceCategory.estimatedDocumentCount()) return;
  const platform = await PlatformConfig.findOne({ key: 'platform' }).lean();
  const catalog = platform?.published?.serviceCatalog || DEFAULT_PLATFORM_CONFIG.serviceCatalog;
  const categoryMap = new Map();
  for (const item of catalog?.categories || []) {
    const slug = serviceSlug(item.id || item.name); const categoryId = `CAT-${slug.toUpperCase()}`;
    const category = await ServiceCategory.findOneAndUpdate({ slug }, { $setOnInsert: { categoryId, slug, name: item.name, description: item.description || '', icon: item.icon || '', family: item.family || 'professional', order: item.order || 0, featured: item.featured === true, status: item.active === false ? 'paused' : 'published', publishedAt: item.active === false ? null : new Date(), createdBy: 'migration', updatedBy: 'migration' } }, { upsert: true, returnDocument: 'after', setDefaultsOnInsert: true });
    categoryMap.set(item.id, category.categoryId);
  }
  if (await ServiceDefinition.estimatedDocumentCount()) return;
  for (const item of catalog?.services || []) {
    const slug = serviceSlug(item.id || item.name);
    await ServiceDefinition.findOneAndUpdate({ slug }, { $setOnInsert: { serviceId: `SVC-${slug.toUpperCase()}`, slug, categoryId: categoryMap.get(item.categoryId) || [...categoryMap.values()][0], name: item.name, description: item.description || '', order: item.order || 0, featured: item.featured === true, status: item.active === false ? 'paused' : 'published', publishedAt: item.active === false ? null : new Date(), createdBy: 'migration', updatedBy: 'migration' } }, { upsert: true, setDefaultsOnInsert: true });
  }
};

const plain = value => value?.toObject ? value.toObject() : value;
const settingsDto = value => { const item = plain(value) || {}; return { ...item, toggles: { ...DEFAULT_SERVICE_ENGINE_TOGGLES, ...(plain(item.toggles) || {}) } }; };
const categoryDto = (value, settings) => { const item = plain(value); const resolved = resolveEffectiveToggles(settings, item, {}); return { ...item, id: item.categoryId, ...resolved }; };
const serviceDto = (value, settings, category) => { const item = plain(value); const resolved = resolveEffectiveToggles(settings, category || {}, item); return { ...item, id: item.serviceId, ...resolved }; };
const templateDto = value => { const item = plain(value); return { ...item, id: item.templateId, type: item.kind, questionCount: item.questions?.length || 0 }; };
const setDto = value => { const item = plain(value); return { ...item, id: item.questionSetId, questionCount: item.questions?.length || 0 }; };

const bootstrap = async (req, res) => {
  await ensureEngine();
  const [settingsDoc, categoryDocs, serviceDocs, templateDocs, setDocs] = await Promise.all([
    ServiceEngineSettings.findOne({ key: 'service-engine' }), ServiceCategory.find().sort({ order: 1, name: 1 }),
    ServiceDefinition.find().sort({ order: 1, name: 1 }), ServiceTemplate.find().sort({ builtIn: -1, name: 1 }), ServiceQuestionSet.find().sort({ name: 1 })
  ]);
  const settings = settingsDto(settingsDoc); const categories = categoryDocs.map(item => categoryDto(item, settings));
  const categoryMap = new Map(categories.map(item => [item.categoryId, item])); const services = serviceDocs.map(item => serviceDto(item, settings, categoryMap.get(item.categoryId)));
  const dashboard = {
    totalCategories: categories.length, totalServices: services.length,
    publishedServices: services.filter(item => item.status === 'published').length, draftServices: services.filter(item => item.status === 'draft').length,
    pausedServices: services.filter(item => item.status === 'paused').length, archivedServices: services.filter(item => item.status === 'archived').length,
    featuredServices: services.filter(item => item.featured).length, servicesWithoutQuestions: services.filter(item => !item.questions?.length).length,
    templates: templateDocs.length, questionSets: setDocs.length
  };
  res.json({ success: true, dashboard, settings, categories, services, templates: templateDocs.map(templateDto), questionSets: setDocs.map(setDto), questionTypes: SERVICE_QUESTION_TYPES, toggleDefinitions: SERVICE_ENGINE_TOGGLE_DEFINITIONS });
};

const publicCatalog = async (req, res) => {
  if (mongoose.connection.readyState !== 1) {
    const source = DEFAULT_PLATFORM_CONFIG.serviceCatalog;
    return res.json({ success: true, fallback: true, catalog: { categories: source.categories.filter(item => item.active !== false), services: source.services.filter(item => item.active !== false) } });
  }
  await ensureEngine();
  const settings = settingsDto(await ServiceEngineSettings.findOne({ key: 'service-engine' }));
  const categories = (await ServiceCategory.find({ status: 'published' }).sort({ order: 1 }).lean()).map(item => categoryDto(item, settings));
  const categoryMap = new Map(categories.map(item => [item.categoryId, item]));
  const services = (await ServiceDefinition.find({ status: 'published', categoryId: { $in: [...categoryMap.keys()] } }).sort({ order: 1 }).lean()).map(item => serviceDto(item, settings, categoryMap.get(item.categoryId)));
  res.json({ success: true, fallback: false, catalog: { settings, categories, services } });
};

const updateSettings = async (req, res) => {
  const settings = await ServiceEngineSettings.findOneAndUpdate({ key: 'service-engine' }, { $set: { enabled: req.body?.enabled !== false, toggles: globals(req.body?.toggles), updatedBy: actor(req) }, $inc: { version: 1 } }, { upsert: true, returnDocument: 'after', runValidators: true });
  await audit(req, 'service_engine_settings_updated', 'settings', 'service-engine'); res.json({ success: true, settings: settingsDto(settings) });
};
const createCategory = async (req, res) => { const data = categoryPayload(req.body); if (!data.slug) throw new ApiError(400, 'A valid category slug is required.'); await duplicateCheck(ServiceCategory, data.slug, 'categoryId'); const category = await ServiceCategory.create({ categoryId: appId('CAT'), ...data, createdBy: actor(req), updatedBy: actor(req) }); await audit(req, 'service_category_created', 'category', category.categoryId); res.status(201).json({ success: true, category: categoryDto(category, await ServiceEngineSettings.findOne({ key: 'service-engine' })) }); };
const updateCategory = async (req, res) => { const existing = await ServiceCategory.findOne(queryId('categoryId', req.params.id)); if (!existing) throw new ApiError(404, 'Category not found.'); const data = categoryPayload(req.body); if (!data.slug) throw new ApiError(400, 'A valid category slug is required.'); await duplicateCheck(ServiceCategory, data.slug, 'categoryId', existing.categoryId); Object.assign(existing, data, { updatedBy: actor(req) }); await existing.save(); await audit(req, 'service_category_updated', 'category', existing.categoryId); res.json({ success: true, category: plain(existing) }); };
const deleteCategory = async (req, res) => { const category = await ServiceCategory.findOne(queryId('categoryId', req.params.id)); if (!category) throw new ApiError(404, 'Category not found.'); if (!['draft', 'archived'].includes(category.status)) throw new ApiError(409, 'Publish lifecycle records must be archived before deletion.'); if (await ServiceDefinition.exists({ categoryId: category.categoryId })) throw new ApiError(409, 'Move or delete this category’s services first.'); await category.deleteOne(); await audit(req, 'service_category_deleted', 'category', category.categoryId); res.json({ success: true }); };
const categoryAction = async (req, res) => { const category = await ServiceCategory.findOne(queryId('categoryId', req.params.id)); if (!category) throw new ApiError(404, 'Category not found.'); await lifecycle(req, category, req.params.action, 'category'); res.json({ success: true, category: plain(category) }); };

const createService = async (req, res) => { const data = servicePayload(req.body); if (!data.slug) throw new ApiError(400, 'A valid service slug is required.'); await duplicateCheck(ServiceDefinition, data.slug, 'serviceId'); if (!await ServiceCategory.exists({ categoryId: data.categoryId, status: { $ne: 'archived' } })) throw new ApiError(400, 'Choose an active category.'); const service = await ServiceDefinition.create({ serviceId: appId('SVC'), ...data, createdBy: actor(req), updatedBy: actor(req) }); await audit(req, 'service_definition_created', 'service', service.serviceId); res.status(201).json({ success: true, service: plain(service) }); };
const updateService = async (req, res) => { const existing = await ServiceDefinition.findOne(queryId('serviceId', req.params.id)); if (!existing) throw new ApiError(404, 'Service not found.'); const data = servicePayload(req.body); if (!data.slug) throw new ApiError(400, 'A valid service slug is required.'); await duplicateCheck(ServiceDefinition, data.slug, 'serviceId', existing.serviceId); if (!await ServiceCategory.exists({ categoryId: data.categoryId, status: { $ne: 'archived' } })) throw new ApiError(400, 'Choose an active category.'); Object.assign(existing, data, { updatedBy: actor(req), revision: existing.revision + 1 }); await existing.save(); await audit(req, 'service_definition_updated', 'service', existing.serviceId); res.json({ success: true, service: plain(existing) }); };
const deleteService = async (req, res) => { const service = await ServiceDefinition.findOne(queryId('serviceId', req.params.id)); if (!service) throw new ApiError(404, 'Service not found.'); if (!['draft', 'archived'].includes(service.status)) throw new ApiError(409, 'Archive this service before deletion.'); await service.deleteOne(); await audit(req, 'service_definition_deleted', 'service', service.serviceId); res.json({ success: true }); };
const serviceAction = async (req, res) => { const service = await ServiceDefinition.findOne(queryId('serviceId', req.params.id)); if (!service) throw new ApiError(404, 'Service not found.'); if (req.params.action === 'publish' && !await ServiceCategory.exists({ categoryId: service.categoryId, status: 'published' })) throw new ApiError(409, 'Publish the parent category first.'); await lifecycle(req, service, req.params.action, 'service'); res.json({ success: true, service: plain(service) }); };

async function lifecycle(req, record, action, entity) {
  if (!['publish', 'pause', 'archive', 'restore'].includes(action)) throw new ApiError(400, 'Unsupported lifecycle action.');
  if (action === 'pause' && record.status !== 'published') throw new ApiError(409, 'Only a published record can be paused.');
  if (action === 'restore' && record.status !== 'archived') throw new ApiError(409, 'Only an archived record can be restored.');
  if (action === 'archive') { if (record.status === 'archived') throw new ApiError(409, 'This record is already archived.'); record.statusBeforeArchive = record.status; record.status = 'archived'; record.archivedAt = new Date(); }
  if (action === 'restore') { record.status = SERVICE_LIFECYCLE_STATUSES.includes(record.statusBeforeArchive) && record.statusBeforeArchive !== 'archived' ? record.statusBeforeArchive : 'draft'; record.archivedAt = null; }
  if (action === 'publish') { record.status = 'published'; record.publishedAt = new Date(); }
  if (action === 'pause') record.status = 'paused';
  record.updatedBy = actor(req); if ('revision' in record) record.revision += 1; await record.save(); await audit(req, `${entity}_${action}d`, entity, record.categoryId || record.serviceId);
}

const createTemplate = async (req, res) => { const data = templatePayload(req.body); if (!data.slug) throw new ApiError(400, 'A valid template slug is required.'); await duplicateCheck(ServiceTemplate, data.slug, 'templateId'); const template = await ServiceTemplate.create({ templateId: appId('TPL'), ...data, createdBy: actor(req), updatedBy: actor(req) }); await audit(req, 'service_template_created', 'template', template.templateId); res.status(201).json({ success: true, template: templateDto(template) }); };
const updateTemplate = async (req, res) => { const item = await ServiceTemplate.findOne(queryId('templateId', req.params.id)); if (!item) throw new ApiError(404, 'Template not found.'); if (item.protected) throw new ApiError(403, 'Starter templates are protected.'); const data = templatePayload(req.body); await duplicateCheck(ServiceTemplate, data.slug, 'templateId', item.templateId); Object.assign(item, data, { updatedBy: actor(req) }); await item.save(); await audit(req, 'service_template_updated', 'template', item.templateId); res.json({ success: true, template: templateDto(item) }); };
const deleteTemplate = async (req, res) => { const item = await ServiceTemplate.findOne(queryId('templateId', req.params.id)); if (!item) throw new ApiError(404, 'Template not found.'); if (item.protected) throw new ApiError(403, 'Starter templates are protected.'); await item.deleteOne(); await audit(req, 'service_template_deleted', 'template', item.templateId); res.json({ success: true }); };
const applyTemplate = async (req, res) => { const service = await ServiceDefinition.findOne(queryId('serviceId', req.params.id)); const template = await ServiceTemplate.findOne(queryId('templateId', req.body?.templateId)); if (!service || !template) throw new ApiError(404, 'Service or template not found.'); service.questions = cloneServiceQuestions(template.questions); service.templateId = template.templateId; service.revision += 1; service.updatedBy = actor(req); await service.save(); await audit(req, 'service_template_applied', 'service', service.serviceId, { templateId: template.templateId }); res.json({ success: true, service: plain(service) }); };
const saveQuestions = async (req, res) => { const service = await ServiceDefinition.findOne(queryId('serviceId', req.params.id)); if (!service) throw new ApiError(404, 'Service not found.'); service.questions = questionPayload(req.body?.questions); service.revision += 1; service.updatedBy = actor(req); await service.save(); await audit(req, 'service_questions_saved', 'service', service.serviceId, { count: service.questions.length }); res.json({ success: true, service: plain(service) }); };
const copyQuestions = async (req, res) => { const target = await ServiceDefinition.findOne(queryId('serviceId', req.params.id)); const source = await ServiceDefinition.findOne(queryId('serviceId', req.body?.sourceServiceId)); if (!target || !source) throw new ApiError(404, 'Source or destination service not found.'); target.questions = cloneServiceQuestions(source.questions); target.revision += 1; target.updatedBy = actor(req); await target.save(); await audit(req, 'service_questions_copied', 'service', target.serviceId, { sourceServiceId: source.serviceId }); res.json({ success: true, service: plain(target) }); };

const createQuestionSet = async (req, res) => { const data = setPayload(req.body); if (!data.slug) throw new ApiError(400, 'A valid question-set slug is required.'); await duplicateCheck(ServiceQuestionSet, data.slug, 'questionSetId'); const item = await ServiceQuestionSet.create({ questionSetId: appId('QSET'), ...data, createdBy: actor(req), updatedBy: actor(req) }); await audit(req, 'question_set_created', 'question-set', item.questionSetId); res.status(201).json({ success: true, questionSet: setDto(item) }); };
const updateQuestionSet = async (req, res) => { const item = await ServiceQuestionSet.findOne(queryId('questionSetId', req.params.id)); if (!item) throw new ApiError(404, 'Question set not found.'); if (item.protected) throw new ApiError(403, 'This question set is protected.'); const data = setPayload(req.body); await duplicateCheck(ServiceQuestionSet, data.slug, 'questionSetId', item.questionSetId); Object.assign(item, data, { version: item.version + 1, updatedBy: actor(req) }); await item.save(); await audit(req, 'question_set_updated', 'question-set', item.questionSetId); res.json({ success: true, questionSet: setDto(item) }); };
const deleteQuestionSet = async (req, res) => { const item = await ServiceQuestionSet.findOne(queryId('questionSetId', req.params.id)); if (!item) throw new ApiError(404, 'Question set not found.'); if (item.protected) throw new ApiError(403, 'This question set is protected.'); await item.deleteOne(); await audit(req, 'question_set_deleted', 'question-set', item.questionSetId); res.json({ success: true }); };
const questionSetFromService = async (req, res) => { const service = await ServiceDefinition.findOne(queryId('serviceId', req.body?.serviceId)); if (!service) throw new ApiError(404, 'Service not found.'); const data = setPayload({ ...req.body, questions: service.questions }); await duplicateCheck(ServiceQuestionSet, data.slug, 'questionSetId'); const item = await ServiceQuestionSet.create({ questionSetId: appId('QSET'), ...data, createdBy: actor(req), updatedBy: actor(req) }); await audit(req, 'question_set_created_from_service', 'question-set', item.questionSetId, { serviceId: service.serviceId }); res.status(201).json({ success: true, questionSet: setDto(item) }); };
const applyQuestionSet = async (req, res) => { const service = await ServiceDefinition.findOne(queryId('serviceId', req.params.id)); const set = await ServiceQuestionSet.findOne(queryId('questionSetId', req.body?.questionSetId)); if (!service || !set) throw new ApiError(404, 'Service or question set not found.'); service.questions = cloneServiceQuestions(set.questions); service.revision += 1; service.updatedBy = actor(req); await service.save(); await audit(req, 'question_set_applied', 'service', service.serviceId, { questionSetId: set.questionSetId }); res.json({ success: true, service: plain(service) }); };
const getAudit = async (req, res) => { const logs = await AuditLog.find({ order_id: 'SERVICE-ENGINE' }).sort({ createdAt: -1 }).limit(250).lean(); res.json({ success: true, logs }); };

export const serviceEngineHandlers = { publicCatalog, bootstrap, updateSettings, createCategory, updateCategory, deleteCategory, categoryAction, createService, updateService, deleteService, serviceAction, createTemplate, updateTemplate, deleteTemplate, applyTemplate, saveQuestions, copyQuestions, createQuestionSet, updateQuestionSet, deleteQuestionSet, questionSetFromService, applyQuestionSet, getAudit };
export const respondWithServiceEngineError = (res, error) => {
  if (error?.code === 11000) return res.status(409).json({ success: false, error: 'That slug already exists.' });
  const status = error?.status || (error?.name === 'ValidationError' || error?.name === 'CastError' ? 400 : 500);
  return res.status(status).json({ success: false, error: status === 500 ? `Service Engine error: ${error.message}` : error.message });
};
