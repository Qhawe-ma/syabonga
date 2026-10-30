import { useMemo, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import Chrome from '../../components/Chrome.jsx';
import ProductCard from '../../components/ProductCard.jsx';
import { useShop } from '../../shop.jsx';

export default function Shop() {
  const { boot, catalog } = useShop();
  const [params] = useSearchParams();
  const [sort, setSort] = useState('');
  const cat = params.get('cat') || '';
  const q = (params.get('q') || '').trim().toLowerCase();
  const known = (boot?.categories || []).find((c) => c.slug === cat);
  const title = q ? 'Results for “' + params.get('q') + '”' : (known ? known.name : 'All groceries');
  const list = useMemo(() => {
    let rows = catalog.filter((p) => (!cat || p.category === cat) && (!q || (p.name + ' ' + p.size).toLowerCase().includes(q)));
    if (sort === 'lo') rows = rows.slice().sort((a, b) => a.price - b.price);
    else if (sort === 'hi') rows = rows.slice().sort((a, b) => b.price - a.price);
    else if (sort === 'az') rows = rows.slice().sort((a, b) => a.name.localeCompare(b.name));
    return rows;
  }, [catalog, cat, q, sort]);

  return (
    <Chrome active={cat}>
      <div className="crumb"><Link to="/">Home</Link> › <span>{title}</span></div>
      <div className="pagehead">
        <h1>{title}</h1>
        <label>Sort <select value={sort} aria-label="Sort" onChange={(e) => setSort(e.target.value)}>
          <option value="">Featured</option>
          <option value="lo">Price, low to high</option>
          <option value="hi">Price, high to low</option>
          <option value="az">Name, A to Z</option>
        </select></label>
      </div>
      {list.length ? <div className="grid">{list.map((p) => <ProductCard key={p.id} product={p} />)}</div> : <p className="empty">No products match that search. Try a shorter word, like “oil”.</p>}
    </Chrome>
  );
}
