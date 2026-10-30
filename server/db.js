const fs = require('fs');
const path = require('path');
const { scryptSync, randomBytes, timingSafeEqual } = require('crypto');
const { DatabaseSync } = require('node:sqlite');
const { products, combos, categories, blurbs } = require('./catalog');

const root = path.join(__dirname, '..');
const dataDir = path.join(root, 'data');
const dbPath = path.join(dataDir, 'store.sqlite');

function hashPassword(pw) {
  const salt = randomBytes(16).toString('hex');
  const hash = scryptSync(pw, salt, 32).toString('hex');
  return salt + ':' + hash;
}

function checkPassword(pw, stored) {
  const [salt, hash] = String(stored || '').split(':');
  if (!salt || !hash) return false;
  const next = scryptSync(String(pw), salt, 32);
  const old = Buffer.from(hash, 'hex');
  return next.length === old.length && timingSafeEqual(next, old);
}

function open() {
  fs.mkdirSync(dataDir, { recursive: true });
  const db = new DatabaseSync(dbPath);
  db.exec(`
    PRAGMA foreign_keys = ON;
    PRAGMA journal_mode = WAL;
    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY,
      name TEXT NOT NULL,
      cell TEXT NOT NULL UNIQUE,
      password_hash TEXT NOT NULL,
      role TEXT NOT NULL DEFAULT 'customer',
      created_at TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS addresses (
      id INTEGER PRIMARY KEY,
      user_id INTEGER NOT NULL,
      line TEXT NOT NULL,
      town TEXT NOT NULL DEFAULT 'Kranskop',
      FOREIGN KEY (user_id) REFERENCES users(id)
    );
    CREATE TABLE IF NOT EXISTS categories (
      slug TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      sort INTEGER NOT NULL
    );
    CREATE TABLE IF NOT EXISTS products (
      id INTEGER PRIMARY KEY,
      name TEXT NOT NULL,
      size TEXT NOT NULL,
      price REAL NOT NULL,
      category TEXT NOT NULL,
      stock INTEGER NOT NULL DEFAULT 40,
      photo TEXT,
      active INTEGER NOT NULL DEFAULT 1,
      items TEXT,
      blurb TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS orders (
      id INTEGER PRIMARY KEY,
      number TEXT NOT NULL UNIQUE,
      user_id INTEGER,
      name TEXT NOT NULL,
      cell TEXT NOT NULL,
      mode TEXT NOT NULL,
      address TEXT,
      town TEXT,
      slot TEXT,
      pay_method TEXT NOT NULL,
      fee REAL NOT NULL,
      subtotal REAL NOT NULL,
      total REAL NOT NULL,
      status TEXT NOT NULL,
      created_at TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS order_items (
      id INTEGER PRIMARY KEY,
      order_id INTEGER NOT NULL,
      product_id INTEGER,
      name TEXT NOT NULL,
      size TEXT,
      qty INTEGER NOT NULL,
      price REAL NOT NULL,
      FOREIGN KEY (order_id) REFERENCES orders(id)
    );
    CREATE TABLE IF NOT EXISTS settings (
      key TEXT PRIMARY KEY,
      value TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS sessions (
      token TEXT PRIMARY KEY,
      user_id INTEGER NOT NULL,
      created_at TEXT NOT NULL,
      FOREIGN KEY (user_id) REFERENCES users(id)
    );
  `);
  seed(db);
  migrate(db);
  return db;
}

function addColumn(db, table, name, ddl) {
  const cols = db.prepare('PRAGMA table_info(' + table + ')').all().map(function (row) { return row.name; });
  if (cols.indexOf(name) < 0) db.exec('ALTER TABLE ' + table + ' ADD COLUMN ' + ddl);
}

