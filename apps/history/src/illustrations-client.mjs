// Original Myers Egypt illustrations, matched to the printed captions in
// https://en.wikisource.org/wiki/A_General_History_for_Colleges_and_High_Schools_(Myers)/Chapter_2
// Public-domain book illustrations; Wikimedia Commons hosts the scans.
export function restoreIllustrations() {
  if (window.myersIllustrationsInstalled) return;
  window.myersIllustrationsInstalled = true;
  const figures = [
    ['ANCIENT EGYPT', '6/6e', 'Map_1'],
    ['PHALANX OF THE KHITA', 'b/bb', 'p_22'],
    ['SETI I', '7/76', 'p_23'],
    ['RAMESES II. RETURNING', 'b/b4', 'p_24'],
    ['MUMMY OF A SACRED BULL', 'd/df', 'p_28'],
    ['JUDGMENT OF THE DEAD', '8/8a', 'p_30'],
    ['BRICK-MAKING IN ANCIENT EGYPT', 'c/c5', 'p_31'],
    ['THE GREAT HALL OF COLUMNS AT KARNAK', '9/95', 'p_32'],
    ['STATUES OF MEMNON AT THEBES', 'f/f4', 'p_33'],
    ['PROFILE OF RAMESES II', '4/4a', 'p_38']
  ];
  function render() {
    for (const paragraph of document.querySelectorAll('article p')) {
      const match = paragraph.textContent.trim().match(/^\[Illustration:\s*([\s\S]+)\]$/i);
      if (!match) continue;
      const caption = match[1].replace(/\s+/g, ' ').trim();
      const entry = figures.find(([title]) => caption.toUpperCase().startsWith(title));
      if (!entry) continue;
      const file = 'A_General_History_for_Colleges_and_High_Schools_-_' + entry[2] + '.png';
      const figure = document.createElement('figure');
      figure.className = 'restored-illustration';
      figure.style.cssText = 'margin:1.5em 0;text-align:center';
      const img = document.createElement('img');
      img.src = 'https://thumb.wikimedia.org/wikipedia/commons/thumb/' + entry[1] + '/' + file + '/960px-' + file;
      img.alt = caption;
      img.referrerPolicy = 'no-referrer';
      img.style.cssText = 'display:block;max-width:100%;max-height:650px;width:auto;height:auto;margin:0 auto;background:#fff';
      const label = document.createElement('figcaption');
      label.textContent = caption;
      label.style.cssText = 'font-size:.8em;line-height:1.5;margin-top:.6em';
      const source = document.createElement('a');
      source.href = 'https://commons.wikimedia.org/wiki/File:' + file;
      source.textContent = 'Original illustration';
      source.target = '_blank'; source.rel = 'noopener noreferrer';
      source.style.cssText = 'display:block;font-size:.7em';
      img.addEventListener('error', () => {
        img.hidden = true;
        source.textContent = 'View original illustration (image could not load)';
      }, {once:true});
      figure.append(img, label, source);
      paragraph.replaceWith(figure);
    }
  }
  function start() {
    render();
    new MutationObserver(render).observe(document.querySelector('main') || document.body, {childList:true,subtree:true});
  }
  if(document.readyState === 'loading') document.addEventListener('DOMContentLoaded',start,{once:true});
  else start();
}

export const illustrationClient = ';(' + restoreIllustrations.toString() + ')();';
