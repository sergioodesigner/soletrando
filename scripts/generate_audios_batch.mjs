import fs from 'node:fs';
import path from 'node:path';
import { WORDS_WITH_CLUES, MATH_ITEMS, textToSlug } from './generate_recorded_audios.mjs';

const OUTPUT_DIR = path.resolve(process.cwd(), 'public/audio/recorded');
const TRACKER_FILE = path.resolve(process.cwd(), 'public/audio/recorded/.generated_audios.json');
const DEFAULT_REF_AUDIO = path.resolve(process.cwd(), 'public/audio/recorded/math_dica_m12-3.mp3');
const DEFAULT_REF_TEXT = "Multiplique 3 por ele mesmo 3 vezes 3 vezes 3 é 9, vezes 3 é 27.";

if (!fs.existsSync(OUTPUT_DIR)) {
  fs.mkdirSync(OUTPUT_DIR, { recursive: true });
}

// Parse command line arguments
const args = process.argv.slice(2).reduce((acc, arg) => {
  if (arg.startsWith('--')) {
    const [key, ...val] = arg.slice(2).split('=');
    acc[key] = val.join('=') || true;
  }
  return acc;
}, {});

const provider = (args.provider || process.env.TTS_PROVIDER || 'openrouter').toLowerCase();
const apiKey = args.key || args.apiKey || process.env.OPENROUTER_API_KEY || process.env.TTS_API_KEY || process.env.ELEVENLABS_API_KEY || process.env.OPENAI_API_KEY;
const model = args.model || (provider === 'openrouter' ? 'fish-audio/s2.1-pro-free:free' : 'eleven_multilingual_v2');
const voice = args.voice || (provider === 'openai' ? 'nova' : 'alloy');
const refAudioPath = args.refAudio || args.referenceAudio || DEFAULT_REF_AUDIO;
const refText = args.refText || args.referenceText || DEFAULT_REF_TEXT;
const force = Boolean(args.force);

if (!apiKey) {
  console.error('\n❌ ERRO: Nenhuma Chave de API foi informada.\n');
  console.error('Como usar com OpenRouter (Fish Audio Voice Cloning):');
  console.error('  npm run generate-audios -- --key=SUA_CHAVE_OPENROUTER --model=fish-audio/s2.1-pro-free:free\n');
  console.error('Opções:');
  console.error('  --provider       openrouter | elevenlabs | openai (padrão: openrouter)');
  console.error('  --key            Sua API Key');
  console.error('  --model          Nome do modelo (padrão: fish-audio/s2.1-pro-free:free)');
  console.error('  --refAudio       Caminho do áudio de referência (padrão: math_dica_m12-3.mp3)');
  console.error('  --refText        Transcrição do áudio de referência');
  console.error('  --force          Regera todos os áudios ignorando o cache\n');
  process.exit(1);
}

// Carrega o áudio de referência em Base64 se existir
let base64RefAudio = null;
if (fs.existsSync(refAudioPath)) {
  const audioBuffer = fs.readFileSync(refAudioPath);
  base64RefAudio = `data:audio/mp3;base64,${audioBuffer.toString('base64')}`;
}

// Nomes fonéticos em português para letras do alfabeto
const PT_LETTER_NAMES = {
  A: 'Á', B: 'Bê', C: 'Cê', D: 'Dê', E: 'É', F: 'Éfe', G: 'Gê', H: 'Agá',
  I: 'I', J: 'Jota', K: 'Cá', L: 'Éle', M: 'Ême', N: 'Êne', O: 'Ó',
  P: 'Pê', Q: 'Quê', R: 'Érre', S: 'Ésse', T: 'Tê', U: 'U', V: 'Vê',
  W: 'Dáblio', X: 'Xis', Y: 'Ípsilon', Z: 'Zê'
};

// Lista de todos os áudios que o sistema utiliza
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
      { key: `palavra_${slug}`, text: `A palavra é: ${formatted}!` },
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

