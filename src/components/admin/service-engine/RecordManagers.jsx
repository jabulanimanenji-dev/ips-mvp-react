import React, { useEffect, useMemo, useState } from 'react';
import {
  categoryIdOf,
  emptyCategory,
  emptyService,
  idOf,
  normalizeStatus,
  slugify
} from './serviceEngineHelpers';
import {
  EmptyState,
  EngineField,
  PermissionNote,
  RecordActions,
  SectionHeading,
  StatusBadge,
  ToggleOverrides
} from './EngineUi';

function RecordList({ title, records, selectedId, onSelect, search, setSearch, subtitle, meta }) {
  return (
    <section className="service-engine-panel service-engine-record-list-panel">
      <div className="service-engine-record-list-heading">
        <div><strong>{title}</strong><small>{subtitle}</small></div>
        <span>{records.length}</span>
      </div>
      <input className="form-input" type="search" value={search} onChange={event => setSearch(event.target.value)} placeholder={`Search ${title.toLowerCase()}...`} />
      <div className="service-engine-record-list">
        {records.map(record => {
          const id = idOf(record);
          return (
            <button key={id} type="button" className={selectedId === id ? 'active' : ''} onClick={() => onSelect(id)}>
              <span className="service-engine-record-icon">{record.icon || String(record.name || '?').slice(0, 1).toUpperCase()}</span>
              <span><strong>{record.name || 'Untitled'}</strong><small>{meta(record)}</small></span>
              <StatusBadge status={normalizeStatus(record)} />
            </button>
          );
        })}
        {!records.length && <EmptyState title={`No ${title.toLowerCase()} found`}>Try another search or create the first record.</EmptyState>}
      </div>
    </section>
  );
}

