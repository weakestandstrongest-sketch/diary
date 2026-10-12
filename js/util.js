// 日付・DOM まわりの小さなヘルパー

export const WEEK_JA = ['日', '月', '火', '水', '木', '金', '土'];

export function pad(n) {
  return String(n).padStart(2, '0');
}

/** Date -> 'YYYY-MM-DD'（ローカル時刻） */
export function toKey(d) {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

/** 'YYYY-MM-DD' or 'YYYY-MM-DDTHH:MM' -> Date（ローカル時刻） */
export function parseKey(s) {
  const [datePart, timePart] = s.split('T');
  const [y, m, d] = datePart.split('-').map(Number);
  const [hh, mm] = (timePart || '00:00').split(':').map(Number);
  return new Date(y, m - 1, d, hh, mm);
}

/** Date -> 'YYYY-MM-DDTHH:MM' */
export function toLocalDateTime(d) {
  return `${toKey(d)}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

export function today() {
  const d = new Date();
  return new Date(d.getFullYear(), d.getMonth(), d.getDate());
}

export function todayKey() {
  return toKey(new Date());
}

export function addDays(d, n) {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate() + n, d.getHours(), d.getMinutes());
}

export function addMonths(d, n) {
  // 月末をはみ出さないようにクランプする（1/31 + 1ヶ月 = 2/28）
  const target = new Date(d.getFullYear(), d.getMonth() + n, 1, d.getHours(), d.getMinutes());
  const last = daysInMonth(target.getFullYear(), target.getMonth());
  target.setDate(Math.min(d.getDate(), last));
  return target;
}

export function daysInMonth(y, m) {
  return new Date(y, m + 1, 0).getDate();
}

export function startOfWeek(d) {
  return addDays(new Date(d.getFullYear(), d.getMonth(), d.getDate()), -d.getDay());
}

export function sameDay(a, b) {
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
}

export function diffDays(a, b) {
  const ua = Date.UTC(a.getFullYear(), a.getMonth(), a.getDate());
  const ub = Date.UTC(b.getFullYear(), b.getMonth(), b.getDate());
  return Math.round((ub - ua) / 86400000);
}

export function formatTime(d) {
  return `${d.getHours()}:${pad(d.getMinutes())}`;
}

export function formatDateJa(d, withWeek = true) {
  const w = withWeek ? ` ${WEEK_JA[d.getDay()]}曜日` : '';
  return `${d.getFullYear()}年${d.getMonth() + 1}月${d.getDate()}日${w}`;
}

const ESC = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' };
export function esc(s) {
  return String(s ?? '').replace(/[&<>"']/g, (c) => ESC[c]);
}

export function uid() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
}

export function $(sel, root = document) {
  return root.querySelector(sel);
}

export function $$(sel, root = document) {
  return [...root.querySelectorAll(sel)];
}

export function clamp(v, lo, hi) {
  return Math.max(lo, Math.min(hi, v));
}

/** 左右・上下スワイプを検出する */
export function onSwipe(el, handler, { threshold = 50 } = {}) {
  let sx = 0;
  let sy = 0;
  let tracking = false;
  el.addEventListener(
    'touchstart',
    (e) => {
      if (e.touches.length !== 1) return;
      tracking = true;
      sx = e.touches[0].clientX;
      sy = e.touches[0].clientY;
    },
    { passive: true },
  );
  el.addEventListener(
    'touchend',
    (e) => {
      if (!tracking) return;
      tracking = false;
      const t = e.changedTouches[0];
      const dx = t.clientX - sx;
      const dy = t.clientY - sy;
      if (Math.abs(dx) < threshold && Math.abs(dy) < threshold) return;
      if (Math.abs(dx) > Math.abs(dy)) handler(dx < 0 ? 'left' : 'right');
      else handler(dy < 0 ? 'up' : 'down');
    },
    { passive: true },
  );
}
