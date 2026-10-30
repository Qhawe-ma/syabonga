import { useState } from 'react';
import { Link } from 'react-router-dom';
import { StaffBar } from '../../components/Chrome.jsx';
import { formatCell, useShop } from '../../shop.jsx';

const vehicles = ['Car', 'Bakkie', 'Motorbike', 'Bicycle'];

function Password({ label, value, onChange, autoComplete }) {
  const [show, setShow] = useState(false);
  return (
    <label>{label}
      <span className="pw">
        <input type={show ? 'text' : 'password'} value={value} onChange={onChange} autoComplete={autoComplete} required minLength={autoComplete === 'new-password' ? 8 : undefined} />
        <button type="button" className="pw-toggle" onClick={() => setShow((v) => !v)}>{show ? 'Hide' : 'Show'}</button>
      </span>
    </label>
  );
}

function fileToData(file) {
  return new Promise((resolve) => {
    if (!file) return resolve('');
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.readAsDataURL(file);
  });
}

export default function DriverAuth() {
  const shop = useShop();
  const [mode, setMode] = useState('in');
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
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  function digits(value) { return String(value || '').replace(/\D/g, ''); }

  async function submit(event) {
    event.preventDefault();
    setError('');
    const phone = digits(cell);
    if (!/^0\d{9}$/.test(phone)) { setError('Enter a 10-digit cell number.'); return; }
    setBusy(true);
    try {
      if (mode === 'up') {
        if (name.trim().length < 2) throw new Error('Add your name and surname.');
        if (!/^\d{13}$/.test(digits(idNumber))) throw new Error('Enter a 13-digit South African ID number.');
        if (vehicleReg.trim().length < 2) throw new Error('Enter the vehicle registration.');
        if (licenceNo.trim().length < 4) throw new Error('Enter the driver\'s licence number.');
        const photo = await fileToData(event.target.photo.files[0]);
        const licencePhoto = await fileToData(event.target.licence.files[0]);
        await shop.api('/api/auth/driver-signup', {
          method: 'POST',
          body: {
            name: name.trim(), cell: phone, password, idNumber: digits(idNumber),
            vehicleType, vehicleReg: vehicleReg.trim(), licenceNo: licenceNo.trim(),
            bankName: bank ? bankName.trim() : '', accountHolder: bank ? accountHolder.trim() : '',
            accountNumber: bank ? digits(accountNumber) : '', branchCode: bank ? digits(branchCode) : '',
            photo: photo || undefined, licencePhoto: licencePhoto || undefined
          }
        });
      } else {
        const data = await shop.api('/api/auth/login', { method: 'POST', body: { cell: phone, password } });
        if (data.user.role !== 'driver') throw new Error('That account is not a driver. Use the shop sign-in for customers.');
      }
      await shop.load();
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <StaffBar home="/driver" kicker="Drivers" />
      <main className="auth-main">
        <form className={'sheet' + (mode === 'up' ? ' wide' : '')} onSubmit={submit}>
          <div className="auth-switch" role="tablist">
            <button type="button" aria-pressed={mode === 'in'} onClick={() => { setMode('in'); setError(''); }}>Sign in</button>
            <button type="button" aria-pressed={mode === 'up'} onClick={() => { setMode('up'); setError(''); }}>Register</button>
          </div>
          <h1>{mode === 'up' ? 'Drive for Siyabonga' : 'Driver sign in'}</h1>
          <p className="lead">{mode === 'up' ? 'The shop approves your ID, licence and vehicle before you can take deliveries.' : 'Drivers only. Customers sign in from the shop.'}</p>
          <label>Cell number<input value={cell} onChange={(e) => setCell(formatCell(e.target.value))} type="tel" inputMode="tel" autoComplete="username" placeholder="082 555 0199" required /></label>
          {mode === 'up' ? (
            <>
              <label>Name and surname<input value={name} onChange={(e) => setName(e.target.value)} autoComplete="name" required /></label>
              <label>South African ID number<input value={idNumber} onChange={(e) => setIdNumber(e.target.value.replace(/\D/g, '').slice(0, 13))} inputMode="numeric" required /></label>
              <div className="form-grid">
                <label>Vehicle<select value={vehicleType} onChange={(e) => setVehicleType(e.target.value)}>{vehicles.map((item) => <option key={item}>{item}</option>)}</select></label>
                <label>Registration<input value={vehicleReg} onChange={(e) => setVehicleReg(e.target.value.toUpperCase())} required /></label>
              </div>
              <label>Driver's licence number<input value={licenceNo} onChange={(e) => setLicenceNo(e.target.value)} required /></label>
              <label>Profile photo<input name="photo" type="file" accept="image/*" /></label>
              <label>Licence photo<input name="licence" type="file" accept="image/*" /></label>
              <label className="checks"><input type="checkbox" checked={bank} onChange={(e) => setBank(e.target.checked)} />Add bank details for payouts</label>
              {bank ? (
                <div className="form-grid">
                  <label>Bank<input value={bankName} onChange={(e) => setBankName(e.target.value)} /></label>
                  <label>Account holder<input value={accountHolder} onChange={(e) => setAccountHolder(e.target.value)} /></label>
                  <label>Account number<input value={accountNumber} onChange={(e) => setAccountNumber(e.target.value.replace(/\D/g, '').slice(0, 16))} inputMode="numeric" /></label>
                  <label>Branch code<input value={branchCode} onChange={(e) => setBranchCode(e.target.value.replace(/\D/g, '').slice(0, 6))} inputMode="numeric" /></label>
                </div>
              ) : <p className="fine">Payouts use a normal bank account. This is not a crypto wallet.</p>}
            </>
          ) : null}
          <Password label={mode === 'up' ? 'Create a password' : 'Password'} value={password} onChange={(e) => setPassword(e.target.value)} autoComplete={mode === 'up' ? 'new-password' : 'current-password'} />
          {error ? <p className="err" role="alert">{error}</p> : null}
          <button className="btn block" type="submit" disabled={busy}>{busy ? 'Please wait…' : mode === 'up' ? 'Submit application' : 'Sign in'}</button>
          <p className="lead"><Link to="/">Back to the shop</Link></p>
        </form>
      </main>
    </>
  );
}
