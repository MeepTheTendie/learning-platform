// Terms that mark present-day pedagogical or moral framing rather than history.
// This list runs against OUR authored text only (spine, context, questions) —
// never against the primary sources, which may use whatever words the past used.
export const BANNED_FRAMING = [
  'global citizenship',
  'global perspective',
  'global community',
  'cultural competence',
  'cultural empathy',
  'cultural awareness',
  'learning objectives',
  'by the end of this',
  'you will be able to',
  'critical thinking skills',
  'career',
  'workplace',
  'employer',
  'job site',
  'social justice',
  'decoloniz',
  'intersectional',
  'lived experience',
  'self-reflection',
  'modern challenges',
  "today's world",
  'in today',
  'this chapter',
  'this textbook',
  'this course',
  'in this text',
  'our world',
  'we must',
  'we should',
  'globalization',
];

export function lintFraming(text: string): string[] {
  const lower = text.toLowerCase();
  return BANNED_FRAMING.filter(term => lower.includes(term));
}
