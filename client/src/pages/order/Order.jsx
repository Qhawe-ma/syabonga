import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import Chrome from '../../components/Chrome.jsx';
import PinMap, { formatPin } from '../../components/PinMap.jsx';
import { money, useShop } from '../../shop.jsx';

export default function Order() {
  const { number } = useParams();
  const { api, boot } = useShop();
  const [order, setOrder] = useState(null);
  const [error, setError] = useState('');

  useEffect(() => {
    api('/api/orders/' + number).then((data) => setOrder(data.order)).catch((err) => {
      try {
        const saved = JSON.parse(sessionStorage.getItem('syb_order') || 'null');
        if (saved && saved.number === number) { setOrder(saved); return; }
      } catch { /* keep the server message */ }
      setError(err.message);
    });
  }, [api, number]);

  useEffect(() => {
    if (!order || order.status !== 'out') return;
    const timer = setInterval(function () {
      api('/api/orders/' + number).then((data) => setOrder(data.order)).catch(() => {});
    }, 15000);
    return function () { clearInterval(timer); };
  }, [api, number, order?.status]);

  const settings = boot?.settings || {};

  return (
    <Chrome>
      {!order ? <p className="empty">{error || 'Loading your order…'}</p> : (
        <div className="sheet done" style={{ maxWidth: 560 }}>
          <h1>Order placed</h1>
          <p>Your order number is</p>
          <div className="no">{order.number}</div>
          <p>{order.mode === 'delivery' ? 'We will bring it to ' + (order.placeLabel ? order.placeLabel + ', ' : '') + order.address + ', ' + order.town : 'Collect at the shop'} · {order.slot}</p>
          <p>Pay {order.payMethod === 'card' ? 'by card machine' : 'cash'} · {money(order.total)}</p>
          <p>Status: <b>{order.status}</b>{order.driverName ? ' · ' + order.driverName : ''}</p>
          {order.mode === 'delivery' && order.lat != null ? (
            <>
              <p className="coord">{formatPin(order.lat, order.lng)}</p>
              <PinMap
                lat={order.lat}
                lng={order.lng}
                shop={{ lat: settings.shop_lat, lng: settings.shop_lng }}
                driver={order.status === 'out' && order.driverLat != null ? { lat: order.driverLat, lng: order.driverLng, name: order.driverName || 'Driver' } : null}
                follow={false}
              />
              {order.status === 'out' ? <p>The driver is on the way. The yellow dot is their latest location.</p> : <p>This is the pin the driver will follow.</p>}
            </>
          ) : null}
          {order.items.map((item) => <div className="sline" key={item.name + item.qty}><span>{item.qty} × {item.name}</span><b>{money(item.price * item.qty)}</b></div>)}
          <Link className="btn" to="/shop" style={{ marginTop: 16 }}>Keep shopping</Link>
        </div>
      )}
    </Chrome>
  );
}
