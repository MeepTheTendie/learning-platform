import fs from 'node:fs';
import path from 'node:path';
import { marked } from 'marked';
import sanitizeHtml from 'sanitize-html';
import { UnitSchema, type Unit } from '../src/schema.ts';
import { syncClient } from '../src/sync-client.ts';

const root = path.resolve(new URL('..', import.meta.url).pathname);
const contentDir = path.join(root, 'content');
const outDir = path.join(root, 'dist');
fs.rmSync(outDir, { recursive: true, force: true });
fs.mkdirSync(outDir, { recursive: true });

const fontFamilies: [string, string][] = [
  ['lexend', 'Lexend'],
  ['atkinson-hyperlegible', 'Atkinson Hyperlegible'],
  ['opendyslexic', 'OpenDyslexic'],
];
const fontDir = path.join(outDir, 'fonts');
fs.mkdirSync(fontDir, { recursive: true });
const fontCss = fontFamilies.flatMap(([pkg, family]) => [400, 700].map(weight => {
  const file = `${pkg}-latin-${weight}-normal.woff2`;
  fs.copyFileSync(path.join(root, 'node_modules', '@fontsource', pkg, 'files', file), path.join(fontDir, file));
  return `@font-face{font-family:'${family}';font-style:normal;font-weight:${weight};font-display:swap;src:url('/fonts/${file}') format('woff2')}`;
})).join('');

// The browser receives ordinary, cacheable web assets. There is intentionally no
// bundler or UI framework between these source files and the rendered pages.
const assetsDir = path.join(outDir, 'assets');
fs.mkdirSync(assetsDir, { recursive: true });
fs.writeFileSync(path.join(assetsDir, 'sourcebook.css'), fontCss + fs.readFileSync(path.join(root, 'src', 'styles.css'), 'utf8'));
fs.writeFileSync(path.join(assetsDir, 'sync.js'), syncClient);
for (const file of ['reader.js', 'unit.js', 'index.js']) fs.copyFileSync(path.join(root, 'src', file), path.join(assetsDir, file));

