import React, { useEffect, useMemo, useState } from 'react';
import {
  emptyQuestionSet,
  emptyTemplate,
  idOf,
  slugify,
  STARTER_TEMPLATE_TYPES,
  titleFromKey
} from './serviceEngineHelpers';
import { EmptyState, EngineField, PermissionNote, SectionHeading } from './EngineUi';

const templateType = template => String(template?.type || template?.templateType || template?.template_type || 'custom').toLowerCase();
const isBuiltIn = template => Boolean(template?.builtIn || template?.built_in || template?.readonly || template?.readOnly);

function TemplateCard({ template, fallback, selected, onSelect }) {
  const record = template || fallback;
  const questionCount = template?.questionCount ?? template?.question_count ?? template?.questions?.length ?? 0;
  return (
    <button type="button" className={`service-engine-template-card ${selected ? 'active' : ''} ${!template ? 'is-placeholder' : ''}`} onClick={() => template && onSelect(idOf(template))} disabled={!template}>
      <span>{String(record.label || record.name || '?').slice(0, 1)}</span>
      <div><small>{template ? 'Starter template' : 'Starter slot'}</small><strong>{record.name || record.label}</strong><p>{record.description || fallback?.description}</p></div>
      <b>{template ? `${questionCount} questions` : 'Awaiting seed'}</b>
    </button>
  );
}

