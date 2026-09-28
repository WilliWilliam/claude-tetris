'use strict';

// Local high-score table. Pure helpers: no DOM; storage access is wrapped in
// try/catch (private mode, blocked site data or a missing localStorage).

const RECORDS_KEY = 'tetris-records';
const RECORDS_MAX = 5;
const NAME_MAX = 12;
const DEFAULT_NAME = 'Anónimo';

function emptyRecords() {
  return { top: [], bestCombo: 0, maxLines: 0 };
}

function toCount(v) {
  return Number.isFinite(v) && v > 0 ? Math.floor(v) : 0;
}

function cleanName(name) {
  const trimmed = String(name ?? '').trim().slice(0, NAME_MAX);
  return trimmed || DEFAULT_NAME;
}

// Accepts anything parsed from storage and returns a well-formed records object.
function normalizeRecords(data) {
  const records = emptyRecords();
  if (!data || typeof data !== 'object') return records;
  if (Array.isArray(data.top)) {
    records.top = data.top
      .filter(e => e && typeof e === 'object' && toCount(e.score) > 0)
      .map(e => ({
        name: cleanName(e.name),
        score: toCount(e.score),
        lines: toCount(e.lines),
        mode: typeof e.mode === 'string' ? e.mode : '',
        date: typeof e.date === 'string' ? e.date : '',
      }))
      .sort((a, b) => b.score - a.score)
      .slice(0, RECORDS_MAX);
  }
  records.bestCombo = toCount(data.bestCombo);
  records.maxLines = toCount(data.maxLines);
  return records;
}

function loadRecords() {
  try {
    const raw = globalThis.localStorage.getItem(RECORDS_KEY);
    return normalizeRecords(raw ? JSON.parse(raw) : null);
  } catch {
    return emptyRecords();
  }
}

function saveRecords(records) {
  try {
    globalThis.localStorage.setItem(RECORDS_KEY, JSON.stringify(records));
    return true;
  } catch {
    return false;
  }
}

function clearRecords() {
  try {
    globalThis.localStorage.removeItem(RECORDS_KEY);
  } catch {
    // nothing stored or storage unavailable
  }
  return emptyRecords();
}

// Rank (0-based) a score would take in the top, or -1 if it doesn't enter.
// Ties go below existing entries, so a full table needs a strictly higher score.
function recordRank(records, score) {
  if (!(score > 0)) return -1;
  let i = 0;
  while (i < records.top.length && records.top[i].score >= score) i++;
  return i < RECORDS_MAX ? i : -1;
}

function qualifies(records, score) {
  return recordRank(records, score) >= 0;
}

// Returns { records, index } with a new records object; index is -1 if the entry didn't enter.
function insertRecord(records, entry) {
  const index = recordRank(records, entry.score);
  if (index < 0) return { records, index };
  const item = {
    name: cleanName(entry.name),
    score: toCount(entry.score),
    lines: toCount(entry.lines),
    mode: entry.mode || '',
    date: entry.date || '',
  };
  const top = [...records.top];
  top.splice(index, 0, item);
  return { records: { ...records, top: top.slice(0, RECORDS_MAX) }, index };
}

// Best combo and max lines update whether or not the score enters the top.
function updateBests(records, { combo, lines }) {
  return {
    ...records,
    bestCombo: Math.max(records.bestCombo, toCount(combo)),
    maxLines: Math.max(records.maxLines, toCount(lines)),
  };
}
