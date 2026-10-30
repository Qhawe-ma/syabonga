import { useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import Chrome from '../../components/Chrome.jsx';
import Logo from '../../components/Logo.jsx';
import { useShop } from '../../shop.jsx';

export default function SignIn() {
  const shop = useShop();
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const [up, setUp] = useState(params.get('mode') === 'up');
  const [name, setName] = useState('');
  const [cell, setCell] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');

  async function submit(event) {
    event.preventDefault();
    setError('');
    try {
      const data = await shop.api(up ? '/api/auth/signup' : '/api/auth/login', {
        method: 'POST',
        body: { name, cell, password }
      });
      await shop.load();
      const next = params.get('next');
      if (next) navigate(next);
      else if (data.user.role === 'admin') navigate('/admin');
      else if (data.user.role === 'driver') navigate('/drive');
      else navigate('/');
    } catch (err) {
      setError(err.message);
    }
  }

  return (
    <Chrome>
      <form className="sheet" onSubmit={submit}>
        <div className="auth-logo"><Logo /></div>
        <h1>{up ? 'Create an account' : 'Sign in'}</h1>
        <p className="lead">{up ? 'Save your name and address, then checkout is quicker.' : 'Welcome back to Siyabonga Powertrade.'}</p>
        <label>Cell number<input value={cell} onChange={(e) => setCell(e.target.value)} inputMode="tel" placeholder="082 000 0000" required /></label>
        {up ? <label>Your name<input value={name} onChange={(e) => setName(e.target.value)} placeholder="Name and surname" required /></label> : null}
        <label>Password<input type="password" value={password} onChange={(e) => setPassword(e.target.value)} required /></label>
        {error ? <p className="err">{error}</p> : null}
        <button className="btn block" type="submit">{up ? 'Create account' : 'Sign in'}</button>
        <button className="lk" type="button" onClick={() => { setUp(!up); setError(''); }}>{up ? 'Already have an account? Sign in' : 'New here? Create an account'}</button>
        <p className="lead" style={{ marginTop: 16 }}>Shop staff sign in with the shop cell number. <Link to="/">Back to the shop</Link></p>
      </form>
    </Chrome>
  );
}
