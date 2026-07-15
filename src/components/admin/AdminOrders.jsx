import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { fmtCur, fmtDate, daysUntil } from '../../utils/formatters';
import { ORDER_STATUSES, BADGE_STYLES, SERVICE_TYPES } from '../../utils/constants';

export default function AdminOrders() {
  const [orders, setOrders] = useState([]);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('All');
  const [serviceFilter, setServiceFilter] = useState('All');

  useEffect(() => {
    const raw = JSON.parse(localStorage.getItem('ips-orders') || '[]');
    setOrders(raw);
  }, []);

  const filtered = orders.filter((o) => {
    const matchesSearch =
      search === '' ||
      String(o.order_id).includes(search) ||
      (o.client_name && o.client_name.toLowerCase().includes(search.toLowerCase())) ||
      (o.topic_title && o.topic_title.toLowerCase().includes(search.toLowerCase()));
    const matchesStatus = statusFilter === 'All' || o.status === statusFilter;
    const matchesService = serviceFilter === 'All' || o.service_type === serviceFilter;
    return matchesSearch && matchesStatus && matchesService;
  });

  return (
    <div>
      <div className="flex justify-between items-center" style={{ marginBottom: '1.5rem', flexWrap: 'wrap', gap: '1rem' }}>
        <h2 style={{ fontSize: '1.4rem', fontWeight: 700 }}>Orders</h2>
        <div className="flex gap-2" style={{ flexWrap: 'wrap' }}>
          <input
            type="text"
            className="form-input"
            placeholder="Search orders..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            style={{ minWidth: 220 }}
          />
          <select
            className="form-select"
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            style={{ minWidth: 140 }}
          >
            <option value="All">All Statuses</option>
            {ORDER_STATUSES.map((s) => (
              <option key={s} value={s}>{s}</option>
            ))}
          </select>
          <select
            className="form-select"
            value={serviceFilter}
            onChange={(e) => setServiceFilter(e.target.value)}
            style={{ minWidth: 140 }}
          >
            <option value="All">All Services</option>
            {SERVICE_TYPES.map((s) => (
              <option key={s} value={s}>{s}</option>
            ))}
          </select>
        </div>
      </div>

      <div className="card" style={{ overflowX: 'auto' }}>
        <table className="data-table">
          <thead>
            <tr>
              <th>ID</th>
              <th>Client</th>
              <th>Service</th>
              <th>Topic</th>
              <th>Writer</th>
              <th>Deadline</th>
              <th>Fee</th>
              <th>Status</th>
              <th>Action</th>
            </tr>
          </thead>
          <tbody>
            {filtered.length === 0 && (
              <tr>
                <td colSpan={9} style={{ textAlign: 'center', color: 'var(--text-muted)', padding: '2rem' }}>
                  No orders found.
                </td>
              </tr>
            )}
            {filtered.map((o) => (
              <tr key={o.order_id}>
                <td>
                  <Link to={`/admin/orders/${o.order_id}`} style={{ color: 'var(--text-link)', fontWeight: 700 }}>
                    #{o.order_id}
                  </Link>
                </td>
                <td>{o.client_name}</td>
                <td>{o.service_type}</td>
                <td style={{ maxWidth: 220, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                  {o.topic_title}
                </td>
                <td>{o.writer_name || <span style={{ color: 'var(--text-muted)' }}>—</span>}</td>
                <td>
                  {fmtDate(o.deadline)}
                  {daysUntil(o.deadline) <= 3 && daysUntil(o.deadline) >= 0 && o.status !== 'Completed' && o.status !== 'Cancelled' && (
                    <span className="badge badge-overdue" style={{ marginLeft: 6, fontSize: '0.65rem' }}>URGENT</span>
                  )}
                </td>
                <td>{fmtCur(o.total_fee_usd)}</td>
                <td>
                  <span className={`badge ${BADGE_STYLES[o.status] || 'badge-new'}`}>{o.status}</span>
                </td>
                <td>
                  <Link to={`/admin/orders/${o.order_id}`} className="btn btn-sm btn-secondary">
                    Manage
                  </Link>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
