import { useEffect } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useShop } from '../../shop.jsx';

const links = [
  ['/admin', 'Today'],
  ['/admin/products', 'Products'],
  ['/admin/orders', 'Orders'],
  ['/admin/drivers', 'Drivers'],
  ['/admin/customers', 'Customers'],
  ['/admin/settings', 'Settings']
];

export default function AdminLayout({ children }) {
  const { boot, api, load } = useShop();
  const navigate = useNavigate();
  const location = useLocation();

  useEffect(() => {
    if (boot && (!boot.user || boot.user.role !== 'admin')) navigate('/sign-in?next=/admin');
  }, [boot, navigate]);

  async function signOut() {
    await api('/api/auth/logout', { method: 'POST', body: {} });
    await load();
    navigate('/');
  }

  if (!boot?.user || boot.user.role !== 'admin') return <p className="empty">Checking the shop login…</p>;

  return (
    <>
      <header className="top">
        <div className="mast"><div className="w bar">
          <Link className="brand" to="/admin"><img className="logo" src="/shared/img/logo.jpg" alt="Siyabonga Powertrade" /></Link>
          <div className="tools" style={{ marginLeft: 'auto' }}>
            <Link className="acct" to="/"><span className="acctx"><small>Shop admin</small><b>View the shop</b></span></Link>
            <button className="join" type="button" onClick={signOut}>Sign out</button>
          </div>
        </div></div>
      </header>
      <div className="w admin-wrap">
        <nav className="admin-nav">
          {links.map(([href, label]) => <Link key={href} to={href} aria-current={location.pathname === href ? 'true' : undefined}>{label}</Link>)}
        </nav>
        <div className="admin-main">{children}</div>
      </div>
    </>
  );
}
