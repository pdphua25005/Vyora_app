import { useState } from 'react';
import { Link } from 'react-router';
import { HomeHeaderArtwork } from './HomeArtwork';
import HomeAccountMenu from './HomeAccountMenu';
import { cartQuantity, useCart } from '../../services/cart';

export default function HomeHeader({ user, onLogout, onSearch, initialQuery = '' }) {
  const [query, setQuery] = useState(initialQuery);
  const cartCount = cartQuantity(useCart().items);

  function submit(event) {
    event.preventDefault();
    const term = query.trim();
    if (!term) return;
    if (onSearch(term) === false) {
      const input = event.currentTarget.elements.search;
      input.setCustomValidity('Chưa tìm thấy nội dung phù hợp trên trang chủ.');
      input.reportValidity();
    }
  }

  return (
    <header className="home-header" data-auth-view={user === null ? 'guest' : 'session'}>
      <HomeHeaderArtwork />
      <Link className="home-hit home-logo" to="/" aria-label="Về trang chủ Vyora" />
      <form className="home-search" role="search" onSubmit={submit}>
        <input
          name="search"
          aria-label="Tìm kiếm trên Vyora"
          placeholder="Vyora du lịch thả ga, không lo về giá - Đăng ký ngay"
          value={query}
          onChange={event => {
            event.target.setCustomValidity('');
            setQuery(event.target.value);
          }}
        />
        <button type="submit" aria-label="Tìm kiếm" />
      </form>
      {user ? (
        <HomeAccountMenu user={user} onLogout={onLogout} />
      ) : user === null && (
        <>
          <Link className="home-hit home-register" to="/register" aria-label="Đăng ký" />
          <Link className="home-hit home-login" to="/login" aria-label="Đăng nhập" />
        </>
      )}
      <Link className="home-hit home-cart-link" to="/cart" aria-label={`Giỏ hàng chuyến đi, ${cartCount} sản phẩm`}>
        {cartCount > 0 && <span>{cartCount}</span>}
      </Link>
      <Link className="home-hit home-forum" to="/forum" aria-label="Diễn đàn" />
    </header>
  );
}
