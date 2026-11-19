import { hotDealProducts } from '../FlashSale/hotDealProducts';
import { useEffect, useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router';
import { cartQuantity, formatSlot, formatPrice, priceInDong, useCart, saveCart, voucherDiscount, voucherIsValid } from '../../services/cart';
import { products, productImage, productPath, saleAssets } from '../FlashSale/products';
import ShopHeader from '../Home/ShopHeader';
import './Cart.css';

function CartRow({ item, selected, onSelect, onQuantity, onTime, onRemove }) {
  const hotDeal = hotDealProducts.find(product => product.slug === item.slug);
  const product = hotDeal ?? products.find(product => product.slug === item.slug);
  const maxQuantity = product?.stock ?? 99;

  return (
    <div className="cart-columns cart-row">
      <div className="cart-product">
        <input type="checkbox" aria-label={`Chọn ${item.name}, ngày ${item.date}`} checked={selected} onChange={onSelect} />
        <Link className="cart-product-link" to={productPath(item.slug)}>
          <img src={productImage(item.image)} alt="" />
          <div><span>{item.name}</span><small>{hotDeal?.offer ?? (item.image.startsWith('/') ? 'Gợi ý hôm nay' : 'Flash Sale')}</small></div>
        </Link>
        <div className="cart-product-date">
          <span>Ngày giờ sử dụng</span>
          <strong>{formatSlot(item.date, item.time)}</strong>
          {!item.time && <label>Chọn giờ <input type="time" aria-label={`Chọn giờ cho ${item.name}`}
            value="" onChange={event => onTime(event.target.value)} /></label>}
        </div>
      </div>
      <div className="cart-unit"><span className="cart-mobile-label">Đơn giá</span>{item.price}</div>
      <div className="cart-quantity" aria-label={`Số lượng ${item.name}`}>
        <button type="button" aria-label={`Giảm số lượng ${item.name}`} disabled={item.quantity <= 1}
          onClick={() => onQuantity(item.quantity - 1)}>−</button>
        <output>{item.quantity}</output>
        <button type="button" aria-label={`Tăng số lượng ${item.name}`} disabled={item.quantity >= maxQuantity}
          onClick={() => onQuantity(item.quantity + 1)}>+</button>
      </div>
      <strong className="cart-line-total">{formatPrice(priceInDong(item.price) * item.quantity)}</strong>
      <div className="cart-row-actions">
        <button type="button" aria-label={`Xóa ${item.name}`} onClick={onRemove}>Xóa</button>
        <Link to="/flash-sale">Xem sản phẩm tương tự</Link>
      </div>
    </div>
  );
}

function Suggestions() {
  return (
    <section className="cart-suggestions" aria-labelledby="cart-suggestions-title">
      <div className="cart-suggestions-heading">
        <h2 id="cart-suggestions-title">CÓ THỂ BẠN CŨNG THÍCH</h2>
        <Link to="/flash-sale">Xem tất cả ›</Link>
      </div>
      <div className="cart-suggestion-grid">
        {products.map(product => (
          <Link key={product.slug} to={`/flash-sale/${product.slug}`} className="cart-suggestion">
            <img src={saleAssets + product.image} alt="" />
            <div><span>{product.name}</span><strong>{product.price}</strong></div>
          </Link>
        ))}
      </div>
    </section>
  );
}

function VoucherIcon() {
  return <img className="cart-voucher-icon" src={saleAssets + 'voucher.svg'} alt="" />;
}

export default function Cart() {
  const cart = useCart();
  return <CartPage key={String(cart.owner)} cart={cart} />;
}

function CartPage({ cart: { owner, items } }) {
  const { state: selection } = useLocation();
  const state = selection?.cartOwner === owner ? selection : null;
  const navigate = useNavigate();
  const [selectedIds, setSelectedIds] = useState(() => state?.selectedIds ?? (state?.selectedId ? [state.selectedId] : []));
  const [voucherOpen, setVoucherOpen] = useState(false);
  const [voucherCode, setVoucherCode] = useState(state?.voucherApplied ? 'VYORA10' : '');
  const [voucherApplied, setVoucherApplied] = useState(state?.voucherApplied === true);
  const [voucherMessage, setVoucherMessage] = useState('');

  useEffect(() => {
    window.scrollTo(0, 0);
  }, []);

  function updateCart(nextItems) {
    saveCart(nextItems, owner);
  }

  function toggleItem(id) {
    if (selectedIds.includes(id)) {
      setSelectedIds(selectedIds.filter(selectedId => selectedId !== id));
    } else {
      setSelectedIds([...selectedIds, id]);
    }
  }

  function removeItems(ids) {
    updateCart(items.filter(item => !ids.includes(item.id)));
    setSelectedIds(selectedIds.filter(id => !ids.includes(id)));
  }

  function applyVoucher(event) {
    event.preventDefault();
    const validCode = voucherIsValid(voucherCode);
    setVoucherApplied(validCode);
    setVoucherMessage(validCode ? 'Đã áp dụng mã VYORA10.' : 'Mã không hợp lệ. Bạn có thể dùng thử VYORA10.');
  }

  const selected = items.filter(item => selectedIds.includes(item.id));
  const allSelected = items.length > 0 && selected.length === items.length;
  const needsTime = selected.some(item => !item.time);
  const selectedCount = cartQuantity(selected);
  const subtotal = selected.reduce((sum, item) => sum + priceInDong(item.price) * item.quantity, 0);
  const discount = voucherDiscount(subtotal, voucherApplied);
  const total = subtotal - discount;

  function selectAll() {
    setSelectedIds(allSelected ? [] : items.map(item => item.id));
  }

  function showVoucher() {
    setVoucherOpen(true);
  }

  function startCheckout() {
    const checkout = { selectedIds: selected.map(item => item.id), voucherApplied, cartOwner: owner };
    if (owner === null) navigate('/login', { state: { checkout } });
    else navigate('/checkout', { state: checkout });
  }

  return (
    <div className="vyora-cart">
      <ShopHeader />
      <main className="cart-width cart-main" aria-label="Giỏ hàng">
        {owner === undefined ? (
          <p className="cart-empty" role="status">Đang tải giỏ hàng…</p>
        ) : items.length === 0 ? (
          <section className="cart-empty">
            <img src="/assets/vyora/ffa9fc7aecabf920.svg" alt="" />
            <h2>Giỏ hàng của bạn đang trống</h2>
            <Link className="cart-primary" to="/flash-sale">Khám phá Flash Sale</Link>
          </section>
        ) : (
          <>
            <div className="cart-columns cart-table-heading">
              <label><input type="checkbox" checked={allSelected} onChange={selectAll} /> Sản phẩm</label>
              <span>Đơn giá</span><span>Số lượng</span><span>Số tiền</span><span>Thao tác</span>
            </div>
            <section className="cart-store" aria-label="Vyora Camping & Travel">
              <label className="cart-store-heading">
                <input type="checkbox" aria-label="Chọn cửa hàng Vyora Camping & Travel" checked={allSelected} onChange={selectAll} />
                <img src={saleAssets + 'seller.png'} alt="" />
                <strong>Vyora Camping &amp; Travel</strong>
              </label>
              {items.map(item => (
                <CartRow key={item.id} item={item} selected={selectedIds.includes(item.id)}
                  onSelect={() => toggleItem(item.id)}
                  onQuantity={quantity => updateCart(items.map(row => row.id === item.id ? { ...row, quantity } : row))}
                  onTime={time => updateCart(items.map(row => row.id === item.id ? { ...row, time } : row))}
                  onRemove={() => removeItems([item.id])} />
              ))}
              <div className="cart-store-voucher">
                <VoucherIcon /><button type="button" className="cart-text-button" onClick={showVoucher}>Thêm voucher Vyora</button>
              </div>
            </section>

            <section className="cart-summary" aria-label="Tổng tiền giỏ hàng">
              <div className="cart-summary-line">
                <strong><VoucherIcon /> Voucher Vyora</strong>
                <button type="button" className="cart-text-button" aria-expanded={voucherOpen}
                  onClick={() => setVoucherOpen(!voucherOpen)}>{voucherOpen ? 'Đóng' : 'Chọn hoặc nhập mã'}</button>
              </div>
              {voucherOpen && (
                <form className="cart-voucher-form" onSubmit={applyVoucher}>
                  <label htmlFor="cart-code">Mã thử nghiệm VYORA10</label>
                  <input id="cart-code" value={voucherCode} onChange={event => setVoucherCode(event.target.value)} placeholder="Nhập mã voucher" />
                  <button type="submit" className="cart-primary">Áp dụng</button>
                  <p role="status">{voucherMessage}</p>
                </form>
              )}
              <div className="cart-summary-line cart-discount"><span>Giảm giá voucher</span><strong>−{formatPrice(discount)}</strong></div>
              {needsTime && <p className="cart-summary-line">Hãy chọn giờ sử dụng cho các sản phẩm đã chọn.</p>}
              <div className="cart-summary-bottom">
                <label><input type="checkbox" checked={allSelected} onChange={selectAll} /> Chọn tất cả ({items.length})</label>
                <button type="button" className="cart-text-button" disabled={!selected.length} onClick={() => removeItems(selectedIds)}>Xóa đã chọn</button>
                <div className="cart-grand-total">Tổng cộng ({selectedCount} sản phẩm) <output>{formatPrice(total)}</output></div>
                <button type="button" className="cart-primary cart-checkout" disabled={!selected.length || needsTime}
                  title={needsTime ? 'Hãy chọn giờ sử dụng cho sản phẩm.' : undefined}
                  onClick={startCheckout}>Mua hàng</button>
              </div>
            </section>
          </>
        )}
        <Suggestions />
      </main>
    </div>
  );
}
