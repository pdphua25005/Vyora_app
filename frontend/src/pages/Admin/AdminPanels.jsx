import { useEffect, useRef, useState } from 'react';
async function adminRequest(path, options = {}) {
  const { body, ...rest } = options;
  const response = await fetch('/api/admin/' + path, {
    ...rest,
    ...(body === undefined ? {} : {
      headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body),
    }),
  });
  const data = await response.json().catch(() => null);
  if (!response.ok || !data) {
    throw Object.assign(new Error(data?.message || 'Không kết nối được trang quản trị.'), { status: response.status });
  }
  return data;
}

const roles = { user: 'Người dùng', partner: 'Đối tác', admin: 'Quản trị viên' };
const genders = { male: 'Nam', female: 'Nữ', other: 'Khác' };
const payments = { arrival: 'Khi nhận dịch vụ', transfer: 'Chuyển khoản', card: 'Thẻ' };
const categories = ['Kinh nghiệm', 'Lịch trình', 'Hỏi đáp', 'Review'];
const events = {
  register: 'Đăng ký', login: 'Đăng nhập', order: 'Đặt đơn', post: 'Đăng bài',
  comment: 'Bình luận', reply: 'Trả lời', review: 'Đánh giá sản phẩm', reaction: 'Tương tác',
};
const auditActions = {
  'user.edit': 'Sửa tài khoản', 'user.delete': 'Xóa tài khoản', 'user.restore': 'Khôi phục tài khoản',
  'posts.edit': 'Sửa bài viết', 'posts.delete': 'Xóa bài viết',
  'comments.edit': 'Sửa bình luận', 'comments.delete': 'Xóa bình luận',
};
const dateTime = new Intl.DateTimeFormat('vi-VN', {
  timeZone: 'Asia/Ho_Chi_Minh', day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit',
});
const number = new Intl.NumberFormat('vi-VN');
const money = new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' });
const formatDate = date => date ? dateTime.format(new Date(date)) : '—';

const iconPaths = {
  chat: 'M3 3h18v14H9l-6 4z M7 8h10 M7 12h6',
  overview: 'M3 3h7v7H3z M14 3h7v7h-7z M3 14h7v7H3z M14 14h7v7h-7z',
  users: 'M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2 M22 21v-2a4 4 0 0 0-3-4 M13 7a4 4 0 1 1-8 0 4 4 0 0 1 8 0 M17 3a4 4 0 0 1 0 8',
  orders: 'M3 7h18l-1 14H4z M8 8V6a4 4 0 0 1 8 0v2',
  posts: 'M5 3h10l4 4v14H5z M14 3v5h5 M8 12h8 M8 16h8',
  comments: 'M21 11a8.5 8.5 0 0 1-8.5 8.5H4l2.1-4.2A8.5 8.5 0 1 1 21 11Z M9 11h7',
  audit: 'M8 4H5v17h14V4h-3 M8 3h8v4H8z M8 11h8 M8 15h8',
  search: 'M15 15l5 5 M17 10a7 7 0 1 1-14 0 7 7 0 0 1 14 0',
  value: 'M3 6h18v12H3z M15 12a3 3 0 1 1-6 0 3 3 0 0 1 6 0',
};

export function AdminIcon({ name }) {
  return <svg className="admin-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7"
    strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d={iconPaths[name]} /></svg>;
}

function useAdminData(path, version, onError) {
  const [state, setState] = useState({ loading: true, data: null, error: '' });
  const [retry, setRetry] = useState(0);
  const handleError = useRef(onError);
  useEffect(() => { handleError.current = onError; }, [onError]);
  useEffect(() => {
    if (!path) return;
    const controller = new AbortController();
    adminRequest(path, { signal: controller.signal }).then(data => {
      if (!controller.signal.aborted) setState({ data, loading: false, error: '' });
    }).catch(error => {
      if (controller.signal.aborted) return;
      handleError.current(error);
      setState({ loading: false, data: null, error: error.message });
    });
    return () => controller.abort();
  }, [path, version, retry]);

  return { ...state, retry: () => { setState({ loading: true, data: null, error: '' }); setRetry(value => value + 1); } };
}

