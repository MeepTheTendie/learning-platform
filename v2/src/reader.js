(() => {
  const key = 'sourcebook-reader';
  const fonts = {
    lexend: "'Lexend', Verdana, system-ui, sans-serif",
    atkinson: "'Atkinson Hyperlegible', Verdana, system-ui, sans-serif",
    opendyslexic: "'OpenDyslexic', Verdana, system-ui, sans-serif",
    sans: 'Verdana, Tahoma, Arial, system-ui, sans-serif',
    serif: "Georgia, 'Times New Roman', serif",
  };
  const spacing = {
    normal: ['1.7', '1.4em', '.012em', '.05em'],
    relaxed: ['1.9', '1.7em', '.05em', '.1em'],
    wide: ['2.1', '2em', '.12em', '.16em'],
  };
  const prefs = { theme: null, font: 'lexend', size: 18, spacing: 'normal', italics: 'off' };

  try { Object.assign(prefs, JSON.parse(localStorage.getItem(key) || '{}')); } catch {}

  function apply() {
    const root = document.documentElement;
    root.dataset.theme = prefs.theme || (matchMedia('(prefers-color-scheme: light)').matches ? 'light' : 'dark');
    root.dataset.italics = prefs.italics || 'off';
    root.style.setProperty('--reading-font', fonts[prefs.font] || fonts.lexend);
    root.style.setProperty('--reading-size', `${prefs.size}px`);
    const selected = spacing[prefs.spacing] || spacing.normal;
    root.style.setProperty('--reading-leading', selected[0]);
    root.style.setProperty('--reading-para', selected[1]);
    root.style.setProperty('--reading-letter', selected[2]);
    root.style.setProperty('--reading-word', selected[3]);
  }

  function save() { try { localStorage.setItem(key, JSON.stringify(prefs)); } catch {} }
  function paint(panel) {
    panel.querySelectorAll('.reader-opts').forEach(group => {
      const preference = group.dataset.pref;
      group.querySelectorAll('button').forEach(button => {
        const selected = preference === 'size'
          ? Number(button.dataset.value) === Number(prefs[preference])
          : button.dataset.value === prefs[preference];
        button.classList.toggle('on', selected);
      });
    });
  }

  apply();
  const toggle = document.getElementById('reader-toggle');
  const panel = document.getElementById('reader-panel');
  if (!toggle || !panel) return;
  toggle.addEventListener('click', () => {
    const open = panel.hidden;
    panel.hidden = !open;
    toggle.setAttribute('aria-expanded', String(open));
    if (open) paint(panel);
  });
  panel.addEventListener('click', event => {
    const button = event.target.closest('button[data-value]');
    if (!button) return;
    const preference = button.closest('.reader-opts').dataset.pref;
    prefs[preference] = preference === 'size' ? Number(button.dataset.value) : button.dataset.value;
    apply();
    save();
    paint(panel);
  });
  document.addEventListener('keydown', event => {
    if (event.key === 'Escape' && !panel.hidden) {
      panel.hidden = true;
      toggle.setAttribute('aria-expanded', 'false');
      toggle.focus();
    }
  });
  paint(panel);
})();
