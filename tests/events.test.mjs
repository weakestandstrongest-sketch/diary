// node --test tests/*.test.mjs で実行
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { occurrencesInRange, occurrenceMap, eventsToICS, parseICS } from '../js/events.js';
import { levelInfo } from '../js/store.js';
import { addMonths } from '../js/util.js';

const d = (y, m, day) => new Date(y, m - 1, day);

test('繰り返しなしの予定は範囲内だけに出る', () => {
  const ev = { id: 'a', title: 'x', allDay: false, start: '2026-10-12T10:00', end: '2026-10-12T11:00', repeat: 'none' };
  assert.equal(occurrencesInRange(d(2026, 10, 12), d(2026, 10, 13), [ev]).length, 1);
  assert.equal(occurrencesInRange(d(2026, 10, 13), d(2026, 10, 14), [ev]).length, 0);
});

test('毎週の予定と繰り返し終了日', () => {
  const ev = { id: 'w', title: 'w', allDay: false, start: '2026-01-05T09:00', end: '2026-01-05T10:00', repeat: 'weekly', repeatEnd: '2026-01-26' };
  const occ = occurrencesInRange(d(2026, 1, 1), d(2026, 3, 1), [ev]);
  assert.deepEqual(occ.map((o) => o.start.getDate()), [5, 12, 19, 26]);
});

test('毎月の予定は月末にクランプされる', () => {
  const ev = { id: 'm', title: 'm', allDay: true, start: '2026-01-31', end: '2026-01-31', repeat: 'monthly' };
  const occ = occurrencesInRange(d(2026, 2, 1), d(2026, 3, 1), [ev]);
  assert.equal(occ.length, 1);
  assert.equal(occ[0].start.getDate(), 28);
  assert.equal(addMonths(d(2026, 1, 31), 1).getDate(), 28);
});

test('遠い未来の毎日予定も速く正しく展開される', () => {
  const ev = { id: 'dly', title: 'd', allDay: false, start: '2020-01-01T07:00', end: '2020-01-01T07:30', repeat: 'daily' };
  const occ = occurrencesInRange(d(2030, 6, 1), d(2030, 6, 8), [ev]);
  assert.equal(occ.length, 7);
});

test('複数日にまたがる終日予定は各日に出る', () => {
  const ev = { id: 't', title: '旅行', allDay: true, start: '2026-10-10', end: '2026-10-12', repeat: 'none', calendar: 'private' };
  const map = occurrenceMap(d(2026, 10, 1), d(2026, 11, 1));
  assert.ok(map instanceof Map);
  const occ = occurrencesInRange(d(2026, 10, 1), d(2026, 11, 1), [ev]);
  assert.equal(occ.length, 1);
  assert.equal((occ[0].end - occ[0].start) / 86400000, 3);
});

test('.ics の書き出し → 読み込みで内容が保たれる', () => {
  const events = [
    { id: '1', title: '会議, 定例', location: '会議室A', notes: '1行目\n2行目', allDay: false, start: '2026-10-12T10:00', end: '2026-10-12T11:30', repeat: 'weekly', repeatEnd: '2026-12-31' },
    { id: '2', title: '旅行', allDay: true, start: '2026-10-10', end: '2026-10-12', repeat: 'none' },
  ];
  const back = parseICS(eventsToICS(events), 'work');
  assert.equal(back.length, 2);
  assert.equal(back[0].title, '会議, 定例');
  assert.equal(back[0].notes, '1行目\n2行目');
  assert.equal(back[0].start, '2026-10-12T10:00');
  assert.equal(back[0].end, '2026-10-12T11:30');
  assert.equal(back[0].repeat, 'weekly');
  assert.equal(back[0].repeatEnd, '2026-12-31');
  assert.equal(back[1].allDay, true);
  assert.equal(back[1].start, '2026-10-10');
  assert.equal(back[1].end, '2026-10-12');
  assert.equal(back[1].calendar, 'work');
});

test('レベル計算', () => {
  assert.equal(levelInfo(0).level, 1);
  assert.equal(levelInfo(19).level, 1);
  assert.equal(levelInfo(20).level, 2);
  assert.equal(levelInfo(80).level, 3);
});
