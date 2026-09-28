(() => {
  const { unitId, subject } = document.body.dataset;
  if (!unitId || !subject || !window.SourcebookSync) return;
  const sync = window.SourcebookSync;
  const complete = document.querySelector('[data-complete]');
  const bookmark = document.querySelector('[data-bookmark]');
  const reviewStatus = document.querySelector('#review-status');
  const note = document.querySelector('#note');
  const chat = document.querySelector('#chat');
  const chatInput = document.querySelector('#chat-input');
  const chatStatus = document.querySelector('#chat-status');
  const escapeHtml = value => String(value).replace(/[&<>]/g, character => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' })[character]);

  document.querySelectorAll('[data-kind="choice"]').forEach(box => {
    const answer = Number(box.dataset.answer);
    box.querySelectorAll('.choice').forEach(button => button.addEventListener('click', () => {
      if (box.dataset.done) return;
      box.dataset.done = '1';
      const picked = Number(button.dataset.index);
      box.querySelectorAll('.choice').forEach((choice, index) => { if (index === answer) choice.classList.add('correct'); });
      if (picked !== answer) button.classList.add('wrong');
      box.querySelector('.feedback').textContent = box.querySelector('template').textContent;
    }));
  });
  document.querySelectorAll('[data-kind="response"]').forEach(box => {
    box.querySelector('.check').addEventListener('click', () => {
      const rubric = box.querySelector('.rubric');
      if (!box.querySelector('textarea').value.trim() && !rubric.querySelector('.write-first')) {
        rubric.insertAdjacentHTML('afterbegin', '<p class="write-first">Write something first, then compare it with the points below.</p>');
      }
      rubric.classList.add('show');
    });
  });

  const paintComplete = () => {
    const done = sync.isComplete(unitId);
    complete.textContent = done ? '✓ Unit complete' : 'Mark unit complete';
    complete.classList.toggle('done', done);
  };
  const paintBookmark = () => {
    const saved = sync.isBookmarked(unitId);
    bookmark.textContent = saved ? '★ Bookmarked' : '☆ Bookmark';
    bookmark.classList.toggle('done', saved);
  };
  const paintReview = () => {
    const review = sync.reviewInfo(unitId);
    reviewStatus.textContent = review
      ? `Reviews: ${review.reps} · next due ${new Date(review.next).toLocaleDateString()}`
      : 'Complete the unit to add it to review.';
  };
  const paintChat = () => {
    chat.innerHTML = sync.getTutor(unitId).map(message => `<p class="${message.role === 'user' ? 'you' : 'tutor'}">${escapeHtml(message.content)}</p>`).join('');
    chat.scrollTop = chat.scrollHeight;
  };

  complete.addEventListener('click', () => sync.toggleComplete(unitId));
  bookmark.addEventListener('click', () => sync.toggleBookmark(unitId));
  document.querySelector('#review-btn').addEventListener('click', () => { sync.markReviewed(unitId); paintReview(); });
  note.value = sync.getNote(unitId);
  let noteTimer;
  note.addEventListener('input', () => { clearTimeout(noteTimer); noteTimer = setTimeout(() => sync.setNote(unitId, note.value), 700); });
  document.querySelector('#chat-send').addEventListener('click', () => {
    const text = chatInput.value.trim();
    if (!text) return;
    const messages = sync.getTutor(unitId).concat([{ role: 'user', content: text }]);
    sync.setTutor(unitId, messages);
    chatInput.value = '';
    paintChat();
    chatStatus.textContent = 'Thinking…';
    sync.askTutor(subject, unitId, messages)
      .then(data => {
        sync.setTutor(unitId, messages.concat([{ role: 'assistant', content: data.reply }]));
        paintChat();
        chatStatus.textContent = data.remaining === undefined ? '' : `Replies left today: ${data.remaining}`;
      })
      .catch(error => { chatStatus.textContent = error.message === 'daily_limit' ? 'Daily limit reached.' : error.message === 'tutor_disabled' ? 'The tutor is switched off.' : 'Tutor unavailable — try again later.'; });
  });
  addEventListener('sourcebook:changed', () => { paintComplete(); paintBookmark(); paintReview(); paintChat(); });
  paintComplete();
  paintBookmark();
  paintReview();
  paintChat();
})();
