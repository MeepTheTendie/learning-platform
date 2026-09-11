import fs from 'node:fs';
import path from 'node:path';
import { UnitSchema } from '../src/schema.ts';
import { lintFraming } from '../src/framing-lint.ts';

const root = path.resolve(new URL('..', import.meta.url).pathname);
const contentDir = path.join(root, 'content');
const subjects = ['history'];
const errors: string[] = [];
const manifest: string[] = ['# Content manifest', '', 'Every source and its license, generated from the unit files.', ''];

for (const subject of subjects) {
  const subjectDir = path.join(contentDir, subject);
  const units = fs.readdirSync(subjectDir).filter(name => fs.statSync(path.join(subjectDir, name)).isDirectory()).sort();
  for (const unitDir of units) {
    const dir = path.join(subjectDir, unitDir);
    const unitPath = path.join(dir, 'unit.json');
    if (!fs.existsSync(unitPath)) { errors.push(`${subject}/${unitDir}: missing unit.json`); continue; }
    let raw: unknown;
    try { raw = JSON.parse(fs.readFileSync(unitPath, 'utf8')); } catch (cause) { errors.push(`${subject}/${unitDir}: invalid JSON (${(cause as Error).message})`); continue; }
    const parsed = UnitSchema.safeParse(raw);
    if (!parsed.success) { for (const issue of parsed.error.issues) errors.push(`${subject}/${unitDir}/unit.json: ${issue.path.join('.')} — ${issue.message}`); continue; }
    const unit = parsed.data;

    const spinePath = path.join(dir, unit.spine);
    if (!fs.existsSync(spinePath)) errors.push(`${unit.id}: missing ${unit.spine}`);
    else {
      const spine = fs.readFileSync(spinePath, 'utf8');
      if (spine.trim().length < 100) errors.push(`${unit.id}: spine is too short`);
      for (const term of lintFraming(spine)) errors.push(`${unit.id}/spine.md: framing term "${term}"`);
    }
    for (const term of lintFraming(unit.title)) errors.push(`${unit.id}/unit.json title: framing term "${term}"`);

    manifest.push(`## ${unit.id} — ${unit.title}`, '', `${unit.period} · ${unit.region}`, '');
    for (const source of unit.sources) {
      const sourcePath = path.join(dir, source.file);
      if (!fs.existsSync(sourcePath)) errors.push(`${unit.id}/${source.file}: missing file`);
      else if (fs.readFileSync(sourcePath, 'utf8').trim().length < 50) errors.push(`${unit.id}/${source.file}: source is too short`);
      for (const term of lintFraming(source.context)) errors.push(`${unit.id}/${source.id} context: framing term "${term}"`);
      for (const question of source.questions) for (const term of lintFraming(question)) errors.push(`${unit.id}/${source.id} question: framing term "${term}"`);
      manifest.push(`- **${source.title}** — ${source.author}, ${source.date}. ${source.license}. ${source.citation}`);
    }
    for (const image of unit.images) {
      const imagePath = path.join(dir, image.file);
      if (!fs.existsSync(imagePath)) errors.push(`${unit.id}/${image.file}: missing image`);
      for (const term of lintFraming(image.caption)) errors.push(`${unit.id}/${image.id} caption: framing term "${term}"`);
      manifest.push(`- image: ${image.file} — ${image.credit} (${image.license})`);
    }
    for (const interpretation of unit.interpretations) {
      for (const field of [interpretation.claim, interpretation.note]) for (const term of lintFraming(field)) errors.push(`${unit.id}/${interpretation.id}: framing term "${term}"`);
      manifest.push(`- interpretation: ${interpretation.historian}, *${interpretation.work}* (${interpretation.year})`);
    }
    for (const activity of unit.activities) {
      const fields = activity.type === 'choice'
        ? [activity.prompt, ...activity.choices, activity.feedback]
        : [activity.prompt, activity.context, ...activity.rubric];
      for (const field of fields) for (const term of lintFraming(field)) errors.push(`${unit.id}/${activity.id}: framing term "${term}"`);
    }
    manifest.push('');
  }
}

fs.writeFileSync(path.join(contentDir, 'MANIFEST.md'), manifest.join('\n') + '\n');

if (errors.length) {
  console.error('Content validation failed:');
  for (const error of errors) console.error('  - ' + error);
  process.exit(1);
}
console.log('Content OK — schema valid, no framing terms, manifest written.');
