import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import Chrome from '../../components/Chrome.jsx';
import { Shelf } from '../../components/ProductCard.jsx';
import { Photo, Price, money, useShop } from '../../shop.jsx';

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

  return (
    <Chrome>
      {!product ? <p className="empty">{error || 'Loading…'}</p> : (
        <>
          <div className="crumb"><Link to="/">Home</Link> › <Link to={'/shop?cat=' + product.category}>{data.categoryName}</Link> › <span>{product.name}</span></div>
          <div className="pdp">
            <div className="big"><Photo product={product} height={280} /></div>
            <div>
              <h1>{product.name}</h1>
              <p className="meta">{product.size}</p>
              <Price value={product.price} />
              <p className={product.stock ? 'ok' : 'out'}>{product.stock ? 'In stock at Siyabonga, Kranskop · ' + product.stock + ' on the shelf' : 'Out of stock'}</p>
              <div className="buyrow" style={{ paddingLeft: 0 }}>
                {product.stock <= 0 ? <span className="out">Out of stock</span> : qty ? (
                  <div className="step">
                    <button type="button" onClick={() => change(product.id, -1)}>−</button><span>{qty}</span>
                    <button type="button" onClick={() => change(product.id, 1)}>+</button>
                  </div>
                ) : <button className="add" type="button" onClick={() => add(product.id)}>Add</button>}
              </div>
              <div className="dl">
                <span><b>Delivery:</b> {money(settings.fee || 25)}, free over {money(settings.free_over || 500)}.</span>
                <span><b>Collect:</b> free at {settings.address}.</span>
                <span><b>Pay:</b> cash or card machine on delivery or collection.</span>
              </div>
              <p>{product.blurb}</p>
              {product.items ? <><h3>What’s in the combo</h3><ul>{product.items.map((item) => <li key={item}>{item}</li>)}</ul></> : null}
            </div>
          </div>
          <div className="rowh"><h2>You may also like</h2></div>
          <Shelf products={data.related || []} />
        </>
      )}
    </Chrome>
  );
}
