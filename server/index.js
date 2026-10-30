const http = require('http');
const https = require('https');
const fs = require('fs');
const path = require('path');
const { randomBytes } = require('crypto');
const { open, hashPassword, checkPassword, settingsMap, publicUser, publicProduct, publicPlace, root } = require('./db');
const { ensureCert, httpsPort } = require('./device-https');

const db = open();
const port = Number(process.env.PORT || 8780);
const dist = path.join(root, 'client', 'dist');

const types = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.png': 'image/png',
  '.svg': 'image/svg+xml',
  '.webp': 'image/webp',
  '.ico': 'image/x-icon'
};

function send(res, status, body, headers) {
  const buf = Buffer.isBuffer(body) ? body : Buffer.from(body);
  res.writeHead(status, Object.assign({
    'Content-Length': buf.length,
    'Cache-Control': 'no-store'
  }, headers || {}));
  res.end(buf);
}

function json(res, status, obj) {
  send(res, status, JSON.stringify(obj), { 'Content-Type': 'application/json; charset=utf-8' });
}

function cookies(req) {
  const out = {};
  String(req.headers.cookie || '').split(';').forEach(function (part) {
    const i = part.indexOf('=');
    if (i > 0) out[part.slice(0, i).trim()] = decodeURIComponent(part.slice(i + 1).trim());
  });
  return out;
}

function readBody(req) {
  return new Promise(function (resolve, reject) {
    const chunks = [];
    let size = 0;
    req.on('data', function (c) {
      size += c.length;
      if (size > 8_000_000) {
        reject(new Error('too big'));
        req.destroy();
        return;
      }
      chunks.push(c);
    });
    req.on('end', function () {
      const raw = Buffer.concat(chunks).toString('utf8');
      if (!raw) return resolve({});
      try { resolve(JSON.parse(raw)); } catch (e) { reject(e); }
    });
    req.on('error', reject);
  });
}

function userFrom(req) {
  const token = cookies(req).sid;
  if (!token) return null;
  const row = db.prepare(`SELECT u.*, s.created_at AS session_at FROM sessions s JOIN users u ON u.id = s.user_id WHERE s.token = ?`).get(token);
  if (!row) return null;
  const age = Date.now() - Date.parse(row.session_at || '');
  if (!Number.isFinite(age) || age > 30 * 24 * 60 * 60 * 1000) {
    db.prepare('DELETE FROM sessions WHERE token = ?').run(token);
    return null;
  }
  if (row.status === 'suspended') {
    db.prepare('DELETE FROM sessions WHERE token = ?').run(token);
    return null;
  }
  return row;
}

function setSession(res, userId) {
  const token = randomBytes(24).toString('hex');
  db.prepare('INSERT INTO sessions (token, user_id, created_at) VALUES (?, ?, ?)').run(token, userId, new Date().toISOString());
  return token;
}

function cookieHeader(token, secure) {
  const bits = ['sid=' + token, 'Path=/', 'HttpOnly', 'SameSite=Lax', 'Max-Age=2592000'];
  if (secure) bits.push('Secure');
  return bits.join('; ');
}

function normaliseCell(value) {
  let digits = String(value || '').replace(/\D/g, '');
  if (digits.startsWith('27') && digits.length === 11) digits = '0' + digits.slice(2);
  return digits;
}

function cellOk(digits) {
  return /^0\d{9}$/.test(digits);
}

function passwordProblem(pw) {
  const value = String(pw || '');
  if (value.length < 8) return 'Use a password of at least 8 characters.';
  const blocked = ['password', '12345678', 'password1', 'qwertyui', 'changeme'];
  if (blocked.indexOf(value.toLowerCase()) >= 0) return 'Choose a less common password.';
  return '';
}

const loginFails = new Map();

function tooManyTries(cell) {
  const row = loginFails.get(cell);
  if (!row) return false;
  if (Date.now() - row.start > 15 * 60 * 1000) {
    loginFails.delete(cell);
    return false;
  }
  return row.n >= 8;
}

function noteFail(cell) {
  const row = loginFails.get(cell);
  if (!row || Date.now() - row.start > 15 * 60 * 1000) loginFails.set(cell, { n: 1, start: Date.now() });
  else row.n += 1;
}

function clearFail(cell) {
  loginFails.delete(cell);
}

function issueSession(res, req, userId) {
  const token = setSession(res, userId);
  res.setHeader('Set-Cookie', cookieHeader(token, !!(req.socket && req.socket.encrypted)));
}

function notify(kind, body, orderId) {
  db.prepare('INSERT INTO notifications (kind, body, order_id, created_at) VALUES (?, ?, ?, ?)')
    .run(kind, body, orderId || null, new Date().toISOString());
}

function wasPrice(value, price) {
  if (value == null || value === '') return null;
  const n = Number(value);
  if (!Number.isFinite(n) || n <= Number(price)) return null;
  return Math.round(n * 100) / 100;
}

