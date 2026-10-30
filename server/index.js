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
      if (size > 2_500_000) {
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
  const row = db.prepare(`SELECT u.* FROM sessions s JOIN users u ON u.id = s.user_id WHERE s.token = ?`).get(token);
  return row || null;
}

function setSession(res, userId) {
  const token = randomBytes(24).toString('hex');
  db.prepare('INSERT INTO sessions (token, user_id, created_at) VALUES (?, ?, ?)').run(token, userId, new Date().toISOString());
  return token;
}

function cookieHeader(token) {
  const bits = ['sid=' + token, 'Path=/', 'HttpOnly', 'SameSite=Lax', 'Max-Age=2592000'];
  return bits.join('; ');
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
  if (req.socket.encrypted) return false;
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
    const cell = String(body.cell || '').replace(/\s/g, '');
    const pass = String(body.password || '');
    if (name.length < 2) return json(res, 400, { error: 'Add your name.' });
    if (cell.length < 10) return json(res, 400, { error: 'Enter a cell number we can message.' });
    if (pass.length < 4) return json(res, 400, { error: 'Use a password of at least 4 characters.' });
    if (db.prepare('SELECT id FROM users WHERE cell = ?').get(cell)) {
      return json(res, 400, { error: 'That cell number already has an account. Sign in instead.' });
    }
    const info = db.prepare('INSERT INTO users (name, cell, password_hash, role, created_at) VALUES (?, ?, ?, ?, ?)')
      .run(name, cell, hashPassword(pass), 'customer', new Date().toISOString());
    const id = Number(info.lastInsertRowid);
    const token = setSession(res, id);
    res.setHeader('Set-Cookie', cookieHeader(token));
    return json(res, 200, { user: publicUser(db.prepare('SELECT * FROM users WHERE id = ?').get(id)) });
  }

  if (method === 'POST' && route === '/api/auth/login') {
    const body = await readBody(req);
    const cell = String(body.cell || '').replace(/\s/g, '');
    const pass = String(body.password || '');
    const row = db.prepare('SELECT * FROM users WHERE cell = ?').get(cell);
    if (!row || !checkPassword(pass, row.password_hash)) {
      return json(res, 400, { error: 'That cell number and password do not match.' });
    }
    const token = setSession(res, row.id);
    res.setHeader('Set-Cookie', cookieHeader(token));
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
    const cell = String(body.cell || (user && user.cell) || '').replace(/\s/g, '');
    const mode = body.mode === 'collect' ? 'collect' : 'delivery';
    const line = String(body.address || '').trim();
    const town = String(body.town || 'Kranskop').trim() || 'Kranskop';
    const lat = Number(body.lat);
    const lng = Number(body.lng);
    const placeLabel = String(body.placeLabel || '').trim().slice(0, 24);
    const slot = String(body.slot || 'Today, 2 pm to 5 pm');
    const pay = body.payMethod === 'card' ? 'card' : 'cash';
    const items = Array.isArray(body.items) ? body.items : [];
    if (name.length < 2 || cell.length < 10) return json(res, 400, { error: 'Add your name and cell number.' });
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
    return json(res, 200, { open: open, today: dayCount, orders: orders, low: low });
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
        const driver = db.prepare("SELECT id FROM users WHERE id = ? AND role = 'driver'").get(driverId);
        if (!driver) return json(res, 400, { error: 'Choose a driver account.' });
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
    const info = db.prepare(`INSERT INTO products (name, size, price, category, stock, photo, active, items, blurb)
      VALUES (?, ?, ?, ?, ?, NULL, 1, ?, ?)`).run(name, size, price, category, stock, null, 'Added by the shop.');
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
    db.prepare('UPDATE products SET name=?, size=?, price=?, category=?, stock=?, active=?, photo=? WHERE id=?')
      .run(name, size, price, category, stock, active, photo, id);
    return json(res, 200, { product: publicProduct(db.prepare('SELECT * FROM products WHERE id = ?').get(id)) });
  }

  if (method === 'GET' && route === '/api/admin/drivers') {
    const drivers = db.prepare("SELECT id, name, cell, created_at FROM users WHERE role = 'driver' ORDER BY name").all();
    return json(res, 200, { drivers: drivers.map(function (d) { return { id: d.id, name: d.name, cell: d.cell, createdAt: d.created_at }; }) });
  }

  if (method === 'POST' && route === '/api/admin/drivers') {
    const body = await readBody(req);
    const name = String(body.name || '').trim();
    const cell = String(body.cell || '').replace(/\s/g, '');
    const pass = String(body.password || '');
    if (name.length < 2) return json(res, 400, { error: 'Add the driver’s name.' });
    if (cell.length < 10) return json(res, 400, { error: 'Enter the driver’s cell number.' });
    if (pass.length < 4) return json(res, 400, { error: 'Use a password of at least 4 characters.' });
    if (db.prepare('SELECT id FROM users WHERE cell = ?').get(cell)) {
      return json(res, 400, { error: 'That cell number already has an account.' });
    }
    const info = db.prepare('INSERT INTO users (name, cell, password_hash, role, created_at) VALUES (?, ?, ?, ?, ?)')
      .run(name, cell, hashPassword(pass), 'driver', new Date().toISOString());
    const row = db.prepare('SELECT id, name, cell, created_at FROM users WHERE id = ?').get(Number(info.lastInsertRowid));
    return json(res, 200, { driver: { id: row.id, name: row.name, cell: row.cell, createdAt: row.created_at } });
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
    const keys = ['fee', 'free_over', 'min_delivery', 'phone', 'fax', 'address', 'shop_name', 'town', 'shop_lat', 'shop_lng'];
    const put = db.prepare('INSERT INTO settings (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value');
    keys.forEach(function (key) {
      if (body[key] != null) put.run(key, String(body[key]).trim());
    });
    return json(res, 200, { settings: settingsMap(db) });
  }

  if (method === 'PUT' && route === '/api/admin/password') {
    const body = await readBody(req);
    const next = String(body.password || '');
    if (next.length < 4) return json(res, 400, { error: 'Use a password of at least 4 characters.' });
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
