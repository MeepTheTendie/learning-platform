const ACTIVITY_TYPES = new Set(['choice', 'short-answer', 'sequence', 'edit']);
const SUBJECTS = new Set(['english', 'history', 'philosophy']);
const text = (value, label, max = 20000) => {
  if (typeof value !== 'string' || !value.trim() || value.length > max) throw new Error(`${label} must be a non-empty string`);
  return value;
};

export function validateLesson(raw) {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) throw new Error('Lesson must be an object');
  const id = text(raw.id, 'lesson.id', 120);
  const subject = text(raw.subject, 'lesson.subject', 30);
  if (!SUBJECTS.has(subject)) throw new Error(`Unsupported subject: ${subject}`);
  const activities = raw.activities;
  if (!Array.isArray(activities) || activities.length < 1 || activities.length > 40) throw new Error(`${id} needs 1–40 activities`);
  const seen = new Set();
  const normalized = activities.map((activity, index) => {
    if (!activity || typeof activity !== 'object') throw new Error(`${id} activity ${index} is invalid`);
    const activityId = text(activity.id, `activity ${index}.id`, 120);
    if (seen.has(activityId)) throw new Error(`${id} repeats activity id ${activityId}`);
    seen.add(activityId);
    const type = text(activity.type, `${activityId}.type`, 30);
    if (!ACTIVITY_TYPES.has(type)) throw new Error(`${activityId} has unsupported type ${type}`);
    const result = { id: activityId, type, prompt: text(activity.prompt, `${activityId}.prompt`), responseId: `${id}:${activityId}` };
    if (activity.hint !== undefined) result.hint = text(activity.hint, `${activityId}.hint`, 1000);
    if (type === 'choice') {
      if (!Array.isArray(activity.choices) || activity.choices.length < 2 || activity.choices.length > 8) throw new Error(`${activityId} needs 2–8 choices`);
      result.choices = activity.choices.map((choice, i) => text(choice, `${activityId}.choices[${i}]`, 500));
      if (!Number.isInteger(activity.answer) || activity.answer < 0 || activity.answer >= result.choices.length) throw new Error(`${activityId}.answer is invalid`);
      result.answer = activity.answer;
    } else if (type === 'sequence') {
      if (!Array.isArray(activity.items) || activity.items.length < 2 || activity.items.length > 12) throw new Error(`${activityId} needs 2–12 items`);
      result.items = activity.items.map((item, i) => text(item, `${activityId}.items[${i}]`, 500));
      if (!Array.isArray(activity.answer) || activity.answer.length !== result.items.length || new Set(activity.answer).size !== result.items.length || activity.answer.some(i => !Number.isInteger(i) || i < 0 || i >= result.items.length)) throw new Error(`${activityId}.answer is invalid`);
      result.answer = [...activity.answer];
    } else {
      result.instructions = text(activity.instructions || 'Write your response in your own words.', `${activityId}.instructions`, 1000);
      if (type === 'edit') result.source = text(activity.source, `${activityId}.source`, 5000);
      if (activity.rubric !== undefined) {
        if (!Array.isArray(activity.rubric) || activity.rubric.length > 8) throw new Error(`${activityId}.rubric is invalid`);
        result.rubric = activity.rubric.map((criterion, i) => text(criterion, `${activityId}.rubric[${i}]`, 500));
      }
    }
    return result;
  });
  let lesson;
  if (raw.lesson !== undefined) {
    if (!raw.lesson || typeof raw.lesson !== 'object' || Array.isArray(raw.lesson)) throw new Error(`${id}.lesson is invalid`);
    const sections = raw.lesson.sections;
    if (!Array.isArray(sections) || sections.length < 1 || sections.length > 12) throw new Error(`${id}.lesson.sections is invalid`);
    lesson = {
      opening: text(raw.lesson.opening, `${id}.lesson.opening`, 2000),
      sections: sections.map((section, index) => {
        if (!section || typeof section !== 'object' || Array.isArray(section)) throw new Error(`${id}.lesson.sections[${index}] is invalid`);
        return { heading: text(section.heading, `${id}.lesson.sections[${index}].heading`, 300), body: text(section.body, `${id}.lesson.sections[${index}].body`, 4000) };
      })
    };
  }
  return { version: 1, id, subject, title: text(raw.title, `${id}.title`, 300), objective: text(raw.objective, `${id}.objective`, 1000), ...(lesson ? { lesson } : {}), sources: Array.isArray(raw.sources) ? raw.sources.map((source, i) => text(source, `${id}.sources[${i}]`, 1000)) : [], activities: normalized };
}

export function gradeActivity(activity, response) {
  if (activity.type === 'choice') return Number(response) === activity.answer;
  if (activity.type === 'sequence') return Array.isArray(response) && response.length === activity.answer.length && response.every((value, i) => value === activity.answer[i]);
  const value = typeof response === 'string' ? response.trim() : '';
  return value.length > 0 && (!activity.rubric || activity.rubric.length === 0 ? true : value.split(/\s+/).length >= 8);
}
