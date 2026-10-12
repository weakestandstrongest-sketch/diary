// 予定（イベント）の繰り返し展開と .ics 入出力
import { getData } from './store.js';
import { addDays, addMonths, diffDays, parseKey, toKey, pad, toLocalDateTime } from './util.js';

export const REPEATS = [
  { id: 'none', label: 'しない' },
  { id: 'daily', label: '毎日' },
  { id: 'weekly', label: '毎週' },
  { id: 'monthly', label: '毎月' },
  { id: 'yearly', label: '毎年' },
];

/** イベントの1回目の開始・終了（終了は排他的） */
function baseSpan(ev) {
  const start = parseKey(ev.start);
  let end;
  if (ev.allDay) {
    end = addDays(parseKey(ev.end || ev.start), 1);
  } else {
    end = parseKey(ev.end || ev.start);
    if (end <= start) end = new Date(start.getTime() + 30 * 60000);
  }
  return { start, end };
}

function nthOccurrence(ev, base, n) {
  switch (ev.repeat) {
    case 'daily':
      return addDays(base, n);
    case 'weekly':
      return addDays(base, n * 7);
    case 'monthly':
      return addMonths(base, n);
    case 'yearly':
      return addMonths(base, n * 12);
    default:
      return n === 0 ? base : null;
  }
}

/** [from, to) と重なる発生をすべて返す */
export function occurrencesInRange(from, to, events = getData().events) {
  const out = [];
  for (const ev of events) {
    const { start, end } = baseSpan(ev);
    const dur = end - start;
    const repeat = ev.repeat && ev.repeat !== 'none';
    const until = repeat && ev.repeatEnd ? addDays(parseKey(ev.repeatEnd), 1) : null;

    if (!repeat) {
      if (start < to && end > from) out.push({ event: ev, start, end });
      continue;
    }

    // 範囲の少し手前から数え始めて、無駄なループを避ける
    const lookFrom = new Date(from.getTime() - dur);
    let n = 0;
    const days = diffDays(start, lookFrom);
    if (days > 0) {
      if (ev.repeat === 'daily') n = days;
      else if (ev.repeat === 'weekly') n = Math.floor(days / 7);
      else if (ev.repeat === 'monthly') n = Math.max(0, Math.floor(days / 31) - 1);
      else if (ev.repeat === 'yearly') n = Math.max(0, Math.floor(days / 366) - 1);
    }
    for (let guard = 0; guard < 1000; guard++, n++) {
      const s = nthOccurrence(ev, start, n);
      if (!s || s >= to) break;
      if (until && s >= until) break;
      const e = new Date(s.getTime() + dur);
      if (e > from) out.push({ event: ev, start: s, end: e });
    }
  }
  return out.sort(compareOcc);
}

function compareOcc(a, b) {
  if (a.event.allDay !== b.event.allDay) return a.event.allDay ? -1 : 1;
  return a.start - b.start || (a.event.title || '').localeCompare(b.event.title || '');
}

export function occurrencesOnDay(date) {
  const d = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  return occurrencesInRange(d, addDays(d, 1));
}

/** 月表示などで使う: dateKey -> 発生リスト */
export function occurrenceMap(from, to) {
  const map = new Map();
  for (const occ of occurrencesInRange(from, to)) {
    let d = new Date(Math.max(occ.start, from));
    d = new Date(d.getFullYear(), d.getMonth(), d.getDate());
    while (d < occ.end && d < to) {
      const k = toKey(d);
      if (!map.has(k)) map.set(k, []);
      map.get(k).push(occ);
      d = addDays(d, 1);
    }
  }
  return map;
}

// ---------------- .ics ----------------

function icsEscape(s) {
  return String(s || '')
    .replace(/\\/g, '\\\\')
    .replace(/\n/g, '\\n')
    .replace(/,/g, '\\,')
    .replace(/;/g, '\\;');
}

function icsUnescape(s) {
  return s.replace(/\\n/gi, '\n').replace(/\\,/g, ',').replace(/\\;/g, ';').replace(/\\\\/g, '\\');
}

function icsDate(d) {
  return `${d.getFullYear()}${pad(d.getMonth() + 1)}${pad(d.getDate())}`;
}

function icsDateTime(d) {
  return `${icsDate(d)}T${pad(d.getHours())}${pad(d.getMinutes())}00`;
}

const FREQ = { daily: 'DAILY', weekly: 'WEEKLY', monthly: 'MONTHLY', yearly: 'YEARLY' };

