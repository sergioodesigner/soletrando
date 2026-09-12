import fs from 'node:fs';
import path from 'node:path';
import { WORDS_WITH_CLUES, MATH_ITEMS, textToSlug } from './generate_recorded_audios.mjs';

const OUTPUT_DIR = path.resolve(process.cwd(), 'public/audio/recorded');
const TRACKER_FILE = path.resolve(process.cwd(), 'public/audio/recorded/.elevenlabs_audios.json');

if (!fs.existsSync(OUTPUT_DIR)) {
  fs.mkdirSync(OUTPUT_DIR, { recursive: true });
}

// Get API key from environment or command line argument
const apiKey = process.env.ELEVENLABS_API_KEY || process.argv[2];
let voiceId = process.argv[3] || process.env.ELEVENLABS_VOICE_ID || 'hpp4J3VqNfWAUOO0d1Us';
// If the user configured Carla (oJebhZNaPllxk6W0LSBA) which requires paid plan, use Bella (hpp4J3VqNfWAUOO0d1Us) as agreed
if (voiceId === 'oJebhZNaPllxk6W0LSBA') {
  voiceId = 'hpp4J3VqNfWAUOO0d1Us';
}

if (!apiKey) {
  console.error('ERRO: Nenhuma chave da ElevenLabs fornecida.');
  console.error('Uso:');
  console.error('  node scripts/generate_elevenlabs_audios.mjs <SUA_CHAVE_API> [VOICE_ID]');
  console.error('Ou defina as variáveis ELEVENLABS_API_KEY e ELEVENLABS_VOICE_ID.');
  process.exit(1);
}

// Explicit Brazilian Portuguese phonetic letter names so ElevenLabs never pronounces in English
export const PT_LETTER_NAMES = {
  A: 'Á',
  B: 'Bê',
  C: 'Cê',
  D: 'Dê',
  E: 'É',
  F: 'Éfe',
  G: 'Gê',
  H: 'Agá',
  I: 'I',
  J: 'Jota',
  K: 'Cá',
  L: 'Éle',
  M: 'Ême',
  N: 'Êne',
  O: 'Ó',
  P: 'Pê',
  Q: 'Quê',
  R: 'Érre',
  S: 'Ésse',
  T: 'Tê',
  U: 'U',
  V: 'Vê',
  W: 'Dáblio',
  X: 'Xis',
  Y: 'Ípsilon',
  Z: 'Zê'
};

const ITEMS = [
  ...Object.entries(PT_LETTER_NAMES).map(([letter, phonetic]) => ({
    key: `letra_${letter.toLowerCase()}`,
    text: phonetic
  })),
  ...Object.entries(PT_LETTER_NAMES).map(([letter, phonetic]) => ({
    key: `proxima_letra_${letter.toLowerCase()}`,
    text: `A próxima letra é ${phonetic}!`
  })),
  { key: 'contar_1', text: 'Um!' },
  { key: 'contar_2', text: 'Dois!' },
  { key: 'contar_3', text: 'Três!' },
  { key: 'contar_4', text: 'Quatro!' },
  { key: 'contar_5', text: 'Cinco!' },
  { key: 'contar_6', text: 'Seis!' },
  { key: 'contar_7', text: 'Sete!' },
  { key: 'contar_8', text: 'Oito!' },
  { key: 'contar_9', text: 'Nove!' },
  { key: 'contar_10', text: 'Dez!' },
  { key: 'parabens_acertou', text: 'Muito bem! Resposta correta!' },
  { key: 'tente_de_novo', text: 'Tente de novo! Você consegue!' },
  { key: 'muito_bem', text: 'Muito bem!' },
  { key: 'excelente', text: 'Excelente!' },
  { key: 'fase_concluida', text: 'Parabéns, você concluiu a fase!' },
  { key: 'modo_letras', text: 'Modo Letras e Palavras' },
  { key: 'modo_matematica', text: 'Modo Matemática' },
  { key: 'fase_3_5', text: 'Fase de três a cinco anos' },
  { key: 'fase_6_8', text: 'Fase de seis a oito anos' },
  { key: 'fase_9_11', text: 'Fase de nove a onze anos' },
  { key: 'fase_12_14', text: 'Fase de doze a quatorze anos' },
  ...WORDS_WITH_CLUES.flatMap(wObj => {
    const w = wObj.word;
    const formatted = w.charAt(0).toUpperCase() + w.slice(1).toLowerCase();
    const slug = textToSlug(w);
    return [
      { key: `palavra_${slug}`, text: `Palavra: ${formatted}!` },
      { key: `desafio_${slug}`, text: `Soletre a palavra: ${formatted}!` },
      { key: `pista_${slug}`, text: `Pista: ${wObj.clue}` },
      { key: `completou_${slug}`, text: `Muito bem! Você completou a palavra ${formatted}!` }
    ];
  }),
  ...MATH_ITEMS.flatMap(m => [
    { key: `math_pergunta_${m.id}`, text: m.question },
    { key: `math_dica_${m.id}`, text: m.hint }
  ])
];