function LoadState({ loading, error, retry }) {
  if (loading) return <p className="admin-state" role="status">Đang tải dữ liệu…</p>;
  if (!error) return null;
  return <div className="admin-state" role="alert"><p>{error}</p><button className="admin-btn" onClick={retry}>Thử lại</button></div>;
}

function AuditList({ rows }) {
  if (!rows.length) return <p className="admin-state">Chưa có thao tác quản trị.</p>;
  return (
    <ul className="admin-timeline">
      {rows.map(entry => (
        <li key={entry._id}>
          <span className="admin-timeline-dot" aria-hidden="true" />
          <div><strong>{auditActions[entry.action] || entry.action}</strong><p>{entry.actor} · {entry.target}</p></div>
          <time>{formatDate(entry.createdAt)}</time>
        </li>
      ))}
    </ul>
  );
}

export function AdminOverview({ version, onError, onOpen }) {
  const result = useAdminData('overview', version, onError);
  if (!result.data) return <div className="admin-panel"><LoadState {...result} /></div>;
  const { metrics, audit, recentOrders } = result.data;
  const cards = [
    ['users', 'Tài khoản hoạt động', number.format(metrics.accounts)],
    ['orders', 'Đơn đã đặt', number.format(metrics.orders)],
    ['value', 'Tổng giá trị đơn', money.format(metrics.orderValue)],
    ['posts', 'Bài viết', number.format(metrics.posts)],
    ['comments', 'Bình luận', number.format(metrics.comments)],
  ];
  return (
    <>
      <div className="admin-metrics">
        {cards.map(([key, label, value]) => (
          <button type="button" key={key} className="admin-metric admin-panel" onClick={() => onOpen(key === 'value' ? 'orders' : key)}>
            <span className="admin-metric-icon"><AdminIcon name={key} /></span>
            <span>{label}</span>
            <strong>{value}</strong>
          </button>
        ))}
      </div>
      <div className="admin-overview-grid">
        <section className="admin-panel">
          <header className="admin-panel-heading"><h2>Đơn mua gần đây</h2><button className="admin-text-btn" onClick={() => onOpen('orders')}>Xem tất cả</button></header>
          {!recentOrders.length && <p className="admin-state">Chưa có đơn mua.</p>}
          <ul className="admin-timeline">
            {recentOrders.map(order => (
              <li key={order._id}>
                <span className="admin-timeline-dot" aria-hidden="true" />
                <div>
                  <button className="admin-text-btn admin-row-title" onClick={() => onOpen('orders', { q: order._id })}>{order.items.map(item => item.name).join(', ')}</button>
                  <p>{formatDate(order.createdAt)}</p>
                </div>
                <strong>{money.format(order.total)}</strong>
              </li>
            ))}
          </ul>
        </section>
        <section className="admin-panel">
          <header className="admin-panel-heading"><h2>Thao tác quản trị gần đây</h2><button className="admin-text-btn" onClick={() => onOpen('audit')}>Xem nhật ký</button></header>
          <AuditList rows={audit} />
        </section>
      </div>
    </>
  );
}

const columns = {
  users: ['Tài khoản', 'Vai trò', 'Trạng thái', 'Đăng nhập gần nhất', 'Thao tác'],
  orders: ['Đơn mua', 'Khách hàng', 'Ngày đặt', 'Tổng tiền', 'Thao tác'],
  posts: ['Bài viết', 'Người đăng', 'Chủ đề', 'Ngày đăng', 'Thao tác'],
  comments: ['Bình luận', 'Người gửi', 'Bài viết', 'Ngày gửi', 'Thao tác'],
};

const searchHints = {
  users: 'Tên, email hoặc số điện thoại',
  orders: 'Mã đơn hoặc tên sản phẩm',
  posts: 'Tiêu đề, nội dung hoặc người đăng',
  comments: 'Nội dung hoặc người gửi',
  audit: 'Quản trị viên hoặc đối tượng',
};

