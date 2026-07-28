import React from 'react';
import { useCMS } from '../../context/CMSContext';

export default function DashboardZone({ portal, id, children, className = '', style = {} }) {
  const { config } = useCMS();
  const widget = (config.dashboardWidgets?.[portal] || []).find(item => item.id === id);
  if (widget?.visible === false) return null;
  const width = widget?.width || 'full';
  const gridColumn = width === 'full' ? '1 / -1' : width === 'wide' ? 'span 2' : 'span 1';
  return (
    <div
      className={`dashboard-zone dashboard-zone-${portal}-${id} ${className}`.trim()}
      style={{ order: widget?.order ?? 0, gridColumn, minWidth: 0, ...style }}
    >
      {children}
    </div>
  );
}
