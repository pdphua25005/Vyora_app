import { useEffect, useState } from 'react';
import { Link, useLocation, useNavigate, useParams } from 'react-router';
import SaleLayout from './SaleLayout';
import { getCart, saveCart } from '../../services/cart';
import ProductGrid from './ProductGrid';
import ProductDetail from './ProductDetail';
import { products, saleAssets } from './products';
import { recommendedProducts } from './recommendedProducts';
import { hotDealProducts } from './hotDealProducts';

const times = ['21:00', '22:00', '00:00', '02:00', '09:00', '12:00'];
const initialSeconds = 29 * 60 + 31;

function SaleHeading() {
  const [seconds, setSeconds] = useState(initialSeconds);

  useEffect(() => {
    const endTime = Date.now() + initialSeconds * 1000;
    const timer = window.setInterval(() => {
      const remaining = Math.max(0, Math.ceil((endTime - Date.now()) / 1000));
      setSeconds(remaining);
      if (remaining === 0) window.clearInterval(timer);
    }, 1000);
    return () => window.clearInterval(timer);
  }, []);

  const clock = [Math.floor(seconds / 3600), Math.floor(seconds / 60) % 60, seconds % 60];

  return (
    <>
      <div className="sale-countdown">
        <img className="sale-logo" src={saleAssets + 'flash-sale-logo.png'} alt="Flash Sale" />
        <img src={saleAssets + 'alarm.svg'} alt="" />
        <span>KẾT THÚC TRONG</span>
        <div className="sale-clock" aria-label="Giờ, phút, giây còn lại">
          {clock.map((number, index) => <span key={index}>{String(number).padStart(2, '0')}</span>)}
        </div>
      </div>
      <img className="sale-banner" src={saleAssets + 'banner.png'} alt="Vyora Flash Sale – Nền tảng du lịch thông minh" />
      <div className="sale-schedule" aria-label="Khung giờ Flash Sale">
        {times.map((time, index) => (
          <div className={index === 0 ? 'sale-time-active' : ''} key={time}>
            <strong>{time}</strong>
            <span>{index === 0 ? 'Đang diễn ra' : index === 1 ? 'Sắp diễn ra' : 'Coming soon'}</span>
          </div>
        ))}
      </div>
    </>
  );
}

export default function FlashSale({ recommended = false }) {
  const { slug } = useParams();
  const navigate = useNavigate();
  const { hash } = useLocation();
  const catalog = recommended ? [...recommendedProducts, ...hotDealProducts] : products;
  const product = catalog.find(item => item.slug === slug);
  const relatedProducts = recommended
    ? (product?.offer ? hotDealProducts : recommendedProducts).filter(item => item.slug !== slug).slice(0, 6)
    : products;

  useEffect(() => {
    if (hash === '#product-reviews') {
      document.getElementById('product-reviews')?.scrollIntoView();
    } else {
      window.scrollTo(0, 0);
    }
  }, [slug, hash]);

  function addToCart(quantity, date, time, buyNow) {
    const { owner, items: currentCart } = getCart();
    if (owner === undefined) return 'Đang kiểm tra phiên đăng nhập. Vui lòng thử lại.';
    const existing = currentCart.find(item => item.slug === product.slug && item.date === date && item.time === time);
    const id = existing?.id ?? (product.slug + '/' + date + '/' + time);
    const newQuantity = (existing?.quantity || 0) + quantity;
    if (newQuantity > (product.stock ?? 99)) {
      return `Chỉ còn ${product.stock ?? 99} sản phẩm cho khung giờ này.`;
    }
    if (existing) {
      saveCart(currentCart.map(item => item.id === id ? { ...item, quantity: newQuantity } : item), owner);
    } else {
      const { slug, name, price, image } = product;
      saveCart([...currentCart, { id, slug, name, price, image, quantity, date, time }], owner);
    }
    if (buyNow && owner === null) {
      navigate('/login', { state: { checkout: { selectedIds: [id], cartOwner: null } } });
    } else if (buyNow) {
      navigate('/cart', { state: { selectedId: id, cartOwner: owner } });
    }
    return '';
  }

  return (
    <SaleLayout detail={Boolean(product)}>
      {product ? (
        <ProductDetail key={slug} product={product} relatedProducts={relatedProducts} addToCart={addToCart} />
      ) : slug ? (
        <main className="sale-width sale-not-found">
          <h1>Sản phẩm không tồn tại</h1>
          <Link to={recommended ? '/' : '/flash-sale'}>Quay lại {recommended ? 'trang chủ' : 'Flash Sale'}</Link>
        </main>
      ) : (
        <main className="sale-width sale-list">
          <SaleHeading />
          <h1 className="sale-list-title"><span>TOP SẢN PHẨM NỔI BẬT</span></h1>
          <ProductGrid />
        </main>
      )}
    </SaleLayout>
  );
}
