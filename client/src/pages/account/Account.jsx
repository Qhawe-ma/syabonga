import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import Chrome from '../../components/Chrome.jsx';
import PlacePicker from '../../components/PlacePicker.jsx';
import { money, useShop } from '../../shop.jsx';

export default function Account() {
  const shop = useShop();
  const navigate = useNavigate();
  const user = shop.boot?.user;
  const [place, setPlace] = useState(() => shop.addr || { line: '', town: 'Kranskop', lat: null, lng: null, label: 'Home' });
  const [orders, setOrders] = useState([]);
  const [error, setError] = useState('');

  useEffect(() => {
    if (shop.boot && !shop.boot.user) navigate('/sign-in?next=/account');
    if (shop.boot?.user?.role === 'driver') navigate('/drive');
    if (shop.boot?.user?.role === 'admin') navigate('/admin');
  }, [shop.boot, navigate]);

  useEffect(() => {
    if (shop.addr?.line || shop.addr?.lat) setPlace(shop.addr);
  }, [shop.addr]);

  useEffect(() => {
    if (!user || user.role !== 'customer') return;
    shop.api('/api/orders/mine').then((data) => setOrders(data.orders)).catch((err) => setError(err.message));
  }, [user, shop.api]);

  if (!user || user.role !== 'customer') return <Chrome><p className="empty">Taking you to sign in…</p></Chrome>;

  return (
    <Chrome>
      <div className="sheet" style={{ maxWidth: 640 }}>
        <h1>{user.name.split(' ')[0]}</h1>
        <p className="lead">{user.cell}</p>
        <h2 style={{ fontFamily: 'var(--cond)', marginTop: 8 }}>Saved places</h2>
        <p className="lead">Home, work, or another gate. The pin is what the driver follows.</p>
        <PlacePicker value={place} onChange={(next) => { setPlace(next); shop.saveAddr(next); }} />
        {error ? <p className="err">{error}</p> : null}
        <h2 style={{ fontFamily: 'var(--cond)', marginTop: 22 }}>Your orders</h2>
        {!orders.length ? <p className="empty">No orders yet.</p> : orders.map((order) => (
          <Link className="sline" key={order.number} to={'/order/' + order.number}><span>{order.number} · {order.status}</span><b>{money(order.total)}</b></Link>
        ))}
      </div>
    </Chrome>
  );
}