const esc = (value: string) => value.replace(/[&<>"]/g, character => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[character] as string));

// Markdown is authored in this repository, but it is still sanitized: raw HTML in
// any future spine or source would otherwise become live page HTML, and the sync
// key lives in localStorage on these pages.
const sanitizeOptions: sanitizeHtml.IOptions = {
  allowedTags: ['p', 'br', 'hr', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'strong', 'em', 'b', 'i', 'u', 's', 'blockquote', 'ul', 'ol', 'li', 'a', 'img', 'code', 'pre', 'sup', 'sub', 'dl', 'dt', 'dd', 'figure', 'figcaption', 'table', 'thead', 'tbody', 'tr', 'th', 'td'],
  allowedAttributes: { a: ['href', 'title'], img: ['src', 'alt', 'title'] },
  allowedSchemes: ['http', 'https', 'mailto'],
};
const renderMarkdown = (markdown: string) => sanitizeHtml(marked.parse(markdown) as string, sanitizeOptions);

const style = `
:root{color-scheme:dark;--bg:#14120f;--panel:#1d1a16;--text:#ece7dd;--muted:#b8b1a3;--line:#37322a;--accent:#d9b46a;--gold:#c9a86a;--ok:#8fce8f;--no:#e09696;--reading-font:'Lexend',Verdana,system-ui,sans-serif;--reading-size:18px;--reading-leading:1.7;--reading-para:1.4em;--reading-letter:.012em;--reading-word:.05em;--em-bg:rgba(217,180,106,.17);--measure:640px}
:root[data-theme="paper"]{color-scheme:light;--bg:#f6efe0;--panel:#efe4cb;--text:#2b2620;--muted:#5f5646;--line:#d8c9a8;--accent:#8a5a1a;--gold:#8a5a1a;--ok:#2f6b3a;--no:#9c3b3b;--em-bg:rgba(138,90,26,.15)}
:root[data-theme="light"]{color-scheme:light;--bg:#ffffff;--panel:#f4f4f4;--text:#1b1b1b;--muted:#555555;--line:#d9d9d9;--accent:#8a4b00;--gold:#8a4b00;--ok:#2f6b3a;--no:#9c3b3b;--em-bg:rgba(138,75,0,.12)}
*{box-sizing:border-box}
html{scroll-behavior:smooth}
@media (prefers-reduced-motion:reduce){html{scroll-behavior:auto}}
body{margin:0;background:var(--bg);color:var(--text);font-family:var(--reading-font);font-size:var(--reading-size);line-height:var(--reading-leading);letter-spacing:var(--reading-letter);word-spacing:var(--reading-word);overflow-wrap:break-word}
.shell{max-width:var(--measure);margin:auto;padding:40px 22px 90px}
p{margin:0 0 var(--reading-para);text-wrap:pretty}
em{font-style:normal;background:var(--em-bg);border-radius:3px;padding:0 .12em;-webkit-box-decoration-break:clone;box-decoration-break:clone}
:root[data-italics="on"] em{font-style:italic;background:none;padding:0}
.toc{background:var(--panel);border:1px solid var(--line);border-radius:12px;padding:14px 18px;margin:0 0 22px}
.toc .toc-title{margin:0 0 8px;font-weight:600;font-size:.9em;color:var(--muted)}
.toc ol{margin:0;padding-left:20px}.toc li{margin:5px 0}
.keypoints{margin:0 0 26px;font-size:.92em}
.keypoints summary{cursor:pointer;color:var(--accent);font-weight:600}
.keypoints ul{margin:10px 0 0;padding-left:20px}.keypoints li{margin:5px 0}
.shell :target{scroll-margin-top:16px}
a{color:var(--accent)}
h1{font-size:clamp(28px,5vw,36px);line-height:1.15;margin:0 0 6px;text-wrap:balance}
.meta{color:var(--muted);font-size:.8em;margin-bottom:28px}
h2{font-size:1.45em;line-height:1.25;margin:40px 0 14px;border-top:1px solid var(--line);padding-top:22px;text-wrap:balance}
h3{font-size:1.08em;margin:26px 0 8px}
figure{margin:22px 0}.map{width:100%;border-radius:12px;border:1px solid var(--line)}
.grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(240px,1fr));gap:14px}
figure img{width:100%;height:230px;object-fit:cover;border-radius:10px;border:1px solid var(--line)}
figcaption{color:var(--muted);font-size:.78em;margin-top:8px}
.source{background:var(--panel);border:1px solid var(--line);border-radius:12px;padding:22px;margin:18px 0}
.source p:last-child{margin-bottom:0}
.source .head{color:var(--muted);font-size:.78em;margin-bottom:14px}
blockquote{border-left:3px solid var(--accent);margin:16px 0;padding:2px 0 2px 16px;color:var(--muted)}
.q{margin:10px 0 0;padding-left:18px}.q li{margin:8px 0}
.activity{background:var(--panel);border:1px solid var(--line);border-radius:12px;padding:20px;margin:16px 0}
.activity p{font-weight:600}
.choice{display:block;width:100%;text-align:left;margin:7px 0;padding:11px 13px;border:1px solid var(--line);border-radius:9px;background:var(--bg);color:var(--text);font:inherit;cursor:pointer}
.choice:hover{border-color:var(--accent)}.choice.correct{border-color:var(--ok);color:var(--ok)}.choice.wrong{border-color:var(--no);color:var(--no)}
.feedback{color:var(--muted);font-size:.82em;margin-top:10px;min-height:18px}
textarea{width:100%;min-height:120px;padding:12px;border-radius:9px;border:1px solid var(--line);background:var(--bg);color:var(--text);font:inherit}
.rubric{display:none;color:var(--muted);font-size:.82em;margin-top:10px}.rubric.show{display:block}
button.check{margin-top:10px;padding:9px 14px;border:1px solid var(--line);border-radius:8px;background:transparent;color:var(--text);font:inherit;cursor:pointer}
button.check.done{border-color:var(--ok);color:var(--ok)}
.complete-card{background:var(--panel)}
.interpretation{border-left:3px solid var(--gold)}
li.done>a{color:var(--ok)}
footer{color:var(--muted);font-size:.72em;border-top:1px solid var(--line);margin-top:44px;padding-top:16px}
.chat{max-height:300px;overflow:auto;margin-bottom:10px}
.chat p{margin:8px 0;padding:9px 12px;border-radius:9px;background:var(--bg);border:1px solid var(--line);font-weight:400;white-space:pre-wrap}
.chat .you{border-color:var(--accent)}.chat .tutor{border-color:var(--gold)}
#chat-input{min-height:70px}
.due-list,.mark-list{margin:6px 0;padding-left:18px}
.pager{display:flex;gap:14px;margin:34px 0 6px}
.pager a{flex:1;min-width:0;display:flex;flex-direction:column;gap:2px;padding:14px 16px;border:1px solid var(--line);border-radius:12px;background:var(--panel);text-decoration:none}
.pager a:hover{border-color:var(--accent)}
.pager a span{color:var(--muted);font-size:.72em}
.pager a strong{font-weight:600}
.pager .pager-next{text-align:right;align-items:flex-end}
@media (max-width:520px){.pager{flex-direction:column}}
.counts{color:var(--muted);font-size:.8em;margin:0 0 10px}
.reader{position:fixed;right:16px;bottom:16px;z-index:50;font-size:15px}
.reader-toggle{width:46px;height:46px;border-radius:50%;border:1px solid var(--line);background:var(--panel);color:var(--text);font:700 16px var(--reading-font);cursor:pointer;box-shadow:0 4px 14px rgba(0,0,0,.28)}
.reader-toggle:hover{border-color:var(--accent)}
.reader-panel{position:absolute;right:0;bottom:56px;width:280px;max-width:calc(100vw - 32px);background:var(--panel);border:1px solid var(--line);border-radius:12px;padding:14px;box-shadow:0 8px 24px rgba(0,0,0,.35)}
.reader-row{display:flex;align-items:center;gap:10px;margin:9px 0}
.reader-row>span{flex:0 0 78px;color:var(--muted);font-size:13px}
.reader-opts{display:flex;flex-wrap:wrap;gap:6px}
.reader-opts button{padding:5px 9px;border:1px solid var(--line);border-radius:7px;background:var(--bg);color:var(--text);font:inherit;font-size:13px;cursor:pointer}
.reader-opts button.on{border-color:var(--accent);color:var(--accent)}
`;

const syncScript = syncClient;

const readerHead = `<script>(function(){try{var p=JSON.parse(localStorage.getItem('sourcebook-reader')||'{}');var F={lexend:"'Lexend',Verdana,system-ui,sans-serif",atkinson:"'Atkinson Hyperlegible',Verdana,system-ui,sans-serif",opendyslexic:"'OpenDyslexic',Verdana,system-ui,sans-serif",sans:"Verdana,Tahoma,Arial,system-ui,sans-serif",serif:"Georgia,'Times New Roman',serif"};var S={normal:["1.7","1.4em",".012em",".05em"],relaxed:["1.9","1.7em",".05em",".1em"],wide:["2.1","2em",".12em",".16em"]};var d=document.documentElement;d.dataset.theme=p.theme||(matchMedia('(prefers-color-scheme: light)').matches?'light':'dark');d.dataset.italics=p.italics||'off';if(p.font&&F[p.font])d.style.setProperty('--reading-font',F[p.font]);if(p.size)d.style.setProperty('--reading-size',p.size+'px');var s=S[p.spacing||'normal'];d.style.setProperty('--reading-leading',s[0]);d.style.setProperty('--reading-para',s[1]);d.style.setProperty('--reading-letter',s[2]);d.style.setProperty('--reading-word',s[3])}catch(e){}})();</script>`;

const readerBar = `<div class="reader"><button class="reader-toggle" id="reader-toggle" aria-expanded="false" aria-controls="reader-panel" title="Reading settings">Aa</button><div class="reader-panel" id="reader-panel" hidden><div class="reader-row"><span>Theme</span><div class="reader-opts" data-pref="theme"><button data-value="dark">Dark</button><button data-value="paper">Paper</button><button data-value="light">Light</button></div></div><div class="reader-row"><span>Font</span><div class="reader-opts" data-pref="font"><button data-value="lexend">Lexend</button><button data-value="atkinson">Atkinson</button><button data-value="sans">Verdana</button><button data-value="opendyslexic">OpenDyslexic</button><button data-value="serif">Serif</button></div></div><div class="reader-row"><span>Text size</span><div class="reader-opts" data-pref="size"><button data-value="16">A-</button><button data-value="18">A</button><button data-value="20">A+</button><button data-value="24">A++</button><button data-value="28">A+++</button></div></div><div class="reader-row"><span>Spacing</span><div class="reader-opts" data-pref="spacing"><button data-value="normal">Normal</button><button data-value="relaxed">Relaxed</button><button data-value="wide">Wide</button></div></div><div class="reader-row"><span>Italics</span><div class="reader-opts" data-pref="italics"><button data-value="off">Off</button><button data-value="on">On</button></div></div></div></div>`;

const readerScript = `
(function(){
  var KEY='sourcebook-reader';
  var FONTS={lexend:"'Lexend',Verdana,system-ui,sans-serif",atkinson:"'Atkinson Hyperlegible',Verdana,system-ui,sans-serif",opendyslexic:"'OpenDyslexic',Verdana,system-ui,sans-serif",sans:"Verdana,Tahoma,Arial,system-ui,sans-serif",serif:"Georgia,'Times New Roman',serif"};
  var SPACING={normal:["1.7","1.4em",".012em",".05em"],relaxed:["1.9","1.7em",".05em",".1em"],wide:["2.1","2em",".12em",".16em"]};
  var prefs={theme:null,font:'lexend',size:18,spacing:'normal',italics:'off'};
  try{Object.assign(prefs,JSON.parse(localStorage.getItem(KEY)||'{}'))}catch(e){}
  function apply(){
    var d=document.documentElement;
    d.dataset.theme=prefs.theme||(matchMedia('(prefers-color-scheme: light)').matches?'light':'dark');
    d.dataset.italics=prefs.italics||'off';
    d.style.setProperty('--reading-font',FONTS[prefs.font]||FONTS.lexend);
    d.style.setProperty('--reading-size',prefs.size+'px');
    var s=SPACING[prefs.spacing]||SPACING.normal;
    d.style.setProperty('--reading-leading',s[0]);
    d.style.setProperty('--reading-para',s[1]);
    d.style.setProperty('--reading-letter',s[2]);
    d.style.setProperty('--reading-word',s[3]);
  }
  function save(){try{localStorage.setItem(KEY,JSON.stringify(prefs))}catch(e){}}
  apply();
  var toggle=document.getElementById('reader-toggle'),panel=document.getElementById('reader-panel');
  if(!toggle||!panel)return;
  function paint(){
    panel.querySelectorAll('.reader-opts').forEach(function(group){
      var key=group.dataset.pref;
      group.querySelectorAll('button').forEach(function(btn){
        var v=btn.dataset.value;
        var on=(key==='size')?Number(v)===Number(prefs[key]):v===prefs[key];
        btn.classList.toggle('on',on);
      });
    });
  }
  toggle.addEventListener('click',function(){
    var open=panel.hidden;
    panel.hidden=!open;
    toggle.setAttribute('aria-expanded',String(open));
    if(open)paint();
  });
  panel.addEventListener('click',function(e){
    var btn=e.target.closest('button[data-value]');
    if(!btn)return;
    var key=btn.closest('.reader-opts').dataset.pref;
    prefs[key]=(key==='size')?Number(btn.dataset.value):btn.dataset.value;
    apply();save();paint();
  });
  document.addEventListener('keydown',function(e){
    if(e.key==='Escape'&&!panel.hidden){panel.hidden=true;toggle.setAttribute('aria-expanded','false');toggle.focus();}
  });
  paint();
})();
`;

const layout = (title: string, body: string, page: 'unit' | 'index', data: Record<string, string> = {}) => `<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
<title>${esc(title)}</title><link rel="stylesheet" href="/assets/sourcebook.css">${readerHead}</head>
<body data-page="${page}"${Object.entries(data).map(([key, value]) => ` data-${esc(key)}="${esc(value)}"`).join('')}><div class="shell">${body}</div>${readerBar}<script src="/assets/sync.js" defer></script><script src="/assets/reader.js" defer></script><script src="/assets/${page}.js" defer></script></body></html>`;

const stripLeadH1 = (html: string) => html.replace(/^\s*<h1\b[^>]*>[\s\S]*?<\/h1>\s*/i, '');

const slug = (text: string) => text.replace(/<[^>]+>/g, '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 60) || 'section';

function buildOutline(html: string): { html: string; outline: string } {
  const used = new Map<string, number>();
  const unique = (base: string) => { const n = used.get(base) || 0; used.set(base, n + 1); return n ? `${base}-${n}` : base; };
  const sections: { id: string; label: string }[] = [];
  const points: { id: string; label: string }[] = [];
  let out = html.replace(/<h2>([\s\S]*?)<\/h2>/g, (_match, inner: string) => {
    const label = inner.replace(/<[^>]+>/g, '').trim();
    const id = unique('s-' + slug(label));
    sections.push({ id, label });
    return `<h2 id="${id}">${inner}</h2>`;
  });
  out = out.replace(/<p><strong>([\s\S]*?)<\/strong>/g, (match, inner: string) => {
    const label = inner.replace(/<[^>]+>/g, '').replace(/[\s.:]+$/, '').trim();
    if (!label || label.length > 90 || /^period$/i.test(label)) return match;
    const id = unique('p-' + slug(label));
    points.push({ id, label });
    return `<p id="${id}"><strong>${inner}</strong>`;
  });
  const toc = sections.length ? `<nav class="toc" aria-label="On this page"><p class="toc-title">On this page</p><ol>${sections.map(section => `<li><a href="#${section.id}">${section.label}</a></li>`).join('')}</ol></nav>` : '';
  const keypoints = points.length > 2 ? `<details class="keypoints"><summary>Key points (${points.length})</summary><ul>${points.map(point => `<li><a href="#${point.id}">${point.label}</a></li>`).join('')}</ul></details>` : '';
  return { html: out, outline: toc + keypoints };
}

function renderUnit(subject: string, dir: string, unit: Unit, nav: { prev: { id: string; title: string } | null; next: { id: string; title: string } | null }): string {
  const spineMarkdown = fs.readFileSync(path.join(dir, unit.spine), 'utf8');
  const sourceMarkdowns = unit.sources.map(source => fs.readFileSync(path.join(dir, source.file), 'utf8'));
  const { html: spineHtml, outline } = buildOutline(stripLeadH1(renderMarkdown(spineMarkdown)));

  const map = unit.images.find(image => image.id === 'map');
  const artifacts = unit.images.filter(image => image.id !== 'map');
  const image = (entry: Unit['images'][number], className = '', priority = false) => {
    const jpg = `../content/${subject}/${unit.id}/${entry.file}`;
    const webp = jpg.replace(/\.jpg$/, '.webp');
    const attrs = `${className ? ` class="${className}"` : ''} src="${jpg}" alt="${esc(entry.caption)}" decoding="async"${priority ? ' fetchpriority="high"' : ' loading="lazy"'}`;
    return `<picture><source type="image/webp" srcset="${webp}"><img${attrs}></picture>`;
  };
  const mapHtml = map ? `<figure>${image(map, 'map', true)}<figcaption>${esc(map.caption)} — ${esc(map.credit)} (${esc(map.license)})</figcaption></figure>` : '';
  const artifactHtml = artifacts.length ? `<div class="grid">${artifacts.map(entry => `<figure>${image(entry)}<figcaption>${esc(entry.caption)} — ${esc(entry.credit)} (${esc(entry.license)})</figcaption></figure>`).join('')}</div>` : '';

  const sourcesHtml = unit.sources.map((source, index) => {
    const body = stripLeadH1(renderMarkdown(sourceMarkdowns[index]));
    const questions = source.questions.map(question => `<li>${esc(question)}</li>`).join('');
    return `<section class="source"><div class="head"><strong>${esc(source.title)}</strong><br>${esc(source.author)} · ${esc(source.date)}</div><p>${esc(source.context)}</p>${body}<h3>Questions</h3><ol class="q">${questions}</ol><div class="head" style="margin-top:14px">${esc(source.citation)} · ${esc(source.license)}</div></section>`;
  }).join('');

  const activitiesHtml = unit.activities.map(activity => {
    if (activity.type === 'choice') {
      const choices = activity.choices.map((choice, index) => `<button class="choice" data-activity="${esc(activity.id)}" data-index="${index}">${esc(choice)}</button>`).join('');
      return `<div class="activity" data-kind="choice" data-id="${esc(activity.id)}" data-answer="${activity.answer}"><p>${esc(activity.prompt)}</p>${choices}<div class="feedback"></div><template>${esc(activity.feedback)}</template></div>`;
    }
    const rubric = activity.rubric.map(item => `<li>${esc(item)}</li>`).join('');
    return `<div class="activity" data-kind="response" data-id="${esc(activity.id)}"><p>${esc(activity.prompt)}</p><blockquote>${esc(activity.context)}</blockquote><textarea placeholder="Write your answer in your own words."></textarea><button class="check">Check my answer</button><div class="rubric"><strong>Your answer should:</strong><ul>${rubric}</ul></div></div>`;
  }).join('');

  const interpretationsHtml = unit.interpretations.length ? `<h2>How historians read this</h2>${unit.interpretations.map(interpretation => `<section class="source interpretation"><div class="head"><strong>${esc(interpretation.historian)}</strong>, <em>${esc(interpretation.work)}</em> (${esc(interpretation.year)})</div><p>${esc(interpretation.claim)}</p><p class="meta">${esc(interpretation.note)}</p></section>`).join('')}` : '';

  const script = `
const unitId=${JSON.stringify(unit.id)}, subject=${JSON.stringify(subject)};
document.querySelectorAll('[data-kind="choice"]').forEach(box=>{
  const answer=Number(box.dataset.answer);
  box.querySelectorAll('.choice').forEach(btn=>btn.addEventListener('click',()=>{
    if(box.dataset.done)return;box.dataset.done='1';
    const i=Number(btn.dataset.index);
    box.querySelectorAll('.choice').forEach((b,j)=>{if(j===answer)b.classList.add('correct');});
    if(i!==answer)btn.classList.add('wrong');
    box.querySelector('.feedback').textContent=box.querySelector('template').textContent;
  }));
});
document.querySelectorAll('[data-kind="response"]').forEach(box=>{
  box.querySelector('.check').addEventListener('click',()=>{
    if(!box.querySelector('textarea').value.trim()){box.querySelector('.rubric').classList.add('show');box.querySelector('.rubric').insertAdjacentHTML('afterbegin','<p>Write something first, then compare it with the points below.</p>');return;}
    box.querySelector('.rubric').classList.add('show');
  });
});
const cbtn=document.querySelector('[data-complete]');
const bbtn=document.querySelector('[data-bookmark]');
const rstatus=document.querySelector('#review-status');
const note=document.querySelector('#note');
const chat=document.querySelector('#chat');
const chatInput=document.querySelector('#chat-input');
const chatStatus=document.querySelector('#chat-status');
const esc=v=>String(v).replace(/[&<>]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;'}[c]));
const paintComplete=()=>{const d=SourcebookSync.isComplete(unitId);cbtn.textContent=d?'✓ Unit complete':'Mark unit complete';cbtn.classList.toggle('done',d);};
const paintBookmark=()=>{const d=SourcebookSync.isBookmarked(unitId);bbtn.textContent=d?'★ Bookmarked':'☆ Bookmark';bbtn.classList.toggle('done',d);};
const paintReview=()=>{const r=SourcebookSync.reviewInfo(unitId);if(!r){rstatus.textContent='Complete the unit to add it to review.';return;}rstatus.textContent='Reviews: '+r.reps+' · next due '+new Date(r.next).toLocaleDateString();};
const paintChat=()=>{const msgs=SourcebookSync.getTutor(unitId);chat.innerHTML=msgs.map(m=>'<p class="'+(m.role==='user'?'you':'tutor')+'">'+esc(m.content)+'</p>').join('');chat.scrollTop=chat.scrollHeight;};
cbtn.addEventListener('click',()=>SourcebookSync.toggleComplete(unitId));
bbtn.addEventListener('click',()=>SourcebookSync.toggleBookmark(unitId));
document.querySelector('#review-btn').addEventListener('click',()=>{SourcebookSync.markReviewed(unitId);paintReview();});
note.value=SourcebookSync.getNote(unitId);
let noteTimer;note.addEventListener('input',()=>{clearTimeout(noteTimer);noteTimer=setTimeout(()=>SourcebookSync.setNote(unitId,note.value),700);});
document.querySelector('#chat-send').addEventListener('click',()=>{
  const text=chatInput.value.trim();if(!text)return;
  const msgs=SourcebookSync.getTutor(unitId).concat([{role:'user',content:text}]);
  SourcebookSync.setTutor(unitId,msgs);chatInput.value='';paintChat();chatStatus.textContent='Thinking…';
  SourcebookSync.askTutor(subject,unitId,msgs).then(data=>{SourcebookSync.setTutor(unitId,msgs.concat([{role:'assistant',content:data.reply}]));paintChat();chatStatus.textContent=(data.remaining!==undefined)?('Replies left today: '+data.remaining):'';}).catch(err=>{chatStatus.textContent=err.message==='daily_limit'?'Daily limit reached.':err.message==='tutor_disabled'?'The tutor is switched off.':'Tutor unavailable — try again later.';});
});
addEventListener('sourcebook:changed',()=>{paintComplete();paintBookmark();paintReview();paintChat();});
paintComplete();paintBookmark();paintReview();paintChat();`;

  const meta = [unit.period, unit.region].filter(Boolean).map(esc).join(' · ');
  const tools = `<section class="activity"><h3>Notes</h3><textarea id="note" placeholder="Your notes for this unit…"></textarea></section>
<section class="activity"><h3>Spaced review</h3><p class="meta" id="review-status"></p><button class="check" id="review-btn">Mark reviewed</button></section>
<section class="activity"><h3>Ask the tutor</h3><div id="chat" class="chat"></div><textarea id="chat-input" placeholder="Ask a question about this unit…"></textarea><button class="check" id="chat-send">Send</button><div class="meta" id="chat-status"></div></section>`;
  const countWords = (text: string) => (text.match(/[A-Za-z0-9’'-]+/g) || []).length;
  const wordCount = countWords(spineMarkdown) + sourceMarkdowns.reduce((total, text) => total + countWords(text), 0);
  const readMinutes = Math.max(1, Math.round(wordCount / 200));
  const pager = (nav.prev || nav.next) ? `<nav class="pager" aria-label="Unit navigation">${nav.prev ? `<a class="pager-prev" href="${esc(nav.prev.id)}.html"><span>← Previous</span><strong>${esc(nav.prev.title)}</strong></a>` : '<span></span>'}${nav.next ? `<a class="pager-next" href="${esc(nav.next.id)}.html"><span>Next →</span><strong>${esc(nav.next.title)}</strong></a>` : '<span></span>'}</nav>` : '';
  const body = `<p><a href="../index.html">← All units</a></p><h1>${esc(unit.title)}</h1>${meta ? `<div class="meta">${meta}</div>` : ''}${outline}${mapHtml}${spineHtml}${artifactHtml}<h2>Sources</h2>${sourcesHtml}${interpretationsHtml}<h2>Practice</h2>${activitiesHtml}<div class="activity complete-card"><p>Finished this unit?</p><button class="check" data-complete="${esc(unit.id)}">Mark unit complete</button> <button class="check" data-bookmark>☆ Bookmark</button></div>${tools}${pager}<footer><p class="counts">${wordCount.toLocaleString('en-US')} words · about ${readMinutes} min read</p>Primary sources only. Nothing here is modern commentary. <span id="sync-status" class="meta"></span></footer>`;

  const sourceTexts = unit.sources.map((source, index) => `${source.title} — ${source.author}\n${source.context}\n${sourceMarkdowns[index]}`).join('\n\n');
  const spineText = spineMarkdown;
  const material = `UNIT: ${unit.title} (${[unit.period, unit.region].filter(Boolean).join(', ')})\n\n${spineText}\n\nSOURCES\n${sourceTexts}`.slice(0, 8000);
  const tutorOut = path.join(outDir, 'tutor', subject, `${unit.id}.json`);
  fs.mkdirSync(path.dirname(tutorOut), { recursive: true });
  fs.writeFileSync(tutorOut, JSON.stringify({ title: unit.title, material }));

  const out = path.join(outDir, subject, `${unit.id}.html`);
  fs.mkdirSync(path.dirname(out), { recursive: true });
  fs.writeFileSync(out, layout(`${unit.title} — Sources`, body, 'unit', { 'unit-id': unit.id, subject }));
  return `<li data-unit="${esc(unit.id)}"><a href="${subject}/${unit.id}.html">${esc(unit.title)}</a> <span class="meta">${esc(unit.period)}</span></li>`;
}

const subjects = fs.readdirSync(contentDir).filter(name => fs.statSync(path.join(contentDir, name)).isDirectory()).sort();
const lists: string[] = [];
for (const subject of subjects) {
  const subjectDir = path.join(contentDir, subject);
  const unitDirs = fs.readdirSync(subjectDir).sort().filter(name => fs.statSync(path.join(subjectDir, name)).isDirectory());
  const units = unitDirs.map(unitDir => ({ unitDir, unit: UnitSchema.parse(JSON.parse(fs.readFileSync(path.join(subjectDir, unitDir, 'unit.json'), 'utf8'))) }));
  const entries: string[] = [];
  units.forEach(({ unitDir, unit }, index) => {
    const dir = path.join(subjectDir, unitDir);
    const neighbour = (offset: number) => { const other = units[index + offset]; return other ? { id: other.unit.id, title: other.unit.title } : null; };
    entries.push(renderUnit(subject, dir, unit, { prev: neighbour(-1), next: neighbour(1) }));
    const assets = path.join(dir, 'assets');
    if (fs.existsSync(assets)) fs.cpSync(assets, path.join(outDir, 'content', subject, unit.id, 'assets'), { recursive: true });
  });
  lists.push(`<h2>${esc(subject.split('-').map(word => word[0].toUpperCase() + word.slice(1)).join(' '))}</h2><ul>${entries.join('')}</ul>`);
}
const indexScript = `document.querySelectorAll('[data-unit] a').forEach(a=>{a.dataset.title=a.textContent});
const unitLink=id=>{const a=document.querySelector('[data-unit="'+id+'"] a');return a?('<a href="'+a.getAttribute('href')+'">'+(a.dataset.title||id)+'</a>'):id};
const mark=()=>{
  document.querySelectorAll('[data-unit]').forEach(li=>{const done=SourcebookSync.isComplete(li.dataset.unit);li.classList.toggle('done',done);const a=li.querySelector('a');if(a)a.textContent=(done?'✓ ':'')+a.dataset.title;});
  const due=SourcebookSync.dueUnits();
  document.querySelector('#due').innerHTML=due.length?due.map(id=>'<li>'+unitLink(id)+'</li>').join(''):'<li class="meta">Nothing due. Complete a unit to schedule its first review.</li>';
  const marks=[];document.querySelectorAll('[data-unit]').forEach(li=>{if(SourcebookSync.isBookmarked(li.dataset.unit))marks.push(li.dataset.unit)});
  document.querySelector('#marks').innerHTML=marks.length?marks.map(id=>'<li>'+unitLink(id)+'</li>').join(''):'<li class="meta">No bookmarks yet.</li>';
};
addEventListener('sourcebook:changed',mark);mark();`;
fs.writeFileSync(path.join(outDir, 'index.html'), layout('Learning — sourcebook', `<h1>Sourcebook</h1><p class="meta">Taught from the period's own documents. <span id="sync-status"></span></p><section class="activity"><h3>Due for review</h3><ul class="due-list" id="due"></ul></section><section class="activity"><h3>Bookmarks</h3><ul class="mark-list" id="marks"></ul></section>${lists.join('')}`, 'index'));
console.log('Rendered to dist/.');
