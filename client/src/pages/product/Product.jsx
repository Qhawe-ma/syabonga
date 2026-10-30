import { useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import Chrome from '../../components/Chrome.jsx';
import { Qty, Shelf } from '../../components/ProductCard.jsx';
import { Photo, Price, money, onSpecial, productBadge, useShop } from '../../shop.jsx';

export default function Product() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { api, boot, cart, add } = useShop();
  const [data, setData] = useState(null);
  const [error, setError] = useState('');

  useEffect(() => {
    setData(null);
    api('/api/products/' + id).then(setData).catch((err) => setError(err.message));
  }, [api, id]);

  const product = data?.product;
  const qty = product ? cart[product.id] || 0 : 0;
  const settings = boot?.settings || {};
  const badge = product ? productBadge(product) : null;
  const special = product ? onSpecial(product) : false;

  useEffect(() => {
    const previous = document.title;
    if (product) document.title = product.name + ' | Siyabonga Powertrade';
    return () => { document.title = previous; };
  }, [product]);

  function buy() {
    if (product) add(product.id);
  }

  const actions = !product ? null : product.stock <= 0 ? <span className="out">Out of stock</span> : qty ? (
    <Qty product={product} qty={qty} large />
  ) : <button className="btn" type="button" onClick={buy}>Add to basket · {money(product.price)}</button>;

  return (
    <Chrome active={product?.category}>
      {!product ? <p className="empty">{error || 'Loading…'}</p> : (
        <div className="pdp-screen">
          <div className="sheet-top">
            <button className="textbtn" type="button" onClick={() => navigate(-1)}>Close</button>
            <div className="crumb">
              <Link to="/">Home</Link> <span aria-hidden="true">/</span> <Link to={'/shop?cat=' + product.category}>{data.categoryName}</Link>
            </div>
          </div>
          <div className="pdp">
            <div className={'big' + (product.stock <= 0 ? ' is-out' : '')}>
              {badge ? <span className={'badge ' + badge.kind}>{badge.label}</span> : null}
              <Photo product={product} alt={product.name} loading="eager" />
            </div>
            <div>
              <p className="meta">{data.categoryName}</p>
              <h1>{product.name}</h1>
              <p className="packline">{product.size}</p>
              <div className="price-stack pdp-price">
                {special ? <span className="was">{money(product.compareAt)}</span> : null}
                <Price value={product.price} />
              </div>
              <p className={product.stock ? 'ok' : 'out'}>{product.stock ? 'In stock at Siyabonga, Kranskop · ' + product.stock + ' on the shelf' : 'Out of stock'}</p>
              <div className="pdp-actions">{actions}</div>
              <dl className="facts">
                <div><dt>Delivery</dt><dd>{money(settings.fee || 25)}, free over {money(settings.free_over || 500)}.{settings.delivery_areas ? ' ' + settings.delivery_areas + '.' : ''}</dd></div>
                <div><dt>Collect</dt><dd>Free at {settings.address}.</dd></div>
                <div><dt>Pay</dt><dd>Cash or card machine on delivery or collection.</dd></div>
              </dl>
              <details className="fold" open>
                <summary>About this product</summary>
                <p className="blurb">{product.blurb}</p>
              </details>
              {product.items ? <><h2 className="subhead">What’s in the combo</h2><ul className="includes">{product.items.map((item) => <li key={item}>{item}</li>)}</ul></> : null}
            </div>
          </div>
          <div className="rowh"><h2>More in {data.categoryName}</h2></div>
          <Shelf products={data.related || []} />
          <div className="buybar">
            <div className="price-stack">
              {special ? <span className="was">{money(product.compareAt)}</span> : null}
              <Price value={product.price} />
            </div>
            {actions}
          </div>
        </div>
      )}
    </Chrome>
  );
}
