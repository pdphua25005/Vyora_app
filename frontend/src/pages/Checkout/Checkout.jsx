import { useEffect, useRef, useState } from 'react';
import { Link, Navigate, useLocation, useNavigate } from 'react-router';
import { cartQuantity, formatPrice, formatSlot, priceInDong, getCart, readCart, useCart, saveCart, voucherDiscount, voucherIsValid } from '../../services/cart';
import { orderRequest } from '../../services/orders';
import { authRequest } from '../../services/auth';
import { productImage, productPath, saleAssets } from '../FlashSale/products';
import ShopHeader from '../Home/ShopHeader';
import './Checkout.css';

const methods = [
  { id: 'arrival', label: 'Thanh toán khi nhận hàng', description: 'Thanh toán khi nhận hàng hoặc sử dụng dịch vụ.' },
  { id: 'transfer', label: 'Chuyển khoản ngân hàng', description: 'Chọn chuyển khoản để xem trước đơn hàng theo phương thức này.' },
  { id: 'card', label: 'Thẻ tín dụng / ghi nợ', description: 'Chọn thanh toán bằng thẻ để xem trước đơn hàng theo phương thức này.' },
];

function AddressDialog({ dialog, address, onSave }) {
  function submit(event) {
    event.preventDefault();
    const form = event.currentTarget;
    const values = new FormData(form);
    const street = values.get('street').trim();
    if (!street) {
      form.elements.street.setCustomValidity('Vui lòng nhập địa chỉ cụ thể.');
      form.elements.street.reportValidity();
      return;
    }
    onSave({
      fullName: values.get('fullName').trim(),
      phone: values.get('phone').trim(),
      region: values.get('region').trim(),
      street,
      type: values.get('type'),
    });
    dialog.current.close();
  }

  return (
    <dialog className="checkout-dialog" ref={dialog} aria-labelledby="checkout-address-title"
      onClose={event => event.currentTarget.querySelector('form').reset()}>
      <form onSubmit={submit} key={JSON.stringify(address)}>
        <h2 id="checkout-address-title">{address ? 'Sửa địa chỉ' : 'Địa chỉ mới'}</h2>
        <p>Vui lòng điền địa chỉ nhận hàng và thông tin liên hệ.</p>
        <div className="checkout-address-fields">
          <label>Họ và tên<input name="fullName" autoComplete="name" defaultValue={address?.fullName} pattern=".*\S.*" required /></label>
          <label>Số điện thoại<input name="phone" type="tel" autoComplete="tel" defaultValue={address?.phone} pattern="[+0-9][0-9 ]{8,15}" required /></label>
          <label className="checkout-field-wide">Tỉnh / Thành phố, Phường / Xã
            <input name="region" autoComplete="address-level2" defaultValue={address?.region} pattern=".*\S.*" required />
          </label>
          <label className="checkout-field-wide">Địa chỉ cụ thể
            <textarea name="street" autoComplete="street-address" defaultValue={address?.street}
              onInput={event => event.currentTarget.setCustomValidity('')} required />
          </label>
        </div>
        <fieldset className="checkout-options">
          <legend>Loại địa chỉ</legend>
          {['Nhà riêng', 'Văn phòng'].map(type => (
            <label key={type}><input type="radio" name="type" value={type} defaultChecked={(address?.type || 'Nhà riêng') === type} />{type}</label>
          ))}
        </fieldset>
        <div className="checkout-dialog-actions">
          <button type="button" className="checkout-link" onClick={() => dialog.current.close()}>Trở lại</button>
          <button type="submit" className="checkout-primary">Hoàn thành</button>
        </div>
      </form>
    </dialog>
  );
}

function CheckoutProducts({ items, subtotal, note, onNoteChange }) {
  return (
    <section className="checkout-panel checkout-products" aria-label="Sản phẩm đã chọn">
      <div className="checkout-columns checkout-product-head">
        <h2>Sản phẩm</h2><span>Đơn giá</span><span>Số lượng</span><span>Thành tiền</span>
      </div>
      <div className="checkout-shop">
        <img src={saleAssets + 'seller.png'} alt="" />
        <strong>Vyora Camping &amp; Travel</strong>
      </div>
      {items.map(item => (
        <div className="checkout-columns checkout-item" key={item.id}>
          <div className="checkout-item-name">
            <img src={productImage(item.image)} alt="" />
            <div>
              <Link to={productPath(item.slug)}>{item.name}</Link>
              <small>Ngày giờ sử dụng {formatSlot(item.date, item.time)}</small>
            </div>
          </div>
          <span>{item.price}</span>
          <span>{item.quantity}</span>
          <strong>{formatPrice(priceInDong(item.price) * item.quantity)}</strong>
        </div>
      ))}
      <div className="checkout-delivery">
        <label>Lời nhắn <input placeholder="Lưu ý cho người bán…" maxLength={200} value={note} onChange={event => onNoteChange(event.target.value)} /></label>
        <div>
          <strong>Phương thức nhận hàng / dịch vụ</strong>
          <p>Ngày sử dụng được ghi trên từng sản phẩm.</p>
        </div>
      </div>
      <div className="checkout-subtotal">
        Tổng tiền hàng ({cartQuantity(items)} sản phẩm) <strong>{formatPrice(subtotal)}</strong>
      </div>
    </section>
  );
}

