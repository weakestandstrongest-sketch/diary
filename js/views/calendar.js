// カレンダー画面（iPhone 純正カレンダー風: 年 → 月 → 日）
import * as store from '../store.js';
import { moodSprite, MOOD_COLORS, MOOD_LABEL } from '../sprites.js';
import { occurrenceMap, occurrencesOnDay } from '../events.js';
import { openDiaryEditor } from '../diaryEditor.js';
import { openEventEditor } from '../eventEditor.js';
import { chevronLeft, plusIcon } from '../ui.js';
import { gauge } from './home.js';
import {
  WEEK_JA,
  addDays,
  addMonths,
  daysInMonth,
  esc,
  formatTime,
  onSwipe,
  sameDay,
  startOfWeek,
  toKey,
  today,
} from '../util.js';

const HOUR_PX = 52;

const state = {
  mode: 'month', // 'year' | 'month' | 'day'
  month: new Date(today().getFullYear(), today().getMonth(), 1),
  selected: today(),
  anim: '',
};

let root = null;

export function render(container) {
  root = container;
  if (state.mode === 'year') renderYear();
  else if (state.mode === 'day') renderDay();
  else renderMonth();
}

/** 他の画面から特定の日を開く */
export function showDay(date) {
  state.selected = date;
  state.month = new Date(date.getFullYear(), date.getMonth(), 1);
  state.mode = 'month';
}

function rerender() {
  render(root);
}

function navBar(backLabel, backTarget) {
  return `
    <div class="cal-nav">
      ${
        backLabel
          ? `<button class="back" data-go="${backTarget}">${chevronLeft}<span>${backLabel}</span></button>`
          : '<span></span>'
      }
      <div class="actions">
        <button data-act="today">今日</button>
        <button data-act="add" aria-label="予定を追加">${plusIcon}</button>
      </div>
    </div>`;
}

function bindNav(screen) {
  screen.querySelectorAll('[data-go]').forEach((b) =>
    b.addEventListener('click', () => {
      state.mode = b.dataset.go;
      if (state.mode === 'month') state.month = new Date(state.selected.getFullYear(), state.selected.getMonth(), 1);
      rerender();
    }),
  );
  screen.querySelector('[data-act="today"]').addEventListener('click', () => {
    state.selected = today();
    state.anim = '';
    if (state.mode === 'year') state.mode = 'month';
    state.month = new Date(today().getFullYear(), today().getMonth(), 1);
    rerender();
  });
  screen.querySelector('[data-act="add"]').addEventListener('click', () => {
    openEventEditor({ date: state.selected });
  });
}

// ---------------- 月 ----------------
function renderMonth() {
  const m = state.month;
  const y = m.getFullYear();
  const mo = m.getMonth();
  const offset = new Date(y, mo, 1).getDay();
  const dim = daysInMonth(y, mo);
  const weeks = Math.ceil((offset + dim) / 7);
  const from = new Date(y, mo, 1);
  const to = new Date(y, mo + 1, 1);
  const occMap = occurrenceMap(from, to);
  const t = today();

  let cells = '';
  for (let i = 0; i < weeks * 7; i++) {
    const dayNum = i - offset + 1;
    if (dayNum < 1 || dayNum > dim) {
      cells += `<div class="day-cell blank" aria-hidden="true"></div>`;
      continue;
    }
    const d = new Date(y, mo, dayNum);
    const key = toKey(d);
    const entry = store.getEntry(key);
    const occs = occMap.get(key) || [];
    const cls = ['day-cell'];
    if (d.getDay() === 0 || d.getDay() === 6) cls.push('we');
    if (sameDay(d, t)) cls.push('today');
    if (sameDay(d, state.selected)) cls.push('selected');
    const label = `${mo + 1}月${dayNum}日${entry ? ' きぶん' + MOOD_LABEL[entry.mood] : ''}${occs.length ? ` 予定${occs.length}件` : ''}`;
    cells += `
      <button class="${cls.join(' ')}" data-date="${key}" aria-label="${label}">
        <span class="num">${dayNum}</span>
        <span class="marks">
          ${entry ? moodSprite(entry.mood, 13) : ''}
          ${occs.length ? '<span class="dot"></span>' : ''}
        </span>
      </button>`;
  }

  root.innerHTML = `
  <div class="screen ios" style="padding-top:0">
    <div class="cal">
      ${navBar(`${y}年`, 'year')}
      <div class="cal-title">${mo + 1}月</div>
      <div class="cal-weekdays">${WEEK_JA.map((w, i) => `<span class="${i === 0 || i === 6 ? 'we' : ''}">${w}</span>`).join('')}</div>
      <div class="month-grid ${state.anim}">${cells}</div>
      <div class="agenda">${agendaHTML(state.selected)}</div>
    </div>
  </div>`;
  state.anim = '';

  const screen = root.querySelector('.screen');
  bindNav(screen);

  const grid = screen.querySelector('.month-grid');
  grid.addEventListener('click', (e) => {
    const b = e.target.closest('[data-date]');
    if (!b) return;
    const [yy, mm, dd] = b.dataset.date.split('-').map(Number);
    const d = new Date(yy, mm - 1, dd);
    if (sameDay(d, state.selected)) {
      state.mode = 'day';
    } else {
      state.selected = d;
    }
    rerender();
  });
  onSwipe(grid, (dir) => {
    if (dir === 'left' || dir === 'up') changeMonth(1);
    else changeMonth(-1);
  });

  bindAgenda(screen.querySelector('.agenda'));
}

