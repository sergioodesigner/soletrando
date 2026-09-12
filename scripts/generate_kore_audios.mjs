import { GoogleGenAI, Modality } from '@google/genai';
import fs from 'node:fs';
import path from 'node:path';
import { execSync } from 'node:child_process';

const OUTPUT_DIR = path.resolve(process.cwd(), 'public/audio/recorded');
const TRACKER_FILE = path.resolve(process.cwd(), 'public/audio/recorded/.kore_audios.json');

if (!fs.existsSync(OUTPUT_DIR)) {
  fs.mkdirSync(OUTPUT_DIR, { recursive: true });
}

let completedKore = {};
if (fs.existsSync(TRACKER_FILE)) {
  try {
    completedKore = JSON.parse(fs.readFileSync(TRACKER_FILE, 'utf8'));
  } catch {
    completedKore = {};
  }
}

function saveTracker() {
  fs.writeFileSync(TRACKER_FILE, JSON.stringify(completedKore, null, 2), 'utf8');
}

function pcmToWav(pcmBuffer, sampleRate = 24000, numChannels = 1, bitsPerSample = 16) {
  const byteRate = (sampleRate * numChannels * bitsPerSample) / 8;
  const blockAlign = (numChannels * bitsPerSample) / 8;
  const dataSize = pcmBuffer.length;
  const header = Buffer.alloc(44);

  header.write('RIFF', 0);
  header.writeUInt32LE(36 + dataSize, 4);
  header.write('WAVE', 8);

  header.write('fmt ', 12);
  header.writeUInt32LE(16, 16);
  header.writeUInt16LE(1, 20);
  header.writeUInt16LE(numChannels, 22);
  header.writeUInt32LE(sampleRate, 24);
  header.writeUInt32LE(byteRate, 28);
  header.writeUInt16LE(blockAlign, 32);
  header.writeUInt16LE(bitsPerSample, 34);

  header.write('data', 36);
  header.writeUInt32LE(dataSize, 40);

  return Buffer.concat([header, pcmBuffer]);
}

const ai = new GoogleGenAI({
  apiKey: process.env.GEMINI_API_KEY,
  httpOptions: { headers: { 'User-Agent': 'aistudio-build' } }
});

// Priority list: First focus on main words and key celebrations
export const PRIORITY_ITEMS = [
  // Key celebrations & feedbacks
  { key: 'muito_bem', text: 'Muito bem!' },
  { key: 'excelente', text: 'Excelente trabalho!' },
  { key: 'tente_de_novo', text: 'Tente de novo! Você consegue!' },
  { key: 'fase_concluida', text: 'Parabéns! Você completou esta fase!' },

  // Words 3-5 years (Primary words)
  { key: 'palavra_bola', text: 'Palavra: Bola!' },
  { key: 'completou_bola', text: 'Muito bem! Você completou a palavra Bola!' },
  { key: 'palavra_gato', text: 'Palavra: Gato!' },
  { key: 'completou_gato', text: 'Muito bem! Você completou a palavra Gato!' },
  { key: 'palavra_casa', text: 'Palavra: Casa!' },
  { key: 'completou_casa', text: 'Muito bem! Você completou a palavra Casa!' },
  { key: 'palavra_sol', text: 'Palavra: Sol!' },
  { key: 'completou_sol', text: 'Muito bem! Você completou a palavra Sol!' },
  { key: 'palavra_pato', text: 'Palavra: Pato!' },
  { key: 'completou_pato', text: 'Muito bem! Você completou a palavra Pato!' },
  { key: 'palavra_peixe', text: 'Palavra: Peixe!' },
  { key: 'completou_peixe', text: 'Muito bem! Você completou a palavra Peixe!' },
  { key: 'palavra_dado', text: 'Palavra: Dado!' },
  { key: 'completou_dado', text: 'Muito bem! Você completou a palavra Dado!' },
  { key: 'palavra_urso', text: 'Palavra: Urso!' },
  { key: 'completou_urso', text: 'Muito bem! Você completou a palavra Urso!' },
  { key: 'palavra_lua', text: 'Palavra: Lua!' },
  { key: 'completou_lua', text: 'Muito bem! Você completou a palavra Lua!' },
  { key: 'palavra_sapo', text: 'Palavra: Sapo!' },
  { key: 'completou_sapo', text: 'Muito bem! Você completou a palavra Sapo!' },
  { key: 'palavra_mama', text: 'Palavra: Mamãe!' },
  { key: 'completou_mama', text: 'Muito bem! Você completou a palavra Mamãe!' },
  { key: 'palavra_papa', text: 'Palavra: Papai!' },
  { key: 'completou_papa', text: 'Muito bem! Você completou a palavra Papai!' },

  // Words 6-8 years
  { key: 'palavra_escola', text: 'Palavra: Escola!' },
  { key: 'completou_escola', text: 'Muito bem! Você completou a palavra Escola!' },
  { key: 'palavra_pipoca', text: 'Palavra: Pipoca!' },
  { key: 'completou_pipoca', text: 'Muito bem! Você completou a palavra Pipoca!' },
  { key: 'palavra_janela', text: 'Palavra: Janela!' },
  { key: 'completou_janela', text: 'Muito bem! Você completou a palavra Janela!' },
  { key: 'palavra_amizade', text: 'Palavra: Amizade!' },
  { key: 'completou_amizade', text: 'Muito bem! Você completou a palavra Amizade!' },
  { key: 'palavra_foguete', text: 'Palavra: Foguete!' },
  { key: 'completou_foguete', text: 'Muito bem! Você completou a palavra Foguete!' },
  { key: 'palavra_caneta', text: 'Palavra: Caneta!' },
  { key: 'completou_caneta', text: 'Muito bem! Você completou a palavra Caneta!' },
  { key: 'palavra_cavalo', text: 'Palavra: Cavalo!' },
  { key: 'completou_cavalo', text: 'Muito bem! Você completou a palavra Cavalo!' },
  { key: 'palavra_estrela', text: 'Palavra: Estrela!' },
  { key: 'completou_estrela', text: 'Muito bem! Você completou a palavra Estrela!' },
  { key: 'palavra_jardim', text: 'Palavra: Jardim!' },
  { key: 'completou_jardim', text: 'Muito bem! Você completou a palavra Jardim!' }
];

