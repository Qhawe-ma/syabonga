import { useEffect, useState } from 'react';
import AdminLayout from '../AdminLayout.jsx';
import { money, useShop } from '../../../shop.jsx';

const empty = { name: '', size: '', price: '', category: 'staples', stock: 20, active: true, photo: '' };

function fileToData(file) {
  return new Promise((resolve) => {
    if (!file) return resolve('');
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.readAsDataURL(file);
  });
}

export default function Products() {
  const { api, boot, load } = useShop();
  const [rows, setRows] = useState([]);
  const [form, setForm] = useState(empty);
  const [error, setError] = useState('');

  async function refresh() {
    const data = await api('/api/products?all=1');
    setRows(data.products);
  }

  useEffect(() => { refresh().catch((err) => setError(err.message)); }, [api]);

  function edit(product) {
    setForm({
      id: product.id, name: product.name, size: product.size, price: product.price,
      category: product.category, stock: product.stock, active: product.active, photo: ''
    });
    window.scrollTo(0, 0);
  }

  async function save(event) {
    event.preventDefault();
    setError('');
    const photo = await fileToData(event.target.photo.files[0]);
    const body = { ...form, price: Number(form.price), stock: Number(form.stock), photo: photo || undefined };
    try {
      if (form.id) await api('/api/admin/products/' + form.id, { method: 'PUT', body });
      else await api('/api/admin/products', { method: 'POST', body });
      setForm(empty);
      event.target.reset();
      await refresh();
      await load();
    } catch (err) { setError(err.message); }
  }

  return (
    <AdminLayout>
      <h1>Products</h1>
      <form className="sheet flat editor" onSubmit={save}>
        <h2>{form.id ? 'Edit product' : 'Add a product'}</h2>
        <div className="grid2">
          <label>Name<input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} required /></label>
          <label>Pack size<input value={form.size} onChange={(e) => setForm({ ...form, size: e.target.value })} required /></label>
          <label>Price<input type="number" step="0.01" min="0" value={form.price} onChange={(e) => setForm({ ...form, price: e.target.value })} required /></label>
          <label>Stock<input type="number" min="0" value={form.stock} onChange={(e) => setForm({ ...form, stock: e.target.value })} required /></label>
          <label>Department
            <select value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })}>
              {(boot?.categories || []).map((c) => <option key={c.slug} value={c.slug}>{c.name}</option>)}
            </select>
          </label>
          <label>Photo<input name="photo" type="file" accept="image/*" /></label>
        </div>
        {form.id ? <label className="checks"><input type="checkbox" checked={form.active} onChange={(e) => setForm({ ...form, active: e.target.checked })} />On the shelf</label> : null}
        {error ? <p className="err">{error}</p> : null}
        <button className="btn" type="submit">{form.id ? 'Save changes' : 'Add product'}</button>
        {form.id ? <button className="textbtn" type="button" onClick={() => setForm(empty)}>Cancel</button> : null}
      </form>
      <div className="table-wrap"><table>
        <thead><tr><th>Product</th><th>Price</th><th>Stock</th><th></th></tr></thead>
        <tbody>
          {rows.map((p) => (
            <tr key={p.id}>
              <td>{p.name}<div className="meta">{p.size} · {p.active ? 'On shelf' : 'Hidden'}</div></td>
              <td className="num">{money(p.price)}</td>
              <td>{p.stock}</td>
              <td><button className="btn mini" type="button" onClick={() => edit(p)}>Edit</button></td>
            </tr>
          ))}
        </tbody>
      </table></div>
    </AdminLayout>
  );
}
