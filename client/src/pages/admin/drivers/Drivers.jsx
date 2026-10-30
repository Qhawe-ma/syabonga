import { useEffect, useState } from 'react';
import AdminLayout from '../AdminLayout.jsx';
import { formatCell, useShop } from '../../../shop.jsx';

const labels = { pending: 'Waiting', active: 'Approved', suspended: 'Suspended' };

export default function Drivers() {
  const { api } = useShop();
  const [drivers, setDrivers] = useState([]);
  const [name, setName] = useState('');
  const [cell, setCell] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [open, setOpen] = useState(null);

  async function refresh() {
    const data = await api('/api/admin/drivers');
    setDrivers(data.drivers);
  }

  useEffect(() => { refresh().catch((err) => setError(err.message)); }, [api]);

  async function create(event) {
    event.preventDefault();
    setError('');
    try {
      await api('/api/admin/drivers', { method: 'POST', body: { name, cell: cell.replace(/\D/g, ''), password } });
      setName('');
      setCell('');
      setPassword('');
      await refresh();
    } catch (err) {
      setError(err.message);
    }
  }

  async function setStatus(driver, status) {
    setError('');
    try {
      await api('/api/admin/drivers/' + driver.id, { method: 'PATCH', body: { status } });
      await refresh();
    } catch (err) { setError(err.message); }
  }

  return (
    <AdminLayout>
      <h1>Drivers</h1>
      <p className="lead">People who apply from the shop stay waiting until you approve them. Only approved drivers can accept deliveries. Payout details are a normal bank account.</p>
      {error ? <p className="err">{error}</p> : null}
      {!drivers.length && !error ? <p className="empty">No drivers yet.</p> : drivers.map((driver) => (
        <article className="sheet flat editor" key={driver.id}>
          <div className="row-actions">
            <h2 style={{ margin: 0 }}>{driver.name}</h2>
            <span className="tag">{labels[driver.status] || driver.status}</span>
          </div>
          <p className="meta">{driver.cell}{driver.vehicleType ? ' · ' + driver.vehicleType + ' ' + driver.vehicleReg : ''}</p>
          <div className="row-actions">
            {driver.status !== 'active' ? <button className="btn mini" type="button" onClick={() => setStatus(driver, 'active')}>Approve</button> : null}
            {driver.status !== 'suspended' ? <button className="btn ghost mini" type="button" onClick={() => setStatus(driver, 'suspended')}>Suspend</button> : null}
            <button className="textbtn" type="button" onClick={() => setOpen(open === driver.id ? null : driver.id)}>{open === driver.id ? 'Hide details' : 'Details'}</button>
          </div>
          {open === driver.id ? (
            <div className="facts">
              <div><dt>ID number</dt><dd>{driver.idNumber || 'Not supplied'}</dd></div>
              <div><dt>Licence</dt><dd>{driver.licenceNo || 'Not supplied'}</dd></div>
              <div><dt>Bank</dt><dd>{driver.bankName ? driver.bankName + ' · ' + driver.accountHolder + ' · ' + driver.accountNumber + ' · branch ' + driver.branchCode : 'No payout account yet'}</dd></div>
              {driver.photo ? <img className="doc" src={driver.photo} alt={'Photo of ' + driver.name} /> : null}
              {driver.licencePhoto ? <img className="doc" src={driver.licencePhoto} alt={'Licence of ' + driver.name} /> : null}
            </div>
          ) : null}
        </article>
      ))}
      <form className="sheet flat editor" onSubmit={create}>
        <h2>Add an approved driver</h2>
        <p className="lead">Use this when you already know the person. They can sign in immediately. Password must be at least 8 characters.</p>
        <label>Name<input value={name} onChange={(e) => setName(e.target.value)} required /></label>
        <label>Cell number<input value={cell} onChange={(e) => setCell(formatCell(e.target.value))} inputMode="tel" required /></label>
        <label>Password<input type="password" value={password} onChange={(e) => setPassword(e.target.value)} minLength={8} required /></label>
        <button className="btn" type="submit">Create driver</button>
      </form>
    </AdminLayout>
  );
}
