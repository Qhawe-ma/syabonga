import { Link } from 'react-router-dom';
import { Photo, Price, useShop } from '../shop.jsx';

export default function ProductCard({ product }) {
  const { cart, add, change } = useShop();
  const qty = cart[product.id] || 0;
  return (
    <article className="pc">
      <div className="im"><Link to={'/product/' + product.id}><Photo product={product} /></Link></div>
      <div className="pinfo">
        <h3><Link to={'/product/' + product.id}>{product.name}</Link></h3>
        <span className="meta">{product.size}</span>
      </div>
      <div className="buyrow">
        <Price value={product.price} />
        {product.stock <= 0 ? <span className="out">Out of stock</span> : qty ? (
          <div className="step">
            <button type="button" aria-label="Remove one" onClick={() => change(product.id, -1)}>−</button>
            <span>{qty}</span>
            <button type="button" aria-label="Add one" onClick={() => change(product.id, 1)}>+</button>
          </div>
        ) : <button className="add" type="button" onClick={() => add(product.id)}>Add</button>}
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
      <button className="arr prev" type="button" aria-label="Previous" onClick={(e) => slide(e, -1)}>‹</button>
      <div className="rail">{products.map((p) => <ProductCard key={p.id} product={p} />)}</div>
      <button className="arr next" type="button" aria-label="Next" onClick={(e) => slide(e, 1)}>›</button>
    </div>
  );
}
