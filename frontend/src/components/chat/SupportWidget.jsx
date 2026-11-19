import { useEffect, useState } from 'react';
import { Link, useLocation } from 'react-router';
import { authRequest } from '../../services/auth';
import { useCart } from '../../services/cart';
import ChatThread from './ChatThread';
import './SupportChat.css';

// Điền số liên hệ của Vyora qua frontend/.env.local khi có số chính thức.
const phone = import.meta.env.VITE_SUPPORT_PHONE?.trim() || '0392486394';
const zalo = import.meta.env.VITE_SUPPORT_ZALO?.trim() || '0392486394';

function ChatPanel({ onClose }) {
  const [user, setUser] = useState(null);
  const [error, setError] = useState(null);
  const [retry, setRetry] = useState(0);
  useEffect(() => {
    let active = true;
    authRequest('me').then(account => { if (active) setUser(account); })
      .catch(error => { if (active) setError(error); });
    return () => { active = false; };
  }, [retry]);

  return (
    <section className="support-panel" role="region" aria-label="Chat hỗ trợ Vyora">
      <header><div><strong>Chat cùng Vyora</strong><span>Hỗ trợ từ quản trị viên</span></div>
        <button type="button" onClick={onClose} aria-label="Đóng chat">×</button></header>
      {error ? <div className="support-welcome">
        <p role="alert">{error.status === 401 ? 'Đăng nhập để trò chuyện với quản trị viên.' : error.message}</p>
        {error.status === 401 ? <Link to="/login" state={{ supportChat: true }}>Đăng nhập</Link>
          : <button onClick={() => { setError(null); setRetry(value => value + 1); }}>Thử lại</button>}
      </div> : user ? (
        user.role === 'admin' ? <div className="support-welcome"><Link to="/admin?tab=chat">Mở hộp thư quản trị</Link></div>
          : <ChatThread userId={user.id} onSessionError={setError} />
      ) : <p className="support-welcome" role="status">Đang kiểm tra đăng nhập…</p>}
    </section>
  );
}

export default function SupportWidget() {
  const { pathname, state } = useLocation();
  const { owner } = useCart();
  const [opened, setOpened] = useState(false);
  const [dismissedIntent, setDismissedIntent] = useState(false);
  const open = opened || Boolean(state?.supportChat && !dismissedIntent);
  function changeOpen(value) { setOpened(value); setDismissedIntent(true); }
  const [contact, setContact] = useState('');
  if (pathname.startsWith('/admin') || ['/login', '/register'].includes(pathname)) return null;

  return (
    <aside className="support-widget" aria-label="Liên hệ Vyora">
      {open && <ChatPanel key={String(owner)} onClose={() => changeOpen(false)} />}
      {contact && <div className="support-contact" role="status">{contact}<button onClick={() => setContact('')} aria-label="Đóng thông báo liên hệ">×</button></div>}
      <div className="support-launchers">
        {zalo && /^\+?\d{9,15}$/.test(zalo) ? (
          <a className="support-round support-zalo" href={'https://zalo.me/' + zalo.replace('+', '')} target="_blank" rel="noreferrer" aria-label="Liên hệ Zalo">Zalo</a>
        ) : <button className="support-round support-zalo" aria-label="Liên hệ Zalo" onClick={() => setContact('Kênh Zalo đang được cập nhật. Bạn có thể nhắn qua Chat.')}>Zalo</button>}
        {phone && /^\+?\d{9,15}$/.test(phone) ? (
          <a className="support-round support-phone" href={'tel:' + phone} aria-label="Gọi điện thoại">☎</a>
        ) : <button className="support-round support-phone" aria-label="Gọi điện thoại" onClick={() => setContact('Số điện thoại đang được cập nhật. Bạn có thể nhắn qua Chat.')}>☎</button>}
        <button className="support-round support-chat" type="button" aria-label="Chat với Vyora" aria-expanded={open} onClick={() => { changeOpen(!open); setContact(''); }}>Chat</button>
      </div>
    </aside>
  );
}
