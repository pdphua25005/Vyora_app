import { useEffect, useRef, useState } from 'react';
import { chatRequest, useChatEvents } from './chatApi';

const time = new Intl.DateTimeFormat('vi-VN', {
  timeZone: 'Asia/Ho_Chi_Minh', day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit',
});

function mergeMessages(current, incoming) {
  const messages = new Map([...current, ...incoming].map(message => [message._id, message]));
  return [...messages.values()].sort((a, b) => a._id.localeCompare(b._id));
}

export default function ChatThread({ userId, admin = false, onSessionError }) {
  const { version, connected } = useChatEvents();
  const [messages, setMessages] = useState([]);
  const [next, setNext] = useState(null);
  const [loaded, setLoaded] = useState(false);
  const [body, setBody] = useState('');
  const [sending, setSending] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState('');
  const [retry, setRetry] = useState(0);
  const pending = useRef(null);
  const end = useRef(null);
  const endpoint = 'messages?' + new URLSearchParams({ userId });
  const sessionError = useRef(onSessionError);
  useEffect(() => { sessionError.current = onSessionError; }, [onSessionError]);

  useEffect(() => {
    const controller = new AbortController();
    chatRequest(endpoint, { signal: controller.signal }).then(result => {
      if (controller.signal.aborted) return;
      setMessages(current => mergeMessages(current, result.messages));
      setNext(current => loaded ? current : result.next);
      setLoaded(true);
      setError('');
    }).catch(error => {
      if (controller.signal.aborted) return;
      setError(error.message);
      if ([401, 403].includes(error.status)) sessionError.current?.(error);
    });
    return () => controller.abort();
  }, [endpoint, version, retry, loaded]);

  const latestId = messages.at(-1)?._id;
  useEffect(() => { end.current?.scrollIntoView({ block: 'nearest' }); }, [latestId]);

  async function loadOlder() {
    if (loadingMore) return;
    setLoadingMore(true);
    try {
      const result = await chatRequest(endpoint + '&before=' + next);
      setMessages(current => mergeMessages(current, result.messages));
      setNext(result.next);
    } catch (error) { setError(error.message); }
    finally { setLoadingMore(false); }
  }

  async function send(event) {
    event.preventDefault();
    if (sending || !body.trim()) return;
    pending.current ??= { requestId: crypto.randomUUID(), body: body.trim() };
    setSending(true);
    setError('');
    try {
      const result = await chatRequest(endpoint, { body: pending.current });
      setMessages(current => mergeMessages(current, [result.message]));
      pending.current = null;
      setBody('');
    } catch (error) {
      setError(error.message);
      if ([401, 403].includes(error.status)) sessionError.current?.(error);
    } finally { setSending(false); }
  }

  return (
    <div className="support-thread">
      <p className="support-connection" role="status">{connected ? 'Đã kết nối trực tiếp' : 'Đang kết nối lại…'}</p>
      <div className="support-messages" role="log" aria-label="Lịch sử trò chuyện" aria-live="polite">
        {next && <button className="support-text-button" onClick={loadOlder} disabled={loadingMore}>Tin nhắn cũ hơn</button>}
        {!loaded && !error && <p>Đang tải tin nhắn…</p>}
        {loaded && !messages.length && <p className="support-welcome">Xin chào! Bạn cần Vyora hỗ trợ điều gì?</p>}
        {messages.map(message => (
          <div className={'support-message ' + (message.fromAdmin === admin ? 'support-mine' : '')} key={message._id}>
            <strong>{message.fromAdmin ? 'Quản trị viên · ' : ''}{message.sender}</strong>
            <p>{message.body}</p>
            <time dateTime={message.createdAt}>{time.format(new Date(message.createdAt))}</time>
          </div>
        ))}
        <div ref={end} />
      </div>
      {error && <p className="support-error" role="alert">{error} <button className="support-text-button" onClick={() => setRetry(value => value + 1)}>Thử lại</button></p>}
      <form className="support-compose" onSubmit={send}>
        <textarea aria-label="Tin nhắn" placeholder="Nhập tin nhắn…" maxLength={2000} rows={2} value={body} disabled={sending}
          onChange={event => { setBody(event.target.value); pending.current = null; }} />
        <button type="submit" disabled={sending || !body.trim()}>{sending ? 'Đang gửi' : 'Gửi'}</button>
      </form>
    </div>
  );
}
