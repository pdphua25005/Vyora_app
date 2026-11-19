import { useEffect, useState } from 'react';
import { Link } from 'react-router';
import { formatPrice, formatSlot } from '../../services/cart';
import { orderRequest } from '../../services/orders';
import { productImage, productPath } from '../FlashSale/products';
import './Orders.css';

function ReviewForm({ orderId, item, onSaved, onCancel }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  async function submit(event) {
    event.preventDefault();
    if (busy) return;

    const fields = new FormData(event.currentTarget);
    const comment = fields.get('comment').trim();
    if (!comment) {
      setError('Hãy nhập nhận xét của bạn.');
      return;
    }

    setBusy(true);
    setError('');
    try {
      const { review } = await orderRequest(`orders/${orderId}/items/${item._id}/review`, {
        rating: Number(fields.get('rating')),
        comment,
      });
      onSaved(review);
    } catch (error) {
      setError(error.message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <form className="purchase-review" onSubmit={submit}>
      <label>Điểm đánh giá
        <select name="rating" defaultValue="5">
          {[5, 4, 3, 2, 1].map(rating => <option value={rating} key={rating}>{rating} sao</option>)}
        </select>
      </label>
      <label>Nhận xét
        <textarea name="comment" rows={3} maxLength={500} required />
      </label>
      {error && <p role="alert">{error}</p>}
      <div className="purchase-review-actions">
        <button type="button" onClick={onCancel} className="profile-text-button" disabled={busy}>Hủy</button>
        <button type="submit" className="account-primary" disabled={busy}>{busy ? 'Đang gửi…' : 'Gửi đánh giá'}</button>
      </div>
    </form>
  );
}

export default function Orders() {
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [attempt, setAttempt] = useState(0);
  const [editingItem, setEditingItem] = useState(null);

  useEffect(() => {
    let active = true;
    orderRequest('orders').then(result => {
      if (active) setOrders(result.orders);
    }).catch(error => {
      if (active) setError(error.message);
    }).finally(() => {
      if (active) setLoading(false);
    });
    return () => { active = false; };
  }, [attempt]);

  function saveReview(orderId, itemId, review) {
    setOrders(current => current.map(order => {
      if (order._id !== orderId) return order;
      return {
        ...order,
        items: order.items.map(item => item._id === itemId ? { ...item, review } : item),
      };
    }));
    setEditingItem(null);
  }

  if (loading) return <p className="account-state" role="status">Đang tải đơn đã mua…</p>;
  if (error) return (
    <div className="account-state">
      <p role="alert">{error}</p>
      <button className="account-primary" type="button" onClick={() => {
        setError('');
        setLoading(true);
        setAttempt(value => value + 1);
      }}>Thử lại</button>
    </div>
  );
  if (!orders.length) return (
    <div className="account-orders">
      <h2>Bạn chưa có đơn đã mua</h2>
      <Link className="account-primary" to="/flash-sale">Khám phá Flash Sale</Link>
    </div>
  );

  return (
    <div className="purchase-list">
      {orders.map(order => (
        <article className="purchase-order" key={order._id}>
          <header className="purchase-heading">
            <strong>Đơn hàng {order._id.slice(0, 8).toUpperCase()}</strong>
            <span>{new Date(order.createdAt).toLocaleDateString('vi-VN')} · Đã đặt</span>
          </header>
          {order.items.map(item => (
            <div className="purchase-line" key={item._id}>
              <div className="purchase-item">
                <img src={productImage(item.image)} alt="" />
                <div>
                  <Link to={productPath(item.slug)}>{item.name}</Link>
                  <p>{formatSlot(item.date, item.time)} · Số lượng {item.quantity}</p>
                </div>
                <strong>{formatPrice(item.price * item.quantity)}</strong>
              </div>
              <div className="purchase-item-actions">
                {item.review ? (
                  <Link to={productPath(item.slug) + '#product-reviews'}>Đã đánh giá · {item.review.rating}/5 sao</Link>
                ) : editingItem !== item._id && (
                  <button className="account-primary" type="button" onClick={() => setEditingItem(item._id)}>Đánh giá</button>
                )}
              </div>
              {editingItem === item._id && (
                <ReviewForm orderId={order._id} item={item}
                  onSaved={review => saveReview(order._id, item._id, review)} onCancel={() => setEditingItem(null)} />
              )}
            </div>
          ))}
          {order.note && <p className="purchase-note">Lời nhắn · {order.note}</p>}
          <footer className="purchase-total">Tổng tiền <strong>{formatPrice(order.total)}</strong></footer>
        </article>
      ))}
    </div>
  );
}