export default function Checkout() {
  const cart = useCart();
  const { state } = useLocation();
  const [session, setSession] = useState(null);
  const [retry, setRetry] = useState(0);

  useEffect(() => {
    let active = true;
    authRequest('me').then(user => {
      if (active) setSession({ userId: user.id });
    }).catch(error => {
      if (!active) return;
      setSession(error.status === 401 ? { guest: true } : { error: error.message });
    });
    return () => { active = false; };
  }, [retry]);

  if (session?.guest || session?.userId && cart.owner === null) {
    return <Navigate to="/login" replace state={{ checkout: state ?? { cartOwner: null } }} />;
  }
  if (session?.userId && cart.owner && session.userId !== cart.owner) {
    return <Navigate to="/cart" replace />;
  }
  if (session?.userId && session.userId === cart.owner) return <CheckoutPage cart={cart} />;

  return (
    <main className="vyora-checkout">
      <div className="checkout-width checkout-main">
        <section className="checkout-panel checkout-empty">
          {session?.error ? (
            <>
              <p role="alert">{session.error}</p>
              <button type="button" className="checkout-primary" onClick={() => {
                setSession(null);
                setRetry(value => value + 1);
              }}>Thử lại</button>
            </>
          ) : <p role="status">Đang kiểm tra đăng nhập…</p>}
        </section>
      </div>
    </main>
  );
}