function migrate(db) {
  addColumn(db, 'addresses', 'label', "label TEXT NOT NULL DEFAULT 'Home'");
  addColumn(db, 'addresses', 'lat', 'lat REAL');
  addColumn(db, 'addresses', 'lng', 'lng REAL');
  addColumn(db, 'addresses', 'is_default', 'is_default INTEGER NOT NULL DEFAULT 0');
  addColumn(db, 'orders', 'lat', 'lat REAL');
  addColumn(db, 'orders', 'lng', 'lng REAL');
  addColumn(db, 'orders', 'place_label', 'place_label TEXT');
  addColumn(db, 'orders', 'driver_id', 'driver_id INTEGER');
  addColumn(db, 'orders', 'driver_lat', 'driver_lat REAL');
  addColumn(db, 'orders', 'driver_lng', 'driver_lng REAL');
  addColumn(db, 'orders', 'driver_at', 'driver_at TEXT');
  addColumn(db, 'products', 'compare_at', 'compare_at REAL');
  addColumn(db, 'users', 'status', "status TEXT NOT NULL DEFAULT 'active'");
  addColumn(db, 'users', 'id_number', 'id_number TEXT');
  addColumn(db, 'users', 'vehicle_type', 'vehicle_type TEXT');
  addColumn(db, 'users', 'vehicle_reg', 'vehicle_reg TEXT');
  addColumn(db, 'users', 'licence_no', 'licence_no TEXT');
  addColumn(db, 'users', 'bank_name', 'bank_name TEXT');
  addColumn(db, 'users', 'account_holder', 'account_holder TEXT');
  addColumn(db, 'users', 'account_number', 'account_number TEXT');
  addColumn(db, 'users', 'branch_code', 'branch_code TEXT');
  addColumn(db, 'users', 'photo', 'photo TEXT');
  addColumn(db, 'users', 'licence_photo', 'licence_photo TEXT');
  db.exec(`
    CREATE TABLE IF NOT EXISTS password_resets (
      id INTEGER PRIMARY KEY,
      cell TEXT NOT NULL,
      code TEXT NOT NULL,
      expires_at TEXT NOT NULL,
      created_at TEXT NOT NULL,
      used INTEGER NOT NULL DEFAULT 0
    );
    CREATE TABLE IF NOT EXISTS notifications (
      id INTEGER PRIMARY KEY,
      kind TEXT NOT NULL,
      body TEXT NOT NULL,
      order_id INTEGER,
      created_at TEXT NOT NULL,
      read_at TEXT
    );
  `);
  const sampleWas = [[1, 115.9], [2, 109.9], [5, 104.9], [6, 189.9], [8, 144.9]];
  const setWas = db.prepare('UPDATE products SET compare_at = ? WHERE id = ? AND compare_at IS NULL AND price < ?');
  sampleWas.forEach(function (pair) { setWas.run(pair[1], pair[0], pair[1]); });
  function ensureSetting(key, value) {
    if (!db.prepare('SELECT key FROM settings WHERE key = ?').get(key)) {
      db.prepare('INSERT INTO settings (key, value) VALUES (?, ?)').run(key, value);
    }
  }
  ensureSetting('hours', '');
  ensureSetting('delivery_areas', 'Kranskop and nearby');
  ensureSetting('driver_pay', '15');
  const hasShop = db.prepare('SELECT COUNT(*) AS n FROM settings').get().n;
  if (hasShop && !db.prepare('SELECT key FROM settings WHERE key = ?').get('shop_lat')) {
    db.prepare('INSERT INTO settings (key, value) VALUES (?, ?)').run('shop_lat', '-28.971');
    db.prepare('INSERT INTO settings (key, value) VALUES (?, ?)').run('shop_lng', '30.860');
  }
  const people = db.prepare('SELECT DISTINCT user_id FROM addresses').all();
  people.forEach(function (person) {
    const marked = db.prepare('SELECT id FROM addresses WHERE user_id = ? AND is_default = 1').get(person.user_id);
    if (marked) return;
    const last = db.prepare('SELECT id FROM addresses WHERE user_id = ? ORDER BY id DESC LIMIT 1').get(person.user_id);
    if (last) db.prepare('UPDATE addresses SET is_default = 1, label = COALESCE(label, ?) WHERE id = ?').run('Home', last.id);
  });
}

