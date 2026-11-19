import { lazy, Suspense, useEffect } from "react";
import { BrowserRouter, Routes, Route, Link, useLocation } from "react-router";

import Home from "./pages/Home/Home";
import Account from "./pages/Auth/Account";
import Login from "./pages/Auth/Login";
import Register from "./pages/Auth/Register";
import Forum from "./pages/Forum/Forum";
import Checkout from "./pages/Checkout/Checkout";
import Cart from "./pages/Cart/Cart";
import FlashSale from "./pages/FlashSale/FlashSale";
import Catalog from "./pages/Catalog/Catalog";
import { watchAuthChanges } from "./services/auth";
import SupportWidget from "./components/chat/SupportWidget";
const Admin = lazy(() => import("./pages/Admin/Admin"));

function AppRoutes() {
  useEffect(watchAuthChanges, []);
  const { pathname } = useLocation();
  const showBasicNav = !pathname.startsWith("/flash-sale") && !pathname.startsWith("/products/") && !pathname.startsWith("/danh-muc/") && !/^\/(?:login|register|account|orders|cart|checkout|forum|admin)?\/?$/i.test(pathname);
  return (
    <>
      {showBasicNav && <nav style={{ display: "flex", gap: "20px", padding: "20px" }}>
        <Link to="/">Trang chủ</Link>
        <Link to="/login">Đăng nhập</Link>
        <Link to="/forum">Diễn đàn</Link>
      </nav>}

      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/account" element={<Account />} />
        <Route path="/orders" element={<Account showOrders />} />
        <Route path="/login" element={<Login />} />
        <Route path="/register" element={<Register />} />
        <Route path="/forum" element={<Forum />} />
        <Route path="/cart" element={<Cart />} />
        <Route path="/checkout" element={<Checkout />} />
        <Route path="/admin" element={<Suspense fallback={<p role="status">Đang mở trang quản trị…</p>}><Admin /></Suspense>} />
        <Route path="/products/:slug" element={<FlashSale recommended />} />
        <Route path="/flash-sale/:slug?" element={<FlashSale />} />
        <Route path="/danh-muc/:categoryId" element={<Catalog />} />
      </Routes>
      <SupportWidget />
    </>
  );
}

export default function App() { return <BrowserRouter><AppRoutes /></BrowserRouter>; }
