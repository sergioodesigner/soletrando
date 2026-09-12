import fs from 'node:fs';
import path from 'node:path';
import { GoogleGenAI, Modality } from "@google/genai";

const OUTPUT_DIR = path.resolve(process.cwd(), 'public/audio/kore');
const MANIFEST_PATH = path.resolve(process.cwd(), 'lib/audioManifestData.json');

if (!fs.existsSync(OUTPUT_DIR)) {
  fs.mkdirSync(OUTPUT_DIR, { recursive: true });
}

function pcmToWav(pcmBuffer, sampleRate = 24000, numChannels = 1, bitsPerSample = 16) {
  const byteRate = (sampleRate * numChannels * bitsPerSample) / 8;
  const blockAlign = (numChannels * bitsPerSample) / 8;
  const dataSize = pcmBuffer.length;
  const header = Buffer.alloc(44);

  // RIFF identifier
  header.write("RIFF", 0);
  header.writeUInt32LE(36 + dataSize, 4);
  header.write("WAVE", 8);
  header.write("fmt ", 12);
  header.writeUInt32LE(16, 16);
  header.writeUInt16LE(1, 20);
  header.writeUInt16LE(numChannels, 22);
  header.writeUInt32LE(sampleRate, 24);
  header.writeUInt32LE(byteRate, 28);
  header.writeUInt16LE(blockAlign, 32);
  header.writeUInt16LE(bitsPerSample, 34);
  header.write("data", 36);
  header.writeUInt32LE(dataSize, 40);

  return Buffer.concat([header, pcmBuffer]);
}

export function textToSlug(text) {
  return text
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '')
    .slice(0, 60);
}

// Brazilian Portuguese letter phonetic names
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

export const CORE_PHRASES = [
  // Letters
  ...Object.entries(PT_LETTER_NAMES).flatMap(([letter, phonetic]) => [
    { key: `letra_${letter.toLowerCase()}`, text: phonetic },
    { key: `proxima_letra_${letter.toLowerCase()}`, text: `A próxima letra é: ${phonetic}!` }
  ]),
  // Numbers 1-6 for counting
  { key: 'contar_1', text: 'Um!' },
  { key: 'contar_2', text: 'Dois!' },
  { key: 'contar_3', text: 'Três!' },
  { key: 'contar_4', text: 'Quatro!' },
  { key: 'contar_5', text: 'Cinco!' },
  { key: 'contar_6', text: 'Seis!' },
  // Common celebrations and feedbacks
  { key: 'parabens_acertou', text: 'Muito bem! Resposta correta!' },
  { key: 'tente_de_novo', text: 'Tente de novo! Você consegue!' },
  { key: 'modo_letras', text: 'Modo Letras e Palavras!' },
  { key: 'modo_matematica', text: 'Modo Matemática!' },
  { key: 'fase_3_5', text: 'Fase 3 a 5 anos! Bem-vindos pequenos!' },
  { key: 'fase_6_8', text: 'Fase 6 a 8 anos! Vamos praticar!' },
  { key: 'fase_9_11', text: 'Fase 9 a 11 anos! Desafios incríveis!' },
  { key: 'fase_12_14', text: 'Fase 12 a 14 anos! Modo expert!' },
  { key: 'teste_kore', text: 'Olá amiguinho! Estou muito feliz em aprender com você no Soletrando e Calculando!' }
];

export const WORDS = [
  // 3-5
  'BOLA', 'GATO', 'CASA', 'SOL', 'PATO', 'PEIXE', 'DADO', 'URSO', 'LUA', 'SAPO', 'MAMA', 'PAPA',
  // 6-8
  'ESCOLA', 'PIPOCA', 'JANELA', 'AMIZADE', 'FOGUETE', 'CANETA', 'CAVALO', 'ESTRELA', 'JARDIM',
  // 9-11
  'DINOSSAURO', 'AVENTURA', 'UNIVERSO', 'CORAGEM', 'NATUREZA', 'BRILHANTE', 'BORBOLETA', 'PLANETA',
  // 12-14
  'METAFORA', 'CONSCIENCIA', 'PARADOXO', 'ATMOSFERA', 'HIPOTESE', 'LABIRINTO', 'RESILIENCIA', 'FILOSOFIA'
];

async function generateAudio(ai, text) {
  const response = await ai.models.generateContent({
    model: "gemini-2.5-flash-preview-tts",
    contents: [{ parts: [{ text: text.trim() }] }],
    config: {
      responseModalities: [Modality.AUDIO],
      speechConfig: {
        voiceConfig: {
          prebuiltVoiceConfig: { voiceName: "Kore" }
        }
      }
    }
  });

  const audioPart = response.candidates?.[0]?.content?.parts?.find(p => p.inlineData?.data);
  if (!audioPart?.inlineData?.data) {
    throw new Error("No audio returned");
  }

  const pcmBuffer = Buffer.from(audioPart.inlineData.data, 'base64');
  return pcmToWav(pcmBuffer, 24000, 1, 16);
}

async function run() {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    console.error("GEMINI_API_KEY required");
    process.exit(1);
  }

  const ai = new GoogleGenAI({ apiKey });
  const manifest = {};
  
  // Load existing manifest if present
  if (fs.existsSync(MANIFEST_PATH)) {
    try {
      Object.assign(manifest, JSON.parse(fs.readFileSync(MANIFEST_PATH, 'utf8')));
    } catch {}
  }

  const queue = [
    ...CORE_PHRASES,
    ...WORDS.flatMap(w => {
      const formatted = w.charAt(0).toUpperCase() + w.slice(1).toLowerCase();
      const slug = textToSlug(w);
      return [
        { key: `palavra_${slug}`, text: `Palavra: ${formatted}!` },
        { key: `completou_${slug}`, text: `Muito bem! Você completou a palavra ${formatted}!` }
      ];
    })
  ];

  console.log(`Starting pre-generation of ${queue.length} phrases...`);

  let count = 0;
  for (const item of queue) {
    const filename = `${item.key}.wav`;
    const filePath = path.join(OUTPUT_DIR, filename);
    const webPath = `/audio/kore/${filename}`;

    manifest[item.key] = {
      text: item.text,
      path: webPath
    };

    if (fs.existsSync(filePath) && fs.statSync(filePath).size > 1000) {
      // Already generated
      continue;
    }

    try {
      count++;
      process.stdout.write(`[${count}] Generating ${item.key}: "${item.text}"... `);
      const wav = await generateAudio(ai, item.text);
      fs.writeFileSync(filePath, wav);
      console.log(`OK (${wav.length} bytes)`);
      // Short pause to avoid rate limits
      await new Promise(r => setTimeout(r, 450));
    } catch (e) {
      console.log(`FAILED: ${e.message}`);
      await new Promise(r => setTimeout(r, 1500));
    }
  }

  // Ensure lib directory exists
  const libDir = path.dirname(MANIFEST_PATH);
  if (!fs.existsSync(libDir)) {
    fs.mkdirSync(libDir, { recursive: true });
  }

  fs.writeFileSync(MANIFEST_PATH, JSON.stringify(manifest, null, 2), 'utf8');
  console.log(`\nAll done! Audio manifest written to ${MANIFEST_PATH}`);
}

run();
