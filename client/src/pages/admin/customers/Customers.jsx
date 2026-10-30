import { useEffect, useState } from 'react';
import AdminLayout from '../AdminLayout.jsx';
import { useShop } from '../../../shop.jsx';

export default function Customers() {
  const { api } = useShop();
  const [people, setPeople] = useState([]);
  const [error, setError] = useState('');

  useEffect(() => {
    api('/api/admin/customers').then((data) => setPeople(data.customers)).catch((err) => setError(err.message));
  }, [api]);

  return (
    <AdminLayout>
      <h1>Customers</h1>
      {error ? <p className="err">{error}</p> : null}
      <div className="table-wrap"><table>
        <thead><tr><th>Name</th><th>Cell</th><th>Address</th><th>Orders</th></tr></thead>
        <tbody>
          {people.map((person) => (
            <tr key={person.id}>
              <td>{person.name}</td>
              <td>{person.cell}</td>
              <td>{(person.places || []).length ? person.places.map((place) => (
                <div key={place.id}>{place.label}: {place.line}{place.lat != null ? ' · pin' : ''}</div>
              )) : '—'}</td>
              <td>{person.orders}</td>
            </tr>
          ))}
        </tbody>
      </table></div>
      {!people.length && !error ? <p className="empty">No customer accounts yet.</p> : null}
    </AdminLayout>
  );
}
