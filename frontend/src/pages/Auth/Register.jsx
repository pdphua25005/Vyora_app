import { useRef, useState } from 'react';
import { Link, useNavigate } from 'react-router';
import { authRequest } from '../../services/auth';
import AuthFrame from './AuthFrame';
import RegisterArtwork from './RegisterArtwork';
import './RegisterArtwork.css';
import './Register.css';

export default function Register() {
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmation, setShowConfirmation] = useState(false);
  const [message, setMessage] = useState('');
  const [busy, setBusy] = useState(false);
  const navigate = useNavigate();
  const password = useRef(null);
  const confirmation = useRef(null);

  function clearValidation() {
    confirmation.current?.setCustomValidity('');
    setMessage('');
  }

  async function submit(event) {
    event.preventDefault();
    if (busy) return;
    if (confirmation.current.value !== password.current.value) {
      confirmation.current.setCustomValidity('Mật khẩu nhập lại không khớp.');
      confirmation.current.reportValidity();
      setMessage('Mật khẩu nhập lại không khớp.');
      return;
    }
    const fields = Object.fromEntries(new FormData(event.currentTarget));
    setBusy(true);
    setMessage('Đang tạo tài khoản…');
    try {
      const user = await authRequest('register', fields);
      navigate('/login', { replace: true, state: { registered: true, username: user.username } });
    } catch (error) {
      setMessage(error.message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <AuthFrame height={1837} className="vyora-register">
      <h1 className="login-sr-only">Đăng ký tài khoản Vyora</h1>
      <RegisterArtwork />
      <Link to="/" className="login-hit login-logo" aria-label="Về trang chủ Vyora" />
      <Link to="/forum" className="login-hit login-forum" aria-label="Diễn đàn" />
      <Link to="/login" className="login-hit register-top-login" aria-label="Đăng nhập" />
      <a href="mailto:Vyoraappoffical@gmail.com" className="login-hit login-help" aria-label="Bạn cần giúp đỡ?" />
      <form className="login-form" onSubmit={submit} onChange={clearValidation}>
        <label className="login-sr-only" htmlFor="register-username">Tên đăng nhập</label>
        <input id="register-username" className="login-input login-username" name="username" autoComplete="username" placeholder="Tên đăng nhập" required />
        <label className="login-sr-only" htmlFor="register-password">Mật khẩu</label>
        <input id="register-password" className="login-input login-password" ref={password} name="password" type={showPassword ? 'text' : 'password'} autoComplete="new-password" placeholder="Mật khẩu" minLength={8} required />
        <button type="button" className="login-hit login-visibility" aria-label={showPassword ? 'Ẩn mật khẩu' : 'Hiện mật khẩu'} aria-pressed={showPassword} onClick={() => { setShowPassword(value => !value); password.current?.focus(); }} />
        <label className="login-sr-only" htmlFor="register-confirmation">Nhập lại mật khẩu</label>
        <input id="register-confirmation" className="login-input register-confirmation" ref={confirmation} name="passwordConfirmation" type={showConfirmation ? 'text' : 'password'} autoComplete="new-password" placeholder="Nhập lại mật khẩu" required />
        <button type="button" className="login-hit register-confirmation-visibility" aria-label={showConfirmation ? 'Ẩn mật khẩu nhập lại' : 'Hiện mật khẩu nhập lại'} aria-pressed={showConfirmation} onClick={() => { setShowConfirmation(value => !value); confirmation.current?.focus(); }} />
        <label className="login-sr-only" htmlFor="register-email">Nhập Email</label>
        <input id="register-email" className="login-input register-email" name="email" type="email" autoComplete="email" placeholder="Nhập Email" required />
        <label className="login-sr-only" htmlFor="register-phone">Nhập số điện thoại</label>
        <input id="register-phone" className="login-input register-phone" name="phone" type="tel" autoComplete="tel" placeholder="Nhập số điện thoại" required />
        <button type="submit" disabled={busy} className="login-hit register-submit" aria-label="Đăng ký" />
        <p className="register-status" role="status">{message}</p>
        <button type="button" className="login-hit register-facebook" aria-label="Đăng ký bằng Facebook" onClick={() => setMessage('Đăng ký bằng Facebook hiện chưa khả dụng.')} />
        <button type="button" className="login-hit register-google" aria-label="Đăng ký bằng Google" onClick={() => setMessage('Đăng ký bằng Google hiện chưa khả dụng.')} />
      </form>
    </AuthFrame>
  );
}
