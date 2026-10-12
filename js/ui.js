// シート・トースト・ツールチップ・アイコン
import { renderMap } from './sprites.js';

export function openSheet(html, className = 'rpg') {
  const backdrop = document.createElement('div');
  backdrop.className = 'sheet-backdrop';
  backdrop.innerHTML = `<div class="sheet ${className}" role="dialog" aria-modal="true">${html}</div>`;
  document.body.appendChild(backdrop);
  const sheet = backdrop.firstElementChild;
  const close = () => backdrop.remove();
  backdrop.addEventListener('click', (e) => {
    if (e.target === backdrop) close();
  });
  return { el: sheet, close };
}

let toastTimer = null;
export function toast(message, ms = 2600) {
  document.querySelectorAll('.toast').forEach((t) => t.remove());
  const t = document.createElement('div');
  t.className = 'toast win';
  t.setAttribute('role', 'status');
  t.textContent = message;
  document.body.appendChild(t);
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => t.remove(), ms);
  t.addEventListener('click', () => t.remove());
}

// data-tip を持つ要素をタップ / ホバーしたときに小さなウィンドウを出す
let tipEl = null;
function hideTip() {
  tipEl?.remove();
  tipEl = null;
}

export function installTooltips() {
  const show = (target, x, y) => {
    hideTip();
    tipEl = document.createElement('div');
    tipEl.className = 'tip';
    tipEl.textContent = target.getAttribute('data-tip');
    document.body.appendChild(tipEl);
    const r = tipEl.getBoundingClientRect();
    const left = Math.min(window.innerWidth - r.width - 8, Math.max(8, x - r.width / 2));
    const top = y - r.height - 14 < 8 ? y + 18 : y - r.height - 14;
    tipEl.style.left = left + 'px';
    tipEl.style.top = top + 'px';
  };
  document.addEventListener('pointerover', (e) => {
    if (e.pointerType !== 'mouse') return;
    const t = e.target.closest?.('[data-tip]');
    if (t) show(t, e.clientX, e.clientY);
    else hideTip();
  });
  document.addEventListener('click', (e) => {
    const t = e.target.closest?.('[data-tip]');
    if (t) show(t, e.clientX, e.clientY);
    else hideTip();
  });
  document.addEventListener('scroll', hideTip, true);
}

// ---- アイコン ----
const ICONS = {
  heart: [
    '.oo...oo.',
    'oooo.oooo',
    'ooooooooo',
    'ooooooooo',
    '.ooooooo.',
    '..ooooo..',
    '...ooo...',
    '....o....',
    '.........',
  ],
  calendar: [
    '.o.....o.',
    'ooooooooo',
    'o.......o',
    'ooooooooo',
    'o.o.o.o.o',
    'ooooooooo',
    'o.o.o.o.o',
    'ooooooooo',
    '.........',
  ],
  chart: [
    '.......o.',
    '.......o.',
    '....o..o.',
    '....o..o.',
    '.o..o..o.',
    '.o..o..o.',
    '.o..o..o.',
    'ooooooooo',
    '.........',
  ],
  gear: [
    '....o....',
    '.o.ooo.o.',
    '..ooooo..',
    '.oo...oo.',
    'ooo...ooo',
    '.oo...oo.',
    '..ooooo..',
    '.o.ooo.o.',
    '....o....',
  ],
};

export function pxIcon(name, size = 22) {
  return renderMap(ICONS[name], { o: 'currentColor' }, size);
}

export const chevronLeft =
  '<svg viewBox="0 0 12 20" aria-hidden="true"><path d="M10 2 2 10l8 8" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round"/></svg>';
export const plusIcon =
  '<svg viewBox="0 0 22 22" aria-hidden="true"><path d="M11 3v16M3 11h16" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>';