// OpenRouter + Fish Audio API
async function fetchOpenRouter(text) {
  const url = 'https://openrouter.ai/api/v1/audio/speech';

  const bodyPayload = {
    model: model,
    input: text,
    voice: voice
  };

  // Se temos áudio de referência para clonagem de voz do Fish Audio
  if (base64RefAudio) {
    bodyPayload.input_references = [
      {
        type: 'input_audio',
        input_audio: {
          data: base64RefAudio
        }
      },
      {
        type: 'text',
        text: refText
      }
    ];
    // Formato alternativo compatível com referências diretas
    bodyPayload.references = [
      {
        audio: base64RefAudio,
        text: refText
      }
    ];
  }

  const res = await fetch(url, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
      'HTTP-Referer': 'https://soletrando.app',
      'X-Title': 'Soletrando Audio Generator'
    },
    body: JSON.stringify(bodyPayload)
  });

  if (!res.ok) {
    const errText = await res.text();
    throw new Error(`OpenRouter API HTTP ${res.status}: ${errText}`);
  }

  return Buffer.from(await res.arrayBuffer());
}

// Provedor ElevenLabs
async function fetchElevenLabs(text) {
  const url = `https://api.elevenlabs.io/v1/text-to-speech/${voice}?output_format=mp3_44100_128`;
  const res = await fetch(url, {
    method: 'POST',
    headers: {
      'xi-api-key': apiKey,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      text,
      model_id: model,
      language_code: 'pt',
      voice_settings: { stability: 0.60, similarity_boost: 0.85, style: 0.10, use_speaker_boost: true }
    })
  });

  if (!res.ok) {
    const errText = await res.text();
    throw new Error(`ElevenLabs API HTTP ${res.status}: ${errText}`);
  }

  return Buffer.from(await res.arrayBuffer());
}

// Provedor OpenAI TTS
async function fetchOpenAI(text) {
  const url = 'https://api.openai.com/v1/audio/speech';
  const res = await fetch(url, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${apiKey}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      model: model,
      input: text,
      voice: voice,
      response_format: 'mp3'
    })
  });

  if (!res.ok) {
    const errText = await res.text();
    throw new Error(`OpenAI TTS API HTTP ${res.status}: ${errText}`);
  }

  return Buffer.from(await res.arrayBuffer());
}

async function generateAudio(text) {
  if (provider === 'openai') {
    return fetchOpenAI(text);
  }
  if (provider === 'elevenlabs') {
    return fetchElevenLabs(text);
  }
  return fetchOpenRouter(text);
}

async function main() {
  console.log(`\n🎙️  Gerador de Áudios em Lote (Voice Cloning) - Soletrando`);
  console.log(`--------------------------------------------------------`);
  console.log(`Provedor: ${provider.toUpperCase()}`);
  console.log(`Modelo:   ${model}`);
  if (base64RefAudio) {
    console.log(`Voz Ref.: ${path.basename(refAudioPath)} (Clonagem Ativa 🐟)`);
  }
  console.log(`Destino:  ${OUTPUT_DIR}`);
  console.log(`Total de arquivos: ${ITEMS.length}\n`);

  let successCount = 0;
  for (let i = 0; i < ITEMS.length; i++) {
    const item = ITEMS[i];
    const filename = `${item.key}.mp3`;
    const filePath = path.join(OUTPUT_DIR, filename);

    if (completed[item.key] && fs.existsSync(filePath)) {
      successCount++;
      continue;
    }

    let attempts = 0;
    let ok = false;
    while (!ok && attempts < 3) {
      attempts++;
      try {
        process.stdout.write(`[${i + 1}/${ITEMS.length}] Gerando ${filename} ("${item.text}")... `);
        const buffer = await generateAudio(item.text);
        fs.writeFileSync(filePath, buffer);
        completed[item.key] = true;
        saveTracker();
        successCount++;
        console.log('✅ OK');
        ok = true;
        await new Promise(r => setTimeout(r, 250));
      } catch (err) {
        console.log(`❌ FALHA: ${err.message}`);
        if (err.message.includes('429')) {
          console.log('Aguardando 8 segundos por limite de requisições...');
          await new Promise(r => setTimeout(r, 8000));
        } else {
          await new Promise(r => setTimeout(r, 2000));
        }
      }
    }
  }

  console.log(`\n✨ Concluído! ${successCount}/${ITEMS.length} áudios gerados em ${OUTPUT_DIR}\n`);
}

main().catch(err => {
  console.error('\n❌ Erro fatal:', err.message);
  process.exit(1);
});
