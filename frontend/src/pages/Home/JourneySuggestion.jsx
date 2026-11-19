import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import './JourneySuggestion.css';

const destinations = ['TP. Cần Thơ', 'TP. Đà Nẵng', 'TP. Hồ Chí Minh', 'Hà Nội', 'Huế', 'Hội An', 'Đà Lạt', 'Phú Quốc', 'Hạ Long', 'Nha Trang', 'Vũng Tàu', 'Phú Yên', 'Côn Đảo', 'Sa Pa', 'Ninh Bình'];
const locationIcon = '/assets/vyora/a66a68a1fbf71abe.svg';
const calendarIcon = '/assets/vyora/c8ddf654e0bfc496.svg';

function initialTimes() {
  const date = new Date();
  date.setDate(date.getDate() + 1);
  const localDate = day => [day.getFullYear(), String(day.getMonth() + 1).padStart(2, '0'), String(day.getDate()).padStart(2, '0')].join('-');
  const departure = localDate(date);
  date.setDate(date.getDate() + 1);
  const end = localDate(date);
  return { departure: departure + 'T08:00', end: end + 'T17:00' };
}

function displayTime(value) {
  const [date, time] = value.split('T');
  const [, month, day] = date.split('-');
  return time + ' ' + day + '/' + month;
}

function TimeDialog({ times, field, onSave, onClose }) {
  const title = field === 'departure' ? 'Thời gian xuất phát' : 'Thời gian kết thúc';
  const dialog = useRef(null);
  const [draft, setDraft] = useState(times[field]);
  const [error, setError] = useState('');
  useEffect(() => {
    const element = dialog.current;
    if (!element.open) element.showModal();
    element.querySelector('[name="' + field + '"]')?.focus();
  }, [field]);

  function submit(event) {
    event.preventDefault();
    const updated = { ...times, [field]: draft };
    if (updated.end <= updated.departure) {
      setError('Thời gian kết thúc phải sau thời gian xuất phát.');
      return;
    }
    onSave(updated);
    onClose();
  }

  return createPortal(
    <dialog className="journey-dialog" ref={dialog} aria-labelledby="journey-time-title"
      onCancel={onClose}>
      <form onSubmit={submit}>
        <header><h2 id="journey-time-title">{title}</h2>
          <button type="button" onClick={onClose} aria-label="Đóng chọn thời gian">×</button></header>
        <fieldset>
          <legend>{title}</legend>
          <label>Ngày và giờ
            <input type="datetime-local" name={field} aria-label={title}
              value={draft} required max="9999-12-31T23:59"
              onChange={event => { setDraft(event.target.value); setError(''); }} />
          </label>
        </fieldset>
        {error && <p className="journey-error" role="alert">{error}</p>}
        <footer><button type="button" onClick={onClose}>Hủy</button><button type="submit">Áp dụng</button></footer>
      </form>
    </dialog>, document.body);
}

export default function JourneySuggestion({ onSuggest }) {
  const [origin, setOrigin] = useState('TP. Cần Thơ');
  const [destination, setDestination] = useState('TP. Đà Nẵng');
  const [times, setTimes] = useState(initialTimes);
  const [editing, setEditing] = useState('');
  const [error, setError] = useState('');

  function suggest() {
    if (origin === destination) {
      setError('Vui lòng chọn địa điểm đến khác địa điểm xuất phát.');
      return;
    }
    setError('');
    onSuggest();
  }

  return (
    <section className="journey-selection" aria-label="Lựa chọn chuyến đi">
      <div className="journey-places">
        {[['Địa điểm xuất phát', origin, setOrigin], ['Địa điểm đến', destination, setDestination]].map(([label, value, setValue]) => (
          <label className="journey-place" key={label}>
            <img src={locationIcon} alt="" /><span>{label}</span>
            <select aria-label={label} value={value} onChange={event => { setValue(event.target.value); setError(''); }}>
              {destinations.map(place => <option key={place}>{place}</option>)}
            </select>
          </label>
        ))}
      </div>
      <div className="journey-times">
        {[['departure', 'Thời gian xuất phát'], ['end', 'Thời gian kết thúc']].map(([key, title]) => (
          <button className="journey-time" key={key} type="button" onClick={() => setEditing(key)} aria-label={'Chọn ' + title.toLowerCase()}>
            <img src={calendarIcon} alt="" /><span>{title}</span>
            <strong>{displayTime(times[key])}</strong>
          </button>
        ))}
      </div>
      <button type="button" className="journey-suggest" onClick={suggest}>Gợi ý cho bạn</button>
      {error && <p className="journey-selection-error" role="alert">{error}</p>}
      {editing && <TimeDialog times={times} field={editing} onSave={setTimes} onClose={() => setEditing('')} />}
    </section>
  );
}
