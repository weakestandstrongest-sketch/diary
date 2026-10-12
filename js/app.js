// アプリ本体: タブ切り替えと再描画
import * as store from './store.js';
import * as home from './views/home.js';
import * as calendar from './views/calendar.js';
import * as review from './views/review.js';
import * as settings from './views/settings.js';
import { installTooltips, pxIcon } from './ui.js';

const TABS = [
  { id: 'home', label: 'ステータス', icon: 'heart', view: home },
  { id: 'calendar', label: 'カレンダー', icon: 'calendar', view: calendar },
  { id: 'review', label: 'ふりかえり', icon: 'chart', view: review },
  { id: 'settings', label: 'せってい', icon: 'gear', view: settings },
];

const viewEl = document.getElementById('view');
const tabbar = document.getElementById('tabbar');

let current = TABS.find((t) => t.id === location.hash.slice(1)) || TABS[0];

function renderTabbar() {
  tabbar.innerHTML = TABS.map(
    (t) => `<button data-tab="${t.id}" ${t === current ? 'aria-current="page"' : ''}>${pxIcon(t.icon, 22)}<span>${t.label}</span></button>`,
  ).join('');
}

function renderView() {
  const scroller = viewEl.querySelector('.screen');
  const keep = scroller && viewEl.dataset.tab === current.id ? scroller.scrollTop : 0;
  current.view.render(viewEl);
  viewEl.dataset.tab = current.id;
  // データ更新での再描画ではスクロール位置を保つ（カレンダーは自前で管理）
  const next = viewEl.querySelector('.screen');
  if (keep && next && current.id !== 'calendar') next.scrollTop = keep;
}

tabbar.addEventListener('click', (e) => {
  const b = e.target.closest('[data-tab]');
  if (!b) return;
  const tab = TABS.find((t) => t.id === b.dataset.tab);
  if (tab === current) {
    viewEl.querySelector('.screen')?.scrollTo({ top: 0, behavior: 'smooth' });
    return;
  }
  current = tab;
  history.replaceState(null, '', '#' + tab.id);
  renderTabbar();
  viewEl.dataset.tab = '';
  renderView();
});

store.subscribe(renderView);

// 日付が変わったら（アプリを開きっぱなしでも）表示を更新する
let lastDay = new Date().toDateString();
document.addEventListener('visibilitychange', () => {
  if (document.visibilityState === 'visible' && new Date().toDateString() !== lastDay) {
    lastDay = new Date().toDateString();
    renderView();
  }
});

installTooltips();
renderTabbar();
renderView();

if ('serviceWorker' in navigator && location.protocol !== 'file:') {
  navigator.serviceWorker.register('./sw.js').catch(() => {});
}