function Row({ tab, row, select, onOpen }) {
  const view = () => select(row);
  if (tab === 'users') return (
    <tr>
      <td><strong>{row.displayName || row.username}</strong><small>@{row.username} · {row.email}</small></td>
      <td><span className="admin-tag">{roles[row.role] || row.role}</span></td>
      <td><span className={'admin-tag ' + (row.deletedAt ? 'admin-tag-deleted' : 'admin-tag-active')}>{row.deletedAt ? 'Đã xóa' : 'Hoạt động'}</span></td>
      <td>{formatDate(row.lastLoginAt)}</td>
      <td><button className="admin-text-btn" onClick={view}>Xem hồ sơ</button></td>
    </tr>
  );
  if (tab === 'orders') return (
    <tr>
      <td><strong>{row.items?.[0]?.name || 'Đơn mua'}{row.items?.length > 1 ? ' +' + (row.items.length - 1) : ''}</strong><small>#{row._id}</small></td>
      <td>{row.customer || 'Tài khoản không còn tồn tại'}</td>
      <td>{formatDate(row.createdAt)}</td>
      <td><strong>{money.format(row.total)}</strong></td>
      <td><button className="admin-text-btn" onClick={view}>Xem đơn</button></td>
    </tr>
  );
  if (tab === 'posts') return (
    <tr>
      <td><strong>{row.title}</strong><small><button className="admin-text-btn" onClick={() => onOpen('comments', { postId: row._id })}>{row.commentCount} bình luận</button></small></td>
      <td>{row.author}</td>
      <td><span className="admin-tag">{row.category}</span></td>
      <td>{formatDate(row.createdAt)}</td>
      <td><button className="admin-text-btn" onClick={view}>Kiểm duyệt</button></td>
    </tr>
  );
  return (
    <tr>
      <td><strong>{row.body.slice(0, 120)}{row.body.length > 120 ? '…' : ''}</strong>{row.parentId && <small>Câu trả lời</small>}</td>
      <td>{row.author}</td>
      <td>{row.post?.title}</td>
      <td>{formatDate(row.createdAt)}</td>
      <td><button className="admin-text-btn" onClick={view}>Kiểm duyệt</button></td>
    </tr>
  );
}

