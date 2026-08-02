import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { addToast } from '../../common/Toast';
import serviceEngineApi from './serviceEngineApi';
import {
  ENGINE_SECTIONS,
  normalizeQuestionTypes,
  normalizeToggleDefinitions
} from './serviceEngineHelpers';
import { LoadingBlock } from './EngineUi';
import DashboardView from './DashboardView';
import SettingsView from './SettingsView';
import { CategoryManager, ServiceManager } from './RecordManagers';
import TemplatesView from './TemplatesView';
import QuestionBuilder from './QuestionBuilder';
import AuditView from './AuditView';
import './service-engine.css';

const EMPTY_ENGINE = {
  dashboard: {},
  settings: { enabled: true, toggles: {} },
  categories: [],
  services: [],
  templates: [],
  questionSets: [],
  questionTypes: [],
  toggleDefinitions: []
};

const extractEngine = data => {
  const source = data.engine || data.serviceEngine || data.service_engine || data;
  return {
    dashboard: source.dashboard || {},
    settings: source.settings || EMPTY_ENGINE.settings,
    categories: Array.isArray(source.categories) ? source.categories : [],
    services: Array.isArray(source.services) ? source.services : [],
    templates: Array.isArray(source.templates) ? source.templates : [],
    questionSets: Array.isArray(source.questionSets) ? source.questionSets : Array.isArray(source.question_sets) ? source.question_sets : [],
    questionTypes: normalizeQuestionTypes(source.questionTypes || source.question_types),
    toggleDefinitions: normalizeToggleDefinitions(source.toggleDefinitions || source.toggle_definitions)
  };
};

const recordFrom = data => data.category || data.service || data.template || data.questionSet || data.question_set || data.record || null;

