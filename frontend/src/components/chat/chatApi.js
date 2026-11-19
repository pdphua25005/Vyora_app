import { useEffect, useState } from 'react';

export async function chatRequest(path, options = {}) {
  const { body, ...rest } = options;
  const response = await fetch('/api/chat/' + path, {
    ...rest,
    ...(body === undefined ? {} : { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) }),
  });
  const result = await response.json();
  if (!response.ok) throw Object.assign(new Error(result.message || 'Không tải được tin nhắn.'), { status: response.status });
  return result;
}

export function useChatEvents() {
  const [version, setVersion] = useState(0);
  const [connected, setConnected] = useState(false);
  useEffect(() => {
    const source = new EventSource('/api/chat/events');
    function refresh() { setConnected(true); setVersion(value => value + 1); }
    source.addEventListener('ready', refresh);
    source.addEventListener('message', refresh);
    source.addEventListener('expired', () => { setConnected(false); setVersion(value => value + 1); source.close(); });
    source.onerror = () => setConnected(false);
    return () => source.close();
  }, []);
  return { version, connected };
}
