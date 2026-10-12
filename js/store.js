// データの保存・読み込み（localStorage）
import { uid } from './util.js';

const KEY = 'pixel-quest-diary/v1';

export const MOODS = [
  { value: 5, label: 'さいこう' },
  { value: 4, label: 'よい' },
  { value: 3, label: 'ふつう' },
  { value: 2, label: 'わるい' },
  { value: 1, label: 'さいあく' },
];

export const CONDITIONS = [
  'げんき', 'しあわせ', 'やるき', 'ねむけ', 'つかれ', 'ずつう', 'かぜ', 'ストレス', 'こい', 'はらぺこ',
];

// 「こうどう」= その日なにをしていたか。ふりかえりで集計する
export const DEFAULT_ACTIVITIES = [
  { id: 'work', label: 'しごと', icon: '⚔' },
  { id: 'study', label: 'べんきょう', icon: '📖' },
  { id: 'exercise', label: 'うんどう', icon: '💪' },
  { id: 'play', label: 'あそび', icon: '🎮' },
  { id: 'friends', label: 'なかま', icon: '🤝' },
  { id: 'family', label: 'かぞく', icon: '🏠' },
  { id: 'cook', label: 'りょうり', icon: '🍳' },
  { id: 'shopping', label: 'かいもの', icon: '💰' },
  { id: 'travel', label: 'たび', icon: '🗺' },
  { id: 'walk', label: 'さんぽ', icon: '👣' },
  { id: 'read', label: 'どくしょ', icon: '📜' },
  { id: 'rest', label: 'やすみ', icon: '💤' },
];

// iPhone 純正カレンダーのカレンダー色に寄せたもの
export const DEFAULT_CALENDARS = [
  { id: 'private', name: 'プライベート', color: '#0a84ff' },
  { id: 'work', name: 'しごと', color: '#ff453a' },
  { id: 'family', name: 'かぞく', color: '#30d158' },
  { id: 'hobby', name: 'しゅみ', color: '#ff9f0a' },
  { id: 'health', name: 'けんこう', color: '#bf5af2' },
];

function emptyData() {
  return {
    version: 1,
    profile: { name: 'ゆうしゃ', createdAt: new Date().toISOString() },
    entries: {},
    events: [],
    calendars: DEFAULT_CALENDARS.map((c) => ({ ...c })),
    customActivities: [],
  };
}

let data = load();
const listeners = new Set();

function load() {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return emptyData();
    return normalize(JSON.parse(raw));
  } catch {
    return emptyData();
  }
}

function normalize(d) {
  const base = emptyData();
  return {
    ...base,
    ...d,
    profile: { ...base.profile, ...(d.profile || {}) },
    entries: d.entries || {},
    events: Array.isArray(d.events) ? d.events : [],
    calendars: Array.isArray(d.calendars) && d.calendars.length ? d.calendars : base.calendars,
    customActivities: Array.isArray(d.customActivities) ? d.customActivities : [],
  };
}

function save() {
  try {
    localStorage.setItem(KEY, JSON.stringify(data));
  } catch (e) {
    alert('ほぞんに しっぱいしました（容量がいっぱいかもしれません）\n' + e.message);
  }
  listeners.forEach((fn) => fn());
}

export function subscribe(fn) {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

export function getData() {
  return data;
}

// ---- プロフィール ----
export function setProfileName(name) {
  data.profile.name = name.trim() || 'ゆうしゃ';
  save();
}

// ---- 日記 ----
export function getEntry(key) {
  return data.entries[key] || null;
}

export function saveEntry(entry) {
  data.entries[entry.date] = { ...entry, updatedAt: new Date().toISOString() };
  save();
}

export function deleteEntry(key) {
  delete data.entries[key];
  save();
}

export function allEntries() {
  return Object.values(data.entries).sort((a, b) => (a.date < b.date ? 1 : -1));
}

// ---- 予定 ----
export function saveEvent(ev) {
  const i = data.events.findIndex((e) => e.id === ev.id);
  if (i >= 0) data.events[i] = ev;
  else data.events.push({ ...ev, id: ev.id || uid() });
  save();
}

export function deleteEvent(id) {
  data.events = data.events.filter((e) => e.id !== id);
  save();
}

export function addEvents(list) {
  list.forEach((ev) => data.events.push({ ...ev, id: uid() }));
  save();
}

export function calendarById(id) {
  return data.calendars.find((c) => c.id === id) || data.calendars[0];
}

// ---- こうどう ----
export function activities() {
  return [...DEFAULT_ACTIVITIES, ...data.customActivities];
}

export function activityById(id) {
  return activities().find((a) => a.id === id) || { id, label: id, icon: '★' };
}

export function addCustomActivity(label) {
  const clean = label.trim();
  if (!clean) return null;
  const existing = activities().find((a) => a.label === clean);
  if (existing) return existing;
  const act = { id: 'c_' + uid(), label: clean, icon: '★' };
  data.customActivities.push(act);
  save();
  return act;
}

export function removeCustomActivity(id) {
  data.customActivities = data.customActivities.filter((a) => a.id !== id);
  save();
}

// ---- バックアップ ----
export function exportJSON() {
  return JSON.stringify(data, null, 2);
}

export function importJSON(text) {
  const parsed = JSON.parse(text);
  if (!parsed || typeof parsed !== 'object' || !parsed.entries) {
    throw new Error('ぼうけんのしょ の けいしきが ちがいます');
  }
  data = normalize(parsed);
  save();
}

export function resetAll() {
  data = emptyData();
  save();
}

// ---- けいけんち・レベル ----
export function entryExp(e) {
  const textBonus = Math.min(20, Math.floor((e.text || '').length / 20));
  return 10 + textBonus + (e.activities || []).length * 2;
}

export function totalExp() {
  return Object.values(data.entries).reduce((s, e) => s + entryExp(e), 0);
}

// レベル n に必要な累計EXP = 20 * (n-1)^2
export function levelInfo(exp = totalExp()) {
  const level = Math.floor(Math.sqrt(exp / 20)) + 1;
  const cur = 20 * (level - 1) ** 2;
  const next = 20 * level ** 2;
  return { level, exp, cur, next, toNext: next - exp, progress: (exp - cur) / (next - cur) };
}

const TITLES = [
  [1, 'みならい'],
  [3, 'たびびと'],
  [5, 'せんし'],
  [8, 'まほうつかい'],
  [12, 'まほうせんし'],
  [16, 'パラディン'],
  [20, 'けんじゃ'],
  [30, 'ゆうしゃ'],
  [50, 'でんせつの ゆうしゃ'],
];

export function titleFor(level) {
  let t = TITLES[0][1];
  for (const [lv, name] of TITLES) if (level >= lv) t = name;
  return t;
}

if (navigator.storage && navigator.storage.persist) {
  navigator.storage.persist().catch(() => {});
}
