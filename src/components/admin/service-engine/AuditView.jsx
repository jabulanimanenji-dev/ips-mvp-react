import React, { useMemo, useState } from 'react';
import { displayDate, titleFromKey } from './serviceEngineHelpers';
import { EmptyState, LoadingBlock, SectionHeading } from './EngineUi';

const stringifyDetails = entry => {
  const details = entry.details || entry.metadata || entry.changes;
  if (!details) return entry.description || '';
  if (typeof details === 'string') return details;
  return Object.entries(details).slice(0, 5).map(([key, value]) => `${titleFromKey(key)}: ${typeof value === 'object' ? JSON.stringify(value) : value}`).join(' · ');
};

export default function AuditView({ entries, loading, onRefresh }) {
  const [query, setQuery] = useState('');
  const [actionFilter, setActionFilter] = useState('all');
  const actions = useMemo(() => [...new Set(entries.map(entry => entry.action).filter(Boolean))].sort(), [entries]);
  const filtered = useMemo(() => {
    const term = query.trim().toLowerCase();
    return entries.filter(entry => {
      const matchesAction = actionFilter === 'all' || entry.action === actionFilter;
      const matchesText = !term || `${entry.action} ${entry.entityType || entry.entity_type} ${entry.entityName || entry.entity_name} ${entry.actor_name || entry.actor} ${stringifyDetails(entry)}`.toLowerCase().includes(term);
      return matchesAction && matchesText;
    });
  }, [entries, query, actionFilter]);

  return (
    <div className="service-engine-view">
      <SectionHeading eyebrow="Governance" title="Service Engine audit" description="Review catalogue changes, lifecycle actions and reusable-template updates." actions={<button type="button" className="btn btn-secondary" disabled={loading} onClick={onRefresh}>{loading ? 'Refreshing...' : 'Refresh audit'}</button>} />
      <section className="service-engine-panel">
        <div className="service-engine-audit-filters"><input className="form-input" type="search" placeholder="Search actor, record or change..." value={query} onChange={event => setQuery(event.target.value)} /><select className="form-select" value={actionFilter} onChange={event => setActionFilter(event.target.value)}><option value="all">All actions</option>{actions.map(action => <option key={action} value={action}>{titleFromKey(action)}</option>)}</select><span>{filtered.length} events</span></div>
        {loading ? <LoadingBlock label="Loading audit history..." /> : !filtered.length ? <EmptyState title="No audit events found">Service Engine changes will appear here with actor and timestamp details.</EmptyState> : (
          <div className="service-engine-table-wrap">
            <table className="data-table service-engine-audit-table">
              <thead><tr><th>Action</th><th>Record</th><th>Actor</th><th>Details</th><th>When</th></tr></thead>
              <tbody>{filtered.map((entry, index) => <tr key={entry.id || entry._id || index}><td><strong>{titleFromKey(entry.action || 'updated')}</strong></td><td>{entry.entityName || entry.entity_name || entry.entityId || entry.entity_id || entry.order_id || 'Service Engine'}<small>{titleFromKey(entry.entityType || entry.entity_type || '')}</small></td><td>{entry.actor_name || entry.actorName || entry.actor || entry.actor_id || 'System'}<small>{entry.actor_role || entry.actorRole || ''}</small></td><td>{stringifyDetails(entry) || 'No additional details'}</td><td>{displayDate(entry.createdAt || entry.created_at || entry.timestamp)}</td></tr>)}</tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}
