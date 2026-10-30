import { useEffect, useRef, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { StaffBar } from '../../components/Chrome.jsx';
import PinMap, { formatPin, mapsUrl } from '../../components/PinMap.jsx';
import { money, statusLabel, useShop } from '../../shop.jsx';

const nextStatus = { accepted: 'picking', new: 'picking', picking: 'out', ready: 'out', out: 'delivered' };
const nextLabel = { accepted: 'Start picking', new: 'Start picking', picking: 'Mark picked up', ready: 'Mark picked up', out: 'Mark delivered' };

export default function Drive() {
  const shop = useShop();
  const navigate = useNavigate();
  const user = shop.boot?.user;
  const [tab, setTab] = useState('mine');
  const [pack, setPack] = useState(null);
  const [available, setAvailable] = useState([]);
  const [earnings, setEarnings] = useState(null);
  const [currentId, setCurrentId] = useState(null);
  const [error, setError] = useState('');
  const [gpsNote, setGpsNote] = useState('');
  const [here, setHere] = useState(null);
  const [busy, setBusy] = useState(false);
  const sent = useRef(0);

  async function refresh() {
    const [mine, open, pay] = await Promise.all([
      shop.api('/api/driver/orders'),
      shop.api('/api/driver/available'),
      shop.api('/api/driver/earnings')
    ]);
    setPack(mine);
    setAvailable(open.orders || []);
    setEarnings(pay);
    setCurrentId((id) => id || mine.orders.find((order) => order.status !== 'delivered')?.id || mine.orders[0]?.id || null);
  }

  useEffect(() => {
    if (shop.boot && user && user.role !== 'driver') navigate('/sign-in?next=/drive');
    if (shop.boot && !user) navigate('/sign-in?next=/drive');
  }, [shop.boot, user, navigate]);

  useEffect(() => {
    if (user?.role !== 'driver' || (user.status && user.status !== 'active')) return;
    refresh().catch((err) => setError(err.message));
  }, [user?.role, user?.status]);

  const current = pack?.orders?.find((order) => order.id === currentId) || null;

  useEffect(() => {
    if (!current || current.status !== 'out' || current.lat == null) return;
    if (!navigator.geolocation) return;
    const watch = navigator.geolocation.watchPosition(async function (pos) {
      const lat = pos.coords.latitude;
      const lng = pos.coords.longitude;
      setHere({ lat, lng, name: 'You' });
      setGpsNote('');
      const now = Date.now();
      if (now - sent.current < 15000) return;
      sent.current = now;
      try {
        await shop.api('/api/driver/location', { method: 'POST', body: { orderId: current.id, lat, lng } });
      } catch (err) {
        setError(err.message);
      }
    }, function () {
      setGpsNote('Allow location so the customer can see you on the way.');
    }, { enableHighAccuracy: true, maximumAge: 10000 });
    return function () { navigator.geolocation.clearWatch(watch); };
  }, [current?.id, current?.status, shop.api]);

  async function mark(status) {
    setError('');
    setBusy(true);
    try {
      await shop.api('/api/driver/orders/' + current.id, { method: 'PATCH', body: { status } });
      await refresh();
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  async function accept(order) {
    setError('');
    setBusy(true);
    try {
      const data = await shop.api('/api/driver/orders/' + order.id + '/accept', { method: 'POST', body: {} });
      await refresh();
      setTab('mine');
      setCurrentId(data.order.id);
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  async function signOut() {
    await shop.api('/api/auth/logout', { method: 'POST', body: {} });
    await shop.load();
    navigate('/');
  }

  if (!user || user.role !== 'driver') return <p className="empty">Checking the driver sign-in…</p>;

  if (user.status === 'pending') {
    return (
      <>
        <StaffBar home="/drive">
          <button className="staff-link" type="button" onClick={signOut}>Sign out</button>
        </StaffBar>
        <div className="w">
          <div className="sheet">
            <h1>Waiting for approval</h1>
            <p className="lead">Thanks, {user.name.split(' ')[0]}. The shop is checking your ID, licence and vehicle. You can take deliveries once they approve you.</p>
            <Link className="btn" to="/">Back to the shop</Link>
          </div>
        </div>
      </>
    );
  }

  if (user.status === 'suspended') {
    return (
      <>
        <StaffBar home="/drive"><button className="staff-link" type="button" onClick={signOut}>Sign out</button></StaffBar>
        <div className="w"><div className="sheet"><h1>Account suspended</h1><p className="lead">Call the shop if you think this is a mistake.</p></div></div>
      </>
    );
  }

  return (
    <>
      <StaffBar home="/drive">
        <span className="staff-name">{user.name.split(' ')[0]}</span>
        <button className="staff-link" type="button" onClick={signOut}>Sign out</button>
      </StaffBar>
      <div className="w drive-app">
        <div className="auth-switch" role="tablist">
          <button type="button" aria-pressed={tab === 'mine'} onClick={() => setTab('mine')}>My stops</button>
          <button type="button" aria-pressed={tab === 'open'} onClick={() => setTab('open')}>Available</button>
          <button type="button" aria-pressed={tab === 'pay'} onClick={() => setTab('pay')}>Earnings</button>
        </div>
        {gpsNote ? <p className="warn">{gpsNote}</p> : null}
        {error ? <p className="err">{error}</p> : null}
        {tab === 'open' ? (
          <div>
            {!available.length ? <p className="empty">No unassigned deliveries right now.</p> : available.map((order) => (
              <article className="stop" key={order.id}>
                <b>{order.number}</b> · {statusLabel(order.status)}
                <div className="meta">{order.placeLabel ? order.placeLabel + ' · ' : ''}{order.address}, {order.town}</div>
                <div className="meta">{order.slot} · {money(order.total)}</div>
                <button className="btn" type="button" disabled={busy} onClick={() => accept(order)}>Accept</button>
              </article>
            ))}
          </div>
        ) : null}
        {tab === 'pay' ? (
          <div className="sheet flat">
            <h1>Earnings</h1>
            <p className="lead">The shop pays {money(earnings?.pay || 0)} per delivered order. Payouts go to the bank account on your application.</p>
            <div className="stat"><span>Delivered</span><b>{money(earnings?.total || 0)}</b></div>
            {(earnings?.drops || []).map((drop) => (
              <div className="sline" key={drop.id}><span>{drop.number}<div className="meta">{drop.address}</div></span><b>{money(drop.amount)}</b></div>
            ))}
            {!earnings?.drops?.length ? <p className="empty">No delivered orders yet.</p> : null}
          </div>
        ) : null}
        {tab === 'mine' ? (
          <div className="drive">
            <div>
              <h1 className="page-title">Stops</h1>
              {!pack?.orders?.length ? <p className="empty">Nothing assigned yet. Check Available, or wait for the shop to assign you.</p> : pack.orders.map((order) => (
                <button key={order.id} type="button" className="stop" aria-pressed={order.id === currentId} onClick={() => setCurrentId(order.id)}>
                  <b>{order.number}</b> · {statusLabel(order.status)}
                  <div className="meta">{order.placeLabel ? order.placeLabel + ' · ' : ''}{order.address}</div>
                  <div className="meta">{order.name} · {order.cell} · {order.slot}</div>
                </button>
              ))}
            </div>
            <div className="drive-panel">
              {!current ? <p className="empty">Choose a stop.</p> : (
                <>
                  <h2 className="subhead">{current.placeLabel || 'Drop-off'}</h2>
                  <p>{current.address}{current.town ? ', ' + current.town : ''}</p>
                  <p className="meta">{current.name} · {current.cell}</p>
                  <p>{current.items.map((item) => item.qty + ' × ' + item.name).join(', ')}</p>
                  {current.lat == null ? <p className="warn">This order has no pin. Call {current.name} on {current.cell}.</p> : (
                    <>
                      <p className="coord">{formatPin(current.lat, current.lng)}</p>
                      <PinMap
                        className="tall"
                        lat={current.lat}
                        lng={current.lng}
                        shop={pack.shop}
                        driver={here || (current.driverLat != null ? { lat: current.driverLat, lng: current.driverLng, name: 'You' } : null)}
                        follow={false}
                      />
                    </>
                  )}
                  <div className="drive-actions">
                    {current.lat != null ? <a className="btn ghost" href={mapsUrl(current.lat, current.lng)} target="_blank" rel="noreferrer">Navigate</a> : null}
                    {nextStatus[current.status] ? (
                      <button className="btn" type="button" disabled={busy} onClick={() => mark(nextStatus[current.status])}>{busy ? 'Saving…' : nextLabel[current.status]}</button>
                    ) : <p className="ok">Delivered.</p>}
                  </div>
                </>
              )}
            </div>
          </div>
        ) : null}
      </div>
    </>
  );
}
