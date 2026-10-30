import { useState } from 'react';
import { Link } from 'react-router-dom';
import Chrome from '../../components/Chrome.jsx';
import ProductCard, { Shelf } from '../../components/ProductCard.jsx';
import { Photo, useShop } from '../../shop.jsx';

export default function Home() {
  const { boot, catalog } = useShop();
  const [tab, setTab] = useState('all');
  const categories = boot?.categories || [];
  const counts = {};
  catalog.forEach((p) => { counts[p.category] = (counts[p.category] || 0) + 1; });
  const popular = catalog.filter((p) => p.category !== 'combo' && (tab === 'all' || p.category === tab)).slice(0, 8);
  const rails = ['combo', 'staples', 'fresh', 'drinks', 'home'];

  return (
    <Chrome active="front">
      <div className="top3">
        <aside className="side">
          <h3>DEPARTMENTS</h3>
          {categories.map((c) => (
            <Link className="dept" key={c.slug} to={'/shop?cat=' + c.slug}><span>{c.name}</span><em>{counts[c.slug] || 0}</em></Link>
          ))}
        </aside>
        <div>
          <p className="eyeh">Specials at <b>Siyabonga Kranskop</b></p>
          <div className="leaflets">
            <div className="flyer">
              <span className="script">blessed</span>
              <h1>Friday<br />specials</h1>
              <p>Rice, flour, sugar and cooking oil, while stocks last.</p>
              <Link className="btn y" to="/shop?cat=staples">Shop specials</Link>
            </div>
            <Link className="leaflet" to="/shop?cat=combo"><img src="/shared/img/combos/c1.jpg" alt="Stokvel combo" /><span className="cap">STOKVEL COMBOS</span></Link>
          </div>
          <div className="offers">
            <Link to="/shop"><b>Free delivery over R500</b><span>Our staff pick your groceries and bring them to your gate.</span></Link>
            <Link to="/shop?cat=staples"><b>Cash or card</b><span>Pay when we deliver, or when you collect at Lot 20 Main Rd.</span></Link>
          </div>
        </div>
      </div>
      <h2 className="depthead">Shop by department</h2>
      <div className="qs">
        {categories.map((c) => {
          const sample = catalog.find((p) => p.category === c.slug && p.photo) || catalog.find((p) => p.category === c.slug);
          return <Link key={c.slug} to={'/shop?cat=' + c.slug}><i>{sample ? <Photo product={sample} height={64} /> : null}</i><span>{c.name}</span></Link>;
        })}
      </div>
      {rails.map((slug) => {
        const cat = categories.find((c) => c.slug === slug);
        const list = catalog.filter((p) => p.category === slug).slice(0, 10);
        if (!cat || !list.length) return null;
        return (
          <section key={slug}>
            <div className="rowh"><h2>{cat.name}</h2><Link className="lk" to={'/shop?cat=' + slug}>View all</Link></div>
            <Shelf products={list} />
          </section>
        );
      })}
      <div className="rowh">
        <h2>Popular groceries</h2>
        <div className="tabs2">
          <button type="button" aria-pressed={tab === 'all'} onClick={() => setTab('all')}>All</button>
          {categories.map((c) => <button key={c.slug} type="button" aria-pressed={tab === c.slug} onClick={() => setTab(c.slug)}>{c.name}</button>)}
        </div>
      </div>
      <div className="grid">{popular.map((p) => <ProductCard key={p.id} product={p} />)}</div>
      <p className="notice">Prices come from the shop list and can be changed in admin. Pack photos are still being added for some products.</p>
    </Chrome>
  );
}