export default function TemplatesView({
  templates,
  questionSets,
  canEdit,
  working,
  onCreateTemplate,
  onUpdateTemplate,
  onDeleteTemplate,
  onCreateQuestionSet,
  onUpdateQuestionSet,
  onDeleteQuestionSet,
  onOpenQuestions
}) {
  const starterTemplates = templates.filter(template => isBuiltIn(template));
  const customTemplates = templates.filter(template => !isBuiltIn(template));
  const [selectedTemplateId, setSelectedTemplateId] = useState('');
  const [templateCreating, setTemplateCreating] = useState(false);
  const [templateForm, setTemplateForm] = useState(emptyTemplate);
  const [selectedSetId, setSelectedSetId] = useState('');
  const [setCreating, setSetCreating] = useState(false);
  const [setForm, setSetForm] = useState(emptyQuestionSet);

  const selectedTemplate = useMemo(() => templates.find(template => idOf(template) === selectedTemplateId), [templates, selectedTemplateId]);
  const selectedSet = useMemo(() => questionSets.find(set => idOf(set) === selectedSetId), [questionSets, selectedSetId]);

  useEffect(() => {
    if (templateCreating) return;
    if (selectedTemplate) setTemplateForm({ ...selectedTemplate, questions: selectedTemplate.questions || [] });
    else if (customTemplates[0]) setSelectedTemplateId(idOf(customTemplates[0]));
  }, [selectedTemplate, customTemplates, templateCreating]);

  useEffect(() => {
    if (setCreating) return;
    if (selectedSet) setSetForm({ ...selectedSet, questions: selectedSet.questions || [] });
    else if (questionSets[0]) setSelectedSetId(idOf(questionSets[0]));
  }, [selectedSet, questionSets, setCreating]);

  const selectTemplate = id => {
    setTemplateCreating(false);
    setSelectedTemplateId(id);
  };
  const createTemplate = () => {
    setTemplateCreating(true);
    setSelectedTemplateId('');
    setTemplateForm({ ...emptyTemplate, questions: [] });
  };
  const updateTemplateField = (key, value) => setTemplateForm(previous => ({
    ...previous,
    [key]: value,
    ...(key === 'name' && (!previous.slug || templateCreating) ? { slug: slugify(value) } : {})
  }));
  const saveTemplate = async event => {
    event.preventDefault();
    const payload = {
      name: templateForm.name,
      slug: templateForm.slug,
      type: templateForm.type || 'custom',
      description: templateForm.description,
      questions: templateForm.questions || []
    };
    const result = templateCreating ? await onCreateTemplate(payload) : await onUpdateTemplate(idOf(selectedTemplate), payload);
    if (result?.success === false) return;
    setTemplateCreating(false);
    if (result?.record) setSelectedTemplateId(idOf(result.record));
  };
  const removeTemplate = () => {
    if (!selectedTemplate || !window.confirm(`Delete the custom template “${selectedTemplate.name}”?`)) return;
    onDeleteTemplate(idOf(selectedTemplate));
    setSelectedTemplateId('');
  };

  const selectSet = id => {
    setSetCreating(false);
    setSelectedSetId(id);
  };
  const createSet = () => {
    setSetCreating(true);
    setSelectedSetId('');
    setSetForm({ ...emptyQuestionSet, questions: [] });
  };
  const updateSetField = (key, value) => setSetForm(previous => ({
    ...previous,
    [key]: value,
    ...(key === 'name' && (!previous.slug || setCreating) ? { slug: slugify(value) } : {})
  }));
  const saveSet = async event => {
    event.preventDefault();
    const payload = { name: setForm.name, slug: setForm.slug, description: setForm.description, questions: setForm.questions || [] };
    const result = setCreating ? await onCreateQuestionSet(payload) : await onUpdateQuestionSet(idOf(selectedSet), payload);
    if (result?.success === false) return;
    setSetCreating(false);
    if (result?.record) setSelectedSetId(idOf(result.record));
  };
  const removeSet = () => {
    if (!selectedSet || !window.confirm(`Delete the reusable question set “${selectedSet.name}”?`)) return;
    onDeleteQuestionSet(idOf(selectedSet));
    setSelectedSetId('');
  };

  return (
    <div className="service-engine-view">
      <SectionHeading eyebrow="Reusable foundations" title="Templates" description="Start with six supported service patterns, then maintain custom templates and reusable question sets." actions={<button type="button" className="btn btn-primary" disabled={!canEdit} onClick={createTemplate}>New custom template</button>} />
      <PermissionNote canEdit={canEdit} />

      <section className="service-engine-panel">
        <div className="service-engine-panel-title"><div><span>Starter library</span><h4>Six service templates</h4></div><small>Maintained by IPS</small></div>
        <div className="service-engine-starter-grid">
          {STARTER_TEMPLATE_TYPES.map(fallback => {
            const template = starterTemplates.find(item => templateType(item) === fallback.id || String(item.slug || '').toLowerCase() === fallback.id);
            return <TemplateCard key={fallback.id} template={template} fallback={fallback} selected={template && selectedTemplateId === idOf(template)} onSelect={selectTemplate} />;
          })}
        </div>
      </section>

      <div className="service-engine-template-layout">
        <section className="service-engine-panel">
          <div className="service-engine-panel-title"><div><span>Custom library</span><h4>Custom templates</h4></div><b>{customTemplates.length}</b></div>
          <div className="service-engine-compact-list">
            {customTemplates.map(template => <button type="button" key={idOf(template)} className={selectedTemplateId === idOf(template) ? 'active' : ''} onClick={() => selectTemplate(idOf(template))}><span><strong>{template.name}</strong><small>{template.description || 'No description'}</small></span><b>{template.questions?.length || 0}</b></button>)}
            {!customTemplates.length && <EmptyState title="No custom templates">Create a reusable service foundation for your team.</EmptyState>}
          </div>
        </section>

        <section className="service-engine-panel service-engine-template-editor">
          {!templateCreating && !selectedTemplate ? <EmptyState title="Select a template">Choose a starter to inspect it or create a custom template.</EmptyState> : (
            <form onSubmit={saveTemplate}>
              <div className="service-engine-editor-heading"><div><span>{isBuiltIn(selectedTemplate) ? 'Read-only starter' : templateCreating ? 'New template' : 'Custom template'}</span><h3>{templateCreating ? 'Create template' : templateForm.name}</h3></div>{selectedTemplate && <b>{templateForm.questions?.length || 0} questions</b>}</div>
              <EngineField label="Template name" value={templateForm.name} disabled={isBuiltIn(selectedTemplate)} required maxLength={120} onChange={value => updateTemplateField('name', value)} />
              <EngineField label="Unique slug" value={templateForm.slug} disabled={isBuiltIn(selectedTemplate)} required pattern="[a-z0-9]+(?:-[a-z0-9]+)*" onChange={value => updateTemplateField('slug', slugify(value))} />
              <label className="service-engine-field"><span>Template family</span><select className="form-select" disabled={isBuiltIn(selectedTemplate)} value={templateForm.type || 'custom'} onChange={event => updateTemplateField('type', event.target.value)}><option value="custom">Custom</option>{STARTER_TEMPLATE_TYPES.map(type => <option value={type.id} key={type.id}>{type.label}</option>)}</select></label>
              <EngineField label="Description" value={templateForm.description} disabled={isBuiltIn(selectedTemplate)} multiline maxLength={500} onChange={value => updateTemplateField('description', value)} />
              <div className="service-engine-editor-footer">
                <button type="button" className="btn btn-ghost" onClick={() => onOpenQuestions({ templateId: idOf(selectedTemplate) })}>Use in Question Builder</button>
                {!isBuiltIn(selectedTemplate) && <div><button type="button" className="btn btn-danger btn-sm" disabled={!canEdit || Boolean(working)} onClick={removeTemplate}>Delete</button><button type="submit" className="btn btn-primary" disabled={!canEdit || Boolean(working)}>{working === 'template-save' ? 'Saving...' : 'Save template'}</button></div>}
              </div>
            </form>
          )}
        </section>
      </div>

      <SectionHeading eyebrow="Question libraries" title="Reusable question sets" description="Question sets can be created here or captured from a fully configured service in Question Builder." actions={<button type="button" className="btn btn-secondary" disabled={!canEdit} onClick={createSet}>New empty set</button>} />
      <div className="service-engine-template-layout">
        <section className="service-engine-panel">
          <div className="service-engine-compact-list">
            {questionSets.map(set => <button type="button" key={idOf(set)} className={selectedSetId === idOf(set) ? 'active' : ''} onClick={() => selectSet(idOf(set))}><span><strong>{set.name}</strong><small>{set.description || 'Reusable intake questions'}</small></span><b>{set.questions?.length || set.questionCount || 0}</b></button>)}
            {!questionSets.length && <EmptyState title="No reusable sets">Save a service's questions as a set or create an empty one.</EmptyState>}
          </div>
        </section>
        <section className="service-engine-panel service-engine-template-editor">
          {!setCreating && !selectedSet ? <EmptyState title="Select a question set">Choose a set to edit its details.</EmptyState> : (
            <form onSubmit={saveSet}>
              <div className="service-engine-editor-heading"><div><span>{setCreating ? 'New set' : 'Reusable set'}</span><h3>{setCreating ? 'Create question set' : setForm.name}</h3></div><b>{setForm.questions?.length || 0} questions</b></div>
              <EngineField label="Set name" value={setForm.name} required onChange={value => updateSetField('name', value)} />
              <EngineField label="Unique slug" value={setForm.slug} required pattern="[a-z0-9]+(?:-[a-z0-9]+)*" onChange={value => updateSetField('slug', slugify(value))} />
              <EngineField label="Description" value={setForm.description} multiline onChange={value => updateSetField('description', value)} />
              <div className="service-engine-editor-footer"><button type="button" className="btn btn-ghost" onClick={() => onOpenQuestions({ questionSetId: idOf(selectedSet) })}>Apply in Question Builder</button><div>{!setCreating && <button type="button" className="btn btn-danger btn-sm" disabled={!canEdit || Boolean(working)} onClick={removeSet}>Delete</button>}<button type="submit" className="btn btn-primary" disabled={!canEdit || Boolean(working)}>{working === 'question-set-save' ? 'Saving...' : 'Save set'}</button></div></div>
            </form>
          )}
        </section>
      </div>
    </div>
  );
}
