import { useEffect, useState } from 'react';
import AdminLayout from '../AdminLayout.jsx';
import { useShop } from '../../../shop.jsx';

export default function Settings() {
  const { api, load, setToast } = useShop();
  const [form, setForm] = useState(null);
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');

  useEffect(() => {
    api('/api/admin/settings').then((data) => setForm(data.settings)).catch((err) => setError(err.message));
  }, [api]);

  function set(key, value) { setForm({ ...form, [key]: value }); }

  async function save(event) {
    event.preventDefault();
    try {
      await api('/api/admin/settings', { method: 'PUT', body: form });
      await load();
      setToast('Shop settings saved.');
    } catch (err) { setError(err.message); }
  }

  async function changePassword(event) {
    event.preventDefault();
    try {
      await api('/api/admin/password', { method: 'PUT', body: { password } });
      setPassword('');
      setToast('Password changed.');
    } catch (err) { setError(err.message); }
  }

  if (!form) return <AdminLayout><p className="empty">{error || 'Loading settings…'}</p></AdminLayout>;

  return (
    <AdminLayout>
      <h1>Settings</h1>
      <form className="sheet flat" onSubmit={save}>
        <label>Shop name<input value={form.shop_name || ''} onChange={(e) => set('shop_name', e.target.value)} /></label>
        <label>Phone<input value={form.phone || ''} onChange={(e) => set('phone', e.target.value)} /></label>
        <label>Fax<input value={form.fax || ''} onChange={(e) => set('fax', e.target.value)} /></label>
        <label>Shop address<input value={form.address || ''} onChange={(e) => set('address', e.target.value)} /></label>
        <label>Town<input value={form.town || ''} onChange={(e) => set('town', e.target.value)} /></label>
        <label>Shop pin latitude<input value={form.shop_lat || ''} onChange={(e) => set('shop_lat', e.target.value)} /></label>
        <label>Shop pin longitude<input value={form.shop_lng || ''} onChange={(e) => set('shop_lng', e.target.value)} /></label>
        <label>Delivery fee (R)<input type="number" step="0.01" value={form.fee} onChange={(e) => set('fee', e.target.value)} /></label>
        <label>Free delivery over (R)<input type="number" step="0.01" value={form.free_over} onChange={(e) => set('free_over', e.target.value)} /></label>
        <label>Delivery minimum (R)<input type="number" step="0.01" value={form.min_delivery} onChange={(e) => set('min_delivery', e.target.value)} /></label>
        {error ? <p className="err">{error}</p> : null}
        <button className="btn" type="submit">Save settings</button>
      </form>
      <form className="sheet flat" style={{ marginTop: 16 }} onSubmit={changePassword}>
        <h2>Admin password</h2>
        <label>New password<input type="password" value={password} onChange={(e) => setPassword(e.target.value)} /></label>
        <button className="btn" type="submit">Change password</button>
      </form>
    </AdminLayout>
  );
}
