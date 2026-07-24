import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { fmtCur, fmtDate, daysUntil } from '../../utils/formatters';
import { ORDER_STATUSES, BADGE_STYLES, SERVICE_TYPES } from '../../utils/constants';

export default function AdminOrders() {
  const [orders, setOrders] = useState([]);
  const [writers, setWriters] = useState([]);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('All');
  const [serviceFilter, setServiceFilter] = useState('All');

  useEffect(() => {
    const loadData = async () => {
      try {
        const [ordersResponse, writersResponse] = await Promise.all([
          fetch('/api/orders'),
          fetch('/api/writers')
        ]);
        const ordersData = await ordersResponse.json();
        const writersData = await writersResponse.json();
        if (!ordersResponse.ok) throw new Error(ordersData.error || 'Failed to load orders');
        if (!writersResponse.ok) throw new Error(writersData.error || 'Failed to load writers');
        setOrders(ordersData.orders || []);
        setWriters(writersData.writers || []);
      } catch (error) {
        console.error('Admin data load failed:', error);
      }
    };
    loadData();
  }, []);

  const assignWriter = async (orderId, writerId) => {
    const writer = writers.find(w => w.writer_id === writerId);
    const response = await fetch(`/api/orders/${orderId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        writer_id: writerId,
        writer_name: writer ? writer.full_name : ''
      })
    });
    const data = await response.json();
    if (response.ok) {
      setOrders(current => current.map(order => order.order_id === orderId ? data.order : order));
    }
  };

  const updateStatus = async (orderId, newStatus) => {
    const response = await fetch(`/api/orders/${orderId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: newStatus })
    });
    const data = await response.json();
    if (response.ok) {
      setOrders(current => current.map(order => order.order_id === orderId ? data.order : order));
    }
  };

  const deleteOrder = async (orderId) => {
    if (!window.confirm(`Delete order ${orderId}? This cannot be undone.`)) return;
    const response = await fetch(`/api/orders/${orderId}`, { method: 'DELETE' });
    if (response.ok) {
      setOrders(current => current.filter(order => order.order_id !== orderId));
    }
  };

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
              <th>Status</th>
              <th>Deadline</th>
              <th>Fee</th>
              <th>Actions</th>
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
                <td style={{ maxWidth: 180, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                  {o.topic_title}
                </td>
                <td>
                  <select
                    className="form-select"
                    value={o.writer_id || ''}
                    onChange={(e) => assignWriter(o.order_id, e.target.value)}
                    style={{ minWidth: 140, fontSize: '0.8rem' }}
                  >
                    <option value="">— Unassigned —</option>
                    {writers.filter(w => w.status === 'Active').map(w => (
                      <option key={w.writer_id} value={w.writer_id}>
                        {w.full_name} ({w.primary_expertise})
                      </option>
                    ))}
                  </select>
                </td>
                <td>
                  <select
                    className="form-select"
                    value={o.status}
                    onChange={(e) => updateStatus(o.order_id, e.target.value)}
                    style={{ minWidth: 120, fontSize: '0.8rem' }}
                  >
                    {ORDER_STATUSES.map(s => (
                      <option key={s} value={s}>{s}</option>
                    ))}
                  </select>
                </td>
                <td>
                  {fmtDate(o.deadline)}
                  {daysUntil(o.deadline) <= 3 && daysUntil(o.deadline) >= 0 && o.status !== 'Completed' && o.status !== 'Cancelled' && (
                    <span className="badge badge-overdue" style={{ marginLeft: 6, fontSize: '0.65rem' }}>URGENT</span>
                  )}
                </td>
                <td>{fmtCur(o.total_fee_usd)}</td>
                <td>
                  <div className="flex gap-1">
                    <Link to={`/admin/orders/${o.order_id}`} className="btn btn-sm btn-secondary">Manage</Link>
                    <button className="btn btn-sm btn-danger" onClick={() => deleteOrder(o.order_id)}>Delete</button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