function CheckoutPage({ cart: { owner, items: cart } }) {
  const { state: selection } = useLocation();
  const navigate = useNavigate();
  const state = selection?.cartOwner === owner ? selection : null;
  const [address, setAddress] = useState(null);
  const [note, setNote] = useState('');
  const [voucherOpen, setVoucherOpen] = useState(false);
  const [code, setCode] = useState(state?.voucherApplied ? 'VYORA10' : '');
  const [voucherApplied, setVoucherApplied] = useState(state?.voucherApplied === true);
  const [voucherMessage, setVoucherMessage] = useState('');
  const [payment, setPayment] = useState(methods[0]);
  const addressDialog = useRef(null);
  const requestId = useRef(null);
  const [saving, setSaving] = useState(false);
  const [order, setOrder] = useState(null);
  const [orderError, setOrderError] = useState(null);

  useEffect(() => {
    window.scrollTo(0, 0);
  }, []);

  const selectedIds = state?.selectedIds ?? [];
  const items = cart.filter(item => selectedIds.includes(item.id));
  const subtotal = items.reduce((sum, item) => sum + priceInDong(item.price) * item.quantity, 0);
  const discount = voucherDiscount(subtotal, voucherApplied);
  const total = subtotal - discount;
  const cartState = { selectedIds, voucherApplied, cartOwner: owner };

  function applyVoucher(event) {
    event.preventDefault();
    const valid = voucherIsValid(code);
    setVoucherApplied(valid);
    setVoucherMessage(valid ? 'Đã áp dụng mã VYORA10.' : 'Mã không hợp lệ. Bạn có thể dùng thử VYORA10.');
  }

  async function placeOrder() {
    if (saving) return;
    if (items.some(item => !item.time)) {
      setOrderError(new Error('Hãy quay lại giỏ hàng để chọn giờ sử dụng.'));
      return;
    }
    if (!address) {
      addressDialog.current.showModal();
      return;
    }
    requestId.current ??= crypto.randomUUID();
    setSaving(true);
    setOrderError(null);
    try {
      const result = await orderRequest('orders', {
        requestId: requestId.current,
        cartOwner: owner,
        items: items.map(({ slug, date, time, quantity }) => ({ slug, date, time, quantity })),
        voucherApplied,
        note,
        payment: payment.id,
      });
      saveCart(readCart(owner).filter(item => !selectedIds.includes(item.id)), owner);
      if (getCart().owner !== owner) return;
      setOrder(result.order);
      window.scrollTo(0, 0);
    } catch (error) {
      if (error.status === 401) navigate('/login', { replace: true, state: { checkout: cartState } });
      else setOrderError(error);
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="vyora-checkout">
      <ShopHeader />
      <main className="checkout-width checkout-main">
        <div className="checkout-title">
          <h1>Thanh toán</h1>
          <Link to="/cart" state={order ? undefined : cartState}>‹ Quay lại giỏ hàng</Link>
        </div>
        {order ? (
          <section className="checkout-panel checkout-empty" role="status">
            <h2>Đặt hàng thành công!</h2>
            <p>Đơn kiểm thử đã được thêm vào mục Đã mua.</p>
            <Link className="checkout-primary" to="/orders">Xem đơn đã mua</Link>
          </section>
        ) : items.length === 0 ? (
          <section className="checkout-panel checkout-empty">
            <p>Chọn sản phẩm trong giỏ hàng để tiếp tục thanh toán.</p>
            <Link className="checkout-primary" to="/cart">Về giỏ hàng</Link>
          </section>
        ) : (
          <>
            <section className="checkout-panel checkout-address">
              <h2>Địa chỉ nhận hàng</h2>
              <div className="checkout-address-line">
                {address ? (
                  <>
                    <strong>{address.fullName} · {address.phone}</strong>
                    <span>{address.street}, {address.region}</span>
                    <small>{address.type}</small>
                  </>
                ) : <span>Chưa có địa chỉ nhận hàng.</span>}
                <button type="button" className="checkout-link" onClick={() => addressDialog.current.showModal()}>
                  {address ? 'Thay đổi' : 'Thêm địa chỉ'}
                </button>
              </div>
            </section>

            <CheckoutProducts items={items} subtotal={subtotal} note={note} onNoteChange={setNote} />

            <section className="checkout-panel checkout-voucher">
              <div>
                <h2><img src={saleAssets + 'voucher.svg'} alt="" />Voucher Vyora</h2>
                {voucherApplied && <strong>VYORA10</strong>}
                <button className="checkout-link" type="button" aria-expanded={voucherOpen}
                  onClick={() => setVoucherOpen(!voucherOpen)}>{voucherOpen ? 'Đóng' : 'Chọn voucher'}</button>
              </div>
              {voucherOpen && (
                <form onSubmit={applyVoucher}>
                  <label>Mã thử nghiệm VYORA10<input value={code} onChange={event => setCode(event.target.value)} /></label>
                  <button className="checkout-primary" type="submit">Áp dụng</button>
                  {voucherApplied && <button className="checkout-link" type="button" onClick={() => {
                    setVoucherApplied(false);
                    setVoucherMessage('Đã bỏ voucher.');
                  }}>Bỏ voucher</button>}
                  <p role="status">{voucherMessage}</p>
                </form>
              )}
            </section>

            <section className="checkout-panel checkout-payment">
              <fieldset className="checkout-options checkout-methods">
                <legend>Phương thức thanh toán</legend>
                {methods.map(method => (
                  <label key={method.id}>
                    <input type="radio" name="payment" checked={payment.id === method.id} onChange={() => setPayment(method)} />
                    {method.label}
                  </label>
                ))}
              </fieldset>
              <div className="checkout-payment-description"><strong>{payment.label}</strong><p>{payment.description}</p></div>
              <dl className="checkout-totals">
                <div><dt>Tổng tiền hàng</dt><dd>{formatPrice(subtotal)}</dd></div>
                <div><dt>Phí vận chuyển dự kiến</dt><dd>{formatPrice(0)}</dd></div>
                <div><dt>Giảm giá voucher</dt><dd>{discount > 0 ? '−' : ''}{formatPrice(discount)}</dd></div>
                <div className="checkout-grand-total"><dt>Tổng thanh toán</dt><dd>{formatPrice(total)}</dd></div>
              </dl>
              <div className="checkout-place-order">
                <p>Thanh toán mẫu · Không thu tiền</p>
                <button type="button" className="checkout-primary" onClick={placeOrder} disabled={saving}>
                  {saving ? 'Đang đặt hàng…' : 'Đặt hàng'}
                </button>
              </div>
              {orderError && (
                <p className="checkout-order-error" role="alert">
                  {orderError.message}
                </p>
              )}
            </section>
            <AddressDialog dialog={addressDialog} address={address} onSave={setAddress} />
          </>
        )}
      </main>
      <footer className="checkout-footer">
        <div className="checkout-width">
          <Link to="/" aria-label="Trang chủ Vyora"><img src="/assets/vyora/65b144bcd4dd7a5a.png" alt="Vyora" /></Link>
          <Link to="/flash-sale">Flash Sale</Link><Link to="/cart">Giỏ hàng</Link><Link to="/account">Tài khoản</Link>
        </div>
      </footer>
    </div>
  );
}
