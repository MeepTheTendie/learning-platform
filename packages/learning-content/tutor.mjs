// Tutor conversations stored inside each app's canonical synced state.
//
// Shape:
//   tutor: {
//     "<lessonId>": { messages: [{ role: 'user' | 'assistant', content, at }] }
//   }
//
// Conversations are bounded so they stay small enough to sync.

const UNSAFE = new Set(['__proto__', 'constructor', 'prototype']);
const MAX_LESSON = 120;
const MAX_MESSAGES = 40;
const MAX_CONTENT = 2000;

const safeKey = key => typeof key === 'string' && key.length > 0 && key.length <= MAX_LESSON && !UNSAFE.has(key);
const isObject = value => value !== null && typeof value === 'object' && !Array.isArray(value);

export function sanitizeTutor(raw) {
  const out = {};
  if (!isObject(raw)) return out;
  for (const lessonId of Object.keys(raw)) {
    if (!safeKey(lessonId)) continue;
    const record = raw[lessonId];
    if (!isObject(record)) continue;
    const messages = Array.isArray(record.messages)
      ? record.messages
        .filter(message => isObject(message) && (message.role === 'user' || message.role === 'assistant') && typeof message.content === 'string' && message.content.trim())
        .map(message => ({ role: message.role, content: message.content.slice(0, MAX_CONTENT), ...(Number.isFinite(message.at) ? { at: message.at } : {}) }))
        .slice(-MAX_MESSAGES)
      : [];
    out[lessonId] = { messages };
  }
  return out;
}

export function tutorThread(tutor, lessonId) {
  tutor[lessonId] ??= { messages: [] };
  return tutor[lessonId].messages;
}

export function appendTutorMessage(tutor, lessonId, role, content) {
  const messages = tutorThread(tutor, lessonId);
  messages.push({ role, content: String(content).slice(0, MAX_CONTENT), at: Date.now() });
  if (messages.length > MAX_MESSAGES) messages.splice(0, messages.length - MAX_MESSAGES);
  return messages;
}

export function tutorRequestMessages(tutor, lessonId) {
  return tutorThread(tutor, lessonId)
    .slice(-20)
    .map(({ role, content }) => ({ role, content }));
}
