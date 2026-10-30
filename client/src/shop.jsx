import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';

const CART = 'syb_cart';
const ADDR = 'syb_addr';
const ShopContext = createContext(null);

export function money(n) {
  return 'R' + Number(n || 0).toFixed(2);
}

export function Price({ value, className = 'pr' }) {
  const [whole, cents] = Number(value || 0).toFixed(2).split('.');
  const grouped = Number(whole).toLocaleString('en-ZA').replace(/\u00a0/g, ' ');
  return <span className={className}>R{grouped}{cents !== '00' ? <sup>{cents}</sup> : null}</span>;
}

export function Pack({ product }) {
  const brand = (product.name || '').split(' ')[0].slice(0, 9).toUpperCase();
  return (
    <svg viewBox="0 0 120 140" aria-hidden="true">
      <path d="M26 18h68l8 14v96a8 8 0 0 1-8 8H26a8 8 0 0 1-8-8V32z" fill="#14306b" />
      <path d="M26 18h68l8 14H18z" fill="#fff" opacity=".28" />
      <rect x="30" y="58" width="60" height="42" rx="5" fill="#fff" />
      <text x="60" y="76" textAnchor="middle" fontFamily="Barlow Condensed, Arial" fontWeight="800" fontSize="14" fill="#14306b">{brand}</text>
      <text x="60" y="92" textAnchor="middle" fontFamily="Barlow, Arial" fontSize="11" fill="#e1212b">{product.size}</text>
    </svg>
  );
}

export function Photo({ product, height = 136 }) {
  if (product.photo) return <img src={product.photo} alt={product.name} style={{ maxHeight: height }} />;
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
