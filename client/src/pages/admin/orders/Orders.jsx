import { useEffect, useState } from 'react';
import AdminLayout from '../AdminLayout.jsx';
import { money, statusLabel, useShop } from '../../../shop.jsx';

const statuses = ['new', 'accepted', 'picking', 'out', 'ready', 'delivered', 'collected', 'cancelled'];

export default function Orders() {
  const { api, load } = useShop();
  const [orders, setOrders] = useState([]);
  const [drivers, setDrivers] = useState([]);
  const [filter, setFilter] = useState('');
  const [error, setError] = useState('');

  async function refresh(status) {
    const [data, staff] = await Promise.all([
      api('/api/admin/orders' + (status ? '?status=' + status : '')),
      api('/api/admin/drivers')
    ]);
    setOrders(data.orders);
    setDrivers(staff.drivers);
  }

  useEffect(() => { refresh(filter).catch((err) => setError(err.message)); }, [filter, api]);

  async function assign(order, driverId) {
    try {
      await api('/api/admin/orders/' + order.id, { method: 'PATCH', body: { driverId: Number(driverId) || 0 } });
      await refresh(filter);
    } catch (err) { setError(err.message); }
  }

  async function setStatus(order, status) {
    try {
      await api('/api/admin/orders/' + order.id, { method: 'PATCH', body: { status } });
      await refresh(filter);
      await load();
    } catch (err) { setError(err.message); }
  }

  return (
    <AdminLayout>
      <h1>Orders</h1>
      <label className="filters">Show
        <select value={filter} onChange={(e) => setFilter(e.target.value)}>
          <option value="">All</option>
          {statuses.map((s) => <option key={s} value={s}>{statusLabel(s)}</option>)}
        </select>
      </label>
      {error ? <p className="err">{error}</p> : null}
      <div className="table-wrap"><table>
        <thead><tr><th>Order</th><th>Customer</th><th>Items</th><th>Total</th><th>Driver</th><th>Status</th></tr></thead>
        <tbody>
          {orders.map((order) => (
            <tr key={order.id}>
              <td>{order.number}<div className="meta">{order.mode === 'delivery' ? (order.placeLabel ? order.placeLabel + ' · ' : '') + order.address + (order.lat != null ? ' · pin' : ' · no pin') : 'Collect'} · {order.slot}</div></td>
              <td>{order.name}<div className="meta">{order.cell}</div></td>
              <td>{order.items.map((item) => item.qty + ' × ' + item.name).join(', ')}</td>
              <td className="num">{money(order.total)}<div className="meta">{order.payMethod}</div></td>
              <td>
                {order.mode === 'delivery' ? (
                  <select value={order.driverId || ''} onChange={(e) => assign(order, e.target.value)}>
                    <option value="">No driver</option>
                    {drivers.filter((driver) => driver.status === 'active' || String(driver.id) === String(order.driverId)).map((driver) => <option key={driver.id} value={driver.id}>{driver.name}{driver.status !== 'active' ? ' (' + driver.status + ')' : ''}</option>)}
                  </select>
                ) : 'Collect'}
              </td>
              <td>
                <select value={order.status} onChange={(e) => setStatus(order, e.target.value)}>
                  {statuses.map((s) => <option key={s} value={s}>{statusLabel(s)}</option>)}
                </select>
              </td>
            </tr>
          ))}
        </tbody>
      </table></div>
    </AdminLayout>
  );
}
