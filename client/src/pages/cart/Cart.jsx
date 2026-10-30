import { Link } from 'react-router-dom';
import Chrome from '../../components/Chrome.jsx';
import { Photo, Price, money, useShop } from '../../shop.jsx';

export default function Cart() {
  const { cart, catalog, change, subtotal, boot } = useShop();
  const lines = catalog.filter((p) => cart[p.id]);
  const settings = boot?.settings || { fee: 25, free_over: 500, min_delivery: 150 };
  const fee = subtotal > 0 && subtotal < settings.free_over ? settings.fee : 0;
  const low = subtotal > 0 && subtotal < settings.min_delivery;
  const total = subtotal + (lines.length ? fee : 0);

  return (
    <Chrome>
      <div className="pagehead"><h1>Basket</h1></div>
      {!lines.length ? (
        <div className="empty-state">
          <h2>Your basket is empty</h2>
          <p>Add groceries from the shop and they will show up here.</p>
          <Link className="btn" to="/shop">Browse groceries</Link>
        </div>
      ) : (
        <div className="split">
          <div>
            {lines.map((p) => (
              <div className="line" key={p.id}>
                <Link className="line-img" to={'/product/' + p.id}><Photo product={p} /></Link>
                <div className="line-info">
                  <b><Link to={'/product/' + p.id}>{p.name}</Link></b>
                  <div className="meta">{p.size} · <Price value={p.price} className="meta-price" /></div>
                  <div className="line-actions">
                    <div className="step" role="group" aria-label={'Quantity of ' + p.name}>
                      <button type="button" aria-label="Remove one" onClick={() => change(p.id, -1)}>−</button>
                      <span>{cart[p.id]}</span>
                      <button type="button" aria-label="Add one" onClick={() => change(p.id, 1)}>+</button>
                    </div>
                    <button className="textbtn" type="button" onClick={() => change(p.id, -cart[p.id])}>Remove</button>
                  </div>
                </div>
                <div className="pr">{money(p.price * cart[p.id])}</div>
              </div>
            ))}
          </div>
          <aside className="bill">
            <h2>To pay</h2>
            <div className="sline"><span>Items</span><b>{money(subtotal)}</b></div>
            <div className="sline"><span>Delivery, if we bring it</span><b>{fee ? money(fee) : 'Free'}</b></div>
            <div className="sline tot"><span>Total</span><b>{money(total)}</b></div>
            {subtotal < settings.free_over ? <p className="fine">Add {money(settings.free_over - subtotal)} more for free delivery.</p> : <p className="fine">Delivery is free on this basket.</p>}
            {low ? <p className="warn">Delivery starts at {money(settings.min_delivery)}. You can still collect at the shop.</p> : null}
            <Link className="btn block" to="/checkout">Checkout</Link>
            <Link className="textbtn block-link" to="/shop">Continue shopping</Link>
          </aside>
        </div>
      )}
    </Chrome>
  );
}
