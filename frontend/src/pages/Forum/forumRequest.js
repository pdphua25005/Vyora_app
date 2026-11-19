export async function forumRequest(path, options) {
  const response = await fetch('/api/forum/' + path, options);
  const data = await response.json().catch(() => null);
  if (!response.ok || !data) {
    throw Object.assign(new Error(data?.message || 'Không kết nối được diễn đàn. Vui lòng thử lại.'), { status: response.status });
  }
  return data;
}
