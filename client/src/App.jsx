import { Route, Routes } from 'react-router-dom';
import Home from './pages/home/Home.jsx';
import Shop from './pages/shop/Shop.jsx';
import Product from './pages/product/Product.jsx';
import Cart from './pages/cart/Cart.jsx';
import Checkout from './pages/checkout/Checkout.jsx';
import SignIn from './pages/sign-in/SignIn.jsx';
import Account from './pages/account/Account.jsx';
import Order from './pages/order/Order.jsx';
import Dashboard from './pages/admin/dashboard/Dashboard.jsx';
import Products from './pages/admin/products/Products.jsx';
import Orders from './pages/admin/orders/Orders.jsx';
import Customers from './pages/admin/customers/Customers.jsx';
import Settings from './pages/admin/settings/Settings.jsx';
import Drivers from './pages/admin/drivers/Drivers.jsx';
import Drive from './pages/drive/Drive.jsx';

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<Home />} />
      <Route path="/shop" element={<Shop />} />
      <Route path="/product/:id" element={<Product />} />
      <Route path="/cart" element={<Cart />} />
      <Route path="/checkout" element={<Checkout />} />
      <Route path="/sign-in" element={<SignIn />} />
      <Route path="/account" element={<Account />} />
      <Route path="/order/:number" element={<Order />} />
      <Route path="/drive" element={<Drive />} />
      <Route path="/driver" element={<Drive />} />
      <Route path="/admin" element={<Dashboard />} />
      <Route path="/admin/drivers" element={<Drivers />} />
      <Route path="/admin/products" element={<Products />} />
      <Route path="/admin/orders" element={<Orders />} />
      <Route path="/admin/customers" element={<Customers />} />
      <Route path="/admin/settings" element={<Settings />} />
    </Routes>
  );
}
