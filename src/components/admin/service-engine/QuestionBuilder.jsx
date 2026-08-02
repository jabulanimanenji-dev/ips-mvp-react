import React, { useEffect, useMemo, useState } from 'react';
import {
  createQuestion,
  idOf,
  normalizeQuestions,
  slugify,
  titleFromKey
} from './serviceEngineHelpers';
import { EmptyState, EngineField, PermissionNote, SectionHeading, StatusBadge } from './EngineUi';

const questionId = question => String(question?.id || question?.key || '');

const reorder = (items, from, to) => {
  if (from < 0 || to < 0 || from >= items.length || to >= items.length) return items;
  const next = [...items];
  const [item] = next.splice(from, 1);
  next.splice(to, 0, item);
  return next.map((question, order) => ({ ...question, order }));
};

const optionsToText = options => (options || []).map(option => option.label || option.value || '').join('\n');
const optionsFromText = value => value.split('\n').map(item => item.trim()).filter(Boolean).map((label, index) => ({ label, value: slugify(label) || `option-${index + 1}` }));

export default function QuestionBuilder({
  services,
  categories,
  templates,
  questionSets,
  questionTypes,
  initialSelection,
  canEdit,
  working,
  onSave,
  onCopy,
  onApplyTemplate,
  onApplyQuestionSet,
  onSaveAsQuestionSet
}) {
  const availableServices = useMemo(() => services.filter(service => String(service.status || '').toLowerCase() !== 'archived'), [services]);
  const [serviceId, setServiceId] = useState(() => initialSelection?.serviceId || idOf(availableServices[0]));
  const [questions, setQuestions] = useState([]);
  const [baseline, setBaseline] = useState('[]');
  const [selectedQuestionId, setSelectedQuestionId] = useState('');
  const [newType, setNewType] = useState(questionTypes[0]?.value || 'short_text');
  const [dragIndex, setDragIndex] = useState(null);
  const [copySource, setCopySource] = useState('');
  const [templateId, setTemplateId] = useState(initialSelection?.templateId || '');
  const [questionSetId, setQuestionSetId] = useState(initialSelection?.questionSetId || '');
  const [setDraft, setSetDraft] = useState({ name: '', description: '' });
  const [validationMessage, setValidationMessage] = useState('');

  const service = useMemo(() => services.find(item => idOf(item) === serviceId), [services, serviceId]);
  const selectedQuestion = useMemo(() => questions.find(question => questionId(question) === selectedQuestionId), [questions, selectedQuestionId]);
  const dirty = JSON.stringify(questions) !== baseline;
  const category = categories.find(item => idOf(item) === String(service?.categoryId || service?.category_id || service?.category || ''));
  const maxStep = Math.max(1, ...questions.map(question => Number(question.step || 1)));

  useEffect(() => {
    if (initialSelection?.serviceId) setServiceId(initialSelection.serviceId);
    if (initialSelection?.templateId) setTemplateId(initialSelection.templateId);
    if (initialSelection?.questionSetId) setQuestionSetId(initialSelection.questionSetId);
  }, [initialSelection]);

  useEffect(() => {
    if (!service && availableServices[0]) {
      setServiceId(idOf(availableServices[0]));
      return;
    }
    const next = normalizeQuestions(service?.questions || service?.questionSet?.questions || service?.question_set?.questions || []);
    setQuestions(next);
    setBaseline(JSON.stringify(next));
    setSelectedQuestionId(questionId(next[0]));
    setValidationMessage('');
  }, [service, availableServices]);

  const chooseService = nextId => {
    if (dirty && !window.confirm('Discard unsaved question changes and open another service?')) return;
    setServiceId(nextId);
  };

  const updateQuestion = patch => setQuestions(previous => previous.map(question => questionId(question) === selectedQuestionId ? { ...question, ...patch } : question));
  const updateNested = (group, key, value) => updateQuestion({ [group]: { ...(selectedQuestion?.[group] || {}), [key]: value } });
  const addQuestion = () => {
    const question = createQuestion(newType, questions.length);
    setQuestions(previous => [...previous, question]);
    setSelectedQuestionId(question.id);
  };
  const duplicateQuestion = () => {
    if (!selectedQuestion) return;
    const clone = {
      ...selectedQuestion,
      id: `question-${Date.now()}-${questions.length + 1}`,
      key: `${selectedQuestion.key || 'question'}_copy`,
      label: `${selectedQuestion.label} copy`,
      order: questions.length,
      options: (selectedQuestion.options || []).map(option => ({ ...option })),
      validation: { ...(selectedQuestion.validation || {}) },
      condition: { ...(selectedQuestion.condition || {}) },
      upload: { ...(selectedQuestion.upload || {}) }
    };
    setQuestions(previous => [...previous, clone]);
    setSelectedQuestionId(clone.id);
  };
  const removeQuestion = () => {
    if (!selectedQuestion || !window.confirm(`Remove “${selectedQuestion.label}” from this service?`)) return;
    setQuestions(previous => {
      const next = previous.filter(question => questionId(question) !== selectedQuestionId).map((question, order) => ({ ...question, order }));
      setSelectedQuestionId(questionId(next[0]));
      return next;
    });
  };
  const moveQuestion = direction => {
    const index = questions.findIndex(question => questionId(question) === selectedQuestionId);
    const nextIndex = index + direction;
    if (nextIndex < 0 || nextIndex >= questions.length) return;
    setQuestions(previous => reorder(previous, index, nextIndex));
  };

  const save = async () => {
    const keys = questions.map(question => String(question.key || '').trim()).filter(Boolean);
    if (keys.length !== questions.length) {
      setValidationMessage('Every question needs a stable key.');
      return;
    }
    if (new Set(keys).size !== keys.length) {
      setValidationMessage('Question keys must be unique within a service.');
      return;
    }
    setValidationMessage('');
    const result = await onSave(serviceId, questions.map((question, order) => ({ ...question, order })));
    if (result?.success !== false) setBaseline(JSON.stringify(questions.map((question, order) => ({ ...question, order }))));
  };

  const copy = () => {
    if (!copySource || !serviceId) return;
    if (!window.confirm('Replace this service’s current questions with a copy from the selected service?')) return;
    onCopy(serviceId, copySource);
  };
  const applyTemplate = () => {
    if (!templateId || !serviceId) return;
    if (!window.confirm('Apply this template and replace the service’s current questions?')) return;
    onApplyTemplate(serviceId, templateId);
  };
  const applySet = () => {
    if (!questionSetId || !serviceId) return;
    if (!window.confirm('Apply this reusable set and replace the service’s current questions?')) return;
    onApplyQuestionSet(serviceId, questionSetId);
  };
  const saveAsSet = async event => {
    event.preventDefault();
    if (!setDraft.name.trim()) return;
    const result = await onSaveAsQuestionSet({ serviceId, name: setDraft.name.trim(), description: setDraft.description.trim() });
    if (result?.success !== false) setSetDraft({ name: '', description: '' });
  };
  const conditionalSources = questions.filter(question => questionId(question) !== selectedQuestionId);
  const uploadType = ['file', 'image', 'file_upload', 'image_upload'].includes(String(selectedQuestion?.type || '').toLowerCase());

  if (!services.length) {
    return <div className="service-engine-view"><SectionHeading eyebrow="Dynamic intake" title="Question Builder" /><section className="service-engine-panel"><EmptyState title="Create a service first">Questions belong to a service. Add one in the Services module, then return here.</EmptyState></section></div>;
  }

  return (
    <div className="service-engine-view">
      <SectionHeading eyebrow="Dynamic intake" title="Question Builder" description="Build multi-step forms with validation, conditional logic, uploads and reusable question libraries." actions={<div className="service-engine-question-save"><span className={dirty ? 'is-dirty' : ''}>{dirty ? 'Unsaved changes' : 'Questions saved'}</span><button type="button" className="btn btn-primary" disabled={!canEdit || !dirty || Boolean(working)} onClick={save}>{working === 'questions-save' ? 'Saving...' : 'Save questions'}</button></div>} />
      <PermissionNote canEdit={canEdit} />
      {validationMessage && <div className="service-engine-inline-error">{validationMessage}</div>}

      <section className="service-engine-panel service-engine-question-toolbar">
        <label><span>Service</span><select className="form-select" value={serviceId} onChange={event => chooseService(event.target.value)}>{availableServices.map(item => <option key={idOf(item)} value={idOf(item)}>{item.name}</option>)}</select></label>
        <div className="service-engine-selected-service"><StatusBadge status={service?.status || 'draft'} /><span><strong>{service?.name}</strong><small>{category?.name || 'Uncategorised'} · {questions.length} questions · {maxStep} steps</small></span></div>
      </section>

      <section className="service-engine-panel service-engine-question-tools">
        <div><label><span>Start from template</span><select className="form-select" value={templateId} onChange={event => setTemplateId(event.target.value)}><option value="">Choose template...</option>{templates.map(template => <option key={idOf(template)} value={idOf(template)}>{template.name}</option>)}</select></label><button type="button" className="btn btn-secondary btn-sm" disabled={!canEdit || !templateId || Boolean(working)} onClick={applyTemplate}>Apply template</button></div>
        <div><label><span>Apply reusable set</span><select className="form-select" value={questionSetId} onChange={event => setQuestionSetId(event.target.value)}><option value="">Choose question set...</option>{questionSets.map(set => <option key={idOf(set)} value={idOf(set)}>{set.name}</option>)}</select></label><button type="button" className="btn btn-secondary btn-sm" disabled={!canEdit || !questionSetId || Boolean(working)} onClick={applySet}>Apply set</button></div>
        <div><label><span>Copy from another service</span><select className="form-select" value={copySource} onChange={event => setCopySource(event.target.value)}><option value="">Choose source...</option>{availableServices.filter(item => idOf(item) !== serviceId).map(item => <option key={idOf(item)} value={idOf(item)}>{item.name}</option>)}</select></label><button type="button" className="btn btn-secondary btn-sm" disabled={!canEdit || !copySource || Boolean(working)} onClick={copy}>Copy questions</button></div>
      </section>

      <div className="service-engine-question-layout">
        <section className="service-engine-panel service-engine-question-list-panel">
          <div className="service-engine-question-add">
            <select className="form-select" value={newType} onChange={event => setNewType(event.target.value)}>{questionTypes.map(type => <option key={type.value} value={type.value}>{type.label}</option>)}</select>
            <button type="button" className="btn btn-primary btn-sm" disabled={!canEdit} onClick={addQuestion}>Add question</button>
          </div>
          <div className="service-engine-step-summary">
            {Array.from({ length: maxStep }, (_, index) => index + 1).map(step => <span key={step}>Step {step}<b>{questions.filter(question => Number(question.step || 1) === step).length}</b></span>)}
          </div>
          <div className="service-engine-question-list">
            {questions.map((question, index) => (
              <button
                key={questionId(question)}
                type="button"
                draggable={canEdit}
                className={selectedQuestionId === questionId(question) ? 'active' : ''}
                onClick={() => setSelectedQuestionId(questionId(question))}
                onDragStart={() => setDragIndex(index)}
                onDragOver={event => event.preventDefault()}
                onDrop={() => {
                  if (dragIndex == null) return;
                  setQuestions(previous => reorder(previous, dragIndex, index));
                  setDragIndex(null);
                }}
              >
                <i>::</i><span><small>Step {question.step} · {questionTypes.find(type => type.value === question.type)?.label || titleFromKey(question.type)}</small><strong>{question.label}</strong><em>{question.required ? 'Required' : 'Optional'}{question.condition?.enabled ? ' · Conditional' : ''}</em></span><b>{index + 1}</b>
              </button>
            ))}
            {!questions.length && <EmptyState title="No questions yet">Choose a question type and add the first field.</EmptyState>}
          </div>
        </section>

        <section className="service-engine-panel service-engine-question-inspector">
          {!selectedQuestion ? <EmptyState title="Select a question">Choose a question to configure content, validation and conditional behavior.</EmptyState> : (
            <div>
              <div className="service-engine-editor-heading"><div><span>Question inspector</span><h3>{selectedQuestion.label}</h3></div><div className="service-engine-row-buttons"><button type="button" disabled={!canEdit || questions.indexOf(selectedQuestion) === 0} onClick={() => moveQuestion(-1)} aria-label="Move question up">Up</button><button type="button" disabled={!canEdit || questions.indexOf(selectedQuestion) === questions.length - 1} onClick={() => moveQuestion(1)} aria-label="Move question down">Down</button></div></div>
              <div className="service-engine-form-grid">
                <EngineField label="Question label" value={selectedQuestion.label} disabled={!canEdit} required onChange={value => updateQuestion({ label: value })} />
                <EngineField label="Stable key" value={selectedQuestion.key} disabled={!canEdit} required pattern="[a-z0-9_]+" help="Used to store answers; must be unique." onChange={value => updateQuestion({ key: slugify(value).replace(/-/g, '_') })} />
                <label className="service-engine-field"><span>Question type</span><select className="form-select" disabled={!canEdit} value={selectedQuestion.type} onChange={event => updateQuestion({ type: event.target.value })}>{questionTypes.map(type => <option key={type.value} value={type.value}>{type.label}</option>)}</select></label>
                <EngineField label="Form step" type="number" min={1} max={20} value={selectedQuestion.step} disabled={!canEdit} onChange={value => updateQuestion({ step: Math.max(1, value) })} />
                <EngineField label="Placeholder" value={selectedQuestion.placeholder} disabled={!canEdit} onChange={value => updateQuestion({ placeholder: value })} />
                <label className="service-engine-check"><input type="checkbox" checked={selectedQuestion.required} disabled={!canEdit} onChange={event => updateQuestion({ required: event.target.checked })} /><span><strong>Required answer</strong><small>Clients cannot continue without a valid value.</small></span></label>
                <div className="service-engine-form-wide"><EngineField label="Help text" value={selectedQuestion.helpText} disabled={!canEdit} multiline onChange={value => updateQuestion({ helpText: value })} /></div>
              </div>

              {['select', 'radio', 'checkbox', 'multi_select'].includes(selectedQuestion.type) && <div className="service-engine-editor-section"><h4>Choice options</h4><EngineField label="One option per line" value={optionsToText(selectedQuestion.options)} disabled={!canEdit} multiline onChange={value => updateQuestion({ options: optionsFromText(value) })} /></div>}

              <div className="service-engine-editor-section">
                <h4>Validation rules</h4>
                <div className="service-engine-form-grid">
                  <EngineField label="Minimum value" type="number" value={selectedQuestion.validation?.min ?? ''} disabled={!canEdit} onChange={value => updateNested('validation', 'min', value)} />
                  <EngineField label="Maximum value" type="number" value={selectedQuestion.validation?.max ?? ''} disabled={!canEdit} onChange={value => updateNested('validation', 'max', value)} />
                  <EngineField label="Minimum length" type="number" min={0} value={selectedQuestion.validation?.minLength ?? ''} disabled={!canEdit} onChange={value => updateNested('validation', 'minLength', value)} />
                  <EngineField label="Maximum length" type="number" min={0} value={selectedQuestion.validation?.maxLength ?? ''} disabled={!canEdit} onChange={value => updateNested('validation', 'maxLength', value)} />
                  <div className="service-engine-form-wide"><EngineField label="Validation pattern" value={selectedQuestion.validation?.pattern || ''} disabled={!canEdit} help="Optional regular-expression pattern enforced by the server." onChange={value => updateNested('validation', 'pattern', value)} /></div>
                </div>
              </div>

              <div className="service-engine-editor-section">
                <h4>Conditional display</h4>
                <label className="service-engine-check"><input type="checkbox" checked={selectedQuestion.condition?.enabled} disabled={!canEdit || !conditionalSources.length} onChange={event => updateNested('condition', 'enabled', event.target.checked)} /><span><strong>Show this question conditionally</strong><small>Evaluate an earlier or related answer before showing the field.</small></span></label>
                {selectedQuestion.condition?.enabled && <div className="service-engine-condition-grid"><label className="service-engine-field"><span>Source question</span><select className="form-select" disabled={!canEdit} value={selectedQuestion.condition?.questionId || ''} onChange={event => updateNested('condition', 'questionId', event.target.value)}><option value="">Choose question...</option>{conditionalSources.map(question => <option key={questionId(question)} value={questionId(question)}>{question.label}</option>)}</select></label><label className="service-engine-field"><span>Operator</span><select className="form-select" disabled={!canEdit} value={selectedQuestion.condition?.operator || 'equals'} onChange={event => updateNested('condition', 'operator', event.target.value)}>{['equals', 'not_equals', 'contains', 'not_contains', 'greater_than', 'less_than', 'is_empty', 'is_not_empty'].map(operator => <option key={operator} value={operator}>{titleFromKey(operator)}</option>)}</select></label><EngineField label="Comparison value" value={selectedQuestion.condition?.value ?? ''} disabled={!canEdit || ['is_empty', 'is_not_empty'].includes(selectedQuestion.condition?.operator)} onChange={value => updateNested('condition', 'value', value)} /></div>}
              </div>

              {uploadType && <div className="service-engine-editor-section"><h4>Upload settings</h4><div className="service-engine-form-grid"><EngineField label="Accepted file types" value={selectedQuestion.upload?.accept || ''} disabled={!canEdit} placeholder=".pdf,.docx,image/*" onChange={value => updateNested('upload', 'accept', value)} /><EngineField label="Maximum files" type="number" min={1} max={20} value={selectedQuestion.upload?.maxFiles || 1} disabled={!canEdit} onChange={value => updateNested('upload', 'maxFiles', value)} /><EngineField label="Maximum size (MB)" type="number" min={1} max={100} value={selectedQuestion.upload?.maxSizeMb || 10} disabled={!canEdit} onChange={value => updateNested('upload', 'maxSizeMb', value)} /><label className="service-engine-check"><input type="checkbox" checked={selectedQuestion.upload?.imageOnly} disabled={!canEdit} onChange={event => updateNested('upload', 'imageOnly', event.target.checked)} /><span><strong>Images only</strong><small>Require an image MIME type.</small></span></label></div></div>}

              <div className="service-engine-editor-footer"><div><button type="button" className="btn btn-secondary btn-sm" disabled={!canEdit} onClick={duplicateQuestion}>Duplicate</button><button type="button" className="btn btn-danger btn-sm" disabled={!canEdit} onClick={removeQuestion}>Remove</button></div><small>Drag the question card or use Up / Down to reorder.</small></div>
            </div>
          )}
        </section>
      </div>

      <section className="service-engine-panel service-engine-save-set">
        <div><span>Reusable workflow</span><h4>Save this service as a question set</h4><p>Save questions first, then capture the current server version as a reusable set.</p></div>
        <form onSubmit={saveAsSet}><input className="form-input" required value={setDraft.name} onChange={event => setSetDraft(previous => ({ ...previous, name: event.target.value }))} placeholder="Question set name" /><input className="form-input" value={setDraft.description} onChange={event => setSetDraft(previous => ({ ...previous, description: event.target.value }))} placeholder="Short description" /><button className="btn btn-secondary" disabled={!canEdit || dirty || Boolean(working)}>Save reusable set</button></form>
      </section>
    </div>
  );
}
