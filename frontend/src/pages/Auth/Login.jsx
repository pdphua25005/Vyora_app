import { useRef, useState } from 'react';
import { Link, useNavigate, useLocation } from 'react-router';
import { authRequest } from '../../services/auth';
import LoginArtwork from './LoginArtwork';
import AuthFrame from './AuthFrame';
import './LoginArtwork.css';
import './Login.css';

export default function Login() {
  const [showPassword, setShowPassword] = useState(false);
  const [remember, setRemember] = useState(false);
  const { state } = useLocation();
  const [message, setMessage] = useState('');
  const [showRegistrationNotice, setShowRegistrationNotice] = useState(state?.registered === true);
  const [showForumNotice, setShowForumNotice] = useState(state?.forum === true);
  const [showCheckoutNotice, setShowCheckoutNotice] = useState(Boolean(state?.checkout));
  const [busy, setBusy] = useState(false);
  const navigate = useNavigate();
  const passwordInput = useRef(null);



  async function submit(event) {
    event.preventDefault();
    if (busy) return;
    const { username, password } = Object.fromEntries(new FormData(event.currentTarget));
    setBusy(true);
    setMessage('Đang đăng nhập…');
    try {
      const user = await authRequest('login', { username, password, remember });
      if (state?.admin) {
        navigate('/admin', { replace: true });
      } else if (state?.checkout) {
        const { cartOwner } = state.checkout;
        if (state.checkout.selectedIds?.length && (cartOwner === null || cartOwner === user.id)) {
          navigate('/checkout', { replace: true, state: { ...state.checkout, cartOwner: user.id } });
        } else {
          navigate('/cart', { replace: true });
        }
      } else if (state?.supportChat) {
        navigate('/', { replace: true, state: { supportChat: true } });
      } else if (state?.forum) {
        navigate('/forum', { replace: true, state: { compose: true } });
      } else if (state?.forumComment) {
        navigate('/forum?post=' + encodeURIComponent(state.forumComment), { replace: true, state: { commentPost: state.forumComment } });
      } else {
        navigate('/', { replace: true });
      }
    } catch (error) {
      setMessage(error.message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      {showRegistrationNotice && (
        <div className="registration-notice">
          <div role="status">
            <strong>Đã đăng ký tài khoản thành công!</strong>
            <p>Bạn có thể đăng nhập ngay.</p>
          </div>
          <button type="button" aria-label="Đóng thông báo" onClick={() => setShowRegistrationNotice(false)}>×</button>
        </div>
      )}
      {showForumNotice && (
        <div className="registration-notice forum-login-notice">
          <div role="status">
            <strong>Bạn cần đăng nhập để đăng bài.</strong>
            <p>Đăng nhập xong, cửa sổ tạo bài viết sẽ tự mở.</p>
          </div>
          <button type="button" aria-label="Đóng thông báo" onClick={() => setShowForumNotice(false)}>×</button>
        </div>
      )}
      {showCheckoutNotice && (
        <div className="registration-notice login-required-notice">
          <div role="status">
            <strong>Bạn cần đăng nhập để mua hàng.</strong>
            <p>Vui lòng đăng nhập để tiếp tục.</p>
          </div>
          <button type="button" aria-label="Đóng thông báo" onClick={() => setShowCheckoutNotice(false)}>×</button>
        </div>
      )}
      <AuthFrame height={1422}>
        <h1 className="login-sr-only">Đăng nhập Vyora</h1>
        <LoginArtwork />
        <Link to="/" className="login-hit login-logo" aria-label="Về trang chủ Vyora" />
        <Link to="/register" className="login-hit login-top-signup" aria-label="Đăng ký" />
        <Link to="/forum" className="login-hit login-forum" aria-label="Diễn đàn" />
        <a href="mailto:Vyoraappoffical@gmail.com" className="login-hit login-help" aria-label="Bạn cần giúp đỡ?" />
        <form className="login-form" onSubmit={submit} onChange={() => setMessage('')}>
          <label className="login-sr-only" htmlFor="vyora-username">Tên đăng nhập</label>
          <input className="login-input login-username" id="vyora-username" name="username" defaultValue={state?.username ?? ''} autoComplete="username" placeholder="Tên đăng nhập" required />
          <label className="login-sr-only" htmlFor="vyora-password">Mật khẩu</label>
          <input className="login-input login-password" id="vyora-password" name="password" ref={passwordInput} autoComplete="current-password" type={showPassword ? 'text' : 'password'} placeholder="Mật khẩu" required />
          <button className="login-hit login-visibility" type="button" aria-label={showPassword ? 'Ẩn mật khẩu' : 'Hiện mật khẩu'} aria-pressed={showPassword} onClick={() => { setShowPassword(value => !value); passwordInput.current?.focus(); }} />
          <button className="login-hit login-submit" type="submit" disabled={busy} aria-label="Đăng nhập" />
          <label className="login-remember">
            <input type="checkbox" checked={remember} onChange={event => setRemember(event.target.checked)} />
            <span className="login-sr-only">Ghi nhớ mật khẩu</span>
          </label>
          <button className="login-hit login-forgot" type="button" onClick={() => setMessage('Khôi phục mật khẩu hiện chưa khả dụng.')} aria-label="Bạn quên mật khẩu?" />
          <button className="login-hit login-facebook" type="button" onClick={() => setMessage('Đăng nhập bằng Facebook hiện chưa khả dụng.')} aria-label="Đăng nhập bằng Facebook" />
          <button className="login-hit login-google" type="button" onClick={() => setMessage('Đăng nhập bằng Google hiện chưa khả dụng.')} aria-label="Đăng nhập bằng Google" />
          <Link className="login-hit login-signup" to="/register" aria-label="Đăng ký ngay" />
          <p className="login-status" role="status">{message}</p>
        </form>
      </AuthFrame>
    </>
  );
}