export default function ServiceEngineStudio({ canEdit = false, canPublish = false }) {
  const [engine, setEngine] = useState(() => ({
    ...EMPTY_ENGINE,
    questionTypes: normalizeQuestionTypes([]),
    toggleDefinitions: normalizeToggleDefinitions([])
  }));
  const [activeSection, setActiveSection] = useState('dashboard');
  const [loading, setLoading] = useState(true);
  const [working, setWorking] = useState('');
  const [error, setError] = useState('');
  const [auditEntries, setAuditEntries] = useState([]);
  const [auditLoading, setAuditLoading] = useState(false);
  const [serviceCategoryFilter, setServiceCategoryFilter] = useState('');
  const [questionSelection, setQuestionSelection] = useState({});

  const load = useCallback(async ({ quiet = false } = {}) => {
    if (!quiet) setLoading(true);
    try {
      const data = await serviceEngineApi.bootstrap();
      setEngine(extractEngine(data));
      setError('');
      return data;
    } catch (requestError) {
      setError(requestError.message);
      if (!quiet) addToast(requestError.message, 'error');
      return null;
    } finally {
      if (!quiet) setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const loadAudit = useCallback(async () => {
    setAuditLoading(true);
    try {
      const data = await serviceEngineApi.audit();
      setAuditEntries(data.logs || data.entries || data.audit || data.events || []);
      setError('');
    } catch (requestError) {
      setError(requestError.message);
      addToast(requestError.message, 'error');
    } finally {
      setAuditLoading(false);
    }
  }, []);

  useEffect(() => {
    if (activeSection === 'audit' && !auditEntries.length && !auditLoading) loadAudit();
  }, [activeSection, auditEntries.length, auditLoading, loadAudit]);

  const mutate = useCallback(async (key, operation, successMessage) => {
    setWorking(key);
    setError('');
    try {
      const data = await operation();
      addToast(successMessage, 'success');
      await load({ quiet: true });
      return { success: true, data, record: recordFrom(data) };
    } catch (requestError) {
      setError(requestError.message);
      addToast(requestError.message, 'error');
      return { success: false, error: requestError.message };
    } finally {
      setWorking('');
    }
  }, [load]);

  const actions = useMemo(() => ({
    saveSettings: settings => mutate('settings-save', () => serviceEngineApi.updateSettings(settings), 'Service Engine settings saved.'),
    createCategory: category => mutate('category-save', () => serviceEngineApi.createCategory(category), 'Category created.'),
    updateCategory: (id, category) => mutate('category-save', () => serviceEngineApi.updateCategory(id, category), 'Category saved.'),
    deleteCategory: id => mutate(`category-${id}-delete`, () => serviceEngineApi.deleteCategory(id), 'Draft category deleted.'),
    categoryAction: (id, action) => mutate(`category-${id}-${action}`, () => serviceEngineApi.categoryAction(id, action), `Category ${action === 'publish' ? 'published' : `${action}d`}.`),
    createService: service => mutate('service-save', () => serviceEngineApi.createService(service), 'Service created.'),
    updateService: (id, service) => mutate('service-save', () => serviceEngineApi.updateService(id, service), 'Service saved.'),
    deleteService: id => mutate(`service-${id}-delete`, () => serviceEngineApi.deleteService(id), 'Draft service deleted.'),
    serviceAction: (id, action) => mutate(`service-${id}-${action}`, () => serviceEngineApi.serviceAction(id, action), `Service ${action === 'publish' ? 'published' : `${action}d`}.`),
    createTemplate: template => mutate('template-save', () => serviceEngineApi.createTemplate(template), 'Custom template created.'),
    updateTemplate: (id, template) => mutate('template-save', () => serviceEngineApi.updateTemplate(id, template), 'Template saved.'),
    deleteTemplate: id => mutate(`template-${id}-delete`, () => serviceEngineApi.deleteTemplate(id), 'Custom template deleted.'),
    createQuestionSet: set => mutate('question-set-save', () => serviceEngineApi.createQuestionSet(set), 'Question set created.'),
    updateQuestionSet: (id, set) => mutate('question-set-save', () => serviceEngineApi.updateQuestionSet(id, set), 'Question set saved.'),
    deleteQuestionSet: id => mutate(`question-set-${id}-delete`, () => serviceEngineApi.deleteQuestionSet(id), 'Question set deleted.'),
    saveQuestions: (serviceId, questions) => mutate('questions-save', () => serviceEngineApi.saveQuestions(serviceId, questions), 'Service questions saved.'),
    copyQuestions: (serviceId, sourceServiceId) => mutate('questions-copy', () => serviceEngineApi.copyQuestions(serviceId, sourceServiceId), 'Questions copied to this service.'),
    applyTemplate: (serviceId, templateId) => mutate('template-apply', () => serviceEngineApi.applyTemplate(serviceId, templateId), 'Template applied to the service.'),
    applyQuestionSet: (serviceId, questionSetId) => mutate('question-set-apply', () => serviceEngineApi.applyQuestionSet(serviceId, questionSetId), 'Question set applied to the service.'),
    saveAsQuestionSet: payload => mutate('question-set-from-service', () => serviceEngineApi.createQuestionSetFromService(payload), 'Reusable question set created.')
  }), [mutate]);

  const navigate = section => setActiveSection(section);
  const openServices = categoryId => {
    setServiceCategoryFilter(categoryId || '');
    setActiveSection('services');
  };
  const openQuestions = selection => {
    setQuestionSelection(typeof selection === 'string' ? { serviceId: selection } : (selection || {}));
    setActiveSection('questions');
  };

  const renderActiveSection = () => {
    if (activeSection === 'dashboard') return <DashboardView engine={engine} onNavigate={navigate} />;
    if (activeSection === 'categories') return <CategoryManager categories={engine.categories} services={engine.services} settings={engine.settings} toggleDefinitions={engine.toggleDefinitions} canEdit={canEdit} canPublish={canPublish} working={working} onCreate={actions.createCategory} onUpdate={actions.updateCategory} onDelete={actions.deleteCategory} onAction={actions.categoryAction} onOpenServices={openServices} />;
    if (activeSection === 'services') return <ServiceManager categories={engine.categories} services={engine.services} settings={engine.settings} toggleDefinitions={engine.toggleDefinitions} initialCategoryId={serviceCategoryFilter} canEdit={canEdit} canPublish={canPublish} working={working} onCreate={actions.createService} onUpdate={actions.updateService} onDelete={actions.deleteService} onAction={actions.serviceAction} onOpenQuestions={openQuestions} />;
    if (activeSection === 'templates') return <TemplatesView templates={engine.templates} questionSets={engine.questionSets} canEdit={canEdit} working={working} onCreateTemplate={actions.createTemplate} onUpdateTemplate={actions.updateTemplate} onDeleteTemplate={actions.deleteTemplate} onCreateQuestionSet={actions.createQuestionSet} onUpdateQuestionSet={actions.updateQuestionSet} onDeleteQuestionSet={actions.deleteQuestionSet} onOpenQuestions={openQuestions} />;
    if (activeSection === 'questions') return <QuestionBuilder services={engine.services} categories={engine.categories} templates={engine.templates} questionSets={engine.questionSets} questionTypes={engine.questionTypes} initialSelection={questionSelection} canEdit={canEdit} working={working} onSave={actions.saveQuestions} onCopy={actions.copyQuestions} onApplyTemplate={actions.applyTemplate} onApplyQuestionSet={actions.applyQuestionSet} onSaveAsQuestionSet={actions.saveAsQuestionSet} />;
    if (activeSection === 'settings') return <SettingsView settings={engine.settings} toggleDefinitions={engine.toggleDefinitions} canEdit={canEdit} working={working === 'settings-save'} onSave={actions.saveSettings} />;
    if (activeSection === 'audit') return <AuditView entries={auditEntries} loading={auditLoading} onRefresh={loadAudit} />;
    return null;
  };

  return (
    <div className="service-engine-shell">
      <header className="service-engine-header">
        <div>
          <span>PHASE 17A · UNIVERSAL SERVICE ENGINE</span>
          <h3>Service Engine</h3>
          <p>Database-backed catalogue, templates and dynamic client intake in one governed workspace.</p>
        </div>
        <div>
          <span className={`service-engine-platform-state ${engine.settings?.enabled === false ? 'is-off' : 'is-on'}`}><i />{engine.settings?.enabled === false ? 'Platform paused' : 'Platform enabled'}</span>
          <button type="button" className="btn btn-ghost btn-sm" disabled={loading || Boolean(working)} onClick={() => load()}>{loading ? 'Loading...' : 'Refresh'}</button>
        </div>
      </header>

      <nav className="service-engine-nav" aria-label="Service Engine modules">
        {ENGINE_SECTIONS.map(([id, label]) => <button key={id} type="button" className={activeSection === id ? 'active' : ''} onClick={() => setActiveSection(id)}><span>{label}</span>{id === 'services' && engine.services.length > 0 && <b>{engine.services.length}</b>}{id === 'categories' && engine.categories.length > 0 && <b>{engine.categories.length}</b>}</button>)}
      </nav>

      {error && <div className="service-engine-error"><span>{error}</span><button type="button" onClick={() => load()}>Retry</button></div>}
      {loading ? <LoadingBlock /> : renderActiveSection()}
    </div>
  );
}
