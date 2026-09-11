import fs from 'node:fs';
import path from 'node:path';
import { marked } from 'marked';
import { UnitSchema, type Unit } from '../src/schema.ts';

const root = path.resolve(new URL('..', import.meta.url).pathname);
const contentDir = path.join(root, 'content');
const outDir = path.join(root, 'dist');
fs.rmSync(outDir, { recursive: true, force: true });
fs.mkdirSync(outDir, { recursive: true });

const esc = (value: string) => value.replace(/[&<>"]/g, character => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[character] as string));

const style = `
:root{color-scheme:dark;--bg:#14120f;--panel:#1d1a16;--text:#ece7dd;--muted:#a9a294;--line:#37322a;--accent:#d9b46a;--gold:#c9a86a;--ok:#7fbf7f;--no:#d98a8a}
*{box-sizing:border-box}body{margin:0;background:var(--bg);color:var(--text);font:17px/1.7 Georgia,serif}
.shell{max-width:860px;margin:auto;padding:40px 22px 90px}
a{color:var(--accent)}h1{font-size:34px;line-height:1.15;margin:0 0 6px}
.meta{color:var(--muted);font-size:14px;margin-bottom:28px}
h2{font-size:24px;margin:36px 0 12px;border-top:1px solid var(--line);padding-top:20px}
h3{font-size:18px;margin:24px 0 6px}
figure{margin:18px 0}.map{width:100%;border-radius:12px;border:1px solid var(--line)}
.grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(240px,1fr));gap:14px}
figure img{width:100%;height:230px;object-fit:cover;border-radius:10px;border:1px solid var(--line)}
figcaption{color:var(--muted);font-size:13px;margin-top:8px}
.source{background:var(--panel);border:1px solid var(--line);border-radius:12px;padding:22px;margin:18px 0}
.source .head{color:var(--muted);font-size:13px;margin-bottom:14px}
blockquote{border-left:3px solid var(--accent);margin:14px 0;padding:2px 0 2px 16px;color:var(--muted)}
.q{margin:10px 0 0;padding-left:18px}.q li{margin:6px 0}
.activity{background:var(--panel);border:1px solid var(--line);border-radius:12px;padding:20px;margin:16px 0}
.activity p{font-weight:600}
.choice{display:block;width:100%;text-align:left;margin:7px 0;padding:11px 13px;border:1px solid var(--line);border-radius:9px;background:var(--bg);color:var(--text);font:inherit;cursor:pointer}
.choice:hover{border-color:var(--accent)}.choice.correct{border-color:var(--ok);color:var(--ok)}.choice.wrong{border-color:var(--no);color:var(--no)}
.feedback{color:var(--muted);font-size:14px;margin-top:10px;min-height:18px}
textarea{width:100%;min-height:120px;padding:12px;border-radius:9px;border:1px solid var(--line);background:var(--bg);color:var(--text);font:inherit}
.rubric{display:none;color:var(--muted);font-size:14px;margin-top:10px}.rubric.show{display:block}
button.check{margin-top:10px;padding:9px 14px;border:1px solid var(--line);border-radius:8px;background:transparent;color:var(--text);font:inherit;cursor:pointer}
button.check.done{border-color:var(--ok);color:var(--ok)}
.complete-card{background:var(--panel)}
.interpretation{border-left:3px solid var(--gold)}
li.done>a{color:var(--ok)}
footer{color:var(--muted);font-size:12px;border-top:1px solid var(--line);margin-top:44px;padding-top:16px}
`;

const layout = (title: string, body: string, script = '') => `<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
<title>${esc(title)}</title><style>${style}</style></head>
<body><div class="shell">${body}</div>${script ? `<script>${script}</script>` : ''}</body></html>`;

function renderUnit(subject: string, dir: string, unit: Unit): string {
  const spineHtml = marked.parse(fs.readFileSync(path.join(dir, unit.spine), 'utf8')) as string;

  const map = unit.images.find(image => image.id === 'map');
  const artifacts = unit.images.filter(image => image.id !== 'map');
  const mapHtml = map ? `<figure><img class="map" src="../content/${subject}/${unit.id}/${map.file}" alt="${esc(map.caption)}"><figcaption>${esc(map.caption)} — ${esc(map.credit)} (${esc(map.license)})</figcaption></figure>` : '';
  const artifactHtml = artifacts.length ? `<div class="grid">${artifacts.map(image => `<figure><img src="../content/${subject}/${unit.id}/${image.file}" alt="${esc(image.caption)}"><figcaption>${esc(image.caption)} — ${esc(image.credit)} (${esc(image.license)})</figcaption></figure>`).join('')}</div>` : '';

  const sourcesHtml = unit.sources.map(source => {
    const body = marked.parse(fs.readFileSync(path.join(dir, source.file), 'utf8')) as string;
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
const ck='sourcebook-complete';
const rc=()=>{try{return JSON.parse(localStorage.getItem(ck))||{}}catch{return{}}};
const paint=btn=>{const d=rc()[btn.dataset.complete]===true;btn.textContent=d?'✓ Unit complete':'Mark unit complete';btn.classList.toggle('done',d);};
document.querySelectorAll('[data-complete]').forEach(btn=>{btn.addEventListener('click',()=>{const v=rc();v[btn.dataset.complete]=!v[btn.dataset.complete];localStorage.setItem(ck,JSON.stringify(v));paint(btn);});paint(btn);});`;

  const body = `<p><a href="../index.html">← All units</a></p><h1>${esc(unit.title)}</h1><div class="meta">${esc(unit.period)} · ${esc(unit.region)}</div>${mapHtml}${spineHtml}${artifactHtml}<h2>Sources</h2>${sourcesHtml}${interpretationsHtml}<h2>Practice</h2>${activitiesHtml}<div class="activity complete-card"><p>Finished this unit?</p><button class="check" data-complete="${esc(unit.id)}">Mark unit complete</button></div><footer>Primary sources only. Nothing here is modern commentary.</footer>`;
  const out = path.join(outDir, subject, `${unit.id}.html`);
  fs.mkdirSync(path.dirname(out), { recursive: true });
  fs.writeFileSync(out, layout(`${unit.title} — Sources`, body, script));
  return `<li data-unit="${esc(unit.id)}"><a href="${subject}/${unit.id}.html">${esc(unit.title)}</a> <span class="meta">${esc(unit.period)}</span></li>`;
}

const subjects = ['history'];
const lists: string[] = [];
for (const subject of subjects) {
  const subjectDir = path.join(contentDir, subject);
  const entries: string[] = [];
  for (const unitDir of fs.readdirSync(subjectDir).sort()) {
    const dir = path.join(subjectDir, unitDir);
    if (!fs.statSync(dir).isDirectory()) continue;
    const unit = UnitSchema.parse(JSON.parse(fs.readFileSync(path.join(dir, 'unit.json'), 'utf8')));
    entries.push(renderUnit(subject, dir, unit));
    fs.cpSync(path.join(dir, 'assets'), path.join(outDir, 'content', subject, unit.id, 'assets'), { recursive: true });
  }
  lists.push(`<h2>${esc(subject[0].toUpperCase() + subject.slice(1))}</h2><ul>${entries.join('')}</ul>`);
}
const indexScript = `const ck='sourcebook-complete';const rc=()=>{try{return JSON.parse(localStorage.getItem(ck))||{}}catch{return{}}};const c=rc();document.querySelectorAll('[data-unit]').forEach(li=>{if(c[li.dataset.unit]===true){li.classList.add('done');const a=li.querySelector('a');if(a)a.insertAdjacentHTML('afterbegin','✓ ');}});`;
fs.writeFileSync(path.join(outDir, 'index.html'), layout('Learning — sourcebook', `<h1>Sourcebook</h1><p class="meta">History, taught from the period's own documents.</p>${lists.join('')}`, indexScript));
console.log('Rendered to dist/.');
