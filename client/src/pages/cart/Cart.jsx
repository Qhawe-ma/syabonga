import { Link } from 'react-router-dom';
import Chrome from '../../components/Chrome.jsx';
import { Photo, money, useShop } from '../../shop.jsx';

export default function Cart() {
  const { cart, catalog, change, subtotal, boot } = useShop();
  const lines = catalog.filter((p) => cart[p.id]);
  const settings = boot?.settings || { fee: 25, free_over: 500, min_delivery: 150 };
  const fee = subtotal > 0 && subtotal < settings.free_over ? settings.fee : 0;
  const low = subtotal > 0 && subtotal < settings.min_delivery;

  return (
    <Chrome>
      <div className="pagehead"><h1>Your basket</h1></div>
      {!lines.length ? <p className="empty">Your basket is empty. Add groceries from the shop and they will show up here.</p> : lines.map((p) => (
        <div className="line" key={p.id}>
          <Photo product={p} height={72} />
          <div>
            <b>{p.name}</b>
            <div className="meta">{p.size}</div>
            <div className="step">
              <button type="button" onClick={() => change(p.id, -1)}>−</button>
              <span>{cart[p.id]}</span>
              <button type="button" onClick={() => change(p.id, 1)}>+</button>
            </div>
          </div>
          <div className="pr">{money(p.price * cart[p.id])}</div>
        </div>
      ))}
      <aside className="bill" style={{ maxWidth: 420 }}>
        <h2>To pay</h2>
        <div className="sline"><span>Items</span><b>{money(subtotal)}</b></div>
        <div className="sline"><span>Delivery if we bring it</span><b>{fee ? money(fee) : 'Free'}</b></div>
        <div className="sline tot"><span>Total</span><b>{money(subtotal + (lines.length ? fee : 0))}</b></div>
        {low ? <p className="warn">Delivery starts at {money(settings.min_delivery)}. You can still collect at the shop.</p> : null}
        {lines.length ? <Link className="btn block" to="/checkout">Checkout</Link> : <Link className="btn" to="/shop">Browse groceries</Link>}
      </aside>
    </Chrome>
  );
}
