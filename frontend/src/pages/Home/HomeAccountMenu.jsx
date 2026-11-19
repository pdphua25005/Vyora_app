import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router';
import { authRequest } from '../../services/auth';

export default function HomeAccountMenu({ user, onLogout }) {
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  const menu = useRef(null);
  const trigger = useRef(null);

  useEffect(() => {
    if (!open) return;
    function closeOutside(event) {
      if (!menu.current?.contains(event.target)) setOpen(false);
    }
    document.addEventListener('pointerdown', closeOutside);
    return () => document.removeEventListener('pointerdown', closeOutside);
  }, [open]);

  async function logout() {
    setBusy(true);
    setMessage('');
    try {
      await authRequest('logout', {});
      onLogout();
    } catch (error) {
      setMessage(error.message);
      setBusy(false);
    }
  }

  return (
    <div
      className="home-account"
      ref={menu}
      onBlur={event => {
        if (!event.currentTarget.contains(event.relatedTarget)) setOpen(false);
      }}
      onKeyDown={event => {
        if (event.key === 'Escape' && open) {
          setOpen(false);
          trigger.current?.focus();
        }
      }}
    >
      <span>Chào mừng</span>
      <div className="home-account-control">
        <button
          type="button"
          className="home-account-trigger"
          ref={trigger}
          aria-label={'Tài khoản ' + user.username}
          aria-expanded={open}
          aria-controls="home-account-panel"
          onClick={() => setOpen(value => !value)}
          title={user.username}
        >
          {user.username}
        </button>
        <div id="home-account-panel" className="home-account-panel" hidden={!open}>
          <Link to="/account">Tài Khoản Của Tôi</Link>
          <Link to="/orders">Đã mua</Link>
          {user.role === 'admin' && <Link to="/admin">Quản trị Vyora</Link>}
          <button type="button" disabled={busy} onClick={logout}>{busy ? 'Đang đăng xuất…' : 'Đăng Xuất'}</button>
          {message && <p role="alert">{message}</p>}
        </div>
      </div>
    </div>
  );
}
