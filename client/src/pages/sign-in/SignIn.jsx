import { useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import Chrome from '../../components/Chrome.jsx';
import Logo from '../../components/Logo.jsx';
import { formatCell, useShop } from '../../shop.jsx';

const vehicles = ['Car', 'Bakkie', 'Motorbike', 'Bicycle'];

function startMode(params) {
  const mode = params.get('mode');
  if (mode === 'up' || mode === 'drive' || mode === 'forgot') return mode;
  return 'in';
}

function fileToData(file) {
  return new Promise((resolve) => {
    if (!file) return resolve('');
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.readAsDataURL(file);
  });
}

function Password({ label, value, onChange, autoComplete, minLength }) {
  const [show, setShow] = useState(false);
  return (
    <label>{label}
      <span className="pw">
        <input type={show ? 'text' : 'password'} value={value} onChange={onChange} autoComplete={autoComplete} required minLength={minLength || undefined} />
        <button type="button" className="pw-toggle" onClick={() => setShow((v) => !v)}>{show ? 'Hide' : 'Show'}</button>
      </span>
    </label>
  );
}

export default function SignIn() {
  const shop = useShop();
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const [mode, setMode] = useState(startMode(params));
  const [name, setName] = useState('');
  const [cell, setCell] = useState('');
  const [password, setPassword] = useState('');
  const [idNumber, setIdNumber] = useState('');
  const [vehicleType, setVehicleType] = useState('Bakkie');
  const [vehicleReg, setVehicleReg] = useState('');
  const [licenceNo, setLicenceNo] = useState('');
  const [bank, setBank] = useState(false);
  const [bankName, setBankName] = useState('');
  const [accountHolder, setAccountHolder] = useState('');
  const [accountNumber, setAccountNumber] = useState('');
  const [branchCode, setBranchCode] = useState('');
  const [code, setCode] = useState('');
  const [hint, setHint] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  function switchMode(next) {
    setMode(next);
    setError('');
    setHint('');
  }

  function digits(value) {
    return String(value || '').replace(/\D/g, '');
  }

  function checkAccount() {
    const phone = digits(cell);
    if (!/^0\d{9}$/.test(phone)) return 'Enter a 10-digit South African number, like 082 555 0199.';
    if ((mode === 'up' || mode === 'drive') && password.length < 8) return 'Use a password of at least 8 characters.';
    if ((mode === 'up' || mode === 'drive') && name.trim().length < 2) return 'Add your name and surname.';
    return '';
  }

  async function afterLogin(data) {
    await shop.load();
    const next = params.get('next');
    if (next && data.user.role !== 'driver') navigate(next);
    else if (data.user.role === 'admin') navigate('/admin');
    else if (data.user.role === 'driver') navigate('/drive');
    else navigate(next || '/');
  }

  async function submit(event) {
    event.preventDefault();
    setError('');
    setHint('');
    const problem = mode === 'forgot' ? '' : checkAccount();
    if (problem) { setError(problem); return; }
    setBusy(true);
    try {
      if (mode === 'forgot') {
        const phone = digits(cell);
        if (!/^0\d{9}$/.test(phone)) throw new Error('Enter the 10-digit number on the account.');
        if (!code) {
          const data = await shop.api('/api/auth/forgot', { method: 'POST', body: { cell: phone } });
          setHint(data.message || 'Ask the shop to read you the code.');
          return;
        }
        if (password.length < 8) throw new Error('Use a password of at least 8 characters.');
        await shop.api('/api/auth/reset', { method: 'POST', body: { cell: phone, code, password } });
        const data = await shop.api('/api/auth/login', { method: 'POST', body: { cell: phone, password } });
        await afterLogin(data);
        return;
      }
      if (mode === 'drive') {
        const idDigits = digits(idNumber);
        if (!/^\d{13}$/.test(idDigits)) throw new Error('Enter a 13-digit South African ID number.');
        if (vehicleReg.trim().length < 2) throw new Error('Enter the vehicle registration.');
        if (licenceNo.trim().length < 4) throw new Error('Enter the driver\'s licence number.');
        const photo = await fileToData(event.target.photo.files[0]);
        const licencePhoto = await fileToData(event.target.licence.files[0]);
        const data = await shop.api('/api/auth/driver-signup', {
          method: 'POST',
          body: {
            name: name.trim(),
            cell: digits(cell),
            password,
            idNumber: idDigits,
            vehicleType,
            vehicleReg: vehicleReg.trim(),
            licenceNo: licenceNo.trim(),
            bankName: bank ? bankName.trim() : '',
            accountHolder: bank ? accountHolder.trim() : '',
            accountNumber: bank ? digits(accountNumber) : '',
            branchCode: bank ? digits(branchCode) : '',
            photo: photo || undefined,
            licencePhoto: licencePhoto || undefined
          }
        });
        await afterLogin(data);
        return;
      }
      const data = await shop.api(mode === 'up' ? '/api/auth/signup' : '/api/auth/login', {
        method: 'POST',
        body: { name: name.trim(), cell: digits(cell), password }
      });
      await afterLogin(data);
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  const title = mode === 'up' ? 'Create an account' : mode === 'drive' ? 'Drive for the shop' : mode === 'forgot' ? 'Reset password' : 'Sign in';
  const lead = mode === 'up'
    ? 'Save your name and places so checkout is quicker.'
    : mode === 'drive'
      ? 'Apply with your ID, licence and vehicle. The shop approves you before you can take deliveries.'
      : mode === 'forgot'
        ? 'There is no SMS yet. The shop reads you a 6-digit code, then you choose a new password.'
        : 'Customers, drivers and shop staff all sign in here.';

  return (
    <Chrome>
      <form className={'sheet' + (mode === 'drive' ? ' wide' : '')} onSubmit={submit}>
        <div className="auth-logo"><Logo /></div>
        <div className="auth-switch" role="tablist" aria-label="Account">
          <button type="button" aria-pressed={mode === 'in'} onClick={() => switchMode('in')}>Sign in</button>
          <button type="button" aria-pressed={mode === 'up'} onClick={() => switchMode('up')}>Sign up</button>
          <button type="button" aria-pressed={mode === 'drive'} onClick={() => switchMode('drive')}>Drive</button>
        </div>
        <h1>{title}</h1>
        <p className="lead">{lead}</p>
        <label>Cell number
          <input value={cell} onChange={(e) => setCell(formatCell(e.target.value))} type="tel" inputMode="tel" autoComplete="username" placeholder="082 555 0199" required />
        </label>
        {mode === 'up' || mode === 'drive' ? (
          <label>Name and surname
            <input value={name} onChange={(e) => setName(e.target.value)} autoComplete="name" placeholder="Nomsa Dlamini" required />
          </label>
        ) : null}
        {mode === 'drive' ? (
          <>
            <label>South African ID number
              <input value={idNumber} onChange={(e) => setIdNumber(e.target.value.replace(/\D/g, '').slice(0, 13))} inputMode="numeric" placeholder="13 digits" required />
            </label>
            <div className="form-grid">
              <label>Vehicle
                <select value={vehicleType} onChange={(e) => setVehicleType(e.target.value)}>
                  {vehicles.map((item) => <option key={item}>{item}</option>)}
                </select>
              </label>
              <label>Registration
                <input value={vehicleReg} onChange={(e) => setVehicleReg(e.target.value.toUpperCase())} placeholder="ND 123 456" required />
              </label>
            </div>
            <label>Driver's licence number
              <input value={licenceNo} onChange={(e) => setLicenceNo(e.target.value)} required />
            </label>
            <label>Profile photo<input name="photo" type="file" accept="image/*" /></label>
            <label>Licence photo<input name="licence" type="file" accept="image/*" /></label>
            <label className="checks"><input type="checkbox" checked={bank} onChange={(e) => setBank(e.target.checked)} />Add bank details for payouts</label>
            {bank ? (
              <div className="form-grid">
                <label>Bank<input value={bankName} onChange={(e) => setBankName(e.target.value)} placeholder="FNB, Standard Bank…" /></label>
                <label>Account holder<input value={accountHolder} onChange={(e) => setAccountHolder(e.target.value)} /></label>
                <label>Account number<input value={accountNumber} onChange={(e) => setAccountNumber(e.target.value.replace(/\D/g, '').slice(0, 16))} inputMode="numeric" /></label>
                <label>Branch code<input value={branchCode} onChange={(e) => setBranchCode(e.target.value.replace(/\D/g, '').slice(0, 6))} inputMode="numeric" /></label>
              </div>
            ) : <p className="fine">Bank details are optional. The shop pays drivers from the account you give them. This is a normal bank account, not a crypto wallet.</p>}
          </>
        ) : null}
        {mode === 'forgot' && hint ? (
          <label>Code from the shop
            <input value={code} onChange={(e) => setCode(e.target.value.replace(/\D/g, '').slice(0, 6))} inputMode="numeric" placeholder="6 digits" />
          </label>
        ) : null}
        {mode !== 'forgot' || hint ? (
          <Password label={mode === 'up' || mode === 'drive' ? 'Create a password' : mode === 'forgot' ? 'New password' : 'Password'} value={password} onChange={(e) => setPassword(e.target.value)} autoComplete={mode === 'in' ? 'current-password' : 'new-password'} minLength={mode === 'in' ? undefined : 8} />
        ) : null}
        {hint ? <p className="notice">{hint}</p> : null}
        {error ? <p className="err" role="alert">{error}</p> : null}
        <button className="btn block" type="submit" disabled={busy}>
          {busy ? 'Please wait…' : mode === 'up' ? 'Create account' : mode === 'drive' ? 'Submit application' : mode === 'forgot' ? (hint ? 'Set new password' : 'Request a code') : 'Sign in'}
        </button>
        {mode === 'in' ? <button className="textbtn" type="button" onClick={() => switchMode('forgot')}>Forgot password</button> : null}
        {mode === 'forgot' ? <button className="textbtn" type="button" onClick={() => switchMode('in')}>Back to sign in</button> : null}
        <p className="lead">Shop staff sign in with the shop number. <Link to="/">Back to the shop</Link></p>
      </form>
    </Chrome>
  );
}