export function CategoryManager({
  categories,
  services,
  settings,
  toggleDefinitions,
  canEdit,
  canPublish,
  working,
  onCreate,
  onUpdate,
  onDelete,
  onAction,
  onOpenServices
}) {
  const [search, setSearch] = useState('');
  const [selectedId, setSelectedId] = useState(() => idOf(categories[0]));
  const [creating, setCreating] = useState(false);
  const [form, setForm] = useState(() => emptyCategory(toggleDefinitions));

  const selected = useMemo(() => categories.find(record => idOf(record) === selectedId), [categories, selectedId]);
  const filtered = useMemo(() => {
    const term = search.trim().toLowerCase();
    return categories.filter(record => !term || `${record.name} ${record.slug} ${record.description} ${record.family}`.toLowerCase().includes(term));
  }, [categories, search]);

  useEffect(() => {
    if (creating) return;
    if (selected) {
      setForm({ ...selected, toggles: { ...(selected.toggles || {}) } });
      return;
    }
    const nextId = idOf(categories[0]);
    setSelectedId(nextId);
    if (categories[0]) setForm({ ...categories[0], toggles: { ...(categories[0].toggles || {}) } });
  }, [categories, selected, creating]);

  const startCreate = () => {
    setCreating(true);
    setSelectedId('');
    setForm(emptyCategory(toggleDefinitions));
  };
  const select = id => {
    setCreating(false);
    setSelectedId(id);
  };
  const updateField = (key, value) => setForm(previous => ({
    ...previous,
    [key]: value,
    ...(key === 'name' && (!previous.slug || creating) ? { slug: slugify(value) } : {})
  }));
  const payload = {
    name: form.name,
    slug: form.slug,
    description: form.description,
    icon: form.icon,
    family: form.family,
    order: Number(form.order || 0),
    toggles: form.toggles || {}
  };
  const save = async event => {
    event.preventDefault();
    const result = creating ? await onCreate(payload) : await onUpdate(idOf(selected), payload);
    if (result?.success === false) return;
    setCreating(false);
    if (result?.record) setSelectedId(idOf(result.record));
  };
  const act = action => {
    if (['archive'].includes(action) && !window.confirm(`Archive ${form.name}? Its services will no longer be available through this category.`)) return;
    onAction(idOf(selected), action);
  };
  const remove = () => {
    if (!window.confirm(`Permanently delete the draft category “${form.name}”?`)) return;
    onDelete(idOf(selected));
  };
  const serviceCount = record => services.filter(service => categoryIdOf(service) === idOf(record)).length;

  return (
    <div className="service-engine-view">
      <SectionHeading
        eyebrow="Catalogue structure"
        title="Categories"
        description="Create discovery groups, control availability and see exactly which parent setting is effective."
        actions={<button type="button" className="btn btn-primary" disabled={!canEdit} onClick={startCreate}>New category</button>}
      />
      <PermissionNote canEdit={canEdit} />
      <div className="service-engine-record-layout">
        <RecordList
          title="Categories"
          subtitle={`${categories.length} total`}
          records={filtered}
          selectedId={selectedId}
          onSelect={select}
          search={search}
          setSearch={setSearch}
          meta={record => `${record.family === 'odd_job' ? 'Practical assistance' : 'Professional'} · ${serviceCount(record)} services`}
        />

        <section className="service-engine-panel service-engine-record-editor">
          {!creating && !selected ? (
            <EmptyState title="Select a category">Choose a category from the list or create a new one.</EmptyState>
          ) : (
            <form onSubmit={save}>
              <div className="service-engine-editor-heading">
                <div><span>{creating ? 'New record' : 'Category editor'}</span><h3>{creating ? 'Create category' : form.name}</h3></div>
                {!creating && <StatusBadge status={normalizeStatus(selected)} />}
              </div>
              <div className="service-engine-form-grid">
                <EngineField label="Category name" value={form.name} required maxLength={100} onChange={value => updateField('name', value)} />
                <EngineField label="Unique slug" value={form.slug} required maxLength={100} pattern="[a-z0-9]+(?:-[a-z0-9]+)*" help="Duplicate slugs are rejected by the Service Engine." onChange={value => updateField('slug', slugify(value))} />
                <EngineField label="Icon or short symbol" value={form.icon} maxLength={12} onChange={value => updateField('icon', value)} />
                <label className="service-engine-field"><span>Service family</span><select className="form-select" value={form.family || 'professional'} onChange={event => updateField('family', event.target.value)}><option value="professional">Professional</option><option value="odd_job">Practical assistance</option></select></label>
                <EngineField label="Sort order" type="number" min={0} max={999} value={form.order || 0} onChange={value => updateField('order', value)} />
                <div />
                <div className="service-engine-form-wide"><EngineField label="Description" value={form.description} multiline maxLength={500} onChange={value => updateField('description', value)} /></div>
              </div>

              <div className="service-engine-editor-section">
                <h4>Inherited controls</h4>
                <p>Choose Inherit to follow the platform setting without losing this category's future override.</p>
                <ToggleOverrides definitions={toggleDefinitions} record={form} parents={[settings]} disabled={!canEdit} onChange={(key, value) => setForm(previous => ({ ...previous, toggles: { ...previous.toggles, [key]: value } }))} />
              </div>

              <div className="service-engine-editor-footer">
                <div>
                  {!creating && serviceCount(selected) > 0 && <button type="button" className="btn btn-ghost btn-sm" onClick={() => onOpenServices(idOf(selected))}>View {serviceCount(selected)} services</button>}
                  <button type="submit" className="btn btn-primary" disabled={!canEdit || Boolean(working)}>{working === 'category-save' ? 'Saving...' : creating ? 'Create category' : 'Save category'}</button>
                </div>
                {!creating && (
                  <RecordActions
                    record={selected}
                    working={String(working).startsWith(`category-${selectedId}-`) ? String(working).split('-').at(-1) : ''}
                    canEdit={canEdit}
                    canPublish={canPublish}
                    onAction={act}
                    onDelete={normalizeStatus(selected) === 'draft' ? remove : undefined}
                  />
                )}
              </div>
            </form>
          )}
        </section>
      </div>
    </div>
  );
}