function changeMonth(delta) {
  state.month = addMonths(state.month, delta);
  // 選択日も同じ「日」に移す（純正カレンダーは1日を選ぶ。今月なら今日）
  const t = today();
  state.selected =
    state.month.getFullYear() === t.getFullYear() && state.month.getMonth() === t.getMonth()
      ? t
      : new Date(state.month);
  state.anim = delta > 0 ? 'anim-next' : 'anim-prev';
  rerender();
}

function statusCardHTML(date) {
  const key = toKey(date);
  const e = store.getEntry(key);
  if (!e) {
    return `<button class="status-card empty" data-diary="${key}">＋ この日の ぼうけんを きろくする</button>`;
  }
  return `
    <button class="status-card" data-diary="${key}" aria-label="この日の日記を開く">
      ${moodSprite(e.mood, 40)}
      <span class="info">
        <span class="mini"><span>HP</span>${gauge('hp', e.hp)}<span>${e.hp}</span></span>
        <span class="mini"><span>MP</span>${gauge('mp', e.mp)}<span>${e.mp}</span></span>
        <span class="ttl">${esc(e.title || (e.text || '').slice(0, 30) || MOOD_LABEL[e.mood])}</span>
      </span>
    </button>`;
}

function eventRowsHTML(date) {
  const occs = occurrencesOnDay(date);
  if (!occs.length) return '<div class="empty-note">予定なし</div>';
  return occs
    .map((o) => {
      const cal = store.calendarById(o.event.calendar);
      let when;
      if (o.event.allDay) when = '<span>終日</span>';
      else {
        const startsBefore = !sameDay(o.start, date);
        const endsAfter = o.end > addDays(new Date(date.getFullYear(), date.getMonth(), date.getDate()), 1);
        when = `<span>${startsBefore ? '' : formatTime(o.start)}</span><span>${endsAfter ? '' : formatTime(o.end)}</span>`;
        if (startsBefore && endsAfter) when = '<span>終日</span>';
      }
      return `
        <button class="ev-row" data-ev="${esc(o.event.id)}">
          <span class="bar" style="background:${cal.color}"></span>
          <span class="main">
            <span class="t">${esc(o.event.title)}</span>
            ${o.event.location ? `<span class="loc">${esc(o.event.location)}</span>` : ''}
          </span>
          <span class="when">${when}</span>
        </button>`;
    })
    .join('');
}

function agendaHTML(date) {
  return `
    <div class="agenda-head">
      <span>${date.getMonth() + 1}月${date.getDate()}日 ${WEEK_JA[date.getDay()]}曜日</span>
      <button data-act="to-day">タイムライン ›</button>
    </div>
    ${statusCardHTML(date)}
    ${eventRowsHTML(date)}`;
}

function bindAgenda(el) {
  el.addEventListener('click', (e) => {
    const b = e.target.closest('button');
    if (!b) return;
    if (b.dataset.diary) openDiaryEditor(b.dataset.diary);
    else if (b.dataset.ev) {
      const ev = store.getData().events.find((x) => x.id === b.dataset.ev);
      if (ev) openEventEditor({ event: ev });
    } else if (b.dataset.act === 'to-day') {
      state.mode = 'day';
      rerender();
    }
  });
}

