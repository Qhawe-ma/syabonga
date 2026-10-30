import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import AdminLayout from '../AdminLayout.jsx';
import { money, statusLabel, useShop } from '../../../shop.jsx';

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
            <div className="stat"><span>Still to sort</span><b>{data.open}</b></div>
            <div className="stat"><span>Orders today</span><b>{data.today}</b></div>
          </div>
          <div className="table-wrap">
            <table>
              <thead><tr><th>Order</th><th>Customer</th><th>Status</th><th>Total</th></tr></thead>
              <tbody>
                {data.orders.map((order) => (
                  <tr key={order.number}>
                    <td><Link to={'/admin/orders'}>{order.number}</Link></td>
                    <td>{order.name}<div className="meta">{order.cell}</div></td>
                    <td><span className="tag">{statusLabel(order.status)}</span></td>
                    <td className="num">{money(order.total)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {data.low.length ? (
            <div className="notice">
              <b>Low stock</b>
              <ul className="lowlist">{data.low.map((p) => <li key={p.id}>{p.name} · {p.stock} left</li>)}</ul>
            </div>
          ) : null}
        </>
      ) : <p className="empty">Loading the shop…</p>}
    </AdminLayout>
  );
}
