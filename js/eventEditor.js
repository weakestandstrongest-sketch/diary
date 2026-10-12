// 予定の追加・編集シート（iPhone 純正カレンダーの「新規イベント」風）
import * as store from './store.js';
import { REPEATS, eventsToICS, downloadFile } from './events.js';
import { openSheet } from './ui.js';
import { esc, pad, parseKey, toKey, toLocalDateTime } from './util.js';

export function openEventEditor({ event = null, date = new Date(), hour = null, onDone = () => {} } = {}) {
  const isNew = !event;
  let f;
  if (event) {
    const s = parseKey(event.start);
    const e = parseKey(event.end || event.start);
    f = {
      title: event.title || '',
      location: event.location || '',
      allDay: !!event.allDay,
      startDate: toKey(s),
      startTime: `${pad(s.getHours())}:${pad(s.getMinutes())}`,
      endDate: toKey(e),
      endTime: `${pad(e.getHours())}:${pad(e.getMinutes())}`,
      repeat: event.repeat || 'none',
      repeatEnd: event.repeatEnd || '',
      calendar: event.calendar || store.getData().calendars[0].id,
      notes: event.notes || '',
    };
    if (event.allDay) {
      f.startTime = '09:00';
      f.endTime = '10:00';
    }
  } else {
    const now = new Date();
    const h = hour ?? Math.min(23, now.getHours() + 1);
    const s = new Date(date.getFullYear(), date.getMonth(), date.getDate(), h, 0);
    const e = new Date(s.getTime() + 3600000);
    f = {
      title: '',
      location: '',
      allDay: false,
      startDate: toKey(s),
      startTime: `${pad(s.getHours())}:00`,
      endDate: toKey(e),
      endTime: `${pad(e.getHours())}:00`,
      repeat: 'none',
      repeatEnd: '',
      calendar: store.getData().calendars[0].id,
      notes: '',
    };
  }

  const cals = store.getData().calendars;
  const { el, close } = openSheet(
    `
    <div class="sheet-nav">
      <button class="navbtn" data-act="cancel">キャンセル</button>
      <div class="title">${isNew ? '新規イベント' : 'イベントを編集'}</div>
      <button class="navbtn strong" data-act="save" ${f.title ? '' : 'disabled'}>${isNew ? '追加' : '完了'}</button>
    </div>
    <div class="sheet-body">
      <div class="group">
        <div class="row"><input type="text" name="title" placeholder="タイトル" value="${esc(f.title)}" aria-label="タイトル" /></div>
        <div class="row"><input type="text" name="location" placeholder="場所" value="${esc(f.location)}" aria-label="場所" /></div>
      </div>

      <div class="group">
        <div class="row">
          <label for="ev-allday">終日</label>
          <span class="switch"><input id="ev-allday" type="checkbox" name="allDay" ${f.allDay ? 'checked' : ''} /><span></span></span>
        </div>
        <div class="row">
          <label>開始</label>
          <span class="right">
            <input type="date" name="startDate" value="${f.startDate}" aria-label="開始日" />
            <input type="time" name="startTime" value="${f.startTime}" aria-label="開始時刻" data-time />
          </span>
        </div>
        <div class="row">
          <label>終了</label>
          <span class="right">
            <input type="date" name="endDate" value="${f.endDate}" aria-label="終了日" />
            <input type="time" name="endTime" value="${f.endTime}" aria-label="終了時刻" data-time />
          </span>
        </div>
      </div>

      <div class="group">
        <div class="row">
          <label for="ev-repeat">繰り返し</label>
          <select id="ev-repeat" name="repeat">
            ${REPEATS.map((r) => `<option value="${r.id}" ${r.id === f.repeat ? 'selected' : ''}>${r.label}</option>`).join('')}
          </select>
        </div>
        <div class="row" data-repeat-end>
          <label for="ev-repeat-end">繰り返し終了</label>
          <input id="ev-repeat-end" type="date" name="repeatEnd" value="${f.repeatEnd}" />
        </div>
      </div>

      <div class="group">
        <div class="row">
          <label for="ev-cal">カレンダー</label>
          <span class="right">
            <span class="cal-dot" data-cal-dot></span>
            <select id="ev-cal" name="calendar">
              ${cals.map((c) => `<option value="${c.id}" ${c.id === f.calendar ? 'selected' : ''}>${esc(c.name)}</option>`).join('')}
            </select>
          </span>
        </div>
      </div>

      <div class="group">
        <div class="row"><textarea name="notes" placeholder="メモ" aria-label="メモ">${esc(f.notes)}</textarea></div>
      </div>

      <div class="group">
        <button class="row btn blue" data-act="ics">iPhoneのカレンダーにも追加（.ics）</button>
      </div>
      <p class="group-note">.ics ファイルを開くと、iPhone 純正カレンダーにこの予定を登録できます。</p>

      ${isNew ? '' : '<div class="group"><button class="row btn" data-act="delete">イベントを削除</button></div>'}
    </div>`,
    'ios',
  );

  const form = el.querySelector('.sheet-body');
  const saveBtn = el.querySelector('[data-act="save"]');

  function sync() {
    form.querySelectorAll('[data-time]').forEach((i) => (i.hidden = f.allDay));
    form.querySelector('[data-repeat-end]').hidden = f.repeat === 'none';
    form.querySelector('[data-cal-dot]').style.background = store.calendarById(f.calendar).color;
    saveBtn.disabled = !f.title.trim();
  }
  sync();

  form.addEventListener('input', (e) => {
    const { name, type } = e.target;
    if (!name) return;
    const prevStart = parseKey(`${f.startDate}T${f.startTime}`);
    const prevEnd = parseKey(`${f.endDate}T${f.endTime}`);
    f[name] = type === 'checkbox' ? e.target.checked : e.target.value;

    // 開始を動かしたら、長さを保ったまま終了もずらす（純正カレンダーと同じ挙動）
    if ((name === 'startDate' || name === 'startTime') && f.startDate && f.startTime) {
      const ns = parseKey(`${f.startDate}T${f.startTime}`);
      const ne = new Date(ns.getTime() + Math.max(0, prevEnd - prevStart));
      f.endDate = toKey(ne);
      f.endTime = `${pad(ne.getHours())}:${pad(ne.getMinutes())}`;
      form.querySelector('[name="endDate"]').value = f.endDate;
      form.querySelector('[name="endTime"]').value = f.endTime;
    }
    sync();
  });

  function build() {
    let start;
    let end;
    if (f.allDay) {
      start = f.startDate;
      end = f.endDate && f.endDate >= f.startDate ? f.endDate : f.startDate;
    } else {
      const s = parseKey(`${f.startDate}T${f.startTime || '09:00'}`);
      let e = parseKey(`${f.endDate || f.startDate}T${f.endTime || '10:00'}`);
      if (e <= s) e = new Date(s.getTime() + 3600000);
      start = toLocalDateTime(s);
      end = toLocalDateTime(e);
    }
    return {
      id: event?.id,
      title: f.title.trim() || '新規イベント',
      location: f.location.trim(),
      allDay: f.allDay,
      start,
      end,
      repeat: f.repeat,
      repeatEnd: f.repeat !== 'none' && f.repeatEnd ? f.repeatEnd : '',
      calendar: f.calendar,
      notes: f.notes,
    };
  }

  el.querySelector('[data-act="cancel"]').addEventListener('click', close);
  saveBtn.addEventListener('click', () => {
    if (!f.startDate) return;
    store.saveEvent(build());
    close();
    onDone();
  });
  el.querySelector('[data-act="ics"]').addEventListener('click', () => {
    const ev = { ...build(), id: event?.id || 'tmp' + Date.now() };
    downloadFile(`${ev.title}.ics`, eventsToICS([ev]), 'text/calendar');
  });
  el.querySelector('[data-act="delete"]')?.addEventListener('click', () => {
    const msg = event.repeat && event.repeat !== 'none' ? 'この繰り返しイベントをすべて削除しますか？' : 'このイベントを削除しますか？';
    if (confirm(msg)) {
      store.deleteEvent(event.id);
      close();
      onDone();
    }
  });
}
