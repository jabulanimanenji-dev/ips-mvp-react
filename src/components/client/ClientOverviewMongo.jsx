import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';

export default function ClientOverviewMongo() {
  const { user } = useAuth();
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user?.client_id) return setLoading(false);
    fetch(`/api/orders/client/${user.client_id}`)
      .then(response => response.json())
      .then(data => setOrders(data.orders || []))
      .finally(() => setLoading(false));
  }, [user]);

  const active = orders.filter(order => !['Completed', 'Cancelled'].includes(order.status));
  const completed = orders.filter(order => order.status === 'Completed');

  return (
    <div>
      <h1 className="section-title">Welcome, {user?.full_name || 'Client'}</h1>
      <div className="grid grid-3 gap-4" style={{ margin: '1.5rem 0' }}>
        <div className="card"><strong>{orders.length}</strong><div>Total Orders</div></div>
        <div className="card"><strong>{active.length}</strong><div>Active Orders</div></div>
        <div className="card"><strong>{completed.length}</strong><div>Completed</div></div>
      </div>
      <div className="card">
        <div className="flex justify-between items-center"><h3>Recent Orders</h3><Link className="btn btn-primary btn-sm" to="/client/order">New Order</Link></div>
        {loading && <p>Loading…</p>}
        {!loading && !orders.length && <p style={{ color: 'var(--text-muted)' }}>No orders yet.</p>}
        {orders.slice(0, 5).map(order => (
          <Link key={order._id} to={`/client/orders/${order._id}`} style={{ display: 'flex', justifyContent: 'space-between', padding: '0.8rem 0', borderBottom: '1px solid var(--border)', textDecoration: 'none', color: 'inherit' }}>
            <span><strong>{order.topic_title}</strong><br /><small>{order.order_id} · {order.service_type}</small></span>
            <span>{order.status} · {order.progress || 0}%</span>
          </Link>
        ))}
      </div>
    </div>
  );
}
