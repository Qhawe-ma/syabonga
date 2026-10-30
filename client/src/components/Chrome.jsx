import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import PlacePicker from './PlacePicker.jsx';
import { money, useShop } from '../shop.jsx';

function hello() {
  const h = new Date().getHours();
  return h < 12 ? 'Good morning' : h < 17 ? 'Good afternoon' : 'Good evening';
}

export default function Chrome({ active, children }) {
  const shop = useShop();
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const settings = shop.boot?.settings || {};
  const user = shop.boot?.user;
  const raw = shop.addr || {};
  const place = { line: '', town: 'Kranskop', lat: null, lng: null, ...raw, label: raw.label || 'Home' };
  const addrLabel = place.line
    ? (place.label ? place.label + ' · ' : '') + place.line
    : 'Add your address';

  function setPlace(next) {
    shop.saveAddr({ ...place, ...next, town: next.town || 'Kranskop' });
  }

  async function signOut() {
    await shop.api('/api/auth/logout', { method: 'POST', body: {} });
    await shop.load();
    navigate('/');
  }

  return (
    <>
      <header className="top">
        <div className="mast"><div className="w bar">
          <Link className="brand" to="/"><img className="logo" src="/shared/img/logo.jpg" alt="Siyabonga Powertrade" /></Link>
          <div className="addrwrap">
            <button className="addr" type="button" onClick={() => setOpen((v) => !v)}>
              <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2"><path d="M12 21s7-6.2 7-11a7 7 0 1 0-14 0c0 4.8 7 11 7 11z" /><circle cx="12" cy="10" r="2.3" fill="#FFE500" stroke="none" /></svg>
              <span><small>We deliver to</small><b>{addrLabel}</b></span>
            </button>
            {open ? (
              <div className="pop">
                <p className="pophead">Where should we drop it?</p>
                <p className="hint">Tap the map or use your location. Add a landmark, because many gates around Kranskop are not named on the map.</p>
                <PlacePicker value={place} onChange={setPlace} />
              </div>
            ) : null}
          </div>
          <form className="search" onSubmit={(e) => { e.preventDefault(); const q = new FormData(e.target).get('q'); navigate('/shop?q=' + encodeURIComponent(q || '')); }}>
            <svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="11" cy="11" r="7" /><path d="M20 20l-3.2-3.2" /></svg>
            <input name="q" type="search" placeholder="Search rice, cooking oil, washing powder…" aria-label="Search products" />
          </form>
          <div className="tools">
            {user ? (
              <Link className="acct" to={user.role === 'admin' ? '/admin' : user.role === 'driver' ? '/drive' : '/account'}>
                <span className="avatar">{user.name.charAt(0).toUpperCase()}</span>
                <span className="acctx"><small>{hello()}</small><b>{user.name.split(' ')[0]}</b></span>
              </Link>
            ) : (
              <>
                <Link className="acct" to="/sign-in">
                  <span className="avatar"><svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="1.8"><circle cx="12" cy="8" r="3.2" /><path d="M5 19.2c1.3-3 3.6-4.4 7-4.4s5.7 1.4 7 4.4" /></svg></span>
                  <span className="acctx"><small>{hello()}</small><b>Sign in</b></span>
                </Link>
                <Link className="join" to="/sign-in?mode=up">Sign up</Link>
              </>
            )}
            <Link className="cartbtn" to="/cart">
              <span className="bag"><svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" strokeWidth="1.8"><path d="M6.5 8h11l-1 12h-9l-1-12z" /><path d="M9 8V6.8A3 3 0 0 1 12 4a3 3 0 0 1 3 2.8V8" /></svg><i>{shop.count}</i></span>
              <span className="cartx"><small>Basket</small><b>{money(shop.subtotal)}</b></span>
            </Link>
          </div>
        </div></div>
        <button className="strip" type="button" onClick={() => setOpen(true)}>
          {place.line
            ? 'Delivering to ' + addrLabel + (place.lat != null ? ' · pin saved' : ' · pin still needed') + '. Delivery ' + money(settings.fee || 25) + ', free over ' + money(settings.free_over || 500) + '.'
            : 'Add your address and drop a pin so the driver can find the gate.'}
        </button>
        <nav className="cats" aria-label="Departments"><div className="w">
          <Link to="/" aria-current={active === 'front' ? 'true' : undefined}>Home</Link>
          {(shop.boot?.categories || []).map((c) => (
            <Link key={c.slug} to={'/shop?cat=' + c.slug} aria-current={active === c.slug ? 'true' : undefined}>{c.name}</Link>
          ))}
          <span className="call">{settings.phone}</span>
          {user ? <button className="lk" type="button" onClick={signOut} style={{ marginLeft: 12 }}>Sign out</button> : null}
        </div></nav>
      </header>
      <main><div className="w">{children}</div></main>
      <footer>
        <div className="band" />
        <div className="w foot">
          <div className="footbrand">
            <img className="badge" src="/shared/img/badge.jpg" alt="" />
            <div>
              <strong>{settings.shop_name || 'Siyabonga Powertrade'}</strong>
              <p>{settings.address}</p>
              <p>{settings.phone}{settings.fax ? ' · Fax ' + settings.fax : ''}</p>
            </div>
          </div>
          <div>
            <strong>How to shop</strong>
            <p>Our staff pick your groceries and bring them to your gate. Collecting from the shop is free.</p>
            <p>Delivery is {money(settings.fee || 25)}, and free over {money(settings.free_over || 500)}. Delivery orders start at {money(settings.min_delivery || 150)}.</p>
          </div>
          <div>
            <strong>Pay at the door</strong>
            <p>Cash or card machine when we deliver, or when you collect.</p>
          </div>
        </div>
        <div className="w legal">Orders are saved for the shop. Staff manage them in the admin.</div>
      </footer>
    </>
  );
}
