const escapeHTML = value => String(value ?? '').replace(/[&<>"']/g, character => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[character]));

export function renderActivity(activity, response = '') {
  const label = `${activity.responseId} · ${activity.prompt}`;
  if (activity.type === 'choice') return `<fieldset data-activity="${escapeHTML(activity.responseId)}"><legend>${escapeHTML(activity.prompt)}</legend>${activity.choices.map((choice, index) => `<label><input type="radio" name="${escapeHTML(activity.responseId)}" value="${index}" ${String(response) === String(index) ? 'checked' : ''}> ${escapeHTML(choice)}</label>`).join('')}</fieldset>`;
  if (activity.type === 'sequence') return `<fieldset data-activity="${escapeHTML(activity.responseId)}"><legend>${escapeHTML(activity.prompt)}</legend><p>${escapeHTML(activity.instructions || 'Arrange these items in order.')}</p><ol>${activity.items.map(item => `<li>${escapeHTML(item)}</li>`).join('')}</ol></fieldset>`;
  return `<label data-activity="${escapeHTML(activity.responseId)}">${escapeHTML(label)}<textarea>${escapeHTML(response)}</textarea>${activity.hint ? `<small>${escapeHTML(activity.hint)}</small>` : ''}</label>`;
}
