import { useSyncExternalStore } from 'react';

const cartKey = 'vyora-flash-sale-cart';
const guestKey = cartKey + ':guest';
const listeners = new Set();
let cart = { owner: undefined, items: [] };

function keyFor(owner) {
  return owner === null ? guestKey : cartKey + ':user:' + owner;
}

export function readCart(owner = cart.owner) {
  if (owner === undefined) return [];
  try {
    const items = JSON.parse(localStorage.getItem(keyFor(owner)));
    return Array.isArray(items) ? items : [];
  } catch {
    return [];
  }
}

function updateSnapshot(owner, items) {
  cart = { owner, items };
  for (const listener of listeners) listener();
}

export function saveCart(items, owner = cart.owner) {
  if (owner === undefined) return;
  try { localStorage.setItem(keyFor(owner), JSON.stringify(items)); } catch { /* Dùng giỏ trong bộ nhớ. */ }
  if (owner === cart.owner) updateSnapshot(owner, items);
}

function clearStoredCart(key) {
  try { localStorage.removeItem(key); } catch { /* Bộ nhớ cục bộ không khả dụng. */ }
}

export function setCartOwner(owner, { fromLogin = false, fromLogout = false } = {}) {
  if (owner === cart.owner && !fromLogin && !fromLogout) return;
  let items = owner === undefined || fromLogout ? [] : readCart(owner);
  if (fromLogin) {
    const guestItems = cart.owner === null ? cart.items : readCart(null);
    if (guestItems.length) {
      // Giữ lựa chọn mới nhất của khách nếu dòng đó đã nằm trong giỏ tài khoản.
      const merged = new Map([...items, ...guestItems].map(item => [item.id, item]));
      items = [...merged.values()];
      saveCart(items, owner);
    }
  }
  if (fromLogin || fromLogout) {
    clearStoredCart(guestKey);
    clearStoredCart(cartKey);
  }
  updateSnapshot(owner, items);
}

function subscribe(listener) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function syncStoredCart(event) {
  if (cart.owner !== undefined && (event.key === null || event.key === keyFor(cart.owner))) {
    updateSnapshot(cart.owner, readCart(cart.owner));
  }
}

export const getCart = () => cart;
export const useCart = () => useSyncExternalStore(subscribe, getCart);

export function cartQuantity(items) {
  return items.reduce((total, item) => total + item.quantity, 0);
}

export function priceInDong(price) {
  return Number(price.replace(/[^0-9]/g, ''));
}

export function formatPrice(amount) {
  return amount.toLocaleString('vi-VN') + ' đ';
}

export function voucherIsValid(code) {
  return code.trim().toUpperCase() === 'VYORA10';
}

export function voucherDiscount(subtotal, applied) {
  return applied ? Math.round(subtotal * 0.1) : 0;
}

export function formatSlot(date, time) {
  const day = date.split('-').reverse().join('/');
  return time ? day + ' · ' + time : day;
}
