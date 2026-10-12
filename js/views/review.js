// ふりかえり画面（週・月・年で「なにをしていたか」を可視化）
import * as store from '../store.js';
import { moodSprite, MOOD_LABEL } from '../sprites.js';
import { occurrencesInRange } from '../events.js';
import { openDiaryEditor } from '../diaryEditor.js';
import { esc, toKey, today, addDays, startOfWeek, daysInMonth, WEEK_JA, parseKey } from '../util.js';

// ヒートマップ用: 気分の発散スケール（むらさき ← グレー → みどり）。真ん中は目立たない色
const HEAT = { 1: '#9b6be0', 2: '#5f4a8a', 3: '#4a4d58', 4: '#3f7a4a', 5: '#4fd16a' };
const EMPTY = '#1c1c26';

const state = { period: 'week', anchor: today() };

function range() {
  const a = state.anchor;
  if (state.period === 'week') {
    const s = startOfWeek(a);
    return { from: s, to: addDays(s, 7) };
  }
  if (state.period === 'month') {
    return { from: new Date(a.getFullYear(), a.getMonth(), 1), to: new Date(a.getFullYear(), a.getMonth() + 1, 1) };
  }
  return { from: new Date(a.getFullYear(), 0, 1), to: new Date(a.getFullYear() + 1, 0, 1) };
}

function title({ from, to }) {
  if (state.period === 'week') {
    const e = addDays(to, -1);
    return `${from.getMonth() + 1}/${from.getDate()} 〜 ${e.getMonth() + 1}/${e.getDate()}`;
  }
  if (state.period === 'month') return `${from.getFullYear()}年 ${from.getMonth() + 1}月`;
  return `${from.getFullYear()}年`;
}

function shift(dir) {
  const a = state.anchor;
  if (state.period === 'week') state.anchor = addDays(a, 7 * dir);
  else if (state.period === 'month') state.anchor = new Date(a.getFullYear(), a.getMonth() + dir, 1);
  else state.anchor = new Date(a.getFullYear() + dir, 0, 1);
}

function entriesIn({ from, to }) {
  const f = toKey(from);
  const t = toKey(to);
  return Object.values(store.getData().entries)
    .filter((e) => e.date >= f && e.date < t)
    .sort((a, b) => (a.date < b.date ? -1 : 1));
}

const avg = (arr) => (arr.length ? Math.round(arr.reduce((s, v) => s + v, 0) / arr.length) : null);

function countActivities(entries) {
  const m = new Map();
  entries.forEach((e) => e.activities.forEach((id) => m.set(id, (m.get(id) || 0) + 1)));
  return [...m.entries()].sort((a, b) => b[1] - a[1]);
}

function longestStreak(entries) {
  let best = 0;
  let cur = 0;
  let prev = null;
  for (const e of entries) {
    const d = parseKey(e.date);
    cur = prev && toKey(addDays(prev, 1)) === e.date ? cur + 1 : 1;
    best = Math.max(best, cur);
    prev = d;
  }
  return best;
}

/** その期間をRPGのメッセージ風にまとめる */
function narrative(entries, acts, occCount, label) {
  const name = esc(store.getData().profile.name);
  if (!entries.length) {
    return `${label} の ぼうけんの きろくは まだ ない。<br>${occCount ? `よていは ${occCount}けん あった。` : ''}`;
  }
  const lines = [];
  const top = acts.slice(0, 2).map(([id, n]) => `${esc(store.activityById(id).label)}を ${n}かい`);
  if (top.length) lines.push(`${name}は ${label} ${top.join('、')} した！`);
  const best = [...entries].sort((a, b) => b.mood - a.mood || b.hp + b.mp - (a.hp + a.mp))[0];
  const bd = parseKey(best.date);
  lines.push(`いちばん よかった日は ${bd.getMonth() + 1}月${bd.getDate()}日（${MOOD_LABEL[best.mood]}）。`);
  const hp = avg(entries.map((e) => e.hp));
  if (hp <= 35) lines.push('HPが ひくめだ… やどやで やすもう。');
  else if (hp >= 75) lines.push('からだの ちょうしは ばっちりだ！');
  const mp = avg(entries.map((e) => e.mp));
  if (mp <= 35) lines.push('MPが へっている。すきなことで かいふくしよう。');
  return lines.join('<br>');
}

