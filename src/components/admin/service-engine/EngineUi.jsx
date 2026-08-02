import React from 'react';
import {
  normalizeStatus,
  normalizeToggleValue,
  STATUS_ACTIONS,
  statusLabel,
  toggleEffectiveValue,
  toggleSource
} from './serviceEngineHelpers';

export function EngineField({ label, value, onChange, help, multiline = false, type = 'text', ...inputProps }) {
  const Element = multiline ? 'textarea' : 'input';
  return (
    <label className="service-engine-field">
      <span>{label}</span>
      <Element
        className={multiline ? 'form-textarea' : 'form-input'}
        type={multiline ? undefined : type}
        value={value ?? ''}
        onChange={event => onChange(type === 'number'
          ? (event.target.value === '' ? '' : Number(event.target.value))
          : event.target.value)}
        {...inputProps}
      />
      {help && <small>{help}</small>}
    </label>
  );
}

export function StatusBadge({ status }) {
  const normalized = String(status || 'draft').toLowerCase();
  return <span className={`service-engine-status status-${normalized}`}>{statusLabel(normalized)}</span>;
}

export function EmptyState({ title, children, action }) {
  return (
    <div className="service-engine-empty">
      <div className="service-engine-empty-mark">+</div>
      <strong>{title}</strong>
      {children && <p>{children}</p>}
      {action}
    </div>
  );
}

export function LoadingBlock({ label = 'Loading Service Engine...' }) {
  return <div className="service-engine-loading"><span />{label}</div>;
}

export function PermissionNote({ canEdit }) {
  if (canEdit) return null;
  return <div className="service-engine-permission-note">You have read-only access. Editing controls are unavailable for this administrator role.</div>;
}

export function RecordActions({ record, working, canEdit, canPublish, onAction, onDelete }) {
  const status = normalizeStatus(record);
  const actions = STATUS_ACTIONS[status] || ['publish', 'archive'];
  return (
    <div className="service-engine-record-actions">
      {actions.map(action => {
        const allowed = action !== 'publish' ? canEdit : canPublish;
        return (
          <button
            key={action}
            type="button"
            className={`btn btn-sm ${action === 'publish' || action === 'restore' ? 'btn-success' : action === 'archive' ? 'btn-danger' : 'btn-secondary'}`}
            disabled={!allowed || Boolean(working)}
            onClick={() => onAction(action)}
          >
            {working === action ? `${statusLabel(action)}...` : statusLabel(action)}
          </button>
        );
      })}
      {onDelete && (
        <button type="button" className="btn btn-danger btn-sm" disabled={!canEdit || Boolean(working)} onClick={onDelete}>
          {working === 'delete' ? 'Deleting...' : 'Delete draft'}
        </button>
      )}
    </div>
  );
}

export function ToggleOverrides({ definitions, record, parents = [], onChange, disabled = false }) {
  const toggles = record?.toggles || {};
  return (
    <div className="service-engine-toggle-list">
      {definitions.map(definition => {
        const raw = normalizeToggleValue(toggles[definition.key]);
        const effective = toggleEffectiveValue(record, definition, parents);
        const source = toggleSource(record, definition, raw === null ? 'Inherited' : 'This level');
        return (
          <div className="service-engine-toggle-row" key={definition.key}>
            <div>
              <strong>{definition.label}</strong>
              <small>{definition.description || 'Control availability at this level.'}</small>
            </div>
            <label>
              <span>Override</span>
              <select
                className="form-select"
                value={raw === null ? 'inherit' : raw ? 'enabled' : 'disabled'}
                disabled={disabled}
                onChange={event => onChange(definition.key, normalizeToggleValue(event.target.value))}
              >
                <option value="inherit">Inherit</option>
                <option value="enabled">Enabled</option>
                <option value="disabled">Disabled</option>
              </select>
            </label>
            <div className={`service-engine-effective ${effective ? 'is-on' : 'is-off'}`}>
              <span>{effective ? 'Effective: on' : 'Effective: off'}</span>
              <small>Source: {source}</small>
            </div>
          </div>
        );
      })}
    </div>
  );
}

export function SectionHeading({ eyebrow, title, description, actions }) {
  return (
    <div className="service-engine-section-heading">
      <div>
        {eyebrow && <span>{eyebrow}</span>}
        <h3>{title}</h3>
        {description && <p>{description}</p>}
      </div>
      {actions && <div className="service-engine-heading-actions">{actions}</div>}
    </div>
  );
}
