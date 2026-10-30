import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import AdminLayout from '../AdminLayout.jsx';
import { money, statusLabel, useShop } from '../../../shop.jsx';

export default function Dashboard() {
  const { api } = useShop();
  const [data, setData] = useState(null);
  const [error, setError] = useState('');

  function load() {
    api('/api/admin/summary').then(setData).catch((err) => setError(err.message));
  }

  useEffect(() => { load(); }, [api]);

  async function markRead() {
    await api('/api/admin/notifications/read', { method: 'POST', body: {} });
    load();
  }

  return (
    <AdminLayout>
      <h1>Today</h1>
      {error ? <p className="err">{error}</p> : null}
      {data ? (
        <>
          <div className="stats">
            <div className="stat"><span>Still to sort</span><b>{data.open}</b></div>
            <div className="stat"><span>Orders today</span><b>{data.today}</b></div>
            <div className="stat"><span>Revenue today</span><b>{money(data.revenue)}</b></div>
            <div className="stat"><span>New alerts</span><b>{data.unread}</b></div>
          </div>
          {data.notes?.length ? (
            <div className="sheet flat editor">
              <h2>New orders</h2>
              {data.notes.map((note) => <p key={note.id}>{note.body}</p>)}
              {data.unread ? <button className="btn ghost" type="button" onClick={markRead}>Mark alerts read</button> : null}
            </div>
          ) : null}
          {data.resets?.length ? (
            <div className="sheet flat editor">
              <h2>Password codes</h2>
              <p className="lead">Read the code to the customer on the phone. It expires in 30 minutes. There is no SMS gateway yet.</p>
              {data.resets.map((row) => (
                <p key={row.id}><b>{row.code}</b> · {row.name || 'Account'} · {row.cell}</p>
              ))}
            </div>
          ) : null}
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
