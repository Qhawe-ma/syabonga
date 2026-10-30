import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';

const CART = 'syb_cart';
const ADDR = 'syb_addr';
const ShopContext = createContext(null);

const SPECIAL_IDS = new Set([1, 2, 5, 6, 8]);

export function money(n) {
  const value = Number(n || 0);
  const sign = value < 0 ? '-' : '';
  const [whole, cents] = Math.abs(value).toFixed(2).split('.');
  const grouped = whole.replace(/\B(?=(\d{3})+(?!\d))/g, ' ');
  return sign + 'R ' + grouped + '.' + cents;
}

export function Price({ value, className = 'pr' }) {
  return <span className={className}>{money(value)}</span>;
}

export function productBadge(product) {
  if (!product || product.stock <= 0) return null;
  if (product.category === 'combo') return { kind: 'combo', label: 'Combo' };
  if (SPECIAL_IDS.has(Number(product.id))) return { kind: 'special', label: 'Special' };
  if (product.stock <= 8) return { kind: 'low', label: 'Few left' };
  return null;
}

export function shortCategory(slug, name) {
  const map = {
    combo: 'Combos',
    staples: 'Staples',
    pantry: 'Pantry',
    fresh: 'Fresh',
    drinks: 'Drinks',
    home: 'Household',
    care: 'Care'
  };
  return map[slug] || name || slug;
}

export function statusLabel(status) {
  const map = {
    new: 'New',
    accepted: 'Accepted',
    picking: 'Picking',
    out: 'On the way',
    ready: 'Ready to collect',
    delivered: 'Delivered',
    collected: 'Collected',
    cancelled: 'Cancelled'
  };
  return map[status] || status;
}

export function Pack({ product }) {
  const brand = (product.name || '').split(' ')[0].slice(0, 9);
  return (
    <svg viewBox="0 0 120 120" aria-hidden="true">
      <rect x="30" y="16" width="60" height="88" rx="6" fill="#0E2A5C" />
      <rect x="30" y="16" width="60" height="20" rx="6" fill="#16356F" />
      <rect x="38" y="48" width="44" height="34" rx="3" fill="#fff" />
      <text x="60" y="66" textAnchor="middle" fontFamily="Arial, Helvetica, sans-serif" fontWeight="700" fontSize="10" fill="#0E2A5C">{brand}</text>
      <text x="60" y="78" textAnchor="middle" fontFamily="Arial, Helvetica, sans-serif" fontSize="8" fill="#5C6370">{product.size}</text>
    </svg>
  );
}

export function Photo({ product, alt = '' }) {
  if (product.photo) return <img src={product.photo} alt={alt} />;
  return <Pack product={product} />;
}

function readJson(key, fallback) {
  try { return JSON.parse(localStorage.getItem(key) || '') ?? fallback; } catch { return fallback; }
}

export function useShop() {
  const ctx = useContext(ShopContext);
  if (!ctx) throw new Error('Shop is not ready');
  return ctx;
}

export function ShopProvider({ children }) {
  const [boot, setBoot] = useState(null);
  const [catalog, setCatalog] = useState([]);
  const [cart, setCart] = useState(() => readJson(CART, {}));
  const [addr, setAddr] = useState(() => readJson(ADDR, null));
  const [toast, setToast] = useState('');

  const api = useCallback(async function api(path, opts = {}) {
    const res = await fetch(path, {
      method: opts.method || 'GET',
      headers: opts.body ? { 'Content-Type': 'application/json' } : undefined,
      body: opts.body ? JSON.stringify(opts.body) : undefined,
      credentials: 'same-origin'
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data.error || 'Request failed');
    return data;
  }, []);

  const load = useCallback(async function load() {
    const [nextBoot, products] = await Promise.all([
      api('/api/bootstrap'),
      api('/api/products')
    ]);
    setBoot(nextBoot);
    setCatalog(products.products);
    if (nextBoot.address && nextBoot.address.line) {
      setAddr(nextBoot.address);
      localStorage.setItem(ADDR, JSON.stringify(nextBoot.address));
    }
  }, [api]);

  useEffect(() => { load().catch((err) => setToast(err.message)); }, [load]);

  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(''), 2400);
    return () => clearTimeout(t);
  }, [toast]);

  function writeCart(next) {
    setCart(next);
    localStorage.setItem(CART, JSON.stringify(next));
  }

  function productById(id) {
    return catalog.find((p) => String(p.id) === String(id));
  }

  function add(id) {
    const product = productById(id);
    const nextQty = (cart[id] || 0) + 1;
    if (product && nextQty > product.stock) {
      setToast('Only ' + product.stock + ' left of ' + product.name + '.');
      return;
    }
    writeCart({ ...cart, [id]: nextQty });
    setToast('Added to your basket.');
  }

  function change(id, dir) {
    const product = productById(id);
    const nextQty = (cart[id] || 0) + dir;
    if (nextQty > 0 && product && nextQty > product.stock) {
      setToast('Only ' + product.stock + ' left.');
      return;
    }
    const next = { ...cart };
    if (nextQty <= 0) delete next[id];
    else next[id] = nextQty;
    writeCart(next);
  }

  function clearCart() { writeCart({}); }

  function saveAddr(next) {
    setAddr(next);
    localStorage.setItem(ADDR, JSON.stringify(next));
  }

  const count = Object.values(cart).reduce((n, q) => n + q, 0);
  const subtotal = Object.entries(cart).reduce((n, [id, qty]) => {
    const product = productById(id);
    return n + (product ? product.price * qty : 0);
  }, 0);

  const value = useMemo(() => ({
    boot, catalog, cart, addr, toast, api, load, add, change, clearCart, saveAddr,
    setToast, productById, count, subtotal
  }), [boot, catalog, cart, addr, toast, api, load, count, subtotal]);

  return (
    <ShopContext.Provider value={value}>
      {children}
      <div className={'toast' + (toast ? ' on' : '')} role="status">{toast}</div>
    </ShopContext.Provider>
  );
}
