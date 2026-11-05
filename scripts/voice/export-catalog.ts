// Gera scripts/voice/catalog.json a partir do código do jogo.
// Rodar: npm run voice:catalog   (usa npx tsx; só é preciso quando o texto do jogo mudar)
import fs from 'node:fs';
import path from 'node:path';
import { buildCatalog, speakerList } from '../../lib/voice/catalog';

const entries = buildCatalog();

// colisão de hash dentro de um mesmo personagem = erro (dois textos diferentes com o mesmo id)
const seen = new Map<string, string>();
for (const e of entries) {
  const prev = seen.get(e.id);
  if (prev && prev !== e.text) throw new Error(`Colisão de id ${e.id}: "${prev}" x "${e.text}"`);
  seen.set(e.id, e.text);
}

const out = {
  generatedAt: new Date().toISOString(),
  speakers: speakerList(),
  entries,
};
const file = path.resolve(process.cwd(), 'scripts/voice/catalog.json');
fs.writeFileSync(file, JSON.stringify(out, null, 1), 'utf8');

const byGroup: Record<string, number> = {};
const bySpeaker: Record<string, number> = {};
let chars = 0;
for (const e of entries) {
  byGroup[e.group] = (byGroup[e.group] ?? 0) + 1;
  bySpeaker[e.speaker] = (bySpeaker[e.speaker] ?? 0) + 1;
  chars += e.say.length;
}
console.log(`catalog.json: ${entries.length} falas, ${chars} caracteres`);
console.log('por grupo   :', JSON.stringify(byGroup));
console.log('por falante :', JSON.stringify(bySpeaker));
