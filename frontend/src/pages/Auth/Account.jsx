import { useEffect, useState } from 'react';
import { Link, NavLink, useNavigate } from 'react-router';
import { authRequest } from '../../services/auth';
import Orders from './Orders';
import AccountProfile, { ProfileAvatar } from './AccountProfile';
import HomeHeader from '../Home/HomeHeader';
import { SiteFooter } from '../Home/HomeArtwork';
import './Account.css';
import './AccountProfile.css';

export default function Account({ showOrders = false }) {
  const navigate = useNavigate();
  const [chromeScale, setChromeScale] = useState(() => Math.min(document.documentElement.clientWidth / 1920, 1));
  const [user, setUser] = useState(null);
  const [loadError, setLoadError] = useState('');
  const [logoutError, setLogoutError] = useState('');
  const [checking, setChecking] = useState(0);
  const [loggingOut, setLoggingOut] = useState(false);
  const title = showOrders ? 'Đã mua' : 'Hồ Sơ Của Tôi';

  useEffect(() => {
    let active = true;
    authRequest('me').then(currentUser => {
      if (active) setUser(currentUser);
    }).catch(error => {
      if (!active) return;
      if (error.status === 401) navigate('/login', { replace: true });
      else setLoadError(error.message);
    });
    return () => { active = false; };
  }, [navigate, checking]);

  useEffect(() => {
    function resize() {
      setChromeScale(Math.min(document.documentElement.clientWidth / 1920, 1));
    }
    window.addEventListener('resize', resize);
    return () => window.removeEventListener('resize', resize);
  }, []);

  async function logout() {
    setLoggingOut(true);
    setLogoutError('');
    try {
      await authRequest('logout', {});
      navigate('/', { replace: true });
    } catch (error) {
      setLogoutError(error.message);
      setLoggingOut(false);
    }
  }

  return (
    <div className="account-area account-profile-page">
      <div className="account-chrome-header" style={{ height: 117 * chromeScale }}>
        <div className="vyora-home account-chrome-canvas" style={{ transform: `scale(${chromeScale})` }}>
          <HomeHeader
            user={user ?? undefined}
            onLogout={() => navigate('/', { replace: true })}
            onSearch={term => navigate({ pathname: '/', search: new URLSearchParams({ q: term }).toString() })}
          />
        </div>
      </div>

      <main className="account-width account-main">
        <nav aria-label="Đường dẫn" className="account-breadcrumb">
          <Link to="/">Trang chủ</Link>
          <span aria-hidden="true">›</span>
          <span aria-current="page">{title}</span>
        </nav>
        <div className="account-layout">
          <aside className="account-sidebar">
            {user && (
              <div className="account-identity">
                <ProfileAvatar user={user} className="account-avatar" />
                <div>
                  <strong>{user.username}</strong>
                  <Link to="/account">Sửa Hồ Sơ</Link>
                </div>
              </div>
            )}
            <nav aria-label="Tài khoản Vyora" className="account-nav">
              <strong>Tài Khoản Của Tôi</strong>
              <NavLink to="/account" end>Hồ Sơ</NavLink>
              <NavLink to="/orders" end>Đã mua</NavLink>
              {user && <button type="button" disabled={loggingOut} onClick={logout}>{loggingOut ? 'Đang đăng xuất…' : 'Đăng Xuất'}</button>}
            </nav>
            {logoutError && <p className="account-error" role="alert">{logoutError}</p>}
          </aside>

          <section className="account-panel" aria-labelledby="account-title">
            <div className="account-panel-heading">
              <h1 id="account-title">{title}</h1>
              <p>{showOrders ? 'Theo dõi đơn hàng của bạn trên Vyora.' : 'Quản lý thông tin hồ sơ để bảo mật tài khoản'}</p>
            </div>
            {user && (showOrders ? <Orders /> : <AccountProfile user={user} onSaved={setUser} onExpired={() => navigate('/login', { replace: true })} />)}
            {!user && !loadError && <p className="account-state" role="status">Đang kiểm tra phiên đăng nhập…</p>}
            {loadError && (
              <div className="account-state">
                <p role="alert">{loadError}</p>
                <button className="account-primary" type="button" onClick={() => { setLoadError(''); setChecking(attempt => attempt + 1); }}>Thử lại</button>
              </div>
            )}
          </section>
        </div>
      </main>
      <footer className="account-chrome-footer" style={{ height: 729 * chromeScale }}>
        <div className="vyora-home account-chrome-canvas" style={{ transform: `scale(${chromeScale})` }}>
          <div className="account-footer-artwork">
            <SiteFooter />
          </div>
        </div>
      </footer>
    </div>
  );
}
