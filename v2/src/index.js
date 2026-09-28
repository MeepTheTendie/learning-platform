(() => {
  if (!window.SourcebookSync) return;
  const sync = window.SourcebookSync;
  document.querySelectorAll('[data-unit] a').forEach(link => { link.dataset.title = link.textContent; });
  const unitLink = id => {
    const link = document.querySelector(`[data-unit="${CSS.escape(id)}"] a`);
    return link ? `<a href="${link.getAttribute('href')}">${link.dataset.title || id}</a>` : id;
  };
  const mark = () => {
    document.querySelectorAll('[data-unit]').forEach(item => {
      const done = sync.isComplete(item.dataset.unit);
      item.classList.toggle('done', done);
      const link = item.querySelector('a');
      if (link) link.textContent = `${done ? '✓ ' : ''}${link.dataset.title}`;
    });
    const due = sync.dueUnits();
    document.querySelector('#due').innerHTML = due.length
      ? due.map(id => `<li>${unitLink(id)}</li>`).join('')
      : '<li class="meta">Nothing due. Complete a unit to schedule its first review.</li>';
    const bookmarks = [];
    document.querySelectorAll('[data-unit]').forEach(item => { if (sync.isBookmarked(item.dataset.unit)) bookmarks.push(item.dataset.unit); });
    document.querySelector('#marks').innerHTML = bookmarks.length
      ? bookmarks.map(id => `<li>${unitLink(id)}</li>`).join('')
      : '<li class="meta">No bookmarks yet.</li>';
  };
  addEventListener('sourcebook:changed', mark);
  mark();
})();