export function ServiceManager({
  categories,
  services,
  settings,
  toggleDefinitions,
  initialCategoryId,
  canEdit,
  canPublish,
  working,
  onCreate,
  onUpdate,
  onDelete,
  onAction,
  onOpenQuestions
}) {
  const [search, setSearch] = useState('');
  const [categoryFilter, setCategoryFilter] = useState(initialCategoryId || 'all');
  const [selectedId, setSelectedId] = useState(() => idOf(services[0]));
  const [creating, setCreating] = useState(false);
  const [form, setForm] = useState(() => emptyService(toggleDefinitions, idOf(categories[0])));

  useEffect(() => {
    if (initialCategoryId) setCategoryFilter(initialCategoryId);
  }, [initialCategoryId]);

  const selected = useMemo(() => services.find(record => idOf(record) === selectedId), [services, selectedId]);
  const filtered = useMemo(() => {
    const term = search.trim().toLowerCase();
    return services.filter(record => {
      const matchesCategory = categoryFilter === 'all' || categoryIdOf(record) === categoryFilter;
      const matchesText = !term || `${record.name} ${record.slug} ${record.description}`.toLowerCase().includes(term);
      return matchesCategory && matchesText;
    });
  }, [services, search, categoryFilter]);

  useEffect(() => {
    if (creating) return;
    if (selected && filtered.some(record => idOf(record) === selectedId)) {
      setForm({ ...selected, categoryId: categoryIdOf(selected), toggles: { ...(selected.toggles || {}) } });
      return;
    }
    const next = filtered[0] || services[0];
    setSelectedId(idOf(next));
    if (next) setForm({ ...next, categoryId: categoryIdOf(next), toggles: { ...(next.toggles || {}) } });
  }, [services, selected, creating, filtered]);

  const categoryFor = service => categories.find(category => idOf(category) === categoryIdOf(service));
  const startCreate = () => {
    setCreating(true);
    setSelectedId('');
    const defaultCategoryId = categoryFilter !== 'all' ? categoryFilter : idOf(categories.find(category => normalizeStatus(category) !== 'archived') || categories[0]);
    setForm(emptyService(toggleDefinitions, defaultCategoryId));
  };
  const select = id => {
    setCreating(false);
    setSelectedId(id);
  };
  const updateField = (key, value) => setForm(previous => ({
    ...previous,
    [key]: value,
    ...(key === 'name' && (!previous.slug || creating) ? { slug: slugify(value) } : {})
  }));
  const payload = {
    categoryId: form.categoryId,
    name: form.name,
    slug: form.slug,
    description: form.description,
    order: Number(form.order || 0),
    featured: Boolean(form.featured),
    toggles: form.toggles || {}
  };
  const save = async event => {
    event.preventDefault();
    const result = creating ? await onCreate(payload) : await onUpdate(idOf(selected), payload);
    if (result?.success === false) return;
    setCreating(false);
    if (result?.record) setSelectedId(idOf(result.record));
  };
  const act = action => {
    if (action === 'archive' && !window.confirm(`Archive ${form.name}? Existing requests remain available, but new requests will stop.`)) return;
    onAction(idOf(selected), action);
  };
  const remove = () => {
    if (!window.confirm(`Permanently delete the draft service “${form.name}”?`)) return;
    onDelete(idOf(selected));
  };
  const parentCategory = categories.find(category => idOf(category) === form.categoryId);

  return (
    <div className="service-engine-view">
      <SectionHeading
        eyebrow="Service catalogue"
        title="Services"
        description="Manage the client-facing definition separately from live service-request operations."
        actions={<button type="button" className="btn btn-primary" disabled={!canEdit || !categories.length} onClick={startCreate}>New service</button>}
      />
      <PermissionNote canEdit={canEdit} />
      {!categories.length ? (
        <section className="service-engine-panel"><EmptyState title="Create a category first">Every service needs a category before it can be saved.</EmptyState></section>
      ) : (
        <div className="service-engine-record-layout">
          <section className="service-engine-panel service-engine-record-list-panel">
            <div className="service-engine-record-list-heading"><div><strong>Services</strong><small>{services.length} total</small></div><span>{filtered.length}</span></div>
            <input className="form-input" type="search" value={search} onChange={event => setSearch(event.target.value)} placeholder="Search services..." />
            <select className="form-select" value={categoryFilter} onChange={event => setCategoryFilter(event.target.value)}><option value="all">All categories</option>{categories.map(category => <option key={idOf(category)} value={idOf(category)}>{category.name}</option>)}</select>
            <div className="service-engine-record-list">
              {filtered.map(record => {
                const id = idOf(record);
                return <button key={id} type="button" className={selectedId === id ? 'active' : ''} onClick={() => select(id)}><span className="service-engine-record-icon">{String(record.name || '?').slice(0, 1).toUpperCase()}</span><span><strong>{record.name}</strong><small>{categoryFor(record)?.name || 'Uncategorised'} · {(record.questions || []).length} questions</small></span><StatusBadge status={normalizeStatus(record)} /></button>;
              })}
              {!filtered.length && <EmptyState title="No services found">Try another filter or create a service.</EmptyState>}
            </div>
          </section>

          <section className="service-engine-panel service-engine-record-editor">
            {!creating && !selected ? <EmptyState title="Select a service">Choose a service from the list or create a new one.</EmptyState> : (
              <form onSubmit={save}>
                <div className="service-engine-editor-heading"><div><span>{creating ? 'New record' : 'Service editor'}</span><h3>{creating ? 'Create service' : form.name}</h3></div>{!creating && <StatusBadge status={normalizeStatus(selected)} />}</div>
                <div className="service-engine-form-grid">
                  <EngineField label="Service name" value={form.name} required maxLength={120} onChange={value => updateField('name', value)} />
                  <EngineField label="Unique slug" value={form.slug} required maxLength={100} pattern="[a-z0-9]+(?:-[a-z0-9]+)*" help="Duplicate slugs are rejected by the Service Engine." onChange={value => updateField('slug', slugify(value))} />
                  <label className="service-engine-field"><span>Category</span><select className="form-select" required value={form.categoryId || ''} onChange={event => updateField('categoryId', event.target.value)}>{categories.filter(category => normalizeStatus(category) !== 'archived').map(category => <option key={idOf(category)} value={idOf(category)}>{category.name}</option>)}</select></label>
                  <EngineField label="Sort order" type="number" min={0} max={999} value={form.order || 0} onChange={value => updateField('order', value)} />
                  <label className="service-engine-check service-engine-form-wide"><input type="checkbox" checked={Boolean(form.featured)} onChange={event => updateField('featured', event.target.checked)} /><span><strong>Featured service</strong><small>Prioritize this service in discovery and catalogue displays.</small></span></label>
                  <div className="service-engine-form-wide"><EngineField label="Description" value={form.description} multiline maxLength={800} onChange={value => updateField('description', value)} /></div>
                </div>

                <div className="service-engine-editor-section"><h4>Inherited controls</h4><p>Effective values combine platform, category and service choices.</p><ToggleOverrides definitions={toggleDefinitions} record={form} parents={[settings, parentCategory]} disabled={!canEdit} onChange={(key, value) => setForm(previous => ({ ...previous, toggles: { ...previous.toggles, [key]: value } }))} /></div>

                <div className="service-engine-editor-footer">
                  <div>
                    {!creating && <button type="button" className="btn btn-ghost btn-sm" onClick={() => onOpenQuestions(idOf(selected))}>Edit {(selected.questions || []).length} questions</button>}
                    <button type="submit" className="btn btn-primary" disabled={!canEdit || Boolean(working)}>{working === 'service-save' ? 'Saving...' : creating ? 'Create service' : 'Save service'}</button>
                  </div>
                  {!creating && <RecordActions record={selected} working={String(working).startsWith(`service-${selectedId}-`) ? String(working).split('-').at(-1) : ''} canEdit={canEdit} canPublish={canPublish} onAction={act} onDelete={normalizeStatus(selected) === 'draft' ? remove : undefined} />}
                </div>
              </form>
            )}
          </section>
        </div>
      )}
    </div>
  );
}