export function render(root) {
  const r = range();
  const entries = entriesIn(r);
  const acts = countActivities(entries);
  const occs = occurrencesInRange(r.from, r.to);
  const totalDays = Math.round((r.to - r.from) / 86400000);
  const label = { week: 'この しゅう', month: 'この つき', year: 'この とし' }[state.period];

  root.innerHTML = `
  <div class="screen rpg">
    <div class="screen-inner">
      <header class="rpg-header"><h1>ふりかえり</h1></header>

      <div class="seg-px" role="group" aria-label="きかん">
        ${[
          ['week', 'しゅう'],
          ['month', 'つき'],
          ['year', 'とし'],
        ]
          .map(([id, l]) => `<button data-period="${id}" aria-pressed="${state.period === id}">${l}</button>`)
          .join('')}
      </div>

      <div class="period-nav">
        <button data-shift="-1" aria-label="まえ">◀</button>
        <span>${title(r)}</span>
        <button data-shift="1" aria-label="つぎ">▶</button>
      </div>

      <section class="win">
        <span class="win-title">ぼうけんの まとめ</span>
        <p>${narrative(entries, acts, occs.length, label)}</p>
      </section>

      <section class="win">
        <div class="kpis">
          <div class="kpi"><div class="label">きろくした日</div><div class="value">${entries.length}<small> / ${totalDays}日</small></div></div>
          <div class="kpi"><div class="label">よてい</div><div class="value">${occs.length}<small> けん</small></div></div>
          <div class="kpi"><div class="label">へいきん HP</div><div class="value">${avg(entries.map((e) => e.hp)) ?? '—'}</div></div>
          <div class="kpi"><div class="label">へいきん MP</div><div class="value">${avg(entries.map((e) => e.mp)) ?? '—'}</div></div>
          ${
            state.period !== 'week'
              ? `<div class="kpi"><div class="label">さいちょう れんぞく</div><div class="value">${longestStreak(entries)}<small> 日</small></div></div>
                 <div class="kpi"><div class="label">かくとく けいけんち</div><div class="value">${entries.reduce((s, e) => s + store.entryExp(e), 0)}</div></div>`
              : ''
          }
        </div>
      </section>

      ${state.period === 'week' ? weekCharts(r, entries) : ''}
      ${state.period === 'month' ? monthCharts(r, entries) : ''}
      ${state.period === 'year' ? yearCharts(r, entries) : ''}

      <section class="win">
        <span class="win-title">よく した こと</span>
        ${rankHTML(acts.slice(0, 8).map(([id, n]) => {
          const a = store.activityById(id);
          return { label: `${a.icon} ${a.label}`, n };
        }), '#e6e6f0', 'かい')}
      </section>

      <section class="win">
        <span class="win-title">よていの カレンダーべつ</span>
        ${rankHTML(calendarCounts(occs), null, 'けん')}
      </section>

      <section class="win">
        <span class="win-title">きじゅつ いちらん</span>
        ${
          entries.length
            ? [...entries]
                .reverse()
                .slice(0, state.period === 'year' ? 60 : 31)
                .map((e) => {
                  const d = parseKey(e.date);
                  return `<button class="log-item" data-day="${e.date}">
                    ${moodSprite(e.mood, 32)}
                    <span style="flex:1;min-width:0">
                      <span class="date">${d.getMonth() + 1}/${d.getDate()}（${WEEK_JA[d.getDay()]}） HP${e.hp} MP${e.mp}</span><br>
                      <span>${esc(e.title || MOOD_LABEL[e.mood])}</span>
                      ${e.text ? `<span class="excerpt">${esc(e.text)}</span>` : ''}
                    </span>
                  </button>`;
                })
                .join('')
            : '<p class="dim">きろくは ありません</p>'
        }
      </section>
    </div>
  </div>`;

  const screen = root.querySelector('.screen');
  screen.addEventListener('click', (e) => {
    const b = e.target.closest('button, [data-day]');
    if (!b) return;
    if (b.dataset.period) {
      state.period = b.dataset.period;
      render(root);
    } else if (b.dataset.shift) {
      shift(Number(b.dataset.shift));
      render(root);
    } else if (b.dataset.day && b.tagName === 'BUTTON') {
      openDiaryEditor(b.dataset.day);
    }
  });
}

function calendarCounts(occs) {
  const m = new Map();
  occs.forEach((o) => m.set(o.event.calendar, (m.get(o.event.calendar) || 0) + 1));
  return [...m.entries()]
    .sort((a, b) => b[1] - a[1])
    .map(([id, n]) => {
      const c = store.calendarById(id);
      return { label: c.name, n, color: c.color };
    });
}

function rankHTML(rows, color, unit) {
  if (!rows.length) return '<p class="dim">まだ ありません</p>';
  const max = Math.max(...rows.map((r) => r.n));
  return `<div class="rank">${rows
    .map(
      (r) => `
      <span>${esc(r.label)}</span>
      <span class="bar" style="width:${(r.n / max) * 100}%;--c:${r.color || color}" data-tip="${esc(r.label)}: ${r.n}${unit}"></span>
      <span class="n">${r.n}</span>`,
    )
    .join('')}</div>`;
}

const legendHPMP = `<div class="legend"><span><i style="background:var(--hp)"></i>HP（からだ）</span><span><i style="background:var(--mp)"></i>MP（こころ）</span></div>`;