// ---------------- 年 ----------------
function renderYear() {
  const t = today();
  const center = state.month.getFullYear();
  const years = [];
  for (let y = center - 3; y <= center + 3; y++) years.push(y);

  const moodOf = (key) => store.getEntry(key)?.mood;

  root.innerHTML = `
  <div class="screen ios" style="padding-top:0">
    <div class="cal">
      ${navBar('', '')}
      <div class="year-scroll">
        ${years
          .map(
            (y) => `
          <section class="year-block ${y === t.getFullYear() ? 'current' : ''}" data-year="${y}">
            <h2>${y}年</h2>
            <div class="year-months">
              ${Array.from({ length: 12 }, (_, mo) => miniMonth(y, mo, t, moodOf)).join('')}
            </div>
          </section>`,
          )
          .join('')}
      </div>
    </div>
  </div>`;

  const screen = root.querySelector('.screen');
  bindNav(screen);
  screen.querySelector('.year-scroll').addEventListener('click', (e) => {
    const b = e.target.closest('[data-month]');
    if (!b) return;
    const [y, mo] = b.dataset.month.split('-').map(Number);
    state.month = new Date(y, mo, 1);
    state.selected = y === t.getFullYear() && mo === t.getMonth() ? t : new Date(y, mo, 1);
    state.mode = 'month';
    rerender();
  });
  scrollYearIntoView();
}

function scrollYearIntoView() {
  const block = root.querySelector(`[data-year="${state.month.getFullYear()}"]`);
  if (block) block.parentElement.scrollTop = block.offsetTop - block.parentElement.offsetTop;
}

function miniMonth(y, mo, t, moodOf) {
  const offset = new Date(y, mo, 1).getDay();
  const dim = daysInMonth(y, mo);
  let days = '';
  for (let i = 0; i < offset; i++) days += '<span></span>';
  for (let d = 1; d <= dim; d++) {
    const date = new Date(y, mo, d);
    const mood = moodOf(toKey(date));
    const cls = [];
    if (sameDay(date, t)) cls.push('today');
    if (mood) cls.push('has-mood');
    days += `<span class="${cls.join(' ')}" ${mood ? `style="--m:${MOOD_COLORS[mood].b}"` : ''}>${d}</span>`;
  }
  const current = y === t.getFullYear() && mo === t.getMonth();
  return `
    <button class="mini-month ${current ? 'current' : ''}" data-month="${y}-${mo}" aria-label="${y}年${mo + 1}月">
      <h3>${mo + 1}月</h3>
      <div class="mini-days">${days}</div>
    </button>`;
}

