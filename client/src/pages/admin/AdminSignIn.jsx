import { useState } from 'react';
import { Link } from 'react-router-dom';
import { StaffBar } from '../../components/Chrome.jsx';
import { formatCell, useShop } from '../../shop.jsx';

export default function AdminSignIn() {
  const shop = useShop();
  const [cell, setCell] = useState('');
  const [password, setPassword] = useState('');
  const [show, setShow] = useState(false);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  async function submit(event) {
    event.preventDefault();
    setError('');
    setBusy(true);
    try {
      const data = await shop.api('/api/auth/login', {
        method: 'POST',
        body: { cell: cell.replace(/\D/g, ''), password }
      });
      if (data.user.role !== 'admin') throw new Error('That account is not shop staff.');
      await shop.load();
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <StaffBar home="/" kicker="Shop" />
      <main className="auth-main">
        <form className="sheet" onSubmit={submit}>
          <h1>Shop sign in</h1>
          <p className="lead">For the people who run Siyabonga Powertrade. Customers sign in from the shop.</p>
          <label>Shop number<input value={cell} onChange={(e) => setCell(formatCell(e.target.value))} type="tel" inputMode="tel" autoComplete="username" required /></label>
          <label>Password
            <span className="pw">
              <input type={show ? 'text' : 'password'} value={password} onChange={(e) => setPassword(e.target.value)} autoComplete="current-password" required />
              <button type="button" className="pw-toggle" onClick={() => setShow((v) => !v)}>{show ? 'Hide' : 'Show'}</button>
            </span>
          </label>
          {error ? <p className="err" role="alert">{error}</p> : null}
          <button className="btn block" type="submit" disabled={busy}>{busy ? 'Please wait…' : 'Sign in'}</button>
          <p className="lead"><Link to="/">Back to the shop</Link></p>
        </form>
      </main>
    </>
  );
}
