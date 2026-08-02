import React, { useEffect, useState } from 'react';
import { SectionHeading } from './EngineUi';

export default function SettingsView({ settings, toggleDefinitions, canEdit, working, onSave }) {
  const [draft, setDraft] = useState({ enabled: true, toggles: {} });

  useEffect(() => {
    setDraft({
      ...(settings || {}),
      enabled: settings?.enabled !== false,
      toggles: { ...(settings?.toggles || {}) }
    });
  }, [settings]);

  const updateToggle = (key, checked) => setDraft(previous => ({
    ...previous,
    toggles: { ...previous.toggles, [key]: checked }
  }));

  return (
    <div className="service-engine-view">
      <section className="service-engine-panel">
        <SectionHeading
          eyebrow="Global controls"
          title="Service Engine settings"
          description="These values are the root of the inheritance chain. Category and service overrides remain saved when the platform is paused."
          actions={<button type="button" className="btn btn-primary" disabled={!canEdit || Boolean(working)} onClick={() => onSave(draft)}>{working ? 'Saving...' : 'Save settings'}</button>}
        />

        <label className={`service-engine-master-switch ${draft.enabled ? 'is-on' : 'is-off'}`}>
          <div>
            <span>Universal Service Engine</span>
            <strong>{draft.enabled ? 'Enabled across IPS' : 'Paused across IPS'}</strong>
            <small>When paused, no catalogue service is effectively available, but all category and service choices are preserved.</small>
          </div>
          <input type="checkbox" checked={draft.enabled} disabled={!canEdit} onChange={event => setDraft(previous => ({ ...previous, enabled: event.target.checked }))} />
        </label>

        <div className="service-engine-settings-grid">
          {toggleDefinitions.map(definition => {
            const enabled = draft.toggles?.[definition.key] !== false;
            return (
              <label className="service-engine-global-toggle" key={definition.key}>
                <div>
                  <strong>{definition.label}</strong>
                  <small>{definition.description || 'Global default inherited by every category and service.'}</small>
                </div>
                <input type="checkbox" checked={enabled} disabled={!canEdit} onChange={event => updateToggle(definition.key, event.target.checked)} />
                <span>{enabled ? 'Default on' : 'Default off'}</span>
              </label>
            );
          })}
        </div>
      </section>

      <section className="service-engine-panel service-engine-inheritance-guide">
        <SectionHeading eyebrow="Inheritance" title="How effective controls are resolved" />
        <div>
          <article><b>1</b><strong>Platform</strong><span>Sets the global default.</span></article>
          <i />
          <article><b>2</b><strong>Category</strong><span>Inherits or overrides the platform.</span></article>
          <i />
          <article><b>3</b><strong>Service</strong><span>Inherits or overrides its category.</span></article>
        </div>
      </section>
    </div>
  );
}
