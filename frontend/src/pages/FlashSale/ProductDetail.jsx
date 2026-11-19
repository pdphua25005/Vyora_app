import { useEffect, useState } from 'react';
import { priceInDong } from '../../services/cart';
import { orderRequest } from '../../services/orders';
import ProductGrid from './ProductGrid';
import { ProfileAvatar } from '../Auth/AccountProfile';
import { productImage, saleAssets } from './products';

const columns = [0, 1, 2, 3, 4];

function GalleryImage({ product, index }) {
  if (index === null || (product.gallery && index === 0)) {
    return <img src={productImage(product.cover || product.image)} alt={product.name} />;
  }
  if (product.gallery) {
    const folder = product.galleryFolder ?? 'recommended-gallery';
    const image = `/assets/vyora/${folder}/${product.slug}-${index}.webp`;
    return <img src={image} alt={product.gallery[index - 1]} loading="lazy" />;
  }
  if (product.galleryRow === undefined) {
    return <img src={saleAssets + `cai-rang-${index + 1}.png`} alt={`Ảnh ${index + 1} của ${product.name}`} />;
  }

  // Ảnh Figma gồm 5 hàng và 5 cột. Khung ảnh chỉ hiện một ô.
  return (
    <span className="sale-photo-tile" role="img" aria-label={`Ảnh minh họa ${index + 1} của ${product.name}`}
      style={{ backgroundPosition: `${index * 25}% ${product.galleryRow * 25}%` }} />
  );
}

function Gallery({ product }) {
  const [selected, setSelected] = useState(null);
  const activeIndex = selected ?? (product.gallery ? 0 : null);
  const labels = product.gallery
    ? ['Xem ảnh bìa', ...product.gallery]
    : columns.map(index => `Xem ảnh ${index + 1}`);

  return (
    <div className="sale-gallery">
      <button className="sale-cover" type="button" onClick={() => setSelected(null)}
        aria-label="Hiện ảnh bìa sản phẩm">
        <GalleryImage product={product} index={selected} />
      </button>
      <div className="sale-thumbnails">
        {labels.map((label, index) => (
          <button type="button" key={label} aria-pressed={activeIndex === index}
            aria-label={label} onClick={() => setSelected(index)}>
            <GalleryImage product={product} index={index} />
          </button>
        ))}
      </div>
    </div>
  );
}

function Seller() {
  return (
    <section className="sale-seller">
      <div className="sale-seller-info">
        <img src={saleAssets + 'seller.png'} alt="" />
        <div>
          <h2>Vyora Camping &amp; Travel</h2>
          <p>Online 3 phút trước</p>
          <div className="sale-seller-actions"><span>Chat ngay</span><span>Xem cửa hàng</span></div>
        </div>
      </div>
      <dl><dt>Đánh giá</dt><dd>4.8 / 5</dd><dt>Sản phẩm</dt><dd>85</dd></dl>
      <dl><dt>Tỉ lệ phản hồi</dt><dd>98%</dd><dt>Thời gian phản hồi</dt><dd>Trong vài giờ</dd></dl>
      <dl><dt>Người theo dõi</dt><dd>27,6k</dd></dl>
    </section>
  );
}

function Reviews({ reviews, message, average }) {
  return (
    <section className="sale-reviews" id="product-reviews">
      <h2>ĐÁNH GIÁ SẢN PHẨM</h2>
      {reviews.length > 0 && (
        <div className="sale-review-summary">
          <div>
            <p><strong>{average}</strong> trên 5</p>
            <span className="sale-review-stars" aria-hidden="true">{'★'.repeat(Math.round(Number(average)))}</span>
          </div>
          <p>{reviews.length} đánh giá từ khách đã mua</p>
        </div>
      )}
      {message && <p className="sale-review-empty" role="status">{message}</p>}
      {!message && reviews.length === 0 && <p className="sale-review-empty">Chưa có đánh giá cho sản phẩm này</p>}
      {reviews.map(review => (
        <article className="sale-review" key={review._id}>
          <ProfileAvatar className="sale-review-avatar" user={{ username: review.author, avatar: review.avatar }} />
          <div className="sale-review-body">
            <strong>{review.author}</strong>
            <p className="sale-review-stars" aria-label={`${review.rating} trên 5 sao`}>{'★'.repeat(review.rating)}{'☆'.repeat(5 - review.rating)}</p>
            <p className="sale-review-note">Đã mua hàng · {new Date(review.date).toLocaleDateString('vi-VN')}</p>
            <p className="sale-review-comment">{review.comment}</p>
          </div>
        </article>
      ))}
    </section>
  );
}

