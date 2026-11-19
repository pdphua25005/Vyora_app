import { useState } from 'react';
import { authRequest } from '../../services/auth';

const genders = [['male', 'Nam'], ['female', 'Nữ'], ['other', 'Khác']];
const months = Array.from({ length: 12 }, (_, i) => i + 1);
const years = Array.from({ length: new Date().getFullYear() - 1899 }, (_, i) => new Date().getFullYear() - i);

export function ProfileAvatar({ user, className }) {
  return (
    <span className={className} aria-hidden="true">
      {user.avatar ? <img src={user.avatar} alt="" /> : (user.displayName || user.username).charAt(0).toUpperCase()}
    </span>
  );
}

function maskEmail(email) {
  const at = email.indexOf('@');
  return at > 0 ? email.slice(0, Math.min(2, at)) + '********' + email.slice(at) : 'Chưa cập nhật';
}

function DateSelect({ label, name, value, options, onChange }) {
  return (
    <select aria-label={label} name={name} value={value} onChange={onChange}>
      <option value="">{label}</option>
      {options.map(number => <option key={number} value={number}>{number}</option>)}
    </select>
  );
}

export default function AccountProfile({ user, onSaved, onExpired }) {
  const [editEmail, setEditEmail] = useState(false);
  const [editPhone, setEditPhone] = useState(false);
  const [avatar, setAvatar] = useState(user.avatar);
  const [year, month, day] = (user.birthDate || '--').split('-').map(part => String(Number(part) || ''));
  const [birthday, setBirthday] = useState({ year, month, day });
  const [busy, setBusy] = useState(false);
  const [reading, setReading] = useState(false);
  const [notice, setNotice] = useState(null);

  function changeDate(event) {
    const { name, value } = event.target;
    setBirthday(previous => ({ ...previous, [name]: value }));
  }

  function chooseAvatar(event) {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) return;
    setNotice(null);
    if (!['image/jpeg', 'image/png'].includes(file.type) || file.size > 1024 * 1024) {
      setNotice({ text: 'Chọn ảnh JPEG hoặc PNG tối đa 1 MB.', error: true });
      return;
    }
    setReading(true);
    const reader = new FileReader();
    reader.addEventListener('load', () => setAvatar(reader.result));
    reader.addEventListener('error', () => setNotice({ text: 'Không đọc được ảnh. Vui lòng chọn lại.', error: true }));
    reader.addEventListener('loadend', () => setReading(false));
    reader.readAsDataURL(file);
  }

  async function save(event) {
    event.preventDefault();
    if (busy || reading) return;
    const form = event.currentTarget;
    const fields = Object.fromEntries(new FormData(form));
    const parts = [birthday.year, birthday.month, birthday.day];
    if (parts.some(Boolean) && !parts.every(Boolean)) {
      setNotice({ text: 'Hãy chọn đủ ngày, tháng và năm sinh.', error: true });
      return;
    }
    const birthDate = parts.every(Boolean) ? parts.map((part, i) => i === 0 ? part : part.padStart(2, '0')).join('-') : '';
    const changes = {};
    const profileFields = { username: fields.username.trim().toLowerCase(), displayName: fields.displayName.trim(), gender: fields.gender ?? '', birthDate, avatar };
    if (editEmail) profileFields.email = fields.email.trim().toLowerCase();
    if (editPhone) profileFields.phone = fields.phone.trim();
    for (const [field, value] of Object.entries(profileFields)) {
      if (value !== (user[field] ?? '')) changes[field] = value;
    }
    if (changes.email !== undefined) changes.currentPassword = fields.currentPassword;
    setBusy(true);
    setNotice(null);
    try {
      const updated = await authRequest('me', changes, 'PATCH');
      form.elements.username.value = updated.username;
      form.elements.displayName.value = updated.displayName;
      setAvatar(updated.avatar);
      onSaved(updated);
      setEditEmail(false);
      setEditPhone(false);
      setNotice({ text: 'Đã lưu thay đổi hồ sơ.' });
    } catch (error) {
      if (error.status === 401) onExpired();
      else setNotice({ text: error.message, error: true });
    } finally {
      setBusy(false);
    }
  }

  const days = Array.from({ length: birthday.month ? new Date(Number(birthday.year || 2000), Number(birthday.month), 0).getDate() : 31 }, (_, i) => i + 1);
  if (birthday.day && !days.includes(Number(birthday.day))) days.push(Number(birthday.day));

  return (
    <form className="profile-editor" onSubmit={save}>
      <fieldset className="profile-fields" disabled={busy}>
        <div className="profile-row">
          <label htmlFor="profile-username">Tên đăng nhập</label>
          <div>
            <input id="profile-username" name="username" defaultValue={user.username} readOnly={user.usernameChanged} required minLength={3} maxLength={30} />
            <p className="profile-hint">{user.usernameChanged ? 'Bạn đã sử dụng lượt đổi tên đăng nhập.' : 'Tên đăng nhập chỉ có thể thay đổi một lần.'}</p>
          </div>
        </div>
        <div className="profile-row">
          <label htmlFor="profile-name">Tên</label>
          <input id="profile-name" name="displayName" autoComplete="name" defaultValue={user.displayName} maxLength={80} />
        </div>
        <div className="profile-row">
          <span>Email</span>
          {editEmail ? (
            <div className="profile-contact-edit">
              <input aria-label="Email mới" name="email" type="email" autoComplete="email" defaultValue={user.email} required />
              <input aria-label="Mật khẩu hiện tại" name="currentPassword" type="password" autoComplete="current-password" placeholder="Mật khẩu hiện tại" required />
              <button className="profile-text-button" type="button" onClick={() => setEditEmail(false)}>Hủy</button>
            </div>
          ) : (
            <div className="profile-contact"><span>{maskEmail(user.email ?? '')}</span><button className="profile-text-button" type="button" onClick={() => setEditEmail(true)}>Thay Đổi<span className="profile-sr-only"> email</span></button></div>
          )}
        </div>
        <div className="profile-row">
          <span>Số điện thoại</span>
          {editPhone ? (
            <div className="profile-contact">
              <input aria-label="Số điện thoại" name="phone" type="tel" autoComplete="tel" defaultValue={user.phone} required />
              <button className="profile-text-button" type="button" onClick={() => setEditPhone(false)}>Hủy</button>
            </div>
          ) : (
            <div className="profile-contact">
              {user.phone && <span>{user.phone.slice(0, 3)}****{user.phone.slice(-3)}</span>}
              <button className="profile-text-button" type="button" onClick={() => setEditPhone(true)}>{user.phone ? 'Thay Đổi' : 'Thêm'}<span className="profile-sr-only"> số điện thoại</span></button>
            </div>
          )}
        </div>
        <div className="profile-row">
          <span id="profile-gender">Giới tính</span>
          <div className="profile-radio" role="radiogroup" aria-labelledby="profile-gender">
            {genders.map(([value, label]) => (
              <label key={value}><input type="radio" name="gender" value={value} defaultChecked={user.gender === value} />{label}</label>
            ))}
          </div>
        </div>
        <div className="profile-row">
          <span id="profile-birthday">Ngày sinh</span>
          <div className="profile-date" role="group" aria-labelledby="profile-birthday">
            <DateSelect label="Ngày" name="day" options={days} value={birthday.day} onChange={changeDate} />
            <DateSelect label="Tháng" name="month" options={months} value={birthday.month} onChange={changeDate} />
            <DateSelect label="Năm" name="year" options={years} value={birthday.year} onChange={changeDate} />
          </div>
        </div>
        <div className="profile-row profile-actions">
          <div>
            <button className="account-primary" type="submit" disabled={busy || reading}>{busy ? 'Đang lưu…' : 'Lưu'}</button>
            {notice && <p className={notice.error ? 'profile-feedback profile-feedback-error' : 'profile-feedback'} role={notice.error ? 'alert' : 'status'}>{notice.text}</p>}
          </div>
        </div>
      </fieldset>
      <div className="profile-photo">
        <ProfileAvatar user={{ ...user, avatar }} className="profile-avatar" />
        <label className="profile-image-picker">
          Chọn Ảnh
          <input className="profile-sr-only" type="file" accept="image/jpeg,image/png" aria-label="Chọn ảnh đại diện" onChange={chooseAvatar} disabled={busy || reading} />
        </label>
        <p>Dung lượng file tối đa 1 MB<br />Định dạng: JPEG, PNG</p>
      </div>
    </form>
  );
}
