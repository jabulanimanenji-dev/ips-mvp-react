import React from 'react';
import { displayDate, normalizeStatus } from './serviceEngineHelpers';
import { EmptyState, SectionHeading, StatusBadge } from './EngineUi';

const countByStatus = (records, status) => records.filter(record => normalizeStatus(record) === status).length;

export default function DashboardView({ engine, onNavigate }) {
  const { dashboard = {}, categories = [], services = [], templates = [], questionSets = [], settings = {} } = engine;
  const counts = [
    ['Categories', dashboard.categories ?? dashboard.totalCategories ?? categories.length, `${countByStatus(categories, 'published')} published`, 'categories'],
    ['Services', dashboard.services ?? dashboard.totalServices ?? services.length, `${countByStatus(services, 'published')} published`, 'services'],
    ['Templates', dashboard.templates ?? dashboard.totalTemplates ?? templates.length, 'Starter and custom', 'templates'],
    ['Reusable sets', dashboard.questionSets ?? dashboard.totalQuestionSets ?? questionSets.length, 'Question libraries', 'questions'],
    ['Draft items', dashboard.drafts ?? countByStatus(categories, 'draft') + countByStatus(services, 'draft'), 'Awaiting publication', 'services'],
    ['Paused items', dashboard.paused ?? countByStatus(categories, 'paused') + countByStatus(services, 'paused'), 'Temporarily unavailable', 'categories']
  ];
  const activity = dashboard.recentActivity || dashboard.recent_activity || [];

  return (
    <div className="service-engine-view">
      <section className="service-engine-hero-panel">
        <div>
          <span>Universal catalogue control</span>
          <h3>One engine for every IPS service</h3>
          <p>Build categories, publish services and design the exact intake journey without changing application code.</p>
          <div className="service-engine-health-row">
            <b className={settings.enabled === false ? 'is-off' : 'is-on'}>{settings.enabled === false ? 'Platform paused' : 'Platform enabled'}</b>
            <small>Inherited controls remain intact when a parent is paused.</small>
          </div>
        </div>
        <div className="service-engine-hero-actions">
          <button type="button" className="btn btn-primary" onClick={() => onNavigate('services')}>Create a service</button>
          <button type="button" className="btn btn-ghost" onClick={() => onNavigate('questions')}>Build questions</button>
        </div>
      </section>

      <div className="service-engine-kpis">
        {counts.map(([label, value, note, target]) => (
          <button key={label} type="button" onClick={() => onNavigate(target)}>
            <small>{label}</small>
            <strong>{value}</strong>
            <span>{note}</span>
          </button>
        ))}
      </div>

      <div className="service-engine-dashboard-grid">
        <section className="service-engine-panel">
          <SectionHeading eyebrow="Workflow" title="Catalogue readiness" description="Items move safely through draft, published, paused and archived states." />
          <div className="service-engine-lifecycle">
            {['draft', 'published', 'paused', 'archived'].map(status => (
              <div key={status}>
                <StatusBadge status={status} />
                <strong>{countByStatus(categories, status) + countByStatus(services, status)}</strong>
                <small>categories and services</small>
              </div>
            ))}
          </div>
        </section>

        <section className="service-engine-panel">
          <SectionHeading eyebrow="Shortcuts" title="Continue building" />
          <div className="service-engine-shortcuts">
            {[
              ['Categories', 'Organize the service catalogue.', 'categories'],
              ['Templates', 'Start from six proven service patterns.', 'templates'],
              ['Settings', 'Control platform-wide availability.', 'settings'],
              ['Audit', 'Review recent catalogue changes.', 'audit']
            ].map(([label, description, target]) => (
              <button type="button" key={target} onClick={() => onNavigate(target)}>
                <strong>{label}</strong><span>{description}</span><b>Open</b>
              </button>
            ))}
          </div>
        </section>

        <section className="service-engine-panel service-engine-dashboard-wide">
          <SectionHeading eyebrow="Activity" title="Recent changes" actions={<button type="button" className="btn btn-ghost btn-sm" onClick={() => onNavigate('audit')}>Full audit</button>} />
          {!activity.length ? (
            <EmptyState title="No recent activity">Changes will appear here after the first catalogue update.</EmptyState>
          ) : (
            <div className="service-engine-activity-list">
              {activity.slice(0, 8).map((entry, index) => (
                <div key={entry.id || entry._id || index}>
                  <span />
                  <div><strong>{entry.action || entry.title || 'Catalogue updated'}</strong><small>{entry.actor_name || entry.actor || 'Administrator'} · {displayDate(entry.createdAt || entry.created_at || entry.timestamp)}</small></div>
                  {entry.status && <StatusBadge status={entry.status} />}
                </div>
              ))}
            </div>
          )}
        </section>
      </div>
    </div>
  );
}