function ProductOrder({ product, addToCart, reviewCount, average }) {
  const [quantity, setQuantity] = useState(1);
  const [date, setDate] = useState('');
  const [time, setTime] = useState('');
  const [message, setMessage] = useState('');
  const [hasError, setHasError] = useState(false);
  const maxQuantity = product.stock || 99;
  const discount = product.facts
    ? Math.round((1 - priceInDong(product.price) / priceInDong(product.oldPrice)) * 100)
    : 0;

  function submit(event) {
    event.preventDefault();
    const buyNow = event.nativeEvent.submitter?.value === 'buy';
    const error = addToCart(quantity, date, time, buyNow);
    setHasError(Boolean(error));
    setMessage(error || 'Đã thêm vào giỏ hàng chuyến đi.');
  }

  return (
    <form className="sale-order" onSubmit={submit}>
      <div className="sale-product-title">
        <span>{product.category || 'Yêu thích+'}</span>
        <h1>{product.title || product.name}</h1>
      </div>
      {product.facts && <p className="sale-product-summary">{product.summary}</p>}
      <div className="sale-order-rating">
        <div>{average || '—'} <span aria-hidden="true">{'★'.repeat(Math.round(Number(average)))}{'☆'.repeat(5 - Math.round(Number(average)))}</span></div>
        <div>{reviewCount} <small>Đánh giá</small></div>
        {product.category ? <div>{product.location || product.category}</div> : <div>{product.sold ?? '—'} <small>Đã bán</small></div>}
      </div>
      <div className="sale-order-price">
        <strong>{product.price}</strong>
        {product.category && product.oldPrice && <del>{product.oldPrice}</del>}
        {discount > 0 ? <span className="sale-discount">Giảm {discount}%</span> : (
          <span><img src={saleAssets + 'voucher.svg'} alt="" /> {product.offer || 'Giá sau voucher'}</span>
        )}
      </div>
      {!product.facts && (
        <div className="sale-order-row">
          <span>Vận chuyển</span>
          <span><img src={saleAssets + 'delivery.svg'} alt="" /> Không hỗ trợ</span>
        </div>
      )}
      <div className="sale-order-row">
        <label htmlFor="sale-date">{product.bookingLabel || 'Ngày giờ sử dụng'}</label>
        <span><img src={saleAssets + 'calendar.svg'} alt="" />
          <input id="sale-date" type="date" value={date} required onChange={event => setDate(event.target.value)} />
          <input id="sale-time" type="time" aria-label="Giờ sử dụng" value={time} required onChange={event => setTime(event.target.value)} />
        </span>
      </div>
      <div className="sale-order-row">
        <span>{product.quantityLabel || 'Số lượng'}</span>
        <div className="sale-quantity">
          <button type="button" aria-label="Giảm số lượng" disabled={quantity <= 1} onClick={() => setQuantity(quantity - 1)}>−</button>
          <output>{quantity}</output>
          <button type="button" aria-label="Tăng số lượng" disabled={quantity >= maxQuantity} onClick={() => setQuantity(quantity + 1)}>+</button>
        </div>
        <span>{product.stock ? product.status : 'CÒN HÀNG'}</span>
      </div>
      <div className="sale-order-buttons">
        <button className="sale-add" type="submit"><img src={saleAssets + 'add-cart.svg'} alt="" />Thêm vào giỏ hàng</button>
        <button className="sale-voucher" type="submit" value="buy">Mua với Voucher<strong>{product.price}</strong></button>
      </div>
      <p role="status" className={hasError ? 'sale-order-error' : 'sale-order-message'}>{message}</p>
    </form>
  );
}

export default function ProductDetail({ product, relatedProducts, addToCart }) {
  const [reviews, setReviews] = useState([]);
  const [message, setMessage] = useState('Đang tải đánh giá…');

  useEffect(() => {
    let active = true;
    orderRequest(`products/${product.slug}/reviews`).then(result => {
      if (!active) return;
      setReviews(result.reviews);
      setMessage('');
    }).catch(error => {
      if (active) setMessage(error.message);
    });
    return () => { active = false; };
  }, [product.slug]);

  const score = reviews.reduce((total, review) => total + review.rating, 0);
  const average = reviews.length ? (score / reviews.length).toFixed(1) : '';

  return (
    <main className="sale-width sale-detail">
      <section className="sale-product">
        <Gallery product={product} />
        <ProductOrder product={product} addToCart={addToCart} reviewCount={reviews.length} average={average} />
      </section>
      <Seller />
      <section className="sale-description">
        <h2>CHI TIẾT SẢN PHẨM</h2>
        <div>
          {product.facts && (
            <dl className="sale-product-facts">
              <div><dt>Địa điểm</dt><dd>{product.location}</dd></div>
              {product.facts.map(([label, value]) => (
                <div key={label}><dt>{label}</dt><dd>{value}</dd></div>
              ))}
            </dl>
          )}
          {product.descriptions.map(text => <p key={text}>{text}</p>)}
          {product.notes?.length > 0 && <ul>{product.notes.map(text => <li key={text}>{text}</li>)}</ul>}
        </div>
      </section>
      <Reviews reviews={reviews} message={message} average={average} />
      <ProductGrid items={relatedProducts} />
    </main>
  );
}
