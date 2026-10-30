import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import Chrome from '../../components/Chrome.jsx';
import PinMap, { formatPin } from '../../components/PinMap.jsx';
import { money, statusLabel, useShop } from '../../shop.jsx';

function stepIndex(order) {
  if (order.mode === 'collect') {
    return { new: 0, accepted: 1, ready: 2, collected: 3 }[order.status] ?? 0;
  }
  return { new: 0, accepted: 1, picking: 1, out: 2, delivered: 3 }[order.status] ?? 0;
}

function Progress({ order }) {
  if (order.status === 'cancelled') return <p className="warn">This order was cancelled.</p>;
  const steps = order.mode === 'collect'
    ? ['Placed', 'Accepted', 'Ready', 'Collected']
    : ['Placed', 'Picking', 'On the way', 'Delivered'];
  const current = stepIndex(order);
  return (
    <div className="steps" aria-label="Order progress">
      {steps.map((label, i) => <span key={label} className={i < current ? 'done' : i === current ? 'on' : ''}>{label}</span>)}
    </div>
  );
}

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
        <div className="sheet wide">
          <div className="confirm-head">
            <p className="eyebrow">Order placed</p>
            <div className="order-no">{order.number}</div>
            <p>{money(order.total)} · Pay {order.payMethod === 'card' ? 'by card machine' : 'cash'}</p>
          </div>
          <Progress order={order} />
          <p>{order.mode === 'delivery' ? 'We will bring it to ' + (order.placeLabel ? order.placeLabel + ', ' : '') + order.address + ', ' + order.town : 'Collect at the shop'} · {order.slot}</p>
          <p>Status: <b>{statusLabel(order.status)}</b>{order.driverName ? ' · ' + order.driverName : ''}</p>
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
              {order.status === 'out' ? <p>The driver is on the way. The amber dot is their latest location.</p> : <p>This is the pin the driver will follow.</p>}
            </>
          ) : null}
          {order.items.map((item) => <div className="sline" key={item.name + item.qty}><span>{item.qty} × {item.name}</span><b>{money(item.price * item.qty)}</b></div>)}
          <Link className="btn block" to="/shop">Keep shopping</Link>
        </div>
      )}
    </Chrome>
  );
}
