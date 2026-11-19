import { useEffect, useState } from 'react';
import ChatThread from '../../components/chat/ChatThread';
import { chatRequest, useChatEvents } from '../../components/chat/chatApi';
import '../../components/chat/SupportChat.css';

export default function AdminChat() {
  const { version } = useChatEvents();
  const [rows, setRows] = useState([]);
  const [next, setNext] = useState(null);
  const [selected, setSelected] = useState(null);
  const [error, setError] = useState('');
  const [retry, setRetry] = useState(0);
  useEffect(() => {
    const controller = new AbortController();
    chatRequest('conversations', { signal: controller.signal }).then(result => {
      if (controller.signal.aborted) return;
      setRows(result.conversations);
      setNext(result.next);
      setError('');
    }).catch(error => { if (!controller.signal.aborted) setError(error.message); });
    return () => controller.abort();
  }, [version, retry]);

  async function more() {
    try {
      const result = await chatRequest('conversations?before=' + next);
      setRows(current => [...current, ...result.conversations.filter(row => !current.some(item => item.userId === row.userId))]);
      setNext(result.next);
    } catch (error) { setError(error.message); }
  }

  return (
    <section className="admin-panel support-inbox">
      <div className="support-conversations">
        <h2>Cuộc trò chuyện</h2>
        {error && <p role="alert">{error} <button onClick={() => setRetry(value => value + 1)}>Thử lại</button></p>}
        {!rows.length && !error && <p>Chưa có tin nhắn từ khách hàng.</p>}
        {rows.map(row => (
          <button key={row.userId} aria-pressed={selected?.userId === row.userId} onClick={() => setSelected(row)}>
            <strong>{row.customer.displayName || row.customer.username}</strong>
            <span>{row.latest.fromAdmin ? 'Quản trị viên · ' : ''}{row.latest.body}</span>
          </button>
        ))}
        {next && <button onClick={more}>Xem thêm cuộc trò chuyện</button>}
      </div>
      <div className="support-admin-thread">
        {selected ? <>
          <h2>{selected.customer.displayName || selected.customer.username}</h2>
          <ChatThread key={selected.userId} userId={selected.userId} admin />
        </> : <p className="support-welcome">Chọn một cuộc trò chuyện để trả lời khách hàng.</p>}
      </div>
    </section>
  );
}