// ---- 週: HP/MP の棒グラフ + 気分 ----
function weekCharts({ from }, entries) {
  const byKey = Object.fromEntries(entries.map((e) => [e.date, e]));
  const W = 320;
  const H = 150;
  const top = 10;
  const bottom = 20;
  const left = 24;
  const ch = H - top - bottom;
  const colW = (W - left) / 7;
  const bw = Math.min(14, colW / 3);
  let bars = '';
  let grid = '';
  [0, 50, 100].forEach((v) => {
    const y = top + ch - (v / 100) * ch;
    grid += `<line class="grid" x1="${left}" x2="${W}" y1="${y}" y2="${y}"/><text x="${left - 4}" y="${y + 3}" text-anchor="end">${v}</text>`;
  });
  const moods = [];
  for (let i = 0; i < 7; i++) {
    const d = addDays(from, i);
    const key = toKey(d);
    const e = byKey[key];
    const cx = left + colW * i + colW / 2;
    bars += `<text x="${cx}" y="${H - 4}" text-anchor="middle">${WEEK_JA[i]} ${d.getDate()}</text>`;
    if (e) {
      const hpH = (e.hp / 100) * ch;
      const mpH = (e.mp / 100) * ch;
      const tip = `${d.getMonth() + 1}/${d.getDate()}\nHP ${e.hp} / MP ${e.mp}\n${MOOD_LABEL[e.mood]}`;
      bars += `<g data-tip="${tip}">
        <rect x="${cx - colW / 2}" y="${top}" width="${colW}" height="${ch}" fill="transparent"/>
        <rect x="${cx - bw - 1}" y="${top + ch - hpH}" width="${bw}" height="${hpH}" fill="var(--hp)"/>
        <rect x="${cx + 1}" y="${top + ch - mpH}" width="${bw}" height="${mpH}" fill="var(--mp)"/>
      </g>`;
    }
    moods.push(`<button data-day="${key}" aria-label="${d.getDate()}日">${moodSprite(e?.mood, 28)}</button>`);
  }
  return `
    <section class="win">
      <span class="win-title">HP・MP の すいい</span>
      ${legendHPMP}
      <svg class="chart" viewBox="0 0 ${W} ${H}" role="img" aria-label="1しゅうかんの HPとMP">${grid}${bars}</svg>
      <div class="week-moods" style="padding-left:${(left / W) * 100}%">${moods.join('')}</div>
    </section>`;
}

// ---- 月: HP/MP の折れ線 + 気分カレンダー + 気分の分布 ----
function lineChart(points, days, W = 320, H = 150, xLabel = (i) => i + 1, tipLabel = (i) => `${i + 1}日`) {
  const top = 10;
  const bottom = 20;
  const left = 24;
  const ch = H - top - bottom;
  const step = (W - left) / Math.max(1, days - 1);
  const x = (i) => left + i * step;
  const y = (v) => top + ch - (v / 100) * ch;
  let grid = '';
  [0, 50, 100].forEach((v) => {
    grid += `<line class="grid" x1="${left}" x2="${W}" y1="${y(v)}" y2="${y(v)}"/><text x="${left - 4}" y="${y(v) + 3}" text-anchor="end">${v}</text>`;
  });
  const labelEvery = days > 20 ? 5 : 1;
  let xl = '';
  for (let i = 0; i < days; i++) {
    if (i % labelEvery === 0 || i === days - 1) xl += `<text x="${x(i)}" y="${H - 4}" text-anchor="middle">${xLabel(i)}</text>`;
  }
  const path = (key) => {
    // 記録が無い日は線を切る
    let d = '';
    let pen = false;
    points.forEach((p, i) => {
      if (p == null) {
        pen = false;
        return;
      }
      d += `${pen ? 'L' : 'M'}${x(i).toFixed(1)},${y(p[key]).toFixed(1)}`;
      pen = true;
    });
    return d;
  };
  const dots = (key, color) =>
    points
      .map((p, i) => (p == null ? '' : `<rect x="${x(i) - 2}" y="${y(p[key]) - 2}" width="4" height="4" fill="${color}"/>`))
      .join('');
  const hits = points
    .map((p, i) =>
      p == null
        ? ''
        : `<rect x="${x(i) - step / 2}" y="${top}" width="${step}" height="${ch}" fill="transparent" data-tip="${tipLabel(i)}\nHP ${p.hp} / MP ${p.mp}"/>`,
    )
    .join('');
  return `<svg class="chart" viewBox="0 0 ${W} ${H}" role="img" aria-label="HPとMPの すいい">
    ${grid}${xl}
    <path d="${path('hp')}" fill="none" stroke="var(--hp)" stroke-width="2"/>
    <path d="${path('mp')}" fill="none" stroke="var(--mp)" stroke-width="2"/>
    ${dots('hp', 'var(--hp)')}${dots('mp', 'var(--mp)')}
    ${hits}
  </svg>`;
}