function saveDataImage(name, dataUrl) {
  const m = String(dataUrl || '').match(/^data:image\/(jpeg|jpg|png|webp);base64,(.+)$/);
  if (!m) return null;
  const ext = m[1] === 'png' ? 'png' : m[1] === 'webp' ? 'webp' : 'jpg';
  const buf = Buffer.from(m[2], 'base64');
  if (buf.length < 80 || buf.length > 2_400_000) return null;
  const dir = path.join(root, 'shared', 'img', 'uploads');
  fs.mkdirSync(dir, { recursive: true });
  const rel = '/shared/img/uploads/' + name + '.' + ext;
  fs.writeFileSync(path.join(root, rel.replace(/^\//, '')), buf);
  return rel;
}

function driverCard(row) {
  return {
    id: row.id,
    name: row.name,
    cell: row.cell,
    status: row.status || 'active',
    createdAt: row.created_at,
    idNumber: row.id_number || '',
    vehicleType: row.vehicle_type || '',
    vehicleReg: row.vehicle_reg || '',
    licenceNo: row.licence_no || '',
    bankName: row.bank_name || '',
    accountHolder: row.account_holder || '',
    accountNumber: row.account_number || '',
    branchCode: row.branch_code || '',
    photo: row.photo || '',
    licencePhoto: row.licence_photo || ''
  };
}

function clearCookie() {
  return 'sid=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0';
}

function placesFor(userId) {
  if (!userId) return [];
  return db.prepare('SELECT * FROM addresses WHERE user_id = ? ORDER BY is_default DESC, id DESC').all(userId).map(publicPlace);
}

function addressFor(userId) {
  const places = placesFor(userId);
  return places.find(function (place) { return place.isDefault; }) || places[0] || null;
}

function pinOk(lat, lng) {
  return Number.isFinite(lat) && Number.isFinite(lng) && lat >= -90 && lat <= 90 && lng >= -180 && lng <= 180 && Math.abs(lat) > 0.01;
}

function writePlace(userId, id, body) {
  const line = String(body.line || '').trim();
  const town = String(body.town || 'Kranskop').trim() || 'Kranskop';
  const label = String(body.label || 'Home').trim().slice(0, 24) || 'Home';
  const lat = Number(body.lat);
  const lng = Number(body.lng);
  if (line.length < 2) return { error: 'Add a landmark, like a gate colour or a shop nearby.' };
  if (!pinOk(lat, lng)) return { error: 'Drop a pin on the map, or use your current location.' };
  const makeDefault = body.isDefault !== false;
  if (makeDefault) db.prepare('UPDATE addresses SET is_default = 0 WHERE user_id = ?').run(userId);
  let placeId = id;
  if (placeId) {
    const own = db.prepare('SELECT id FROM addresses WHERE id = ? AND user_id = ?').get(placeId, userId);
    if (!own) return { error: 'That place is not on your profile.' };
    db.prepare('UPDATE addresses SET label = ?, line = ?, town = ?, lat = ?, lng = ?, is_default = ? WHERE id = ?')
      .run(label, line, town, lat, lng, makeDefault ? 1 : 0, placeId);
  } else {
    const same = db.prepare('SELECT id FROM addresses WHERE user_id = ? AND lower(label) = lower(?)').get(userId, label);
    if (same) {
      placeId = same.id;
      db.prepare('UPDATE addresses SET line = ?, town = ?, lat = ?, lng = ?, is_default = ? WHERE id = ?')
        .run(line, town, lat, lng, makeDefault ? 1 : 0, placeId);
    } else {
      const info = db.prepare('INSERT INTO addresses (user_id, line, town, label, lat, lng, is_default) VALUES (?, ?, ?, ?, ?, ?, ?)')
        .run(userId, line, town, label, lat, lng, makeDefault ? 1 : 0);
      placeId = Number(info.lastInsertRowid);
    }
  }
  return { place: publicPlace(db.prepare('SELECT * FROM addresses WHERE id = ?').get(placeId)) };
}

function safeFile(rel) {
  const file = path.resolve(root, rel);
  const diff = path.relative(root, file);
  if (diff.startsWith('..') || path.isAbsolute(diff)) return null;
  return file;
}

function serveFile(res, rel) {
  const file = safeFile(rel);
  if (!file || !fs.existsSync(file) || !fs.statSync(file).isFile()) {
    send(res, 404, 'Not found', { 'Content-Type': 'text/plain; charset=utf-8' });
    return;
  }
  const ext = path.extname(file).toLowerCase();
  const cache = ext === '.jpg' || ext === '.jpeg' || ext === '.png' ? 'public, max-age=86400' : 'no-store';
  send(res, 200, fs.readFileSync(file), {
    'Content-Type': types[ext] || 'application/octet-stream',
    'Cache-Control': cache
  });
}

function listProducts(url) {
  const cat = url.searchParams.get('cat') || '';
  const q = (url.searchParams.get('q') || '').trim().toLowerCase();
  const sort = url.searchParams.get('sort') || '';
  const includeHidden = url.searchParams.get('all') === '1';
  let rows = db.prepare('SELECT * FROM products').all();
  if (!includeHidden) rows = rows.filter(function (p) { return p.active; });
  if (cat) rows = rows.filter(function (p) { return p.category === cat; });
  if (q) rows = rows.filter(function (p) { return (p.name + ' ' + p.size).toLowerCase().indexOf(q) > -1; });
  if (sort === 'lo') rows.sort(function (a, b) { return a.price - b.price; });
  else if (sort === 'hi') rows.sort(function (a, b) { return b.price - a.price; });
  else if (sort === 'az') rows.sort(function (a, b) { return a.name.localeCompare(b.name); });
  else rows.sort(function (a, b) { return a.id - b.id; });
  return rows.map(publicProduct);
}

function orderBundle(order) {
  const items = db.prepare('SELECT product_id, name, size, qty, price FROM order_items WHERE order_id = ?').all(order.id);
  const driver = order.driver_id ? db.prepare('SELECT name FROM users WHERE id = ?').get(order.driver_id) : null;
  return {
    id: order.id,
    number: order.number,
    userId: order.user_id,
    name: order.name,
    cell: order.cell,
    mode: order.mode,
    address: order.address,
    town: order.town,
    lat: order.lat == null ? null : Number(order.lat),
    lng: order.lng == null ? null : Number(order.lng),
    placeLabel: order.place_label || '',
    slot: order.slot,
    payMethod: order.pay_method,
    fee: order.fee,
    subtotal: order.subtotal,
    total: order.total,
    status: order.status,
    createdAt: order.created_at,
    driverId: order.driver_id || null,
    driverName: driver ? driver.name : '',
    driverLat: order.driver_lat == null ? null : Number(order.driver_lat),
    driverLng: order.driver_lng == null ? null : Number(order.driver_lng),
    driverAt: order.driver_at || '',
    items: items
  };
}

function requireAdmin(res, user) {
  if (!user || user.role !== 'admin') {
    json(res, 401, { error: 'Shop staff sign-in required.' });
    return false;
  }
  return true;
}

function savePhoto(id, dataUrl) {
  const m = String(dataUrl || '').match(/^data:image\/(jpeg|jpg|png|webp);base64,(.+)$/);
  if (!m) return null;
  const ext = m[1] === 'png' ? 'png' : m[1] === 'webp' ? 'webp' : 'jpg';
  const buf = Buffer.from(m[2], 'base64');
  if (buf.length < 100 || buf.length > 1_800_000) return null;
  const dir = path.join(root, 'shared', 'img', 'uploads');
  fs.mkdirSync(dir, { recursive: true });
  const rel = '/shared/img/uploads/' + id + '.' + ext;
  fs.writeFileSync(path.join(root, rel.replace(/^\//, '')), buf);
  return rel;
}

function serveDist(res, pathname) {
  const rel = pathname === '/' ? 'index.html' : pathname.replace(/^\//, '');
  const file = path.resolve(dist, rel);
  const diff = path.relative(dist, file);
  if (diff.startsWith('..') || path.isAbsolute(diff)) return false;
  if (!fs.existsSync(file) || !fs.statSync(file).isFile()) return false;
  const ext = path.extname(file).toLowerCase();
  send(res, 200, fs.readFileSync(file), { 'Content-Type': types[ext] || 'application/octet-stream' });
  return true;
}

function phoneHost(req) {
  const host = String(req.headers.host || '').split(':')[0];
  if (!host || host === 'localhost' || host === '127.0.0.1' || host === '::1') return '';
  return host;
}

function redirectPhone(req, res) {
  if (process.env.NODE_ENV === 'production') return false;
  if (req.socket.encrypted) return false;
  const forwarded = String(req.headers['x-forwarded-proto'] || '').split(',')[0].trim();
  if (forwarded === 'https') return false;
  const host = phoneHost(req);
  if (!host) return false;
  res.writeHead(307, {
    Location: 'https://' + host + ':' + httpsPort + (req.url || '/'),
    'Cache-Control': 'no-store'
  });
  res.end();
  return true;
}

const server = http.createServer(async function (req, res) {
  try {
    if (redirectPhone(req, res)) return;
    const url = new URL(req.url, 'http://127.0.0.1');
    const pathname = decodeURIComponent(url.pathname);
    if (pathname.startsWith('/api/')) {
      await handleApi(req, res, url);
      return;
    }
    if (pathname.startsWith('/shared/')) {
      serveFile(res, pathname.slice(1));
      return;
    }
    if (serveDist(res, pathname)) return;
    const index = path.join(dist, 'index.html');
    if (fs.existsSync(index)) {
      send(res, 200, fs.readFileSync(index), { 'Content-Type': 'text/html; charset=utf-8' });
      return;
    }
    send(res, 503, 'Shop app is not built yet. From the client folder run: npm install && npm run build', { 'Content-Type': 'text/plain; charset=utf-8' });
  } catch (err) {
    console.error(err);
    if (!res.headersSent) json(res, 500, { error: 'Something went wrong on the shop server.' });
  }
});

async function handleApi(req, res, url) {
  const user = userFrom(req);
  const route = url.pathname.replace(/\/$/, '') || '/';
  const method = req.method;

  if (method === 'GET' && route === '/api/bootstrap') {
    return json(res, 200, {
      user: publicUser(user),
      address: addressFor(user && user.id),
      places: placesFor(user && user.id),
      categories: db.prepare('SELECT slug, name FROM categories ORDER BY sort').all(),
      settings: settingsMap(db),
      secureUrl: 'https://' + (phoneHost(req) || '127.0.0.1') + ':' + httpsPort
    });
  }

  if (method === 'GET' && route === '/api/products') {
    if (url.searchParams.get('all') === '1' && (!user || user.role !== 'admin')) {
      url.searchParams.delete('all');
    }
    return json(res, 200, { products: listProducts(url) });
  }

  const one = route.match(/^\/api\/products\/(\d+)$/);
  if (method === 'GET' && one) {
    const row = db.prepare('SELECT * FROM products WHERE id = ?').get(Number(one[1]));
    if (!row) return json(res, 404, { error: 'That product is not on the shelf.' });
    if (!row.active && (!user || user.role !== 'admin')) return json(res, 404, { error: 'That product is not on the shelf.' });
    const related = db.prepare('SELECT * FROM products WHERE category = ? AND id != ? AND active = 1 ORDER BY id LIMIT 8')
      .all(row.category, row.id).map(publicProduct);
    const cat = db.prepare('SELECT name FROM categories WHERE slug = ?').get(row.category);
    return json(res, 200, { product: publicProduct(row), related: related, categoryName: cat ? cat.name : row.category });
  }

  if (method === 'POST' && route === '/api/auth/signup') {
    const body = await readBody(req);
    const name = String(body.name || '').trim();
    const cell = normaliseCell(body.cell);
    const pass = String(body.password || '');
    if (name.length < 2) return json(res, 400, { error: 'Add your name and surname.' });
    if (!cellOk(cell)) return json(res, 400, { error: 'Enter a South African number, 10 digits starting with 0.' });
    const pwErr = passwordProblem(pass);
    if (pwErr) return json(res, 400, { error: pwErr });
    if (db.prepare('SELECT id FROM users WHERE cell = ?').get(cell)) {
      return json(res, 400, { error: 'That number already has an account. Sign in instead.' });
    }
    const info = db.prepare('INSERT INTO users (name, cell, password_hash, role, status, created_at) VALUES (?, ?, ?, ?, ?, ?)')
      .run(name, cell, hashPassword(pass), 'customer', 'active', new Date().toISOString());
    const id = Number(info.lastInsertRowid);
    issueSession(res, req, id);
    return json(res, 200, { user: publicUser(db.prepare('SELECT * FROM users WHERE id = ?').get(id)) });
  }

  if (method === 'POST' && route === '/api/auth/driver-signup') {
    const body = await readBody(req);
    const name = String(body.name || '').trim();
    const cell = normaliseCell(body.cell);
    const pass = String(body.password || '');
    const idNumber = String(body.idNumber || '').replace(/\D/g, '');
    const vehicleType = String(body.vehicleType || '').trim();
    const vehicleReg = String(body.vehicleReg || '').trim().toUpperCase();
    const licenceNo = String(body.licenceNo || '').trim();
    const vehicles = ['Car', 'Bakkie', 'Motorbike', 'Bicycle'];
    const bankName = String(body.bankName || '').trim();
    const accountHolder = String(body.accountHolder || '').trim();
    const accountNumber = String(body.accountNumber || '').replace(/\D/g, '');
    const branchCode = String(body.branchCode || '').replace(/\D/g, '');
    if (name.length < 2) return json(res, 400, { error: 'Add your name and surname.' });
    if (!cellOk(cell)) return json(res, 400, { error: 'Enter a South African cell number, 10 digits starting with 0.' });
    const pwErr = passwordProblem(pass);
    if (pwErr) return json(res, 400, { error: pwErr });
    if (!/^\d{13}$/.test(idNumber)) return json(res, 400, { error: 'Enter a 13-digit South African ID number.' });
    if (vehicles.indexOf(vehicleType) < 0) return json(res, 400, { error: 'Choose a vehicle type.' });
    if (vehicleReg.length < 2 || vehicleReg.length > 12) return json(res, 400, { error: 'Enter the vehicle registration.' });
    if (licenceNo.length < 4) return json(res, 400, { error: 'Enter the driver\'s licence number.' });
    const banking = bankName || accountHolder || accountNumber || branchCode;
    if (banking && (bankName.length < 2 || accountHolder.length < 2 || accountNumber.length < 6 || branchCode.length < 4)) {
      return json(res, 400, { error: 'Add the bank, account holder, account number and branch code, or leave banking blank.' });
    }
    if (db.prepare('SELECT id FROM users WHERE cell = ?').get(cell)) {
      return json(res, 400, { error: 'That number already has an account. Sign in instead.' });
    }
    const info = db.prepare(`INSERT INTO users
      (name, cell, password_hash, role, status, created_at, id_number, vehicle_type, vehicle_reg, licence_no, bank_name, account_holder, account_number, branch_code)
      VALUES (?, ?, ?, 'driver', 'pending', ?, ?, ?, ?, ?, ?, ?, ?, ?)`)
      .run(name, cell, hashPassword(pass), new Date().toISOString(), idNumber, vehicleType, vehicleReg, licenceNo, bankName, accountHolder, accountNumber, branchCode);
    const id = Number(info.lastInsertRowid);
    const photo = body.photo ? saveDataImage('driver-' + id + '-photo', body.photo) : null;
    const licencePhoto = body.licencePhoto ? saveDataImage('driver-' + id + '-licence', body.licencePhoto) : null;
    if (photo || licencePhoto) {
      db.prepare('UPDATE users SET photo = COALESCE(?, photo), licence_photo = COALESCE(?, licence_photo) WHERE id = ?')
        .run(photo, licencePhoto, id);
    }
    notify('driver', name + ' applied to drive. Cell ' + cell + '.', null);
    issueSession(res, req, id);
    return json(res, 200, { user: publicUser(db.prepare('SELECT * FROM users WHERE id = ?').get(id)) });
  }

  if (method === 'POST' && route === '/api/auth/forgot') {
    const body = await readBody(req);
    const cell = normaliseCell(body.cell);
    const message = 'If that number has an account, ask the shop to read you the reset code. It expires in 30 minutes.';
    if (!cellOk(cell)) return json(res, 400, { error: 'Enter the 10-digit number on the account.' });
    const person = db.prepare('SELECT id FROM users WHERE cell = ?').get(cell);
    if (person) {
      const hourAgo = new Date(Date.now() - 60 * 60 * 1000).toISOString();
      const recent = db.prepare('SELECT COUNT(*) AS n FROM password_resets WHERE cell = ? AND created_at > ?').get(cell, hourAgo).n;
      if (recent >= 3) return json(res, 429, { error: 'Too many reset requests. Wait an hour, or call the shop.' });
      const code = String(Math.floor(100000 + Math.random() * 900000));
      const now = new Date().toISOString();
      db.prepare('UPDATE password_resets SET used = 1 WHERE cell = ? AND used = 0').run(cell);
      db.prepare('INSERT INTO password_resets (cell, code, expires_at, created_at, used) VALUES (?, ?, ?, ?, 0)')
        .run(cell, code, new Date(Date.now() + 30 * 60 * 1000).toISOString(), now);
      notify('reset', 'Password reset code for ' + cell + '.', null);
    }
    return json(res, 200, { ok: true, message: message });
  }

  if (method === 'POST' && route === '/api/auth/reset') {
    const body = await readBody(req);
    const cell = normaliseCell(body.cell);
    const code = String(body.code || '').replace(/\D/g, '');
    const pass = String(body.password || '');
    if (!cellOk(cell) || code.length !== 6) return json(res, 400, { error: 'Enter the cell number and the 6-digit code from the shop.' });
    const pwErr = passwordProblem(pass);
    if (pwErr) return json(res, 400, { error: pwErr });
    const row = db.prepare('SELECT * FROM password_resets WHERE cell = ? AND code = ? AND used = 0 ORDER BY id DESC LIMIT 1').get(cell, code);
    if (!row || Date.parse(row.expires_at) < Date.now()) return json(res, 400, { error: 'That code is wrong or it has expired. Ask the shop for a new one.' });
    const person = db.prepare('SELECT id FROM users WHERE cell = ?').get(cell);
    if (!person) return json(res, 400, { error: 'That code is wrong or it has expired. Ask the shop for a new one.' });
    db.prepare('UPDATE users SET password_hash = ? WHERE id = ?').run(hashPassword(pass), person.id);
    db.prepare('UPDATE password_resets SET used = 1 WHERE id = ?').run(row.id);
    db.prepare('DELETE FROM sessions WHERE user_id = ?').run(person.id);
    return json(res, 200, { ok: true });
  }

  if (method === 'POST' && route === '/api/auth/login') {
    const body = await readBody(req);
    const cell = normaliseCell(body.cell);
    const pass = String(body.password || '');
    if (tooManyTries(cell)) return json(res, 429, { error: 'Too many tries. Wait 15 minutes, or ask the shop to reset the password.' });
    const row = db.prepare('SELECT * FROM users WHERE cell = ?').get(cell);
    if (!row || !checkPassword(pass, row.password_hash)) {
      noteFail(cell);
      return json(res, 400, { error: 'That number and password do not match.' });
    }
    if (row.status === 'suspended') return json(res, 403, { error: 'This account is suspended. Call the shop.' });
    clearFail(cell);
    issueSession(res, req, row.id);
    return json(res, 200, { user: publicUser(row) });
  }

  if (method === 'POST' && route === '/api/auth/logout') {
    const token = cookies(req).sid;
    if (token) db.prepare('DELETE FROM sessions WHERE token = ?').run(token);
    res.setHeader('Set-Cookie', clearCookie());
    return json(res, 200, { ok: true });
  }

  if (method === 'GET' && route === '/api/me/places') {
    if (!user) return json(res, 401, { error: 'Sign in to see your saved places.' });
    return json(res, 200, { places: placesFor(user.id), address: addressFor(user.id) });
  }

  if (method === 'POST' && route === '/api/me/places') {
    if (!user) return json(res, 401, { error: 'Sign in to save a place on your profile.' });
    const body = await readBody(req);
    const saved = writePlace(user.id, null, body);
    if (saved.error) return json(res, 400, saved);
    return json(res, 200, { place: saved.place, places: placesFor(user.id), address: addressFor(user.id) });
  }

  const placeEdit = route.match(/^\/api\/me\/places\/(\d+)$/);
  if (placeEdit && (method === 'PUT' || method === 'DELETE')) {
    if (!user) return json(res, 401, { error: 'Sign in to change a saved place.' });
    const id = Number(placeEdit[1]);
    const row = db.prepare('SELECT * FROM addresses WHERE id = ? AND user_id = ?').get(id, user.id);
    if (!row) return json(res, 404, { error: 'That place is not on your profile.' });
    if (method === 'DELETE') {
      db.prepare('DELETE FROM addresses WHERE id = ?').run(id);
      const left = addressFor(user.id);
      if (left && !left.isDefault) db.prepare('UPDATE addresses SET is_default = 1 WHERE id = ?').run(left.id);
      return json(res, 200, { places: placesFor(user.id), address: addressFor(user.id) });
    }
    const body = await readBody(req);
    const saved = writePlace(user.id, id, body);
    if (saved.error) return json(res, 400, saved);
    return json(res, 200, { place: saved.place, places: placesFor(user.id), address: addressFor(user.id) });
  }

  if (method === 'PUT' && route === '/api/me/address') {
    if (!user) return json(res, 401, { error: 'Sign in to save an address on your account.' });
    const body = await readBody(req);
    const current = addressFor(user.id);
    const saved = writePlace(user.id, current && current.id, Object.assign({ isDefault: true }, body));
    if (saved.error) return json(res, 400, saved);
    return json(res, 200, { address: saved.place, places: placesFor(user.id) });
  }

  if (method === 'POST' && route === '/api/orders') {
    const body = await readBody(req);
    const name = String(body.name || (user && user.name) || '').trim();
    const cell = normaliseCell(body.cell || (user && user.cell) || '');
    const mode = body.mode === 'collect' ? 'collect' : 'delivery';
    const line = String(body.address || '').trim();
    const town = String(body.town || 'Kranskop').trim() || 'Kranskop';
    const lat = Number(body.lat);
    const lng = Number(body.lng);
    const placeLabel = String(body.placeLabel || '').trim().slice(0, 24);
    const slot = String(body.slot || 'Today, 2 pm to 5 pm');
    const pay = body.payMethod === 'card' ? 'card' : 'cash';
    const items = Array.isArray(body.items) ? body.items : [];
    if (name.length < 2 || !cellOk(cell)) return json(res, 400, { error: 'Add your name and a 10-digit phone number.' });
    if (mode === 'delivery' && line.length < 2) return json(res, 400, { error: 'Add a landmark so the driver knows the gate.' });
    if (mode === 'delivery' && !pinOk(lat, lng)) return json(res, 400, { error: 'Drop a pin, or use your current location, so the driver can find you.' });
    if (!items.length) return json(res, 400, { error: 'Your basket is empty.' });

    const settings = settingsMap(db);
    const lines = [];
    let subtotal = 0;
    for (const raw of items) {
      const qty = Math.floor(Number(raw.qty));
      const id = Number(raw.id);
      if (!qty || qty < 1 || qty > 99) return json(res, 400, { error: 'Check the quantities in your basket.' });
      const product = db.prepare('SELECT * FROM products WHERE id = ? AND active = 1').get(id);
      if (!product) return json(res, 400, { error: 'A product in your basket is no longer on the shelf.' });
      if (product.stock < qty) return json(res, 400, { error: product.name + ' only has ' + product.stock + ' left.' });
      lines.push({ product: product, qty: qty });
      subtotal += product.price * qty;
    }
    subtotal = Math.round(subtotal * 100) / 100;
    if (mode === 'delivery' && subtotal < settings.min_delivery) {
      return json(res, 400, { error: 'Delivery orders start at R' + settings.min_delivery.toFixed(2) + '. Add more, or collect at the shop.' });
    }
    const fee = mode === 'delivery' && subtotal < settings.free_over ? settings.fee : 0;
    const total = Math.round((subtotal + fee) * 100) / 100;
    const number = 'SYA-' + Math.floor(1000 + Math.random() * 9000);
    const now = new Date().toISOString();

    db.exec('BEGIN');
    try {
      for (const lineItem of lines) {
        const changed = db.prepare('UPDATE products SET stock = stock - ? WHERE id = ? AND stock >= ?').run(lineItem.qty, lineItem.product.id, lineItem.qty);
        if (!changed.changes) throw new Error(lineItem.product.name + ' just sold out.');
      }
      const info = db.prepare(`INSERT INTO orders
        (number, user_id, name, cell, mode, address, town, lat, lng, place_label, slot, pay_method, fee, subtotal, total, status, created_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'new', ?)`).run(
        number, user ? user.id : null, name, cell, mode,
        mode === 'delivery' ? line : '', town,
        mode === 'delivery' ? lat : null, mode === 'delivery' ? lng : null,
        mode === 'delivery' ? placeLabel : '',
        slot, pay, fee, subtotal, total, now
      );
      const orderId = Number(info.lastInsertRowid);
      const addItem = db.prepare('INSERT INTO order_items (order_id, product_id, name, size, qty, price) VALUES (?, ?, ?, ?, ?, ?)');
      lines.forEach(function (lineItem) {
        addItem.run(orderId, lineItem.product.id, lineItem.product.name, lineItem.product.size, lineItem.qty, lineItem.product.price);
      });
      if (user && mode === 'delivery' && body.savePlace) {
        writePlace(user.id, body.placeId || null, {
          label: placeLabel || 'Home', line: line, town: town, lat: lat, lng: lng, isDefault: true
        });
      }
      db.exec('COMMIT');
      notify('order', name + ' placed ' + number + '.', orderId);
      const order = db.prepare('SELECT * FROM orders WHERE id = ?').get(orderId);
      return json(res, 200, { order: orderBundle(order) });
    } catch (err) {
      db.exec('ROLLBACK');
      return json(res, 400, { error: err.message || 'Could not place the order.' });
    }
  }

  const mine = route.match(/^\/api\/orders\/([^/]+)$/);
  if (method === 'GET' && mine && mine[1] !== 'mine') {
    const order = db.prepare('SELECT * FROM orders WHERE number = ?').get(mine[1]);
    if (!order) return json(res, 404, { error: 'No order with that number.' });
    const staff = user && user.role === 'admin';
    const owner = user && order.user_id === user.id;
    if (!staff && !owner) return json(res, 401, { error: 'Sign in with the account that placed this order.' });
    return json(res, 200, { order: orderBundle(order) });
  }

  if (method === 'GET' && route === '/api/orders/mine') {
    if (!user) return json(res, 401, { error: 'Sign in to see your orders.' });
    const rows = db.prepare('SELECT * FROM orders WHERE user_id = ? ORDER BY id DESC').all(user.id);
    return json(res, 200, { orders: rows.map(orderBundle) });
  }

  if (route.startsWith('/api/driver/')) {
    if (!user || user.role !== 'driver') {
      json(res, 401, { error: 'Driver sign-in required.' });
      return;
    }
    if (user.status === 'suspended') {
      json(res, 403, { error: 'This driver account is suspended.' });
      return;
    }
    if ((user.status || 'active') !== 'active') {
      json(res, 403, { error: 'The shop still needs to approve your account.' });
      return;
    }
  }

  if (method === 'GET' && route === '/api/driver/available') {
    const rows = db.prepare("SELECT * FROM orders WHERE mode = 'delivery' AND driver_id IS NULL AND status IN ('new','accepted','picking') ORDER BY id DESC").all();
    return json(res, 200, { orders: rows.map(orderBundle) });
  }

  if (method === 'GET' && route === '/api/driver/earnings') {
    const settings = settingsMap(db);
    const pay = Number(settings.driver_pay || 0);
    const rows = db.prepare("SELECT * FROM orders WHERE driver_id = ? AND status = 'delivered' ORDER BY id DESC").all();
    return json(res, 200, {
      pay: pay,
      total: Math.round(rows.length * pay * 100) / 100,
      drops: rows.map(function (order) {
        return { id: order.id, number: order.number, at: order.created_at, amount: pay, address: order.address };
      })
    });
  }

  const acceptOrder = route.match(/^\/api\/driver\/orders\/(\d+)\/accept$/);
  if (method === 'POST' && acceptOrder) {
    const order = db.prepare('SELECT * FROM orders WHERE id = ?').get(Number(acceptOrder[1]));
    if (!order || order.mode !== 'delivery') return json(res, 404, { error: 'That delivery is not available.' });
    if (order.driver_id) return json(res, 409, { error: 'Another driver already took this order.' });
    if (['cancelled', 'delivered', 'collected'].indexOf(order.status) >= 0) return json(res, 400, { error: 'That order is already finished.' });
    const next = order.status === 'new' ? 'accepted' : order.status;
    db.prepare('UPDATE orders SET driver_id = ?, status = ? WHERE id = ? AND driver_id IS NULL').run(user.id, next, order.id);
    const saved = db.prepare('SELECT * FROM orders WHERE id = ?').get(order.id);
    if (saved.driver_id !== user.id) return json(res, 409, { error: 'Another driver already took this order.' });
    return json(res, 200, { order: orderBundle(saved) });
  }

  if (method === 'GET' && route === '/api/driver/orders') {
    const settings = settingsMap(db);
    const rows = db.prepare("SELECT * FROM orders WHERE driver_id = ? AND mode = 'delivery' AND status != 'cancelled' ORDER BY id DESC").all(user.id);
    return json(res, 200, {
      orders: rows.map(orderBundle),
      shop: { lat: settings.shop_lat, lng: settings.shop_lng, name: settings.shop_name, address: settings.address }
    });
  }

  const driverOrder = route.match(/^\/api\/driver\/orders\/(\d+)$/);
  if (method === 'PATCH' && driverOrder) {
    const body = await readBody(req);
    const allowed = ['picking', 'out', 'delivered'];
    if (allowed.indexOf(body.status) < 0) return json(res, 400, { error: 'Mark the stop as picking, out, or delivered.' });
    const order = db.prepare('SELECT * FROM orders WHERE id = ? AND driver_id = ?').get(Number(driverOrder[1]), user.id);
    if (!order) return json(res, 404, { error: 'That stop is not on your list.' });
    db.prepare('UPDATE orders SET status = ? WHERE id = ?').run(body.status, order.id);
    return json(res, 200, { order: orderBundle(db.prepare('SELECT * FROM orders WHERE id = ?').get(order.id)) });
  }

  if (method === 'POST' && route === '/api/driver/location') {
    const body = await readBody(req);
    const lat = Number(body.lat);
    const lng = Number(body.lng);
    if (!pinOk(lat, lng)) return json(res, 400, { error: 'The phone did not share a location.' });
    const order = db.prepare('SELECT * FROM orders WHERE id = ? AND driver_id = ?').get(Number(body.orderId), user.id);
    if (!order) return json(res, 404, { error: 'That stop is not on your list.' });
    if (order.status !== 'out') return json(res, 400, { error: 'Share location once the stop is out for delivery.' });
    const at = new Date().toISOString();
    db.prepare('UPDATE orders SET driver_lat = ?, driver_lng = ?, driver_at = ? WHERE id = ?').run(lat, lng, at, order.id);
    return json(res, 200, { lat: lat, lng: lng, at: at });
  }

  if (route.startsWith('/api/admin/')) {
    if (!requireAdmin(res, user)) return;
  }

  if (method === 'GET' && route === '/api/admin/summary') {
    const today = new Date().toISOString().slice(0, 10);
    const orders = db.prepare('SELECT * FROM orders ORDER BY id DESC LIMIT 12').all().map(orderBundle);
    const open = db.prepare("SELECT COUNT(*) AS n FROM orders WHERE status IN ('new','accepted','picking','out','ready')").get().n;
    const dayCount = db.prepare('SELECT COUNT(*) AS n FROM orders WHERE created_at LIKE ?').get(today + '%').n;
    const low = db.prepare('SELECT id, name, stock FROM products WHERE active = 1 AND stock <= 5 ORDER BY stock, name').all();
    const dayRows = db.prepare('SELECT total, status FROM orders WHERE created_at LIKE ?').all(today + '%');
    const revenue = dayRows.reduce(function (n, row) { return row.status === 'cancelled' ? n : n + Number(row.total || 0); }, 0);
    const unread = db.prepare('SELECT COUNT(*) AS n FROM notifications WHERE read_at IS NULL').get().n;
    const notes = db.prepare('SELECT id, kind, body, order_id, created_at, read_at FROM notifications ORDER BY id DESC LIMIT 8').all();
    const resets = db.prepare(`SELECT r.id, r.cell, r.code, r.expires_at, u.name
      FROM password_resets r LEFT JOIN users u ON u.cell = r.cell
      WHERE r.used = 0 AND r.expires_at > ? ORDER BY r.id DESC`).all(new Date().toISOString());
    return json(res, 200, {
      open: open,
      today: dayCount,
      revenue: Math.round(revenue * 100) / 100,
      orders: orders,
      low: low,
      unread: unread,
      notes: notes,
      resets: resets
    });
  }

  if (method === 'GET' && route === '/api/admin/orders') {
    const status = url.searchParams.get('status') || '';
    let rows = db.prepare('SELECT * FROM orders ORDER BY id DESC').all();
    if (status) rows = rows.filter(function (o) { return o.status === status; });
    return json(res, 200, { orders: rows.map(orderBundle) });
  }

  const statusRoute = route.match(/^\/api\/admin\/orders\/(\d+)$/);
  if (method === 'PATCH' && statusRoute) {
    const body = await readBody(req);
    const allowed = ['new', 'accepted', 'picking', 'out', 'ready', 'delivered', 'collected', 'cancelled'];
    const changingStatus = body.status != null && body.status !== '';
    if (changingStatus && allowed.indexOf(body.status) < 0) return json(res, 400, { error: 'Unknown order status.' });
    if (!changingStatus && body.driverId === undefined) return json(res, 400, { error: 'Nothing to update on this order.' });
    const order = db.prepare('SELECT * FROM orders WHERE id = ?').get(Number(statusRoute[1]));
    if (!order) return json(res, 404, { error: 'Order not found.' });
    if (body.driverId !== undefined) {
      const driverId = Number(body.driverId);
      if (!driverId) {
        db.prepare('UPDATE orders SET driver_id = NULL WHERE id = ?').run(order.id);
      } else {
        const driver = db.prepare("SELECT id, status FROM users WHERE id = ? AND role = 'driver'").get(driverId);
        if (!driver) return json(res, 400, { error: 'Choose a driver account.' });
        if ((driver.status || 'active') !== 'active') return json(res, 400, { error: 'Approve that driver before assigning deliveries.' });
        db.prepare('UPDATE orders SET driver_id = ? WHERE id = ?').run(driver.id, order.id);
      }
    }
    if (!changingStatus) {
      return json(res, 200, { order: orderBundle(db.prepare('SELECT * FROM orders WHERE id = ?').get(order.id)) });
    }
    if (body.status === 'cancelled' && order.status !== 'cancelled') {
      const items = db.prepare('SELECT product_id, qty FROM order_items WHERE order_id = ?').all(order.id);
      db.exec('BEGIN');
      items.forEach(function (item) {
        if (item.product_id) db.prepare('UPDATE products SET stock = stock + ? WHERE id = ?').run(item.qty, item.product_id);
      });
      db.prepare('UPDATE orders SET status = ? WHERE id = ?').run('cancelled', order.id);
      db.exec('COMMIT');
    } else {
      db.prepare('UPDATE orders SET status = ? WHERE id = ?').run(body.status, order.id);
    }
    return json(res, 200, { order: orderBundle(db.prepare('SELECT * FROM orders WHERE id = ?').get(order.id)) });
  }

  if (method === 'POST' && route === '/api/admin/products') {
    const body = await readBody(req);
    const name = String(body.name || '').trim();
    const size = String(body.size || '').trim();
    const price = Number(body.price);
    const category = String(body.category || '').trim();
    const stock = Math.max(0, Math.floor(Number(body.stock || 0)));
    if (name.length < 2 || !size || !(price >= 0) || !db.prepare('SELECT slug FROM categories WHERE slug = ?').get(category)) {
      return json(res, 400, { error: 'Name, pack size, price and department are required.' });
    }
    const was = wasPrice(body.compareAt, price);
    const info = db.prepare(`INSERT INTO products (name, size, price, compare_at, category, stock, photo, active, items, blurb)
      VALUES (?, ?, ?, ?, ?, ?, NULL, 1, ?, ?)`).run(name, size, price, was, category, stock, null, 'Added by the shop.');
    const id = Number(info.lastInsertRowid);
    const photo = body.photo ? savePhoto(id, body.photo) : null;
    if (photo) db.prepare('UPDATE products SET photo = ? WHERE id = ?').run(photo, id);
    return json(res, 200, { product: publicProduct(db.prepare('SELECT * FROM products WHERE id = ?').get(id)) });
  }

  const edit = route.match(/^\/api\/admin\/products\/(\d+)$/);
  if (method === 'PUT' && edit) {
    const body = await readBody(req);
    const id = Number(edit[1]);
    const row = db.prepare('SELECT * FROM products WHERE id = ?').get(id);
    if (!row) return json(res, 404, { error: 'Product not found.' });
    const name = String(body.name || row.name).trim();
    const size = String(body.size || row.size).trim();
    const price = body.price == null ? row.price : Number(body.price);
    const category = String(body.category || row.category);
    const stock = body.stock == null ? row.stock : Math.max(0, Math.floor(Number(body.stock)));
    const active = body.active == null ? row.active : (body.active ? 1 : 0);
    if (!db.prepare('SELECT slug FROM categories WHERE slug = ?').get(category)) {
      return json(res, 400, { error: 'Pick a department that exists.' });
    }
    let photo = row.photo;
    if (body.photo) photo = savePhoto(id, body.photo) || photo;
    const was = body.compareAt === undefined ? row.compare_at : wasPrice(body.compareAt, price);
    db.prepare('UPDATE products SET name=?, size=?, price=?, compare_at=?, category=?, stock=?, active=?, photo=? WHERE id=?')
      .run(name, size, price, was, category, stock, active, photo, id);
    return json(res, 200, { product: publicProduct(db.prepare('SELECT * FROM products WHERE id = ?').get(id)) });
  }

  if (method === 'DELETE' && edit) {
    const id = Number(edit[1]);
    const row = db.prepare('SELECT id FROM products WHERE id = ?').get(id);
    if (!row) return json(res, 404, { error: 'Product not found.' });
    const used = db.prepare('SELECT COUNT(*) AS n FROM order_items WHERE product_id = ?').get(id).n;
    if (used) {
      db.prepare('UPDATE products SET active = 0 WHERE id = ?').run(id);
      return json(res, 200, { hidden: true });
    }
    db.prepare('DELETE FROM products WHERE id = ?').run(id);
    return json(res, 200, { deleted: true });
  }

  if (method === 'POST' && route === '/api/admin/categories') {
    const body = await readBody(req);
    const name = String(body.name || '').trim();
    if (name.length < 2) return json(res, 400, { error: 'Add a department name.' });
    let slug = name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 24);
    if (!slug) return json(res, 400, { error: 'Use a name with letters.' });
    if (db.prepare('SELECT slug FROM categories WHERE slug = ?').get(slug)) slug = slug + '-' + Date.now().toString().slice(-4);
    const sort = db.prepare('SELECT COALESCE(MAX(sort), 0) + 1 AS n FROM categories').get().n;
    db.prepare('INSERT INTO categories (slug, name, sort) VALUES (?, ?, ?)').run(slug, name, sort);
    return json(res, 200, { category: { slug: slug, name: name } });
  }

  if (method === 'GET' && route === '/api/admin/drivers') {
    const drivers = db.prepare("SELECT * FROM users WHERE role = 'driver' ORDER BY CASE status WHEN 'pending' THEN 0 WHEN 'active' THEN 1 ELSE 2 END, name").all();
    return json(res, 200, { drivers: drivers.map(driverCard) });
  }

  const driverStatus = route.match(/^\/api\/admin\/drivers\/(\d+)$/);
  if (method === 'PATCH' && driverStatus) {
    const body = await readBody(req);
    const status = String(body.status || '');
    if (['pending', 'active', 'suspended'].indexOf(status) < 0) return json(res, 400, { error: 'Choose pending, active, or suspended.' });
    const row = db.prepare("SELECT * FROM users WHERE id = ? AND role = 'driver'").get(Number(driverStatus[1]));
    if (!row) return json(res, 404, { error: 'Driver not found.' });
    db.prepare('UPDATE users SET status = ? WHERE id = ?').run(status, row.id);
    if (status !== 'active') db.prepare('DELETE FROM sessions WHERE user_id = ?').run(row.id);
    return json(res, 200, { driver: driverCard(db.prepare('SELECT * FROM users WHERE id = ?').get(row.id)) });
  }

  if (method === 'POST' && route === '/api/admin/drivers') {
    const body = await readBody(req);
    const name = String(body.name || '').trim();
    const cell = normaliseCell(body.cell);
    const pass = String(body.password || '');
    if (name.length < 2) return json(res, 400, { error: 'Add the driver’s name.' });
    if (!cellOk(cell)) return json(res, 400, { error: 'Enter a 10-digit cell number.' });
    const pwErr = passwordProblem(pass);
    if (pwErr) return json(res, 400, { error: pwErr });
    if (db.prepare('SELECT id FROM users WHERE cell = ?').get(cell)) {
      return json(res, 400, { error: 'That cell number already has an account.' });
    }
    const info = db.prepare('INSERT INTO users (name, cell, password_hash, role, status, created_at) VALUES (?, ?, ?, ?, ?, ?)')
      .run(name, cell, hashPassword(pass), 'driver', 'active', new Date().toISOString());
    const row = db.prepare('SELECT * FROM users WHERE id = ?').get(Number(info.lastInsertRowid));
    return json(res, 200, { driver: driverCard(row) });
  }

  if (method === 'GET' && route === '/api/admin/customers') {
    const people = db.prepare("SELECT id, name, cell, created_at FROM users WHERE role = 'customer' ORDER BY id DESC").all();
    const withMeta = people.map(function (person) {
      const places = placesFor(person.id);
      const count = db.prepare('SELECT COUNT(*) AS n FROM orders WHERE user_id = ?').get(person.id).n;
      return { id: person.id, name: person.name, cell: person.cell, createdAt: person.created_at, address: addressFor(person.id), places: places, orders: count };
    });
    return json(res, 200, { customers: withMeta });
  }

  if (method === 'GET' && route === '/api/admin/settings') {
    return json(res, 200, { settings: settingsMap(db) });
  }

  if (method === 'PUT' && route === '/api/admin/settings') {
    const body = await readBody(req);
    const keys = ['fee', 'free_over', 'min_delivery', 'phone', 'fax', 'address', 'shop_name', 'town', 'shop_lat', 'shop_lng', 'hours', 'delivery_areas', 'driver_pay'];
    const put = db.prepare('INSERT INTO settings (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value');
    keys.forEach(function (key) {
      if (body[key] != null) put.run(key, String(body[key]).trim());
    });
    return json(res, 200, { settings: settingsMap(db) });
  }

  if (method === 'POST' && route === '/api/admin/notifications/read') {
    db.prepare('UPDATE notifications SET read_at = ? WHERE read_at IS NULL').run(new Date().toISOString());
    return json(res, 200, { ok: true });
  }

  if (method === 'PUT' && route === '/api/admin/password') {
    const body = await readBody(req);
    const next = String(body.password || '');
    const pwErr = passwordProblem(next);
    if (pwErr) return json(res, 400, { error: pwErr });
    db.prepare('UPDATE users SET password_hash = ? WHERE id = ?').run(hashPassword(next), user.id);
    return json(res, 200, { ok: true });
  }

  return json(res, 404, { error: 'No such shop request.' });
}

let deviceCert = null;
try {
  deviceCert = ensureCert(path.join(root, 'data', 'certs'));
} catch (err) {
  console.error('Phone HTTPS certificate was not created.', err.message);
}

server.listen(port, function () {
  console.log('Siyabonga shop at http://127.0.0.1:' + port);
});

if (deviceCert) {
  https.createServer({
    pfx: fs.readFileSync(deviceCert.pfx),
    passphrase: deviceCert.passphrase
  }, server.listeners('request')[0]).listen(httpsPort, function () {
    deviceCert.ips.forEach(function (ip) {
      if (ip === '127.0.0.1') return;
      console.log('Phone shop at https://' + ip + ':' + httpsPort);
    });
  });
}