function photoFor(id, comboKey) {
  if (comboKey) {
    const file = path.join(root, 'shared', 'img', 'combos', comboKey + '.jpg');
    return fs.existsSync(file) ? '/shared/img/combos/' + comboKey + '.jpg' : null;
  }
  const file = path.join(root, 'shared', 'img', 'products', id + '.jpg');
  return fs.existsSync(file) ? '/shared/img/products/' + id + '.jpg' : null;
}

function seed(db) {
  const ready = db.prepare('SELECT COUNT(*) AS n FROM products').get().n;
  if (ready) return;
  const insertCat = db.prepare('INSERT INTO categories (slug, name, sort) VALUES (?, ?, ?)');
  const insertProd = db.prepare(`INSERT INTO products
    (id, name, size, price, category, stock, photo, active, items, blurb)
    VALUES (?, ?, ?, ?, ?, ?, ?, 1, ?, ?)`);
  db.exec('BEGIN');
  categories.forEach(function (c) { insertCat.run(c[0], c[1], c[2]); });
  products.forEach(function (p) {
    insertProd.run(p[0], p[1], p[2], p[3], p[4], 40, photoFor(p[0]), null, blurbs[p[4]]);
  });
  combos.forEach(function (p) {
    insertProd.run(p[0], p[1], 'Bulk combo', p[2], 'combo', 12, photoFor(p[0], p[3]), JSON.stringify(p[4]), blurbs.combo);
  });
  const settings = {
    fee: '25',
    free_over: '500',
    min_delivery: '150',
    phone: '033 444 1595',
    fax: '033 444 1880',
    address: 'Lot 20 Main Rd, Kranskop, 3268',
    shop_name: 'Siyabonga Powertrade',
    town: 'Kranskop',
    shop_lat: '-28.971',
    shop_lng: '30.860'
  };
  const insertSet = db.prepare('INSERT INTO settings (key, value) VALUES (?, ?)');
  Object.keys(settings).forEach(function (k) { insertSet.run(k, settings[k]); });
  db.prepare(`INSERT INTO users (name, cell, password_hash, role, created_at)
    VALUES (?, ?, ?, 'admin', ?)`).run(
    'Siyabonga shop',
    '0334441595',
    hashPassword('change-me'),
    new Date().toISOString()
  );
  db.exec('COMMIT');
  console.log('Shop database created at data/store.sqlite');
  console.log('Admin sign-in cell 0334441595  password change-me');
}

function settingsMap(db) {
  const rows = db.prepare('SELECT key, value FROM settings').all();
  const out = {};
  rows.forEach(function (r) { out[r.key] = r.value; });
  out.fee = Number(out.fee || 25);
  out.free_over = Number(out.free_over || 500);
  out.min_delivery = Number(out.min_delivery || 150);
  out.shop_lat = Number(out.shop_lat || -28.971);
  out.shop_lng = Number(out.shop_lng || 30.860);
  out.driver_pay = out.driver_pay == null || out.driver_pay === '' ? 15 : Number(out.driver_pay);
  out.hours = out.hours || '';
  out.delivery_areas = out.delivery_areas || '';
  return out;
}

function publicPlace(row) {
  if (!row) return null;
  return {
    id: row.id,
    label: row.label || 'Home',
    line: row.line,
    town: row.town || 'Kranskop',
    lat: row.lat == null ? null : Number(row.lat),
    lng: row.lng == null ? null : Number(row.lng),
    isDefault: !!row.is_default
  };
}

function publicUser(row) {
  if (!row) return null;
  return {
    id: row.id,
    name: row.name,
    cell: row.cell,
    role: row.role,
    status: row.status || 'active'
  };
}

function publicProduct(row) {
  return {
    id: row.id,
    name: row.name,
    size: row.size,
    price: row.price,
    category: row.category,
    stock: row.stock,
    photo: row.photo,
    active: !!row.active,
    items: row.items ? JSON.parse(row.items) : null,
    blurb: row.blurb,
    compareAt: row.compare_at == null ? null : Number(row.compare_at)
  };
}

module.exports = { open, hashPassword, checkPassword, settingsMap, publicUser, publicProduct, publicPlace, root };
