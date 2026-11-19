import { useEffect, useRef, useState } from 'react';
import { Link, useSearchParams } from 'react-router';
import HomeArtwork, { SiteFooter } from './HomeArtwork';
import HomeHeader from './HomeHeader';
import HomeForumPosts from './HomeForumPosts';
import HomeOffer from './HomeOffer';
import JourneySuggestion from './JourneySuggestion';
import { authRequest } from '../../services/auth';
import { products } from '../FlashSale/products';
import { categories, categoryPath } from '../Catalog/categories';
import './HomeArtwork.css';
import './Home.css';

// Vị trí 6 thẻ Flash Sale trên khung trang chủ 1920px của Figma.
const saleCardPositions = [133, 401, 666, 934, 1202, 1467];
const featuredProduct = products.find(product => product.slug === 'leu-camping');

function searchHome(frame, query) {
  const normalize = value => value.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLocaleLowerCase('vi');
  const term = normalize(query);
  const result = [...frame.querySelectorAll('p')].find(p => p.dataset.nodeId !== '1:274' && normalize(p.textContent).includes(term));
  if (!result) return false;
  result.scrollIntoView({ behavior: 'smooth', block: 'center' });
  result.animate([
    { outline: '2px solid #0289eb', outlineOffset: '6px' },
    { outline: '2px solid transparent', outlineOffset: '6px' },
  ], { duration: 2000 });
  return true;
}

// The supplied desktop Figma frame is freeform, 1920 × 5677.
// Scale it proportionally to retain its composition on smaller laptop displays.
export default function Home() {
  const frame = useRef(null);
  const [scale, setScale] = useState(() => Math.min(window.innerWidth / 1920, 1));
  const [searchParams] = useSearchParams();
  const initialQuery = searchParams.get('q')?.trim() ?? '';
  const [user, setUser] = useState(undefined);

  useEffect(() => {
    let active = true;
    authRequest('me').then(currentUser => {
      if (active) setUser(currentUser);
    }).catch(() => {
      if (active) setUser(null);
    });
    return () => { active = false; };
  }, []);
  useEffect(() => {
    const resize = () => setScale(Math.min(document.documentElement.clientWidth / 1920, 1));
    resize();
    window.addEventListener('resize', resize);
    return () => window.removeEventListener('resize', resize);
  }, []);
  const jump = (id) => frame.current?.querySelector(`[data-node-id="${id}"]`)?.scrollIntoView({ behavior: 'smooth', block: 'center' });
  useEffect(() => {
    if (!initialQuery || searchHome(frame.current, initialQuery)) return;
    const input = frame.current.querySelector('.home-search input');
    input.focus();
    input.setCustomValidity('Chưa tìm thấy nội dung phù hợp trên trang chủ.');
    input.reportValidity();
  }, [initialQuery]);
  return (
    <main className="vyora-shell" style={{ height: 5677 * scale }}>
      {!initialQuery && featuredProduct && <HomeOffer product={featuredProduct} />}
      <div className="vyora-home" ref={frame} style={{ transform: `scale(${scale})` }}>
        <HomeArtwork />
        <JourneySuggestion onSuggest={() => jump('100:874')} />
        <HomeHeader key={initialQuery} user={user} onLogout={() => setUser(null)} onSearch={term => searchHome(frame.current, term)} initialQuery={initialQuery} />
        <SiteFooter />
        <nav className="home-category-links" aria-label="Danh mục sản phẩm">
          {categories.map(category => (
            <Link key={category.id} to={categoryPath(category.id)} aria-label={category.label} />
          ))}
        </nav>
        {products.map((product, index) => (
          <Link key={product.slug} className="home-hit home-sale-card" to="/flash-sale"
            style={{ left: saleCardPositions[index] }} aria-label={product.name + ' – Xem Flash Sale'} />
        ))}
        <Link className="home-hit home-sale-all" to="/flash-sale" aria-label="Xem tất cả sản phẩm Flash Sale" />
        <HomeForumPosts />
        <Link className="home-hit home-forum-all" to="/forum" aria-label="Xem tất cả bài viết diễn đàn" />
        <button className="home-hit home-more" aria-label="Xem thêm trải nghiệm" onClick={() => jump('100:890')} />
      </div>
    </main>
  );
}
