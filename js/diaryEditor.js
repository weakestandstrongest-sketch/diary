// 日記（その日のステータス）を書くシート
import * as store from './store.js';
import { MOODS, CONDITIONS } from './store.js';
import { moodSprite } from './sprites.js';
import { occurrencesOnDay } from './events.js';
import { openSheet, toast } from './ui.js';
import { esc, parseKey, WEEK_JA, formatTime } from './util.js';
import { openEventEditor } from './eventEditor.js';

function latestEntryBefore(key) {
  return store.allEntries().find((e) => e.date < key) || null;
}

export function openDiaryEditor(dateKey) {
  const existing = store.getEntry(dateKey);
  const prev = latestEntryBefore(dateKey);
  const draft = existing
    ? structuredClone(existing)
    : {
        date: dateKey,
        mood: 0,
        hp: prev ? prev.hp : 70,
        mp: prev ? prev.mp : 70,
        conditions: [],
        activities: [],
        title: '',
        text: '',
      };

  const d = parseKey(dateKey);
  const heading = `${d.getMonth() + 1}月${d.getDate()}日(${WEEK_JA[d.getDay()]})`;

  const { el, close } = openSheet(`
    <div class="sheet-nav">
      <button class="navbtn" data-act="cancel">やめる</button>
      <div class="title">${heading} の ぼうけん</div>
      <button class="navbtn" data-act="save">ほぞん</button>
    </div>
    <div class="sheet-body"></div>
  `);
  const body = el.querySelector('.sheet-body');

  function render() {
    const acts = store.activities();
    const occs = occurrencesOnDay(d);
    body.innerHTML = `
      <section class="win">
        <span class="win-title">きぶん</span>
        <div class="mood-pick">
          ${MOODS.map(
            (m) => `<button type="button" data-mood="${m.value}" aria-pressed="${draft.mood === m.value}">
                ${moodSprite(m.value, 40)}<span>${m.label}</span></button>`,
          ).join('')}
        </div>
      </section>

      <section class="win">
        <span class="win-title">ステータス</span>
        ${slider('hp', 'HP', 'からだの ちょうし', draft.hp)}
        ${slider('mp', 'MP', 'こころの げんき・やるき', draft.mp)}
      </section>

      <section class="win">
        <span class="win-title">じょうたい</span>
        <div class="chips">
          ${CONDITIONS.map(
            (c) => `<button type="button" class="chip" data-cond="${esc(c)}" aria-pressed="${draft.conditions.includes(c)}">${esc(c)}</button>`,
          ).join('')}
        </div>
      </section>

      <section class="win">
        <span class="win-title">こうどう（なにを した？）</span>
        <div class="chips">
          ${acts
            .map(
              (a) => `<button type="button" class="chip" data-act-id="${esc(a.id)}" aria-pressed="${draft.activities.includes(a.id)}">${a.icon} ${esc(a.label)}</button>`,
            )
            .join('')}
        </div>
        <form class="add-row" data-form="add-act">
          <input class="px-input" name="label" maxlength="12" placeholder="こうどうを ついか（例: ピアノ）" />
          <button class="pxbtn" type="submit">ついか</button>
        </form>
      </section>

      <section class="win">
        <span class="win-title">にっき</span>
        <input class="px-input" data-field="title" maxlength="40" placeholder="きょうの ひとこと" value="${esc(draft.title)}" />
        <div style="height:8px"></div>
        <textarea class="px-textarea" data-field="text" placeholder="きょう あった できごとを かこう…">${esc(draft.text)}</textarea>
      </section>

      <section class="win">
        <span class="win-title">この日の よてい</span>
        ${
          occs.length
            ? occs
                .map(
                  (o) => `<button type="button" class="quest" data-ev="${esc(o.event.id)}">
                <span class="bar" style="background:${store.calendarById(o.event.calendar).color}"></span>
                <span>${esc(o.event.title)}</span>
                <span class="time">${o.event.allDay ? 'しゅうじつ' : formatTime(o.start)}</span></button>`,
                )
                .join('')
            : '<p class="dim">よていは ありません</p>'
        }
      </section>

      ${existing ? '<button type="button" class="pxbtn danger block" data-act="delete">この きろくを けす</button>' : ''}
    `;
  }

  function slider(key, label, hint, value) {
    const color = key === 'hp' ? 'var(--hp)' : 'var(--mp)';
    return `
      <div class="slider-row">
        <span>${label}</span>
        <input type="range" class="px-range" min="0" max="100" step="5" value="${value}" data-slider="${key}"
          aria-label="${label}（${hint}）" style="--c:${color};--p:${value}%" />
        <output data-out="${key}">${value}</output>
      </div>
      <p class="dim" style="font-size:12px;margin:-6px 0 8px 44px">${hint}</p>`;
  }

  render();

  body.addEventListener('input', (e) => {
    const s = e.target.dataset.slider;
    if (s) {
      draft[s] = Number(e.target.value);
      e.target.style.setProperty('--p', e.target.value + '%');
      body.querySelector(`[data-out="${s}"]`).textContent = e.target.value;
    }
    const f = e.target.dataset.field;
    if (f) draft[f] = e.target.value;
  });

  body.addEventListener('submit', (e) => {
    e.preventDefault();
    const input = e.target.elements.label;
    const act = store.addCustomActivity(input.value);
    if (act && !draft.activities.includes(act.id)) draft.activities.push(act.id);
    render();
  });

  body.addEventListener('click', (e) => {
    const btn = e.target.closest('button');
    if (!btn) return;
    if (btn.dataset.mood) {
      draft.mood = Number(btn.dataset.mood);
      body.querySelectorAll('[data-mood]').forEach((b) => b.setAttribute('aria-pressed', b === btn));
    } else if (btn.dataset.cond) {
      toggle(draft.conditions, btn.dataset.cond, btn);
    } else if (btn.dataset.actId) {
      toggle(draft.activities, btn.dataset.actId, btn);
    } else if (btn.dataset.ev) {
      const ev = store.getData().events.find((x) => x.id === btn.dataset.ev);
      if (ev) openEventEditor({ event: ev, onDone: render });
    }
  });

  function toggle(list, value, btn) {
    const i = list.indexOf(value);
    if (i >= 0) list.splice(i, 1);
    else list.push(value);
    btn.setAttribute('aria-pressed', i < 0);
  }

  el.querySelector('[data-act="cancel"]').addEventListener('click', close);
  el.addEventListener('click', (e) => {
    if (e.target.closest('[data-act="delete"]')) {
      if (confirm('ほんとうに この日の きろくを けしますか？')) {
        store.deleteEntry(dateKey);
        close();
        toast('きろくは きえさった…');
      }
    }
  });

  el.querySelector('[data-act="save"]').addEventListener('click', () => {
    if (!draft.mood) {
      toast('きぶん を えらんでください');
      return;
    }
    const before = store.levelInfo();
    const oldExp = existing ? store.entryExp(existing) : 0;
    store.saveEntry(draft);
    const after = store.levelInfo();
    const gained = store.entryExp(draft) - oldExp;
    close();
    let msg = existing ? 'ぼうけんのしょ に きろくしました。' : `${store.getData().profile.name}は けいけんち ${gained} かくとく！`;
    if (after.level > before.level) {
      msg += `\nレベルが ${after.level} に あがった！`;
      if (store.titleFor(after.level) !== store.titleFor(before.level)) {
        msg += `\nしょうごう「${store.titleFor(after.level)}」を てにいれた！`;
      }
    }
    toast(msg, 3600);
  });
}
