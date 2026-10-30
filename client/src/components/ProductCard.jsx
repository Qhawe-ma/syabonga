import { Link } from 'react-router-dom';
import { Photo, Price, productBadge, useShop } from '../shop.jsx';

export default function ProductCard({ product }) {
  const { cart, add, change } = useShop();
  const qty = cart[product.id] || 0;
  const badge = productBadge(product);
  return (
    <article className="pc">
      <Link className="im" to={'/product/' + product.id}>
        {badge ? <span className={'badge ' + badge.kind}>{badge.label}</span> : null}
        {product.stock <= 0 ? <span className="sold">Out of stock</span> : null}
        <Photo product={product} />
      </Link>
      <div className="pinfo">
        <h3><Link to={'/product/' + product.id}>{product.name}</Link></h3>
        <p className="meta">{product.size}</p>
      </div>
      <div className="buyrow">
        <Price value={product.price} />
        {product.stock <= 0 ? <span className="out">Out of stock</span> : qty ? (
          <div className="step" role="group" aria-label={'Quantity of ' + product.name}>
            <button type="button" aria-label={'Remove one ' + product.name} onClick={() => change(product.id, -1)}>−</button>
            <span aria-live="polite">{qty}</span>
            <button type="button" aria-label={'Add one ' + product.name} onClick={() => change(product.id, 1)} disabled={qty >= product.stock}>+</button>
          </div>
        ) : (
          <button className="add" type="button" onClick={() => add(product.id)}>Add</button>
        )}
      </div>
    </article>
  );
}

export function Shelf({ products }) {
  function slide(event, dir) {
    const row = event.currentTarget.parentElement.querySelector('.rail');
    row.scrollBy({ left: dir * Math.max(240, row.clientWidth * 0.8), behavior: 'smooth' });
  }
  if (!products.length) return <p className="empty">Nothing in this aisle yet.</p>;
  return (
    <div className="shelf">
      <button className="arr prev" type="button" aria-label="Previous products" onClick={(e) => slide(e, -1)}>‹</button>
      <div className="rail">{products.map((p) => <ProductCard key={p.id} product={p} />)}</div>
      <button className="arr next" type="button" aria-label="Next products" onClick={(e) => slide(e, 1)}>›</button>
    </div>
  );
}
