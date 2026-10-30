import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import PinMap, { formatPin } from './PinMap.jsx';
import { useShop } from '../shop.jsx';

const QUICK = ['Home', 'Work'];

export default function PlacePicker({ value, onChange }) {
  const shop = useShop();
  const user = shop.boot?.user;
  const places = shop.boot?.places || [];
  const settings = shop.boot?.settings || {};
  const [custom, setCustom] = useState(!QUICK.includes(value.label || 'Home'));
  const [busy, setBusy] = useState('');
  const [finding, setFinding] = useState('');
  const [error, setError] = useState('');
  const watchRef = useRef(null);
  const timerRef = useRef(null);
  const bestRef = useRef(Infinity);
  const valueRef = useRef(value);
  valueRef.current = value;

  function patch(next) {
    onChange({ ...valueRef.current, ...next });
  }

  function stopWatch() {
    if (watchRef.current != null && navigator.geolocation) {
      navigator.geolocation.clearWatch(watchRef.current);
      watchRef.current = null;
    }
    if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
  }

  useEffect(function () { return stopWatch; }, []);

  function clearPin() {
    patch({ lat: null, lng: null, accuracy: null });
  }

  function locate() {
    setError('');
    if (!window.isSecureContext) {
      clearPin();
      const next = shop.boot?.secureUrl;
      if (next) {
        window.location.assign(next + window.location.pathname + window.location.search);
        return;
      }
      setError('This phone blocks GPS on an http link. Open the secure shop address, then allow location.');
      return;
    }
    if (!navigator.geolocation) {
      clearPin();
      setError('This phone cannot share a location. Tap the map instead.');
      return;
    }
    stopWatch();
    bestRef.current = Infinity;
    let locked = false;
    // Hide any old / wrong pin until a tight GPS fix lands.
    clearPin();
    setFinding('Finding your exact spot… Allow location if the phone asks.');

    function take(pos) {
      const accuracy = Number(pos.coords.accuracy);
      if (!Number.isFinite(accuracy)) return;
      // Rough network guesses land in the wrong town. Only keep a real GPS fix.
      if (accuracy > 80) {
        setFinding('Waiting for exact GPS… phone guess is too rough');
        return;
      }
      if (accuracy >= bestRef.current) return;
      bestRef.current = accuracy;
      locked = true;
      patch({ lat: pos.coords.latitude, lng: pos.coords.longitude, accuracy });
      if (accuracy <= 25) {
        stopWatch();
        setFinding('');
        return;
      }
      setFinding('Locking GPS… within ' + Math.round(accuracy) + ' m');
    }

    function giveUp(message) {
      stopWatch();
      setFinding('');
      if (!locked) clearPin();
      setError(message);
    }

    function fail(err) {
      if (err && err.code === 1) {
        giveUp('Location is blocked. Allow it for this site, or tap the map on the gate.');
        return;
      }
      if (locked) return;
      if (err && err.code === 2) {
        giveUp('Turn on location in your phone settings, then try again. Or tap the map.');
      }
    }

    const gps = { enableHighAccuracy: true, maximumAge: 0, timeout: 60000 };
    navigator.geolocation.getCurrentPosition(take, fail, gps);
    watchRef.current = navigator.geolocation.watchPosition(take, fail, gps);
    timerRef.current = setTimeout(function () {
      if (locked && bestRef.current <= 80) {
        stopWatch();
        setFinding('');
        return;
      }
      giveUp('Could not get your exact spot. Step outside and try again, or tap the map on the gate.');
    }, 45000);
  }

  async function choose(place) {
    onChange(place);
    setCustom(!QUICK.includes(place.label));
    shop.saveAddr(place);
    if (!user || !place.id) return;
    try {
      const saved = await shop.api('/api/me/places/' + place.id, {
        method: 'PUT',
        body: { ...place, isDefault: true }
      });
      shop.saveAddr(saved.address || saved.place);
      await shop.load();
    } catch (err) {
      setError(err.message);
    }
  }

  async function savePlace() {
    setError('');
    if (!user) return;
    setBusy('Saving…');
    try {
      const body = {
        label: value.label || 'Home',
        line: value.line,
        town: value.town || 'Kranskop',
        lat: value.lat,
        lng: value.lng,
        isDefault: true
      };
      const saved = value.id
        ? await shop.api('/api/me/places/' + value.id, { method: 'PUT', body })
        : await shop.api('/api/me/places', { method: 'POST', body });
      shop.saveAddr(saved.place);
      onChange(saved.place);
      await shop.load();
      shop.setToast(body.label + ' saved on your profile.');
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy('');
    }
  }

  async function removePlace() {
    if (!user || !value.id) return;
    setBusy('Removing…');
    try {
      const saved = await shop.api('/api/me/places/' + value.id, { method: 'DELETE' });
      const next = saved.address || { line: '', town: 'Kranskop', lat: null, lng: null, label: 'Home', id: null };
      shop.saveAddr(next.line ? next : { line: '', town: 'Kranskop', lat: null, lng: null, label: 'Home' });
      onChange(next.line ? next : { line: '', town: 'Kranskop', lat: null, lng: null, label: 'Home', id: null });
      await shop.load();
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy('');
    }
  }

  return (
    <div className="picker">
      {places.length ? (
        <div className="chips">
          {places.map((place) => (
            <button key={place.id} type="button" className="chip" aria-pressed={value.id === place.id} onClick={() => choose(place)}>
              {place.label}
            </button>
          ))}
        </div>
      ) : null}
      <PinMap
        lat={value.lat}
        lng={value.lng}
        accuracy={value.accuracy}
        shop={{ lat: settings.shop_lat, lng: settings.shop_lng }}
        onPick={(pin) => patch(pin)}
      />
      <button className="btn y block" type="button" onClick={locate} disabled={!!finding || !!busy}>{finding || 'Use my current location'}</button>
      <div className="coord-row">
        <p className="coord">{value.lat != null ? formatPin(value.lat, value.lng) + (value.accuracy > 0 ? ' · GPS within ' + Math.round(value.accuracy) + ' m' : '') : finding ? 'Waiting for your exact GPS…' : 'No pin yet. Rural roads often have no name, so the pin is what the driver follows.'}</p>
        {value.lat != null ? <button className="lk" type="button" onClick={clearPin}>Clear pin</button> : null}
      </div>
      <label>Landmark<input value={value.line || ''} onChange={(e) => patch({ line: e.target.value })} placeholder="Blue gate, past the clinic" /></label>
      <label>Town<input value={value.town || ''} onChange={(e) => patch({ town: e.target.value })} /></label>
      <div className="chips">
        {QUICK.map((label) => (
          <button key={label} type="button" className="chip" aria-pressed={!custom && value.label === label} onClick={() => { setCustom(false); patch({ label, id: places.find((p) => p.label === label)?.id || null }); }}>
            {label}
          </button>
        ))}
        <button type="button" className="chip" aria-pressed={custom} onClick={() => { setCustom(true); if (QUICK.includes(value.label)) patch({ label: '', id: null }); }}>Other</button>
      </div>
      {custom ? <label>Place name<input value={QUICK.includes(value.label) ? '' : (value.label || '')} onChange={(e) => patch({ label: e.target.value, id: null })} placeholder="Mom’s house" /></label> : null}
      {error ? <p className="err">{error}</p> : null}
      {user?.role === 'customer' ? (
        <div className="row-actions">
          <button className="btn" type="button" onClick={savePlace} disabled={!!busy}>{busy || 'Save on my profile'}</button>
          {value.id ? <button className="lk" type="button" onClick={removePlace}>Remove</button> : null}
        </div>
      ) : user ? null : (
        <p className="hint"><Link to="/sign-in?mode=up&next=/account">Create an account</Link> to keep Home and Work on your profile.</p>
      )}
    </div>
  );
}
