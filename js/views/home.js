// ステータス画面（ホーム）
import * as store from '../store.js';
import { heroSprite, moodSprite, MOOD_LABEL } from '../sprites.js';
import { occurrencesOnDay } from '../events.js';
import { openDiaryEditor } from '../diaryEditor.js';
import { openEventEditor } from '../eventEditor.js';
import { esc, toKey, today, addDays, WEEK_JA, formatTime, formatDateJa } from '../util.js';

function streak() {
  let n = 0;
  let d = today();
  // きょう まだ書いていなくても、きのうまでの連続はカウントする
  if (!store.getEntry(toKey(d))) d = addDays(d, -1);
  while (store.getEntry(toKey(d))) {
    n++;
    d = addDays(d, -1);
  }
  return n;
}

export function gauge(kind, value, max = 100) {
  const p = Math.max(0, Math.min(100, (value / max) * 100));
  return `<div class="gauge ${kind}"><i style="width:${p}%"></i></div>`;
}

export function hpClass(hp) {
  if (hp == null) return '';
  if (hp <= 0) return 'dead';
  if (hp <= 25) return 'low';
  return '';
}

export function render(root) {
  const data = store.getData();
  const tKey = toKey(today());
  const entry = store.getEntry(tKey);
  const lv = store.levelInfo();
  const latest = store.allEntries()[0];
  const hurt = latest ? latest.hp <= 25 : false;
  const occs = occurrencesOnDay(today());

  const days = Array.from({ length: 7 }, (_, i) => addDays(today(), i - 6));

  root.innerHTML = `
  <div class="screen rpg">
    <div class="screen-inner">
      <header class="rpg-header">
        <h1>ステータス</h1>
        <span class="dim">${formatDateJa(today())}</span>
      </header>

      <section class="win">
        <div class="hero-row">
          ${heroSprite(72, hurt)}
          <div style="flex:1">
            <div class="name">${esc(data.profile.name)}</div>
            <div class="dim">${esc(store.titleFor(lv.level))}</div>
            <div style="display:flex;justify-content:space-between;margin-top:6px">
              <span>Lv ${lv.level}</span><span class="dim" style="font-size:12px">つぎのレベルまで ${lv.toNext}</span>
            </div>
            ${gauge('exp', lv.progress * 100)}
          </div>
        </div>
        <p class="dim" style="font-size:12px;margin-top:10px">れんぞく きろく ${streak()}日 ・ ぼうけん ${Object.keys(data.entries).length}日目</p>
      </section>

      ${
        entry
          ? `<section class="win ${hpClass(entry.hp)}">
          <span class="win-title">きょうの じょうたい</span>
          <div style="display:flex;gap:12px;align-items:center">
            ${moodSprite(entry.mood, 56)}
            <div style="flex:1">
              <div>きぶん：${MOOD_LABEL[entry.mood]}</div>
              <div class="stat-line"><span>HP</span>${gauge('hp', entry.hp)}<span class="num">${entry.hp}/100</span></div>
              <div class="stat-line"><span>MP</span>${gauge('mp', entry.mp)}<span class="num">${entry.mp}/100</span></div>
            </div>
          </div>
          ${entry.conditions.length ? `<p>じょうたい：${entry.conditions.map(esc).join('・')}</p>` : ''}
          ${
            entry.activities.length
              ? `<div class="chips" style="margin:6px 0">${entry.activities
                  .map((id) => store.activityById(id))
                  .map((a) => `<span class="chip static">${a.icon} ${esc(a.label)}</span>`)
                  .join('')}</div>`
              : ''
          }
          ${entry.title ? `<p>「${esc(entry.title)}」</p>` : ''}
          ${entry.hp <= 25 ? `<p>${entry.hp <= 0 ? 'ゆうしゃは ちからつきた… ゆっくり やすもう。' : 'HPが すくない！ むりは きんもつ。'}</p>` : ''}
          <button class="cmd" data-act="write">きろくを かきなおす</button>
        </section>`
          : `<section class="win">
          <span class="win-title">きょうの じょうたい</span>
          <p>まだ きょうの ぼうけんが きろくされていない。</p>
          <button class="cmd primary" data-act="write">きょうの ぼうけんを きろくする</button>
        </section>`
      }

      <section class="win">
        <span class="win-title">きょうの クエスト</span>
        ${
          occs.length
            ? occs
                .map(
                  (o) => `<button class="quest" data-ev="${esc(o.event.id)}">
              <span class="bar" style="background:${store.calendarById(o.event.calendar).color}"></span>
              <span>${esc(o.event.title)}</span>
              <span class="time">${o.event.allDay ? 'しゅうじつ' : `${formatTime(o.start)}〜${formatTime(o.end)}`}</span>
            </button>`,
                )
                .join('')
            : '<p class="dim">きょうの よていは ない。じゆうに ぼうけんしよう！</p>'
        }
        <button class="cmd" data-act="add-event">よていを ついか</button>
      </section>

      <section class="win">
        <span class="win-title">ちかごろの ぼうけん</span>
        <div class="recent">
          ${days
            .map((d) => {
              const e = store.getEntry(toKey(d));
              return `<button data-day="${toKey(d)}" class="${toKey(d) === tKey ? 'is-today' : ''}"
                aria-label="${d.getMonth() + 1}月${d.getDate()}日 ${e ? MOOD_LABEL[e.mood] : 'きろくなし'}">
                <span class="dim">${WEEK_JA[d.getDay()]}</span>
                ${moodSprite(e?.mood, 30)}
                <span>${d.getDate()}</span>
              </button>`;
            })
            .join('')}
        </div>
      </section>
    </div>
  </div>`;

  root.querySelector('.screen').addEventListener('click', (e) => {
    const b = e.target.closest('button');
    if (!b) return;
    if (b.dataset.act === 'write') openDiaryEditor(tKey);
    else if (b.dataset.act === 'add-event') openEventEditor({ date: today() });
    else if (b.dataset.day) openDiaryEditor(b.dataset.day);
    else if (b.dataset.ev) {
      const ev = data.events.find((x) => x.id === b.dataset.ev);
      if (ev) openEventEditor({ event: ev });
    }
  });
}