export function AdminList({ tab, params, version, setFilters, onError, onOpen, select }) {
  const query = new URLSearchParams(params);
  query.delete('tab');
  const result = useAdminData(tab + '?' + query, version, onError);
  const filterKey = params.has('userId') ? 'userId' : params.has('postId') ? 'postId' : '';
  const data = result.data;

  return (
    <section className="admin-panel">
      <form className="admin-filters" onSubmit={event => {
        event.preventDefault();
        const fields = Object.fromEntries(new FormData(event.currentTarget));
        setFilters({ ...fields, q: fields.q.trim(), page: '' });
      }}>
        <div className="admin-search">
          <AdminIcon name="search" />
          <input aria-label="Tìm kiếm" name="q" placeholder={searchHints[tab]} maxLength={100} defaultValue={params.get('q') ?? ''} />
        </div>
        {tab === 'users' && (
          <>
            <select name="role" aria-label="Vai trò" defaultValue={params.get('role') ?? ''}>
              <option value="">Mọi vai trò</option>
              {Object.entries(roles).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
            </select>
            <select name="status" aria-label="Trạng thái" defaultValue={params.get('status') ?? ''}>
              <option value="">Mọi trạng thái</option><option value="active">Hoạt động</option><option value="deleted">Đã xóa</option>
            </select>
          </>
        )}
        {tab === 'posts' && (
          <select name="category" aria-label="Chủ đề" defaultValue={params.get('category') ?? ''}>
            <option value="">Mọi chủ đề</option>
            {categories.map(category => <option key={category}>{category}</option>)}
          </select>
        )}
        <button className="admin-btn admin-primary" type="submit">Tìm</button>
        {(params.get('q') || params.get('role') || params.get('status') || params.get('category')) &&
          <button className="admin-btn" type="button" onClick={() => setFilters({ q: '', role: '', status: '', category: '', page: '' })}>Đặt lại</button>}
      </form>
      {filterKey && <div className="admin-scope">
        {filterKey === 'postId' ? 'Bình luận của bài viết đã chọn' :
          (tab === 'orders' ? 'Đơn mua' : tab === 'posts' ? 'Bài viết' : 'Bình luận') + ' của tài khoản đã chọn'}
        <button className="admin-text-btn" onClick={() => setFilters({ [filterKey]: '', page: '' })}>Bỏ lọc</button>
      </div>}
      <LoadState {...result} />
      {data && tab === 'audit' && <AuditList rows={data.rows} />}
      {data && tab !== 'audit' && (
        data.rows.length ? <div className="admin-table-scroll"><table>
          <thead><tr>{columns[tab].map(label => <th scope="col" key={label}>{label}</th>)}</tr></thead>
          <tbody>{data.rows.map(row => <Row key={row._id} tab={tab} row={row} select={select} onOpen={onOpen} />)}</tbody>
        </table></div> : <p className="admin-state">Không có kết quả phù hợp.</p>
      )}
      {data && (
        <footer className="admin-pagination">
          <span>{number.format(data.total)} kết quả</span>
          <div className="admin-actions">
            <button className="admin-btn admin-btn-small" type="button" disabled={data.page <= 1} onClick={() => setFilters({ page: data.page - 1 })}>Trước</button>
            <span>Trang {data.page}</span>
            <button className="admin-btn admin-btn-small" type="button" disabled={data.page * data.pageSize >= data.total}
              onClick={() => setFilters({ page: data.page + 1 })}>Sau</button>
          </div>
        </footer>
      )}
    </section>
  );
}

function UserForm({ user }) {
  const [today] = useState(() => new Date().toISOString().slice(0, 10));
  return (
    <div className="admin-fields">
      <label>Tên đăng nhập<input name="username" defaultValue={user.username} pattern={'[a-zA-Z0-9_.\\-]{3,30}'} required /></label>
      <label>Tên hiển thị<input name="displayName" defaultValue={user.displayName} maxLength={80} /></label>
      <label>Email<input name="email" type="email" defaultValue={user.email} maxLength={254} required /></label>
      <label>Số điện thoại<input name="phone" type="tel" defaultValue={user.phone} pattern="\+?[0-9]{9,15}" required /></label>
      <label>Giới tính<select name="gender" defaultValue={user.gender ?? ''}>
        <option value="">Chưa cập nhật</option>
        {Object.entries(genders).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
      </select></label>
      <label>Ngày sinh<input name="birthDate" type="date" defaultValue={user.birthDate} min="1900-01-01" max={today} /></label>
      {user.role !== 'admin' && <label>Vai trò<select name="role" defaultValue={user.role}>
        <option value="user">Người dùng</option><option value="partner">Đối tác</option>
      </select></label>}
    </div>
  );
}

function UserDetails({ data, onOpen }) {
  const { user, activity, orderCount, orderTotal } = data;
  return (
    <>
      <dl className="admin-details">
        <div><dt>Tên đăng nhập</dt><dd>@{user.username}</dd></div>
        <div><dt>Vai trò</dt><dd>{roles[user.role]}</dd></div>
        <div><dt>Email</dt><dd>{user.email}</dd></div>
        <div><dt>Số điện thoại</dt><dd>{user.phone}</dd></div>
        <div><dt>Giới tính</dt><dd>{genders[user.gender] || '—'}</dd></div>
        <div><dt>Ngày sinh</dt><dd>{user.birthDate ? user.birthDate.split('-').reverse().join('/') : '—'}</dd></div>
        <div><dt>Ngày đăng ký</dt><dd>{formatDate(user.createdAt)}</dd></div>
        <div><dt>Đăng nhập gần nhất</dt><dd>{formatDate(user.lastLoginAt)}</dd></div>
      </dl>
      {user.deletedAt && <p className="admin-scope">Tài khoản đã xóa lúc {formatDate(user.deletedAt)}.</p>}
      <div className="admin-order-summary">
        <div><strong>{number.format(orderCount)} đơn đã đặt</strong><p>{money.format(orderTotal)} tổng giá trị</p></div>
        <button className="admin-btn" onClick={() => onOpen('orders', { userId: user._id })}>Xem đơn mua</button>
      </div>
      <h3>Hoạt động gần đây</h3>
      <div className="admin-actions admin-activity-links">
        <button className="admin-text-btn" onClick={() => onOpen('posts', { userId: user._id })}>Xem bài đã đăng</button>
        <button className="admin-text-btn" onClick={() => onOpen('comments', { userId: user._id })}>Xem bình luận đã gửi</button>
      </div>
      {!activity.length && <p>Chưa có hoạt động được ghi nhận.</p>}
      <ul className="admin-timeline admin-activity">
        {activity.map((event, index) => (
          <li key={event.date + index}>
            <span className="admin-timeline-dot" aria-hidden="true" />
            <div>
              <strong>{events[event.type]}{event.deleted ? ' · Đã xóa' : ''}</strong>
              <p>{event.text}{event.amount !== undefined && ' · ' + money.format(event.amount)}</p>
            </div>
            <time>{formatDate(event.date)}</time>
          </li>
        ))}
      </ul>
    </>
  );
}

function OrderDetails({ order }) {
  return (
    <>
      <dl className="admin-details">
        <div><dt>Mã đơn</dt><dd>{order._id}</dd></div>
        <div><dt>Khách hàng</dt><dd>{order.customer || 'Tài khoản không còn tồn tại'}</dd></div>
        <div><dt>Ngày đặt</dt><dd>{formatDate(order.createdAt)}</dd></div>
        <div><dt>Phương thức thanh toán đã chọn</dt><dd>{payments[order.payment] || '—'}</dd></div>
        {order.note && <div><dt>Lời nhắn</dt><dd>{order.note}</dd></div>}
      </dl>
      <h3>Sản phẩm và dịch vụ</h3>
      <ul className="admin-order-items">
        {order.items.map(item => (
          <li key={item._id}>
            <div><strong>{item.name}</strong><p>{item.date?.split('-').reverse().join('/')} · {item.time} · SL {item.quantity}</p>
              {item.review && <p>{item.review.rating}/5 sao · {item.review.comment}</p>}
            </div>
            <strong>{money.format(item.price * item.quantity)}</strong>
          </li>
        ))}
      </ul>
      <div className="admin-order-summary"><span>Tổng giá trị đơn</span><strong>{money.format(order.total)}</strong></div>
    </>
  );
}

function ForumDetails({ row, type, onOpen }) {
  return (
    <>
      <p className="admin-muted">{row.author} · {formatDate(row.createdAt)} · {type === 'posts' ? row.category : row.post?.title}</p>
      <p className="admin-forum-body">{row.body}</p>
      {type === 'posts' && <>
        {!!row.photos?.length && <div className="admin-forum-photos">
          {row.photos.map((photo, index) => <a key={photo} href={photo} target="_blank" rel="noreferrer">
            <img src={photo} alt={'Ảnh bài viết ' + (index + 1)} />
          </a>)}
        </div>}
        <button className="admin-btn" onClick={() => onOpen('comments', { postId: row._id })}>Xem {row.commentCount} bình luận</button>
      </>}
      {type === 'comments' && row.parentId && <p className="admin-muted">Đây là câu trả lời trong luồng bình luận.</p>}
    </>
  );
}

export function AdminRecord({ record, onClose, onSaved, onError, onOpen }) {
  const { type, row } = record;
  const detail = useAdminData(type === 'users' ? 'users/' + row._id : null, 0, onError);
  const [mode, setMode] = useState('view');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const dialog = useRef(null);
  const isUser = type === 'users';
  const isPost = type === 'posts';
  const isOrder = type === 'orders';
  const user = detail.data?.user;

  useEffect(() => {
    const element = dialog.current;
    element.showModal();
    return () => element.close();
  }, []);

  function show(next) {
    setError('');
    setMode(next);
  }

  async function submit(event) {
    event.preventDefault();
    if (busy) return;
    setBusy(true);
    setError('');
    let body;
    try {
      const path = type + '/' + row._id;
      if (mode === 'edit') {
        body = Object.fromEntries(new FormData(event.currentTarget));
        if (isUser) {
          for (const key of Object.keys(body)) {
            if (body[key] === (user[key] ?? '')) delete body[key];
          }
          if (!Object.keys(body).length) {
            show('view');
            return;
          }
        }
      }
      const data = await adminRequest(path + (mode === 'restore' ? '/restore' : ''), {
        method: mode === 'edit' ? 'PATCH' : mode === 'delete' ? 'DELETE' : 'POST', body,
      });
      onSaved(data.message);
    } catch (error) {
      onError(error);
      setError(error.message);
    } finally {
      setBusy(false);
    }
  }

  const label = isUser ? 'tài khoản' : isPost ? 'bài viết' : isOrder ? 'đơn mua' : 'bình luận';
  const name = isUser ? (user?.displayName || row.username) : row.title || (isOrder ? 'Chi tiết đơn mua' : 'Chi tiết bình luận');

  return (
    <dialog className="admin-dialog" ref={dialog} aria-labelledby="admin-dialog-title" onCancel={event => {
      event.preventDefault();
      if (!busy) onClose();
    }}>
      <header className="admin-dialog-header">
        <h2 id="admin-dialog-title">{mode === 'edit' ? 'Sửa ' + label : mode === 'delete' ? 'Xóa ' + label : mode === 'restore' ? 'Khôi phục ' + label : name}</h2>
        <button className="admin-btn admin-btn-small" type="button" onClick={onClose} disabled={busy} aria-label="Đóng">✕</button>
      </header>
      {mode === 'view' ? (
        <div className="admin-dialog-body">
          {isUser && <LoadState {...detail} />}
          {user && <UserDetails data={detail.data} onOpen={onOpen} />}
          {isOrder && <OrderDetails order={row} />}
          {!isUser && !isOrder && <ForumDetails row={row} type={type} onOpen={onOpen} />}
          {!isOrder && (!isUser || user) && (
            <footer className="admin-dialog-actions">
              {user?.deletedAt ? <button className="admin-btn admin-primary" onClick={() => show('restore')}>Khôi phục tài khoản</button> : (
                <>
                  <button className="admin-btn admin-primary" onClick={() => show('edit')}>Sửa {label}</button>
                  {user?.role !== 'admin' && <button className="admin-btn admin-danger-outline" onClick={() => show('delete')}>Xóa {label}</button>}
                </>
              )}
            </footer>
          )}
        </div>
      ) : (
        <form className="admin-dialog-body" onSubmit={submit}>
          {mode === 'edit' && (isUser ? <UserForm user={user} /> : (
            <div className="admin-fields">
              {isPost && <>
                <label>Tiêu đề<input name="title" maxLength={120} defaultValue={row.title} required /></label>
                <label>Chủ đề<select name="category" defaultValue={row.category}>
                  {categories.map(category => <option key={category}>{category}</option>)}
                </select></label>
              </>}
              <label className="admin-full-field">Nội dung<textarea name="body" defaultValue={row.body} rows={isPost ? 7 : 4}
                maxLength={isPost ? 5000 : 1000} required /></label>
            </div>
          ))}
          {mode === 'delete' && <p>{isUser
            ? 'Tài khoản sẽ bị khóa và đăng xuất trên các thiết bị. Đơn mua được giữ để đối soát. Bạn có thể khôi phục tài khoản sau.'
            : isPost ? 'Bài viết và các bình luận bên dưới sẽ biến mất khỏi diễn đàn.'
              : 'Bình luận và các câu trả lời bên dưới sẽ biến mất khỏi diễn đàn.'}</p>}
          {mode === 'restore' && <p>Tài khoản có thể đăng nhập lại sau khi khôi phục.</p>}
          {error && <p className="admin-form-error" role="alert">{error}</p>}
          <footer className="admin-dialog-actions">
            <button className="admin-btn" type="button" disabled={busy} onClick={() => show('view')}>Quay lại</button>
            <button className={'admin-btn ' + (mode === 'delete' ? 'admin-danger' : 'admin-primary')} type="submit" disabled={busy}>
              {busy ? 'Đang xử lý…' : mode === 'edit' ? 'Lưu thay đổi' : mode === 'delete' ? 'Xác nhận xóa' : 'Xác nhận khôi phục'}
            </button>
          </footer>
        </form>
      )}
    </dialog>
  );
}
