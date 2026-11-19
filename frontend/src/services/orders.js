export async function orderRequest(path, body) {
  const options = body === undefined ? {} : {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  };
  const response = await fetch('/api/' + path, options);
  const result = await response.json().catch(() => null);

  if (!response.ok || !result) {
    throw Object.assign(new Error(result?.message || 'Không tải được dữ liệu. Vui lòng thử lại.'), { status: response.status });
  }
  return result;
}
