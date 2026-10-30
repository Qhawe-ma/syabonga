import { useEffect, useRef, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import PinMap, { formatPin, mapsUrl } from '../../components/PinMap.jsx';
import { useShop } from '../../shop.jsx';

const nextStatus = { accepted: 'picking', new: 'picking', picking: 'out', ready: 'out', out: 'delivered' };
const nextLabel = { accepted: 'Start picking', new: 'Start picking', picking: 'Out for delivery', ready: 'Out for delivery', out: 'Delivered' };

export default function Drive() {
  const shop = useShop();
  const navigate = useNavigate();
  const [pack, setPack] = useState(null);
  const [currentId, setCurrentId] = useState(null);
  const [error, setError] = useState('');
  const [here, setHere] = useState(null);
  const sent = useRef(0);

  async function refresh() {
    const data = await shop.api('/api/driver/orders');
    setPack(data);
    setCurrentId((id) => id || data.orders.find((order) => order.status !== 'delivered')?.id || data.orders[0]?.id || null);
  }

  useEffect(() => {
    if (shop.boot && shop.boot.user?.role !== 'driver') navigate('/sign-in?next=/drive');
  }, [shop.boot, navigate]);

  useEffect(() => {
    if (shop.boot?.user?.role !== 'driver') return;
    refresh().catch((err) => setError(err.message));
  }, [shop.boot?.user]);

  const current = pack?.orders?.find((order) => order.id === currentId) || null;

  useEffect(() => {
    if (!current || current.status !== 'out' || current.lat == null) return;
    if (!navigator.geolocation) return;
    const watch = navigator.geolocation.watchPosition(async function (pos) {
      const lat = pos.coords.latitude;
      const lng = pos.coords.longitude;
      setHere({ lat, lng, name: 'You' });
      const now = Date.now();
      if (now - sent.current < 15000) return;
      sent.current = now;
      try {
        await shop.api('/api/driver/location', { method: 'POST', body: { orderId: current.id, lat, lng } });
      } catch (err) {
        setError(err.message);
      }
    }, function () {
      setError('Allow location so the customer can see you on the way.');
    }, { enableHighAccuracy: true, maximumAge: 10000 });
    return function () { navigator.geolocation.clearWatch(watch); };
  }, [current?.id, current?.status, shop.api]);

  async function mark(status) {
    setError('');
    try {
      await shop.api('/api/driver/orders/' + current.id, { method: 'PATCH', body: { status } });
      await refresh();
    } catch (err) {
      setError(err.message);
    }
  }

  async function signOut() {
    await shop.api('/api/auth/logout', { method: 'POST', body: {} });
    await shop.load();
    navigate('/');
  }

  if (!shop.boot?.user || shop.boot.user.role !== 'driver') return <p className="empty">Checking the driver sign-in…</p>;

  return (
    <>
      <header className="top">
        <div className="mast"><div className="w bar">
          <Link className="brand" to="/drive"><img className="logo" src="/shared/img/logo.jpg" alt="Siyabonga Powertrade" /></Link>
          <div className="tools" style={{ marginLeft: 'auto' }}>
            <span className="acctx"><small>Driver</small><b>{shop.boot.user.name.split(' ')[0]}</b></span>
            <button className="join" type="button" onClick={signOut}>Sign out</button>
          </div>
        </div></div>
      </header>
      <div className="w drive">
        <div>
          <h1 style={{ fontFamily: 'var(--cond)', margin: '0 0 10px' }}>Stops</h1>
          {error ? <p className="err">{error}</p> : null}
          {!pack?.orders?.length ? <p className="empty">No deliveries assigned yet. The shop assigns you from Admin, Orders.</p> : pack.orders.map((order) => (
            <button key={order.id} type="button" className="stop" aria-pressed={order.id === currentId} onClick={() => setCurrentId(order.id)}>
              <b>{order.number}</b> · {order.status}
              <div className="meta">{order.placeLabel ? order.placeLabel + ' · ' : ''}{order.address}</div>
              <div className="meta">{order.name} · {order.cell} · {order.slot}</div>
            </button>
          ))}
        </div>
        <div>
          {!current ? <p className="empty">Choose a stop.</p> : (
            <>
              <h2 style={{ fontFamily: 'var(--cond)', marginTop: 0 }}>{current.placeLabel || 'Drop-off'}</h2>
              <p>{current.address}, {current.town}</p>
              <p className="meta">{current.name} · {current.cell}</p>
              <p>{current.items.map((item) => item.qty + ' × ' + item.name).join(', ')}</p>
              {current.lat == null ? <p className="warn">This order has no pin. Call {current.name} on {current.cell}.</p> : (
                <>
                  <p className="coord">{formatPin(current.lat, current.lng)}</p>
                  <PinMap
                    lat={current.lat}
                    lng={current.lng}
                    shop={pack.shop}
                    driver={here || (current.driverLat != null ? { lat: current.driverLat, lng: current.driverLng, name: 'You' } : null)}
                    follow={false}
                  />
                  <a className="btn block" href={mapsUrl(current.lat, current.lng)} target="_blank" rel="noreferrer">Navigate</a>
                </>
              )}
              {nextStatus[current.status] ? (
                <button className="btn y" type="button" style={{ marginTop: 10 }} onClick={() => mark(nextStatus[current.status])}>{nextLabel[current.status]}</button>
              ) : <p className="ok">Delivered.</p>}
            </>
          )}
        </div>
      </div>
    </>
  );
}
