import { useEffect, useState } from 'react';
import AdminLayout from '../AdminLayout.jsx';
import { useShop } from '../../../shop.jsx';

export default function Drivers() {
  const { api } = useShop();
  const [drivers, setDrivers] = useState([]);
  const [name, setName] = useState('');
  const [cell, setCell] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');

  async function refresh() {
    const data = await api('/api/admin/drivers');
    setDrivers(data.drivers);
  }

  useEffect(() => { refresh().catch((err) => setError(err.message)); }, [api]);

  async function create(event) {
    event.preventDefault();
    setError('');
    try {
      await api('/api/admin/drivers', { method: 'POST', body: { name, cell, password } });
      setName('');
      setCell('');
      setPassword('');
      await refresh();
    } catch (err) {
      setError(err.message);
    }
  }

  return (
    <AdminLayout>
      <h1>Drivers</h1>
      <form className="sheet flat editor" onSubmit={create}>
        <h2>Add a driver</h2>
        <label>Name<input value={name} onChange={(e) => setName(e.target.value)} required /></label>
        <label>Cell number<input value={cell} onChange={(e) => setCell(e.target.value)} inputMode="tel" required /></label>
        <label>Password<input type="password" value={password} onChange={(e) => setPassword(e.target.value)} required /></label>
        {error ? <p className="err">{error}</p> : null}
        <button className="btn" type="submit">Create driver</button>
      </form>
      <table>
        <thead><tr><th>Name</th><th>Cell</th></tr></thead>
        <tbody>
          {drivers.map((driver) => (
            <tr key={driver.id}><td>{driver.name}</td><td>{driver.cell}</td></tr>
          ))}
        </tbody>
      </table>
      {!drivers.length && !error ? <p className="empty">No drivers yet. Add one, then assign them on an order.</p> : null}
    </AdminLayout>
  );
}