// ---------------- 日 ----------------
function renderDay() {
  const sel = state.selected;
  const t = today();
  const ws = startOfWeek(sel);
  const occs = occurrencesOnDay(sel);
  const dayStart = new Date(sel.getFullYear(), sel.getMonth(), sel.getDate());
  const dayEnd = addDays(dayStart, 1);
  const allDay = occs.filter((o) => o.event.allDay || (o.start <= dayStart && o.end >= dayEnd));
  const timed = occs.filter((o) => !allDay.includes(o));

  const strip = Array.from({ length: 7 }, (_, i) => {
    const d = addDays(ws, i);
    const e = store.getEntry(toKey(d));
    const cls = [];
    if (sameDay(d, t)) cls.push('today');
    if (sameDay(d, sel)) cls.push('selected');
    return `<button class="${cls.join(' ')}" data-date="${toKey(d)}" aria-label="${d.getMonth() + 1}月${d.getDate()}日">
      <span class="wd">${WEEK_JA[i]}</span>
      <span class="n">${d.getDate()}</span>
      <span class="mm">${e ? moodSprite(e.mood, 10) : ''}</span>
    </button>`;
  }).join('');

  const hours = Array.from(
    { length: 24 },
    (_, h) => `<div class="hour" data-hour="${h}"><span class="hl">${h === 0 ? '' : `${h}:00`}</span></div>`,
  ).join('');

  const layout = layoutTimed(timed, dayStart, dayEnd);
  const evHTML = layout
    .map(({ occ, top, height, col, cols }) => {
      const cal = store.calendarById(occ.event.calendar);
      const w = 100 / cols;
      return `<button class="tl-ev" data-ev="${esc(occ.event.id)}"
        style="--c:${cal.color};top:${top}px;height:${Math.max(height, 20)}px;left:calc(${col * w}% + 1px);width:calc(${w}% - 2px)">
        <b>${esc(occ.event.title)}</b>${height > 34 ? `${formatTime(occ.start)}${occ.event.location ? ' ' + esc(occ.event.location) : ''}` : ''}
      </button>`;
    })
    .join('');

  const now = new Date();
  const nowLine = sameDay(sel, t)
    ? `<div class="now-line" data-t="${formatTime(now)}" style="top:${((now.getHours() * 60 + now.getMinutes()) / 60) * HOUR_PX}px"></div>`
    : '';

  root.innerHTML = `
  <div class="screen ios" style="padding-top:0">
    <div class="cal">
      ${navBar(`${sel.getMonth() + 1}月`, 'month')}
      <div class="week-strip">${strip}</div>
      <div class="day-title">${sel.getFullYear()}年${sel.getMonth() + 1}月${sel.getDate()}日 ${WEEK_JA[sel.getDay()]}曜日</div>
      <div class="day-fixed">
        ${statusCardHTML(sel)}
        ${
          allDay.length
            ? `<div class="allday"><span class="lbl">終日</span><div class="items">${allDay
                .map(
                  (o) =>
                    `<button class="ev-chip" data-ev="${esc(o.event.id)}" style="--c:${store.calendarById(o.event.calendar).color}">${esc(o.event.title)}</button>`,
                )
                .join('')}</div></div>`
            : ''
        }
      </div>
      <div class="day-scroll">
        <div class="timeline">
          ${hours}
          <div class="tl-events">${evHTML}</div>
          ${nowLine}
        </div>
      </div>
    </div>
  </div>`;

  const screen = root.querySelector('.screen');
  bindNav(screen);

  const stripEl = screen.querySelector('.week-strip');
  stripEl.addEventListener('click', (e) => {
    const b = e.target.closest('[data-date]');
    if (!b) return;
    const [yy, mm, dd] = b.dataset.date.split('-').map(Number);
    state.selected = new Date(yy, mm - 1, dd);
    rerender();
  });
  onSwipe(stripEl, (dir) => {
    if (dir === 'left') moveDay(7);
    if (dir === 'right') moveDay(-7);
  });

  screen.querySelector('.day-fixed').addEventListener('click', (e) => {
    const b = e.target.closest('button');
    if (b?.dataset.diary) openDiaryEditor(b.dataset.diary);
    else if (b?.dataset.ev) {
      const ev = store.getData().events.find((x) => x.id === b.dataset.ev);
      if (ev) openEventEditor({ event: ev });
    }
  });

  const scroller = screen.querySelector('.day-scroll');
  onSwipe(scroller, (dir) => {
    if (dir === 'left') moveDay(1);
    if (dir === 'right') moveDay(-1);
  });
  scroller.addEventListener('click', (e) => {
    const b = e.target.closest('button');
    if (b?.dataset.ev) {
      const ev = store.getData().events.find((x) => x.id === b.dataset.ev);
      if (ev) openEventEditor({ event: ev });
      return;
    }
    const hourEl = e.target.closest('[data-hour]');
    const tl = e.target.closest('.timeline');
    if (tl && !b) {
      const y = e.clientY - tl.getBoundingClientRect().top;
      const h = Math.max(0, Math.min(23, Math.floor(y / HOUR_PX)));
      openEventEditor({ date: sel, hour: hourEl ? Number(hourEl.dataset.hour) : h });
    }
  });

  // 初期スクロール位置: 今日なら現在時刻の少し前、それ以外は最初の予定か 8時
  const tl = screen.querySelector('.timeline');
  let focusHour = 8;
  if (sameDay(sel, t)) focusHour = Math.max(0, now.getHours() - 1);
  else if (timed.length) focusHour = Math.max(0, timed[0].start.getHours() - 1);
  scroller.scrollTop = tl.offsetTop - scroller.offsetTop + focusHour * HOUR_PX - 8;
}

function moveDay(n) {
  state.selected = addDays(state.selected, n);
  rerender();
}

/** 重なる予定を横に並べる（同じ重なりグループ内で列を割り当てる） */
function layoutTimed(occs, dayStart, dayEnd) {
  const items = occs
    .map((occ) => {
      const s = Math.max(occ.start, dayStart);
      const e = Math.min(occ.end, dayEnd);
      return { occ, s, e, top: ((s - dayStart) / 3600000) * HOUR_PX, height: ((e - s) / 3600000) * HOUR_PX };
    })
    .sort((a, b) => a.s - b.s || b.e - a.e);

  const out = [];
  let group = [];
  let groupEnd = 0;
  const flush = () => {
    const colsEnd = [];
    for (const it of group) {
      let c = colsEnd.findIndex((end) => end <= it.s);
      if (c < 0) {
        c = colsEnd.length;
        colsEnd.push(0);
      }
      colsEnd[c] = it.e;
      it.col = c;
    }
    group.forEach((it) => out.push({ ...it, cols: colsEnd.length }));
    group = [];
  };
  for (const it of items) {
    if (group.length && it.s >= groupEnd) flush();
    group.push(it);
    groupEnd = Math.max(groupEnd, it.e);
  }
  if (group.length) flush();
  return out;
}
