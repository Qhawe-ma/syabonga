import { useEffect, useRef, useState } from 'react';
import { Link, useLocation, useNavigate, useSearchParams } from 'react-router-dom';
import Logo from './Logo.jsx';
import PlacePicker from './PlacePicker.jsx';
import { money, shortCategory, useShop } from '../shop.jsx';

function hello() {
  const h = new Date().getHours();
  return h < 12 ? 'Good morning' : h < 17 ? 'Good afternoon' : 'Good evening';
}

export function StaffBar({ home, children }) {
  return (
    <header className="top">
      <div className="mast">
        <div className="w bar staffbar">
          <Link className="brand" to={home}><Logo /></Link>
          <div className="tools">{children}</div>
        </div>
      </div>
    </header>
  );
}

export default function Chrome({ active, children }) {
  const shop = useShop();
  const navigate = useNavigate();
  const location = useLocation();
  const [params] = useSearchParams();
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState(params.get('q') || '');
  const popRef = useRef(null);
  const settings = shop.boot?.settings || {};
  const user = shop.boot?.user;
  const raw = shop.addr || {};
  const place = { line: '', town: 'Kranskop', lat: null, lng: null, ...raw, label: raw.label || 'Home' };
  const addrLabel = place.line
    ? (place.label ? place.label + ' · ' : '') + place.line
    : 'Add your address';
  const phone = settings.phone || '';
  const tel = phone.replace(/[^\d+]/g, '');
  const showDock = shop.count > 0 && location.pathname !== '/cart' && location.pathname !== '/checkout';

  useEffect(() => { setQ(params.get('q') || ''); }, [params]);
  useEffect(() => { setOpen(false); }, [location.pathname, location.search]);

  useEffect(() => {
    if (!open) return;
    function onDoc(event) {
      if (popRef.current && !popRef.current.contains(event.target)) setOpen(false);
    }
    function onKey(event) {
      if (event.key === 'Escape') setOpen(false);
    }
    document.addEventListener('mousedown', onDoc);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDoc);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  function setPlace(next) {
    shop.saveAddr({ ...place, ...next, town: next.town || 'Kranskop' });
  }

  async function signOut() {
    await shop.api('/api/auth/logout', { method: 'POST', body: {} });
    await shop.load();
    navigate('/');
  }

  function onSearch(event) {
    event.preventDefault();
    const query = q.trim();
    navigate(query ? '/shop?q=' + encodeURIComponent(query) : '/shop');
  }

  const accountTo = user
    ? (user.role === 'admin' ? '/admin' : user.role === 'driver' ? '/drive' : '/account')
    : '/sign-in';

  return (
    <>
      <header className="top">
        <div className="mast">
          <div className="w bar">
            <Link className="brand" to="/" aria-label="Siyabonga Powertrade home">
              <Logo />
            </Link>
            <form className="search" onSubmit={onSearch} role="search">
              <svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="11" cy="11" r="7" /><path d="M20 20l-3.2-3.2" /></svg>
              <input
                name="q"
                type="search"
                value={q}
                onChange={(e) => setQ(e.target.value)}
                placeholder="Search groceries"
                aria-label="Search products"
                enterKeyHint="search"
              />
            </form>
            <div className="tools">
              <Link className="acct" to={accountTo}>
                <span className="avatar">{user ? user.name.charAt(0).toUpperCase() : (
                  <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true"><circle cx="12" cy="8" r="3.2" /><path d="M5 19.2c1.3-3 3.6-4.4 7-4.4s5.7 1.4 7 4.4" /></svg>
                )}</span>
                <span className="acctx">
                  <small>{hello()}</small>
                  <b>{user ? user.name.split(' ')[0] : 'Sign in'}</b>
                </span>
              </Link>
              {user ? (
                <button className="textbtn light" type="button" onClick={signOut}>Sign out</button>
              ) : (
                <Link className="join" to="/sign-in?mode=up">Sign up</Link>
              )}
              <Link className="cartbtn" to="/cart" aria-label={'Basket, ' + shop.count + ' items, ' + money(shop.subtotal)}>
                <span className="bag">
                  <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true"><path d="M6.5 8h11l-.8 11.2a1.5 1.5 0 0 1-1.5 1.3H8.8a1.5 1.5 0 0 1-1.5-1.3L6.5 8z" /><path d="M9 8V6.6a3 3 0 0 1 6 0V8" /></svg>
                  {shop.count > 0 ? <i>{shop.count}</i> : null}
                </span>
                <span className="cartx"><small>Basket</small><b>{money(shop.subtotal)}</b></span>
              </Link>
            </div>
          </div>
        </div>
      </header>
      <div className="subnav">
        <div className="w subnav-inner">
          <div className="addrwrap" ref={popRef}>
            <button className="addr" type="button" aria-expanded={open} aria-haspopup="dialog" onClick={() => setOpen((v) => !v)}>
              <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true"><path d="M12 21s7-6.2 7-11a7 7 0 1 0-14 0c0 4.8 7 11 7 11z" /><circle cx="12" cy="10" r="2.3" /></svg>
              <span className="addr-copy">
                <small>{place.line ? 'Deliver to' : 'Delivery address'}</small>
                <b>{addrLabel}</b>
              </span>
            </button>
            {open ? (
              <div className="pop" role="dialog" aria-label="Delivery address">
                <p className="pophead">Where should we drop it?</p>
                <p className="hint">Tap the map or use your location. Add a landmark. Many gates around Kranskop are not named on the map.</p>
                <p className="hint">Delivery {money(settings.fee || 25)}, free over {money(settings.free_over || 500)}. Delivery orders start at {money(settings.min_delivery || 150)}.</p>
                <PlacePicker value={place} onChange={setPlace} />
              </div>
            ) : null}
          </div>
          <nav className="cats" aria-label="Departments">
            <div className="chiprow">
              <Link to="/" aria-current={active === 'front' ? 'true' : undefined}>Home</Link>
              {(shop.boot?.categories || []).map((c) => (
                <Link key={c.slug} to={'/shop?cat=' + c.slug} aria-current={active === c.slug ? 'true' : undefined}>{shortCategory(c.slug, c.name)}</Link>
              ))}
            </div>
          </nav>
          {phone ? <a className="call" href={'tel:' + tel}>{phone}</a> : null}
        </div>
      </div>
      <main className={showDock ? 'has-dock' : undefined}><div className="w">{children}</div></main>
      {showDock ? (
        <Link className="dock" to="/cart">
          <span className="dock-count">{shop.count}</span>
          <span>View basket</span>
          <b>{money(shop.subtotal)}</b>
        </Link>
      ) : null}
      <footer>
        <div className="w foot">
          <div>
            <Logo />
            <p className="footname">{settings.shop_name || 'Siyabonga Powertrade'}</p>
            <p>{settings.address}</p>
            {phone ? <p><a href={'tel:' + tel}>{phone}</a></p> : null}
            {settings.fax ? <p>Fax {settings.fax}</p> : null}
          </div>
          <div>
            <h2>Delivery</h2>
            <p>Staff pick your groceries and bring them to your gate.</p>
            <p>Delivery is {money(settings.fee || 25)}, and free over {money(settings.free_over || 500)}.</p>
            <p>Delivery orders start at {money(settings.min_delivery || 150)}. Collecting from the shop is free.</p>
          </div>
          <div>
            <h2>Pay at the door</h2>
            <p>Cash or card machine when we deliver, or when you collect. There is no online payment.</p>
          </div>
          <div>
            <h2>Departments</h2>
            <ul className="footlinks">
              {(shop.boot?.categories || []).map((c) => (
                <li key={c.slug}><Link to={'/shop?cat=' + c.slug}>{c.name}</Link></li>
              ))}
            </ul>
          </div>
        </div>
        <div className="w legal">© {new Date().getFullYear()} {settings.shop_name || 'Siyabonga Powertrade'}. Kranskop, KwaZulu-Natal. Prices on the shelf can change.</div>
      </footer>
    </>
  );
}