async function generateSingle(item) {
  const wavTempPath = path.join(OUTPUT_DIR, `_temp_${item.key}.wav`);
  const finalMp3Path = path.join(OUTPUT_DIR, `${item.key}.mp3`);

  const res = await ai.models.generateContent({
    model: 'gemini-3.1-flash-tts-preview',
    contents: [{ parts: [{ text: item.text }] }],
    config: {
      responseModalities: [Modality.AUDIO],
      speechConfig: {
        voiceConfig: {
          prebuiltVoiceConfig: { voiceName: 'Kore' }
        }
      }
    }
  });

  const part = res.candidates?.[0]?.content?.parts?.find(p => p.inlineData?.data);
  if (!part?.inlineData?.data) {
    throw new Error('No audio data received from Gemini');
  }

  const pcm = Buffer.from(part.inlineData.data, 'base64');
  const wav = pcmToWav(pcm);
  fs.writeFileSync(wavTempPath, wav);

  // Convert to high quality 128k MP3
  execSync(`ffmpeg -y -i "${wavTempPath}" -b:a 128k "${finalMp3Path}" 2>/dev/null`);

  // Clean up temporary wav
  if (fs.existsSync(wavTempPath)) {
    fs.unlinkSync(wavTempPath);
  }

  completedKore[item.key] = true;
  saveTracker();
}

async function main() {
  console.log(`Starting Kore generation for ${PRIORITY_ITEMS.length} priority items...`);
  
  // Mark parabens_acertou as already generated with Kore
  completedKore['parabens_acertou'] = true;
  saveTracker();

  let count = 0;
  for (let i = 0; i < PRIORITY_ITEMS.length; i++) {
    const item = PRIORITY_ITEMS[i];
    if (completedKore[item.key]) {
      console.log(`[${i + 1}/${PRIORITY_ITEMS.length}] Already completed: ${item.key}`);
      continue;
    }

    let success = false;
    let attempts = 0;

    while (!success && attempts < 4) {
      attempts++;
      try {
        console.log(`[${i + 1}/${PRIORITY_ITEMS.length}] Generating with Kore: ${item.key} ("${item.text}")...`);
        await generateSingle(item);
        console.log(`-> SUCCESS: ${item.key}.mp3 saved with Kore voice!`);
        success = true;
        count++;

        // Pace requests: 22 seconds delay to strictly stay under 3 requests/minute (3 RPM)
        console.log('Pacing: waiting 22s for next request to respect rate limits...');
        await new Promise(r => setTimeout(r, 22000));
      } catch (err) {
        console.warn(`Attempt ${attempts} failed for ${item.key}:`, err.message);
        if (err.message.includes('429') || err.message.includes('quota') || err.message.includes('RESOURCE_EXHAUSTED')) {
          console.log('Hit 429 rate limit. Pausing 35 seconds to let quota window reset...');
          await new Promise(r => setTimeout(r, 35000));
        } else {
          await new Promise(r => setTimeout(r, 5000));
        }
      }
    }
  }

  console.log(`All done! ${count} items processed with genuine Gemini Kore timbre.`);
}

main().catch(err => {
  console.error('Fatal script error:', err);
  process.exit(1);
});
