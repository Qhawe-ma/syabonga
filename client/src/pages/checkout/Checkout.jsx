import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import Chrome from '../../components/Chrome.jsx';
import PlacePicker from '../../components/PlacePicker.jsx';
import { money, useShop } from '../../shop.jsx';

const slots = ['Today, 2 pm to 5 pm', 'Today, 5 pm to 8 pm', 'Tomorrow, 8 am to 12 pm'];

export default function Checkout() {
  const shop = useShop();
  const navigate = useNavigate();
  const user = shop.boot?.user;
  const settings = shop.boot?.settings || { fee: 25, free_over: 500, min_delivery: 150 };
  const [mode, setMode] = useState('delivery');
  const [name, setName] = useState(user?.name || '');
  const [cell, setCell] = useState(user?.cell || '');
  const [place, setPlace] = useState(() => ({
    id: shop.addr?.id || null,
    label: shop.addr?.label || 'Home',
    line: shop.addr?.line || '',
    town: shop.addr?.town || 'Kranskop',
    lat: shop.addr?.lat ?? null,
    lng: shop.addr?.lng ?? null
  }));
  const [slot, setSlot] = useState(slots[0]);
  const [pay, setPay] = useState('cash');
  useEffect(() => {
    if (user?.name) setName((v) => v || user.name);
    if (user?.cell) setCell((v) => v || user.cell);
    if (shop.addr?.lat != null) setPlace((current) => (current.lat == null ? shop.addr : current));
    else if (shop.addr?.line) setPlace((current) => (current.line ? current : shop.addr));
  }, [user, shop.addr]);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const lines = shop.catalog.filter((p) => shop.cart[p.id]);
  const fee = mode === 'delivery' && shop.subtotal > 0 && shop.subtotal < settings.free_over ? settings.fee : 0;
  const low = mode === 'delivery' && shop.subtotal < settings.min_delivery;

  async function submitOrder(event) {
    event.preventDefault();
    setError('');
    setBusy(true);
    try {
      const data = await shop.api('/api/orders', {
        method: 'POST',
        body: {
          name, cell, mode, address: place.line, town: place.town, lat: place.lat, lng: place.lng,
          placeLabel: place.label, slot, payMethod: pay,
          items: lines.map((p) => ({ id: p.id, qty: shop.cart[p.id] }))
        }
      });
      shop.clearCart();
      sessionStorage.setItem('syb_order', JSON.stringify(data.order));
      if (mode === 'delivery') shop.saveAddr(place);
      await shop.load();
      navigate('/order/' + data.order.number);
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  if (!lines.length) {
    return <Chrome><div className="sheet"><h1>Your basket is empty</h1><p className="lead">Add a few groceries, then come back to enter your details.</p><Link className="btn" to="/shop">Browse the shop</Link></div></Chrome>;
  }

  return (
    <Chrome>
      <div className="crumb"><Link to="/cart">Basket</Link> › <span>Checkout</span></div>
      <div className="paygrid">
        <form id="checkout" className="sheet flat" onSubmit={submitOrder}>
          <h1>Checkout</h1>
          <p className="lead">{mode === 'delivery' ? 'Our staff pick the order and bring it to your gate.' : 'Collect free at ' + (settings.address || 'the shop') + '.'}</p>
          <div className="tabs">
            <button type="button" aria-pressed={mode === 'delivery'} onClick={() => setMode('delivery')}>Deliver to me</button>
            <button type="button" aria-pressed={mode === 'collect'} onClick={() => setMode('collect')}>I will collect</button>
          </div>
          <label>Your name<input value={name} onChange={(e) => setName(e.target.value)} required /></label>
          <label>Cell number<input value={cell} onChange={(e) => setCell(e.target.value)} inputMode="tel" required /></label>
          {mode === 'delivery' ? <PlacePicker value={place} onChange={(next) => { setPlace(next); shop.saveAddr(next); }} /> : null}
          <label>{mode === 'delivery' ? 'Delivery window' : 'Collection window'}
            <select value={slot} onChange={(e) => setSlot(e.target.value)}>{slots.map((s) => <option key={s}>{s}</option>)}</select>
          </label>
          <label>How you will pay
            <select value={pay} onChange={(e) => setPay(e.target.value)}>
              <option value="cash">Cash when I {mode === 'delivery' ? 'receive' : 'collect'}</option>
              <option value="card">Card machine when I {mode === 'delivery' ? 'receive' : 'collect'}</option>
            </select>
          </label>
          {error ? <p className="err">{error}</p> : null}
          {low ? <p className="warn">Delivery orders start at {money(settings.min_delivery)}. Add more, or collect at the shop.</p> : null}
        </form>
        <aside className="bill">
          <h2>To pay</h2>
          {lines.map((p) => <div className="sline" key={p.id}><span>{shop.cart[p.id]} × {p.name}</span><b>{money(p.price * shop.cart[p.id])}</b></div>)}
          <div className="sline"><span>{mode === 'delivery' ? 'Delivery' : 'Collection'}</span><b>{fee ? money(fee) : 'Free'}</b></div>
          <div className="sline tot"><span>Total</span><b>{money(shop.subtotal + fee)}</b></div>
          <button className="btn block" form="checkout" type="submit" disabled={busy || low}>{busy ? 'Placing…' : 'Place order'}</button>
          <p className="fine2">You pay when the order arrives or when you collect. The shop sees this order in admin.</p>
        </aside>
      </div>
    </Chrome>
  );
}
