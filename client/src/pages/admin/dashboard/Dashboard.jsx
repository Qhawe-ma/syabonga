import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import AdminLayout from '../AdminLayout.jsx';
import { money, useShop } from '../../../shop.jsx';

export default function Dashboard() {
  const { api } = useShop();
  const [data, setData] = useState(null);
  const [error, setError] = useState('');

  useEffect(() => {
    api('/api/admin/summary').then(setData).catch((err) => setError(err.message));
  }, [api]);

  return (
    <AdminLayout>
      <h1>Today</h1>
      {error ? <p className="err">{error}</p> : null}
      {data ? (
        <>
          <div className="stats">
            <div className="stat"><b>{data.open}</b> still to sort</div>
            <div className="stat"><b>{data.today}</b> orders today</div>
          </div>
          <table>
            <thead><tr><th>Order</th><th>Customer</th><th>Status</th><th>Total</th></tr></thead>
            <tbody>
              {data.orders.map((order) => (
                <tr key={order.number}>
                  <td><Link to={'/admin/orders'}>{order.number}</Link></td>
                  <td>{order.name}<div className="meta">{order.cell}</div></td>
                  <td><span className="tag">{order.status}</span></td>
                  <td>{money(order.total)}</td>
                </tr>
              ))}
            </tbody>
          </table>
          {data.low.length ? <p className="notice">Low stock: {data.low.map((p) => p.name + ' (' + p.stock + ')').join(', ')}</p> : null}
        </>
      ) : <p className="empty">Loading the shop…</p>}
    </AdminLayout>
  );
}