const force = process.argv.includes('--force');
let completed = {};
if (fs.existsSync(TRACKER_FILE) && !force) {
  try {
    completed = JSON.parse(fs.readFileSync(TRACKER_FILE, 'utf8'));
  } catch {
    completed = {};
  }
}

function saveTracker() {
  fs.writeFileSync(TRACKER_FILE, JSON.stringify(completed, null, 2), 'utf8');
}

async function fetchElevenLabsAudio(text, vId) {
  const url = `https://api.elevenlabs.io/v1/text-to-speech/${vId}?output_format=mp3_44100_128`;
  const res = await fetch(url, {
    method: 'POST',
    headers: {
      'xi-api-key': apiKey,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      text: text,
      model_id: 'eleven_multilingual_v2',
      language_code: 'pt',
      voice_settings: {
        stability: 0.60,
        similarity_boost: 0.85,
        style: 0.10,
        use_speaker_boost: true
      }
    })
  });

  if (!res.ok) {
    const errText = await res.text();
    throw new Error(`ElevenLabs API HTTP ${res.status}: ${errText}`);
  }

  const arrayBuffer = await res.arrayBuffer();
  return Buffer.from(arrayBuffer);
}

async function main() {
  console.log(`ElevenLabs TTS Generator initialized.`);
  console.log(`Target Voice ID: ${voiceId}`);
  console.log(`Total items to process: ${ITEMS.length}`);

  let successCount = 0;
  for (let i = 0; i < ITEMS.length; i++) {
    const item = ITEMS[i];
    const filename = `${item.key}.mp3`;
    const filePath = path.join(OUTPUT_DIR, filename);

    if (completed[item.key]) {
      successCount++;
      continue;
    }

    let attempts = 0;
    let ok = false;
    while (!ok && attempts < 3) {
      attempts++;
      try {
        process.stdout.write(`[${i + 1}/${ITEMS.length}] Generating ${filename} ("${item.text}")... `);
        const buffer = await fetchElevenLabsAudio(item.text, voiceId);
        fs.writeFileSync(filePath, buffer);
        completed[item.key] = true;
        saveTracker();
        successCount++;
        console.log('OK');
        ok = true;
        // Pacing delay between calls
        await new Promise(r => setTimeout(r, 250));
      } catch (err) {
        console.log(`FAIL: ${err.message}`);
        if (err.message.includes('429')) {
          console.log('Rate limit reached, waiting 10 seconds...');
          await new Promise(r => setTimeout(r, 10000));
        } else {
          await new Promise(r => setTimeout(r, 2000));
        }
      }
    }
  }

  console.log(`\nConcluído! ${successCount}/${ITEMS.length} áudios gerados com a ElevenLabs.`);
}

main().catch(err => {
  console.error('Fatal error:', err);
  process.exit(1);
});