export function eventsToICS(events) {
  const stamp = new Date().toISOString().replace(/[-:]/g, '').replace(/\.\d+/, '');
  const lines = ['BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//Pixel Quest Diary//JA', 'CALSCALE:GREGORIAN'];
  for (const ev of events) {
    const { start, end } = baseSpan(ev);
    lines.push('BEGIN:VEVENT', `UID:${ev.id}@pixel-quest-diary`, `DTSTAMP:${stamp}`);
    if (ev.allDay) {
      lines.push(`DTSTART;VALUE=DATE:${icsDate(start)}`, `DTEND;VALUE=DATE:${icsDate(end)}`);
    } else {
      lines.push(`DTSTART:${icsDateTime(start)}`, `DTEND:${icsDateTime(end)}`);
    }
    if (ev.repeat && FREQ[ev.repeat]) {
      let rule = `RRULE:FREQ=${FREQ[ev.repeat]}`;
      if (ev.repeatEnd) rule += `;UNTIL=${icsDate(parseKey(ev.repeatEnd))}T235959`;
      lines.push(rule);
    }
    lines.push(`SUMMARY:${icsEscape(ev.title)}`);
    if (ev.location) lines.push(`LOCATION:${icsEscape(ev.location)}`);
    if (ev.notes) lines.push(`DESCRIPTION:${icsEscape(ev.notes)}`);
    lines.push('END:VEVENT');
  }
  lines.push('END:VCALENDAR');
  return lines.join('\r\n');
}

/** DTSTART などの値を { date: Date, allDay } に */
function parseIcsDate(params, value) {
  const allDay = /VALUE=DATE(?!-)/i.test(params) || /^\d{8}$/.test(value);
  const m = value.match(/^(\d{4})(\d{2})(\d{2})(?:T(\d{2})(\d{2})(\d{2})?(Z)?)?/);
  if (!m) return null;
  const [, y, mo, d, hh = '0', mi = '0', ss = '0', z] = m;
  const date = z
    ? new Date(Date.UTC(+y, +mo - 1, +d, +hh, +mi, +ss))
    : new Date(+y, +mo - 1, +d, +hh, +mi, +ss);
  return { date, allDay };
}

export function parseICS(text, calendarId = 'private') {
  // 行の折り返し（RFC 5545）を戻す
  const lines = text.replace(/\r\n[ \t]/g, '').replace(/\n[ \t]/g, '').split(/\r?\n/);
  const events = [];
  let cur = null;
  for (const line of lines) {
    if (line === 'BEGIN:VEVENT') {
      cur = {};
      continue;
    }
    if (line === 'END:VEVENT') {
      if (cur && cur.DTSTART) events.push(cur);
      cur = null;
      continue;
    }
    if (!cur) continue;
    const idx = line.indexOf(':');
    if (idx < 0) continue;
    const left = line.slice(0, idx);
    const value = line.slice(idx + 1);
    const [name, ...params] = left.split(';');
    cur[name.toUpperCase()] = { params: params.join(';'), value };
  }

  return events
    .map((raw) => {
      const s = parseIcsDate(raw.DTSTART.params, raw.DTSTART.value);
      if (!s) return null;
      const e = raw.DTEND ? parseIcsDate(raw.DTEND.params, raw.DTEND.value) : null;
      const ev = {
        title: raw.SUMMARY ? icsUnescape(raw.SUMMARY.value) : '(タイトルなし)',
        location: raw.LOCATION ? icsUnescape(raw.LOCATION.value) : '',
        notes: raw.DESCRIPTION ? icsUnescape(raw.DESCRIPTION.value) : '',
        allDay: s.allDay,
        calendar: calendarId,
        repeat: 'none',
      };
      if (s.allDay) {
        ev.start = toKey(s.date);
        // ics の終日 DTEND は排他的なので1日戻す
        const endDate = e ? addDays(e.date, -1) : s.date;
        ev.end = toKey(endDate < s.date ? s.date : endDate);
      } else {
        ev.start = toLocalDateTime(s.date);
        ev.end = toLocalDateTime(e ? e.date : new Date(s.date.getTime() + 3600000));
      }
      if (raw.RRULE) {
        const freq = (raw.RRULE.value.match(/FREQ=(\w+)/) || [])[1];
        const found = Object.entries(FREQ).find(([, v]) => v === freq);
        const interval = +((raw.RRULE.value.match(/INTERVAL=(\d+)/) || [])[1] || 1);
        if (found && interval === 1) {
          ev.repeat = found[0];
          const until = (raw.RRULE.value.match(/UNTIL=(\d{8})/) || [])[1];
          if (until) ev.repeatEnd = `${until.slice(0, 4)}-${until.slice(4, 6)}-${until.slice(6, 8)}`;
        }
      }
      return ev;
    })
    .filter(Boolean);
}

export function downloadFile(name, content, type) {
  const blob = new Blob([content], { type });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = name;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
