import { useEffect } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { StaffBar } from '../../components/Chrome.jsx';
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
      <StaffBar home="/admin">
        <Link className="staff-link" to="/">Shop</Link>
        <button className="staff-link" type="button" onClick={signOut}>Sign out</button>
      </StaffBar>
      <div className="w admin-wrap">
        <nav className="admin-nav">
          {links.map(([href, label]) => <Link key={href} to={href} aria-current={location.pathname === href ? 'true' : undefined}>{label}</Link>)}
        </nav>
        <div className="admin-main">{children}</div>
      </div>
    </>
  );
}