function moodDistribution(entries) {
  const rows = [5, 4, 3, 2, 1].map((m) => ({ m, n: entries.filter((e) => e.mood === m).length }));
  const max = Math.max(1, ...rows.map((r) => r.n));
  return `<div class="rank" style="grid-template-columns: 2em 4.5em 1fr 2.5em">${rows
    .map(
      (r) => `${moodSprite(r.m, 20)}<span>${MOOD_LABEL[r.m]}</span>
      <span class="bar" style="width:${(r.n / max) * 100}%;--c:${HEAT[r.m]};${r.n ? '' : 'visibility:hidden'}" data-tip="${MOOD_LABEL[r.m]}: ${r.n}日"></span><span class="n">${r.n}</span>`,
    )
    .join('')}</div>`;
}

function monthCharts({ from }, entries) {
  const y = from.getFullYear();
  const mo = from.getMonth();
  const dim = daysInMonth(y, mo);
  const byKey = Object.fromEntries(entries.map((e) => [e.date, e]));
  const points = Array.from({ length: dim }, (_, i) => byKey[toKey(new Date(y, mo, i + 1))] || null);

  const offset = from.getDay();
  let cal = WEEK_JA.map((w) => `<div>${w}</div>`).join('');
  for (let i = 0; i < offset; i++) cal += '<div></div>';
  for (let d = 1; d <= dim; d++) {
    const key = toKey(new Date(y, mo, d));
    cal += `<button data-day="${key}" aria-label="${mo + 1}月${d}日">${moodSprite(byKey[key]?.mood, 26)}${d}</button>`;
  }

  return `
    <section class="win">
      <span class="win-title">HP・MP の すいい</span>
      ${legendHPMP}
      ${lineChart(points, dim, 320, 150, (i) => i + 1, (i) => `${mo + 1}/${i + 1}`)}
    </section>
    <section class="win">
      <span class="win-title">きぶん カレンダー</span>
      <div class="month-mood">${cal}</div>
    </section>
    <section class="win">
      <span class="win-title">きぶんの ぶんぷ</span>
      ${moodDistribution(entries)}
    </section>`;
}

// ---- 年: 1年のヒートマップ + 月ごとの平均 ----
function yearCharts({ from }, entries) {
  const y = from.getFullYear();
  const byKey = Object.fromEntries(entries.map((e) => [e.date, e]));
  const start = startOfWeek(from);
  const end = new Date(y + 1, 0, 1);
  let cells = '';
  let months = '';
  let col = 0;
  for (let d = start; d < end; d = addDays(d, 1)) {
    const inYear = d.getFullYear() === y;
    const e = inYear ? byKey[toKey(d)] : null;
    if (d.getDay() === 0) col = Math.round((d - start) / (7 * 86400000));
    if (inYear && d.getDate() === 1) months += `<span style="left:${col * 11}px">${d.getMonth() + 1}月</span>`;
    const bg = !inYear ? 'transparent' : e ? HEAT[e.mood] : EMPTY;
    const tip = inYear ? `${d.getMonth() + 1}/${d.getDate()} ${e ? MOOD_LABEL[e.mood] + `\nHP ${e.hp} / MP ${e.mp}` : 'きろくなし'}` : '';
    cells += `<i style="background:${bg}" ${inYear ? `data-tip="${tip}"` : ''}></i>`;
  }

  const monthly = Array.from({ length: 12 }, (_, m) => {
    const list = entries.filter((e) => parseKey(e.date).getMonth() === m);
    return list.length ? { hp: avg(list.map((e) => e.hp)), mp: avg(list.map((e) => e.mp)), n: list.length } : null;
  });

  const legend = [1, 2, 3, 4, 5]
    .map((m) => `<span><i style="background:${HEAT[m]}"></i>${MOOD_LABEL[m]}</span>`)
    .join('');

  return `
    <section class="win">
      <span class="win-title">1ねんの きぶん</span>
      <div class="legend">${legend}<span><i style="background:${EMPTY};outline:1px solid #333"></i>きろくなし</span></div>
      <div style="overflow-x:auto">
        <div style="width:${54 * 11}px">
          <div class="heat-months">${months}</div>
          <div class="heat">${cells}</div>
        </div>
      </div>
    </section>
    <section class="win">
      <span class="win-title">つきごとの へいきん HP・MP</span>
      ${legendHPMP}
      ${lineChart(monthly, 12, 320, 150, (i) => `${i + 1}`, (i) => `${i + 1}月（${monthly[i]?.n ?? 0}日）`)}
    </section>
    <section class="win">
      <span class="win-title">きぶんの ぶんぷ</span>
      ${moodDistribution(entries)}
    </section>`;
}
