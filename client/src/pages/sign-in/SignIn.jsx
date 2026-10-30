import { useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { StaffBar } from '../../components/Chrome.jsx';
import { formatCell, useShop } from '../../shop.jsx';

function Password({ label, value, onChange, autoComplete, minLength }) {
  const [show, setShow] = useState(false);
  return (
    <label>{label}
      <span className="pw">
        <input type={show ? 'text' : 'password'} value={value} onChange={onChange} autoComplete={autoComplete} required minLength={minLength || undefined} />
        <button type="button" className="pw-toggle" onClick={() => setShow((v) => !v)} aria-label={show ? 'Hide password' : 'Show password'}>{show ? 'Hide' : 'Show'}</button>
      </span>
    </label>
  );
}

export default function SignIn() {
  const shop = useShop();
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const [mode, setMode] = useState(params.get('mode') === 'up' ? 'up' : params.get('mode') === 'forgot' ? 'forgot' : 'in');
  const [name, setName] = useState('');
  const [cell, setCell] = useState('');
  const [password, setPassword] = useState('');
  const [code, setCode] = useState('');
  const [hint, setHint] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  function digits(value) {
    return String(value || '').replace(/\D/g, '');
  }

  async function submit(event) {
    event.preventDefault();
    setError('');
    const phone = digits(cell);
    if (!/^0\d{9}$/.test(phone)) {
      setError('Enter a 10-digit South African number, like 082 555 0199.');
      return;
    }
    if (mode === 'up' && name.trim().length < 2) {
      setError('Add your name and surname.');
      return;
    }
    if (mode !== 'in' && mode !== 'forgot' && password.length < 8) {
      setError('Use a password of at least 8 characters.');
      return;
    }
    setBusy(true);
    try {
      if (mode === 'forgot') {
        if (!code) {
          const data = await shop.api('/api/auth/forgot', { method: 'POST', body: { cell: phone } });
          setHint(data.message || 'Ask the shop to read you the code.');
          return;
        }
        if (password.length < 8) throw new Error('Use a password of at least 8 characters.');
        await shop.api('/api/auth/reset', { method: 'POST', body: { cell: phone, code, password } });
      }
      const data = await shop.api(mode === 'up' ? '/api/auth/signup' : '/api/auth/login', {
        method: 'POST',
        body: { name: name.trim(), cell: phone, password }
      });
      await shop.load();
      if (data.user.role === 'admin') navigate('/admin');
      else if (data.user.role === 'driver') navigate('/driver');
      else navigate(params.get('next') || '/');
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <StaffBar home="/" />
      <main className="auth-main">
        <form className="sheet" onSubmit={submit}>
          <div className="auth-switch" role="tablist" aria-label="Account">
            <button type="button" aria-pressed={mode === 'in' || mode === 'forgot'} onClick={() => { setMode('in'); setError(''); setHint(''); }}>Sign in</button>
            <button type="button" aria-pressed={mode === 'up'} onClick={() => { setMode('up'); setError(''); setHint(''); }}>Sign up</button>
          </div>
          <h1>{mode === 'up' ? 'Create an account' : mode === 'forgot' ? 'Reset password' : 'Sign in'}</h1>
          <p className="lead">{mode === 'up' ? 'Save your name and places. You can also check out without an account.' : mode === 'forgot' ? 'Ask the shop to read you a code, then choose a new password.' : 'Use the cell number on your account.'}</p>
          {mode === 'up' ? <label>Name and surname<input value={name} onChange={(e) => setName(e.target.value)} autoComplete="name" required /></label> : null}
          <label>Cell number<input value={cell} onChange={(e) => setCell(formatCell(e.target.value))} type="tel" inputMode="tel" autoComplete="username" placeholder="082 555 0199" required /></label>
          {mode === 'forgot' && hint ? <label>Code from the shop<input value={code} onChange={(e) => setCode(e.target.value.replace(/\D/g, '').slice(0, 6))} inputMode="numeric" /></label> : null}
          {mode !== 'forgot' || hint ? (
            <Password label={mode === 'up' ? 'Create a password' : mode === 'forgot' ? 'New password' : 'Password'} value={password} onChange={(e) => setPassword(e.target.value)} autoComplete={mode === 'in' ? 'current-password' : 'new-password'} minLength={mode === 'in' ? undefined : 8} />
          ) : null}
          {hint ? <p className="notice">{hint}</p> : null}
          {error ? <p className="err" role="alert">{error}</p> : null}
          <button className="btn block" type="submit" disabled={busy}>{busy ? 'Please wait…' : mode === 'up' ? 'Create account' : mode === 'forgot' ? (hint ? 'Set new password' : 'Request a code') : 'Sign in'}</button>
          {mode === 'in' ? <button className="textbtn" type="button" onClick={() => { setMode('forgot'); setError(''); }}>Forgot password</button> : null}
          {mode === 'forgot' ? <button className="textbtn" type="button" onClick={() => { setMode('in'); setHint(''); setError(''); }}>Back to sign in</button> : null}
          <p className="lead"><Link to="/">Back to the shop</Link></p>
        </form>
      </main>
    </>
  );
}
