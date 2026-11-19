import { useEffect, useState } from 'react';
import { Link, useLocation, useNavigate, useSearchParams } from 'react-router';
import { authRequest } from '../../services/auth';
import { AdminOverview, AdminList, AdminRecord, AdminIcon } from './AdminPanels';
import './Admin.css';
import AdminChat from './AdminChat';

const sections = {
  overview: ['Tổng quan', 'Theo dõi hoạt động của Vyora.'],
  users: ['Tài khoản', 'Xem hồ sơ, lịch sử hoạt động và đơn mua của từng tài khoản.'],
  orders: ['Đơn mua', 'Tra cứu sản phẩm đã đặt, lịch sử dụng dịch vụ và tổng tiền.'],
  posts: ['Bài viết', 'Xem và kiểm duyệt các bài đăng trong diễn đàn.'],
  comments: ['Bình luận', 'Kiểm duyệt bình luận và câu trả lời trong diễn đàn.'],
  chat: ['Tin nhắn hỗ trợ', 'Trò chuyện trực tiếp với khách hàng.'],
  audit: ['Nhật ký quản trị', 'Tra cứu các thay đổi do quản trị viên thực hiện.'],
};

export default function Admin() {
  const [params, setParams] = useSearchParams();
  const [user, setUser] = useState(null);
  const [sessionError, setSessionError] = useState(null);
  const [record, setRecord] = useState(null);
  const [version, setVersion] = useState(0);
  const [notice, setNotice] = useState('');
  const [loggingOut, setLoggingOut] = useState(false);
  const navigate = useNavigate();
  const { search } = useLocation();
  const candidate = params.get('tab');
  const tab = Object.hasOwn(sections, candidate) ? candidate : 'overview';

  useEffect(() => {
    let active = true;
    authRequest('me').then(account => {
      if (active) setUser(account);
    }).catch(error => {
      if (active) setSessionError(error);
    });
    return () => { active = false; };
  }, []);

  function dismissSession(error) {
    if ([401, 403].includes(error.status)) setSessionError(error);
  }

  async function logout() {
    setLoggingOut(true);
    try {
      await authRequest('logout', {});
      navigate('/', { replace: true });
    } catch (error) {
      setNotice(error.message);
      setLoggingOut(false);
    }
  }

  function openSection(section, filters = {}) {
    setRecord(null);
    setNotice('');
    setParams({ tab: section, ...filters });
  }

  if (sessionError || user && user.role !== 'admin') {
    const signedOut = sessionError?.status === 401;
    const forbidden = sessionError?.status === 403 || user && user.role !== 'admin';
    return (
      <main className="vy-admin admin-session">
        <div className="admin-panel">
          <span className="admin-brand"><img src="/assets/vyora/65b144bcd4dd7a5a.png" alt="Vyora" /> Quản trị</span>
          <h1>{signedOut ? 'Đăng nhập để tiếp tục' : forbidden ? 'Cần quyền quản trị' : 'Không tải được trang quản trị'}</h1>
          <p>{signedOut ? 'Đăng nhập bằng tài khoản quản trị viên của Vyora.' : forbidden
            ? 'Trang này chỉ dành cho tài khoản có quyền quản trị.' : sessionError.message}</p>
          <div className="admin-actions">
            <Link className="admin-btn" to="/">Về trang chủ</Link>
            {signedOut && <Link className="admin-btn admin-primary" to="/login" state={{ admin: true }}>Đăng nhập</Link>}
          </div>
        </div>
      </main>
    );
  }
  if (!user) return <main className="vy-admin admin-session"><p role="status">Đang kiểm tra quyền truy cập…</p></main>;

  return (
    <div className="vy-admin admin-layout">
      <aside className="admin-sidebar">
        <Link to="/admin" className="admin-brand" onClick={() => { setRecord(null); setNotice(''); }}>
          <img src="/assets/vyora/65b144bcd4dd7a5a.png" alt="Vyora" />
          <span>Quản trị</span>
        </Link>
        <nav aria-label="Quản trị Vyora">
          {Object.entries(sections).map(([key, [label]]) => (
            <button type="button" className="admin-nav-item" aria-current={tab === key ? 'page' : undefined}
              key={key} onClick={() => openSection(key)}>
              <AdminIcon name={key} /> {label}
            </button>
          ))}
        </nav>
        <Link className="admin-store-link" to="/">Về cửa hàng <span aria-hidden="true">↗</span></Link>
      </aside>

      <main className="admin-main">
        <header className="admin-header">
          <div className="admin-location">Quản trị <span aria-hidden="true">/</span> <strong>{sections[tab][0]}</strong></div>
          <div className="admin-adminuser">
            <span className="admin-initial" aria-hidden="true">{(user.displayName || user.username).charAt(0).toUpperCase()}</span>
            <strong>{user.displayName || user.username}</strong>
            <button className="admin-btn admin-btn-small" type="button" disabled={loggingOut} onClick={logout}>Đăng xuất</button>
          </div>
        </header>

        <div className="admin-content">
          <div className="admin-heading">
            <h1>{sections[tab][0]}</h1>
            <p>{sections[tab][1]}</p>
          </div>
          {notice && <p className="admin-notice" role="status">{notice}</p>}
          {tab === 'chat' ? <AdminChat /> : tab === 'overview' ? (
            <AdminOverview version={version} onError={dismissSession} onOpen={openSection} />
          ) : (
            <AdminList key={tab + search} tab={tab} params={params} version={version} onError={dismissSession}
              onOpen={openSection} select={row => setRecord({ type: tab, row })}
              setFilters={filters => {
                const next = new URLSearchParams(params);
                for (const [field, value] of Object.entries(filters)) {
                  if (value) next.set(field, value);
                  else next.delete(field);
                }
                setParams(next);
              }} />
          )}
        </div>
      </main>
      {record && <AdminRecord key={record.type + record.row._id} record={record} onClose={() => setRecord(null)}
        onError={dismissSession} onOpen={openSection} onSaved={message => {
          setRecord(null);
          setVersion(current => current + 1);
          setNotice(message);
        }} />}
    </div>
  );
}
