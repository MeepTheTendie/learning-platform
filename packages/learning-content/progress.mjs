// Canonical exemplar progress stored inside each app's synced state.
//
// Shape:
//   exemplars: {
//     "<lessonId>": {
//       responses: { "<activityId>": string | number | number[] },
//       attempts:  { "<activityId>": number },
//       passed:    { "<activityId>": boolean },
//       updatedAt: number
//     }
//   }
//
// Activity IDs are the per-lesson IDs from the shared lesson contract; the
// lesson ID is the outer key, so this stays stable if a lesson is renamed.

const UNSAFE = new Set(['__proto__', 'constructor', 'prototype']);
const MAX_ID = 120;
const MAX_TEXT = 20000;
const MAX_ITEMS = 40;
const MAX_ATTEMPTS = 100000;

const safeKey = key => typeof key === 'string' && key.length > 0 && key.length <= MAX_ID && !UNSAFE.has(key);
const isObject = value => value !== null && typeof value === 'object' && !Array.isArray(value);

export function emptyExemplarProgress() {
  return {};
}

export function sanitizeExemplarProgress(raw) {
  const out = {};
  if (!isObject(raw)) return out;
  for (const lessonId of Object.keys(raw)) {
    if (!safeKey(lessonId)) continue;
    const record = raw[lessonId];
    if (!isObject(record)) continue;
    const entry = { responses: {}, attempts: {}, passed: {} };
    if (isObject(record.responses)) {
      for (const activityId of Object.keys(record.responses)) {
        if (!safeKey(activityId)) continue;
        const value = record.responses[activityId];
        if (typeof value === 'string') entry.responses[activityId] = value.slice(0, MAX_TEXT);
        else if (typeof value === 'number' && Number.isFinite(value)) entry.responses[activityId] = value;
        else if (Array.isArray(value) && value.length <= MAX_ITEMS && value.every(Number.isInteger)) entry.responses[activityId] = value.slice(0, MAX_ITEMS);
      }
    }
    if (isObject(record.attempts)) {
      for (const activityId of Object.keys(record.attempts)) {
        if (!safeKey(activityId)) continue;
        const value = record.attempts[activityId];
        if (Number.isFinite(value)) entry.attempts[activityId] = Math.max(0, Math.min(MAX_ATTEMPTS, Math.floor(value)));
      }
    }
    if (isObject(record.passed)) {
      for (const activityId of Object.keys(record.passed)) {
        if (!safeKey(activityId)) continue;
        if (typeof record.passed[activityId] === 'boolean') entry.passed[activityId] = record.passed[activityId];
      }
    }
    if (Number.isFinite(record.points)) entry.points = Math.max(0, Math.min(1000000, Math.floor(record.points)));
    if (record.completed === true) entry.completed = true;
    if (isObject(record.awarded)) {
      const awarded = {};
      for (const key of Object.keys(record.awarded)) if (safeKey(key) && record.awarded[key] === true) awarded[key] = true;
      entry.awarded = awarded;
    }
    if (Number.isFinite(record.updatedAt)) entry.updatedAt = Math.max(0, record.updatedAt);
    out[lessonId] = entry;
  }
  return out;
}

export function exemplarRecord(progress, lessonId) {
  progress[lessonId] ??= { responses: {}, attempts: {}, passed: {} };
  return progress[lessonId];
}

export function exemplarResponse(progress, lessonId, activityId) {
  return progress?.[lessonId]?.responses?.[activityId];
}

export function setExemplarResponse(progress, lessonId, activityId, response) {
  const record = exemplarRecord(progress, lessonId);
  record.responses[activityId] = response;
  record.updatedAt = Date.now();
  return record;
}

export function recordExemplarAttempt(progress, lessonId, activityId, passed) {
  const record = exemplarRecord(progress, lessonId);
  record.attempts[activityId] = (record.attempts[activityId] || 0) + 1;
  record.passed[activityId] = !!passed;
  record.updatedAt = Date.now();
  return record;
}
