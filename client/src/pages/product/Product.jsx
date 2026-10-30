import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import Chrome from '../../components/Chrome.jsx';
import { Shelf } from '../../components/ProductCard.jsx';
import { Photo, Price, money, productBadge, useShop } from '../../shop.jsx';

export default function Product() {
  const { id } = useParams();
  const { api, boot, cart, add, change } = useShop();
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

  return (
    <Chrome active={product?.category}>
      {!product ? <p className="empty">{error || 'Loading…'}</p> : (
        <>
          <div className="crumb">
            <Link to="/">Home</Link> <span aria-hidden="true">/</span> <Link to={'/shop?cat=' + product.category}>{data.categoryName}</Link> <span aria-hidden="true">/</span> <span>{product.name}</span>
          </div>
          <div className="pdp">
            <div className="big">
              {badge ? <span className={'badge ' + badge.kind}>{badge.label}</span> : null}
              <Photo product={product} alt={product.name} />
            </div>
            <div>
              <h1>{product.name}</h1>
              <p className="meta">{product.size}</p>
              <Price value={product.price} />
              <p className={product.stock ? 'ok' : 'out'}>{product.stock ? 'In stock at Siyabonga, Kranskop · ' + product.stock + ' on the shelf' : 'Out of stock'}</p>
              <div className="pdp-actions">
                {product.stock <= 0 ? <span className="out">Out of stock</span> : qty ? (
                  <div className="step lg" role="group" aria-label="Quantity">
                    <button type="button" aria-label="Remove one" onClick={() => change(product.id, -1)}>−</button>
                    <span>{qty}</span>
                    <button type="button" aria-label="Add one" onClick={() => change(product.id, 1)} disabled={qty >= product.stock}>+</button>
                  </div>
                ) : <button className="btn" type="button" onClick={() => add(product.id)}>Add to basket</button>}
              </div>
              <dl className="facts">
                <div><dt>Delivery</dt><dd>{money(settings.fee || 25)}, free over {money(settings.free_over || 500)}.</dd></div>
                <div><dt>Collect</dt><dd>Free at {settings.address}.</dd></div>
                <div><dt>Pay</dt><dd>Cash or card machine on delivery or collection.</dd></div>
              </dl>
              <p className="blurb">{product.blurb}</p>
              {product.items ? <><h2 className="subhead">What’s in the combo</h2><ul className="includes">{product.items.map((item) => <li key={item}>{item}</li>)}</ul></> : null}
            </div>
          </div>
          <div className="rowh"><h2>More in {data.categoryName}</h2></div>
          <Shelf products={data.related || []} />
        </>
      )}
    </Chrome>
  );
}
