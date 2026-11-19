import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router';
import { productPath } from '../FlashSale/products';
import { priceInDong } from '../../services/cart';
import './HomeOffer.css';

const sessionKey = 'vyora-camping-offer-dismissed';
let dismissed = false;

function wasDismissed() {
  try {
    return dismissed || sessionStorage.getItem(sessionKey) === '1';
  } catch {
    return dismissed;
  }
}

export default function HomeOffer({ product }) {
  const dialog = useRef(null);
  const [visible, setVisible] = useState(() => !wasDismissed());
  const discount = Math.round(100 * (1 - priceInDong(product.price) / priceInDong(product.oldPrice)));

  useEffect(() => {
    if (visible && !dialog.current.open) dialog.current.showModal();
  }, [visible]);

  function closeOffer() {
    dismissed = true;
    try { sessionStorage.setItem(sessionKey, '1'); } catch { /* Dùng trạng thái trong bộ nhớ. */ }
    dialog.current.close();
    setVisible(false);
  }

  if (!visible) return null;

  return (
    <dialog className="home-offer" ref={dialog} aria-labelledby="home-offer-title"
      onCancel={event => { event.preventDefault(); closeOffer(); }}
      onClick={event => { if (event.target === event.currentTarget) closeOffer(); }}>
      <div className="home-offer-poster">
        <img className="home-offer-art" src="/assets/vyora/camping-offer.jpg" alt="Lều cắm trại màu cam và xám trên nền núi rừng" fetchPriority="high" />
        <button className="home-offer-close" type="button" onClick={closeOffer} aria-label="Đóng ưu đãi">×</button>
        <div className="home-offer-copy">
          <img className="home-offer-logo" src="/assets/vyora/65b144bcd4dd7a5a.png" alt="Vyora" />
          <span className="home-offer-campaign">FLASH SALE</span>
          <h2 id="home-offer-title">{product.name}</h2>
          <div className="home-offer-prices">
            <strong>{product.price}</strong>
            <del>{product.oldPrice}</del>
            <span>−{discount}%</span>
          </div>
        </div>
        <Link className="home-offer-link" to={productPath(product.slug)} onClick={closeOffer}>
          Mua ngay <span aria-hidden="true">→</span>
        </Link>
      </div>
    </dialog>
  );
}
