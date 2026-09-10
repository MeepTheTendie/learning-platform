const escapeHTML = value => String(value ?? '').replace(/[&<>"']/g, character => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[character]));

export function renderActivity(activity, response = '') {
  const label = `${activity.responseId} · ${activity.prompt}`;
  if (activity.type === 'choice') return `<fieldset data-activity="${escapeHTML(activity.responseId)}"><legend>${escapeHTML(activity.prompt)}</legend>${activity.choices.map((choice, index) => `<label><input type="radio" name="${escapeHTML(activity.responseId)}" value="${index}" ${String(response) === String(index) ? 'checked' : ''}> ${escapeHTML(choice)}</label>`).join('')}</fieldset>`;
  if (activity.type === 'sequence') return `<fieldset data-activity="${escapeHTML(activity.responseId)}"><legend>${escapeHTML(activity.prompt)}</legend><p>${escapeHTML(activity.instructions || 'Arrange these items in order.')}</p><ol>${activity.items.map(item => `<li>${escapeHTML(item)}</li>`).join('')}</ol><label>Order by item number<input data-sequence value="${escapeHTML(Array.isArray(response) ? response.map(value => value + 1).join(', ') : response)}" placeholder="e.g. 2, 4, 3, 1"></label></fieldset>`;
  const context = activity.context ? `<details class="activity-context"><summary>Show the passage</summary><p>${escapeHTML(activity.context)}</p></details>` : '';
  return `<div data-activity="${escapeHTML(activity.responseId)}" class="activity-text"><label>${escapeHTML(label)}<small>${escapeHTML(activity.instructions || '')}</small></label>${context}<textarea>${escapeHTML(response)}</textarea>${activity.hint ? `<small>${escapeHTML(activity.hint)}</small>` : ''}</div>`;
}

export function gradeActivity(activity, response) {
  if (activity.type === 'choice') return Number(response) === activity.answer;
  if (activity.type === 'sequence') return Array.isArray(response) && response.length === activity.answer.length && response.every((value, index) => value === activity.answer[index]);
  return typeof response === 'string' && response.trim().split(/\s+/).length >= (activity.rubric?.length ? 8 : 1);
}
