import { useState } from 'react';
import { Link } from 'react-router-dom';
import Chrome from '../../components/Chrome.jsx';
import ProductCard, { Shelf } from '../../components/ProductCard.jsx';
import { Photo, money, shortCategory, useShop } from '../../shop.jsx';

export default function Home() {
  const { boot, catalog } = useShop();
  const [tab, setTab] = useState('all');
  const categories = boot?.categories || [];
  const settings = boot?.settings || {};
  const counts = {};
  catalog.forEach((p) => { counts[p.category] = (counts[p.category] || 0) + 1; });
  const popular = catalog.filter((p) => p.category !== 'combo' && (tab === 'all' || p.category === tab)).slice(0, 8);
  const rails = ['combo', 'staples', 'fresh', 'drinks', 'home'];

  return (
    <Chrome active="front">
      <div className="home-layout">
        <aside className="side">
          <h2>Departments</h2>
          {categories.map((c) => (
            <Link className="dept" key={c.slug} to={'/shop?cat=' + c.slug}>
              <span>{c.name}</span><em>{counts[c.slug] || 0}</em>
            </Link>
          ))}
        </aside>
        <div>
          <section className="hero">
            <div className="hero-copy">
              <p className="kicker">Kranskop · this week</p>
              <h1>Friday specials</h1>
              <p>Rice, flour, sugar and cooking oil, while stocks last.</p>
              <Link className="btn light" to="/shop?specials=1">Shop specials</Link>
            </div>
            <Link className="hero-photo" to="/shop?cat=combo">
              <img src="/shared/img/combos/c1.jpg" alt="Stokvel combo packs" />
              <span>Stokvel combos</span>
            </Link>
          </section>
          <div className="promises">
            <article>
              <b>Free delivery over {money(settings.free_over || 500)}</b>
              <span>Picked in the shop and brought to your gate.</span>
            </article>
            <article>
              <b>Delivery from {money(settings.fee || 25)}</b>
              <span>Delivery orders start at {money(settings.min_delivery || 150)}.</span>
            </article>
            <article>
              <b>Cash or card at the door</b>
              <span>Or collect free at {settings.address || 'the shop'}.</span>
            </article>
          </div>

          <h2 className="depthead">Shop by department</h2>
          <div className="qs">
            {categories.map((c) => {
              const sample = catalog.find((p) => p.category === c.slug && p.photo) || catalog.find((p) => p.category === c.slug);
              return (
                <Link key={c.slug} to={'/shop?cat=' + c.slug}>
                  <span className="thumb">{sample ? <Photo product={sample} /> : null}</span>
                  <span>{shortCategory(c.slug, c.name)}</span>
                </Link>
              );
            })}
          </div>

          {rails.map((slug) => {
            const cat = categories.find((c) => c.slug === slug);
            const list = catalog.filter((p) => p.category === slug).slice(0, 10);
            if (!cat || !list.length) return null;
            return (
              <section key={slug}>
                <div className="rowh">
                  <h2>{cat.name}</h2>
                  <Link className="lk" to={'/shop?cat=' + slug}>View all</Link>
                </div>
                <Shelf products={list} />
              </section>
            );
          })}

          <div className="rowh">
            <h2>Browse the shelf</h2>
          </div>
          <div className="chips-scroll" role="tablist" aria-label="Filter groceries">
            <button type="button" className="chip" aria-pressed={tab === 'all'} onClick={() => setTab('all')}>All</button>
            {categories.filter((c) => c.slug !== 'combo').map((c) => (
              <button key={c.slug} type="button" className="chip" aria-pressed={tab === c.slug} onClick={() => setTab(c.slug)}>{shortCategory(c.slug, c.name)}</button>
            ))}
          </div>
          <div className="grid">{popular.map((p) => <ProductCard key={p.id} product={p} />)}</div>
          <p className="notice">Prices come from the shop list and can be changed in admin. Some pack photos are still being added.</p>
        </div>
      </div>
    </Chrome>
  );
}
