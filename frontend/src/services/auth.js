import { getCart, setCartOwner, syncStoredCart } from './cart';

const authChangeKey = 'vyora-auth-change';
let sessionVersion = 0;

function notifyAuthChange() {
  try {
    localStorage.setItem(authChangeKey, crypto.randomUUID());
  } catch {
    // Phiên đăng nhập vẫn hợp lệ khi trình duyệt chặn bộ nhớ cục bộ.
  }
}

export function watchAuthChanges() {
  function sync(event) {
    if (event.key === authChangeKey) {
      sessionVersion += 1;
      setCartOwner(undefined);
      authRequest('me').catch(() => {});
    } else {
      syncStoredCart(event);
    }
  }
  window.addEventListener('storage', sync);
  return () => window.removeEventListener('storage', sync);
}

export async function authRequest(path, body, method = 'POST') {
  const checkingSession = path === 'me' && body === undefined;
  const version = sessionVersion;
  let response;
  try {
    response = await fetch('/api/auth/' + path, {
      credentials: 'same-origin',
      ...(body === undefined ? {} : {
        method, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body),
      }),
    });
  } catch {
    if (checkingSession && version === sessionVersion && getCart().owner === undefined) setCartOwner(null);
    throw new Error('Không kết nối được máy chủ. Vui lòng thử lại.');
  }
  if (response.status === 204) {
    if (path === 'logout') {
      sessionVersion += 1;
      setCartOwner(null, { fromLogout: true });
      notifyAuthChange();
    }
    return;
  }
  const data = await response.json().catch(() => null);
  if (!response.ok || !data?.user) {
    if (checkingSession && version === sessionVersion &&
        (response.status === 401 || getCart().owner === undefined)) setCartOwner(null);
    throw Object.assign(new Error(data?.message || 'Máy chủ chưa sẵn sàng. Vui lòng thử lại.'), { status: response.status });
  }
  if (path === 'login') {
    sessionVersion += 1;
    setCartOwner(data.user.id, { fromLogin: true });
    notifyAuthChange();
  } else if (checkingSession && version === sessionVersion) {
    setCartOwner(data.user.id);
  }
  return data.user;
}
