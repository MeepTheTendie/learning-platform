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

const layout = (title: string, body: string) => `<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
<title>${esc(title)}</title>
<style>
:root{color-scheme:dark;--bg:#14120f;--panel:#1d1a16;--text:#ece7dd;--muted:#a9a294;--line:#37322a;--accent:#d9b46a}
*{box-sizing:border-box}body{margin:0;background:var(--bg);color:var(--text);font:17px/1.7 Georgia,serif}
.shell{max-width:820px;margin:auto;padding:40px 22px 80px}
a{color:var(--accent)}h1{font-size:34px;line-height:1.15;margin:0 0 6px}
.meta{color:var(--muted);font-size:14px;margin-bottom:28px}
h2{font-size:24px;margin:34px 0 12px;border-top:1px solid var(--line);padding-top:20px}
h3{font-size:18px;margin:24px 0 6px}
.source{background:var(--panel);border:1px solid var(--line);border-radius:12px;padding:22px;margin:18px 0}
.source .head{color:var(--muted);font-size:13px;margin-bottom:14px}
blockquote{border-left:3px solid var(--accent);margin:14px 0;padding:2px 0 2px 16px;color:var(--muted)}
.q{margin:10px 0 0;padding-left:18px}.q li{margin:6px 0}
footer{color:var(--muted);font-size:12px;border-top:1px solid var(--line);margin-top:40px;padding-top:16px}
</style></head><body><div class="shell">${body}</div></body></html>`;

function renderUnit(subject: string, dir: string, unit: Unit): string {
  const spineHtml = marked.parse(fs.readFileSync(path.join(dir, unit.spine), 'utf8')) as string;
  const sourcesHtml = unit.sources.map(source => {
    const body = marked.parse(fs.readFileSync(path.join(dir, source.file), 'utf8')) as string;
    const questions = source.questions.map(question => `<li>${esc(question)}</li>`).join('');
    return `<section class="source"><div class="head"><strong>${esc(source.title)}</strong><br>${esc(source.author)} · ${esc(source.date)}</div><p>${esc(source.context)}</p>${body}<h3>Questions</h3><ol class="q">${questions}</ol><div class="head" style="margin-top:14px">${esc(source.citation)} · ${esc(source.license)}</div></section>`;
  }).join('');
  const body = `<p><a href="../index.html">← All units</a></p><h1>${esc(unit.title)}</h1><div class="meta">${esc(unit.period)} · ${esc(unit.region)}</div>${spineHtml}<h2>Sources</h2>${sourcesHtml}<footer>Primary sources only. Nothing here is modern commentary.</footer>`;
  const out = path.join(outDir, subject, `${unit.id}.html`);
  fs.mkdirSync(path.dirname(out), { recursive: true });
  fs.writeFileSync(out, layout(`${unit.title} — Sources`, body));
  return `<li><a href="${subject}/${unit.id}.html">${esc(unit.title)}</a> <span class="meta">${esc(unit.period)}</span></li>`;
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
  }
  lists.push(`<h2>${esc(subject[0].toUpperCase() + subject.slice(1))}</h2><ul>${entries.join('')}</ul>`);
}
fs.writeFileSync(path.join(outDir, 'index.html'), layout('Learning — sourcebook', `<h1>Sourcebook</h1><p class="meta">History, taught from the period's own documents.</p>${lists.join('')}`));
console.log('Rendered to dist/.');
