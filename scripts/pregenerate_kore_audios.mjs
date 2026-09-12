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

// Letter phonetics in Brazilian Portuguese
const PT_LETTER_NAMES = {
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

const WORDS_DATA = [
  // 3-5 anos
  { word: 'Bola' },
  { word: 'Gato' },
  { word: 'Casa' },
  { word: 'Sol' },
  { word: 'Pato' },
  { word: 'Peixe' },
  { word: 'Dado' },
  { word: 'Urso' },
  { word: 'Lua' },
  { word: 'Sapo' },
  { word: 'Mama' },
  { word: 'Papa' },

  // 6-8 anos
  { word: 'Escola', clue: 'Lugar onde aprendemos e brincamos' },
  { word: 'Pipoca', clue: 'Lanche crocante que estoura na panela' },
  { word: 'Janela', clue: 'Abre para ver a luz do sol e o vento' },
  { word: 'Amizade', clue: 'O carinho sincero entre amigos' },
  { word: 'Foguete', clue: 'Voa alto em direção às estrelas' },
  { word: 'Caneta', clue: 'Usada para escrever no caderno' },
  { word: 'Cavalo', clue: 'Animal forte e veloz' },
  { word: 'Estrela', clue: 'Brilha no céu durante a noite' },
  { word: 'Jardim', clue: 'Cheio de flores e plantas coloridas' },

  // 9-11 anos
  { word: 'Dinossauro', clue: 'Criaturas gigantes que habitaram a Terra no passado' },
  { word: 'Aventura', clue: 'Uma emocionante viagem cheia de desafios' },
  { word: 'Universo', clue: 'A imensidão com todos os planetas e galáxias' },
  { word: 'Coragem', clue: 'Força interior para enfrentar o desconhecido' },
  { word: 'Natureza', clue: 'O conjunto de florestas, rios, oceanos e animais' },
  { word: 'Brilhante', clue: 'Algo que reflete muita luz ou alguém muito inteligente' },
  { word: 'Borboleta', clue: 'Inseto gracioso que passa por metamorfose' },
  { word: 'Planeta', clue: 'Corpo celeste como a Terra, Marte ou Júpiter' },

  // 12-14 anos
  { word: 'Metafora', clue: 'Figura de linguagem com comparação implícita' },
  { word: 'Consciencia', clue: 'Capacidade humana de perceber e julgar a própria mente' },
  { word: 'Paradoxo', clue: 'Ideia que desafia a lógica comum com sentidos opostos' },
  { word: 'Atmosfera', clue: 'Camada de gases que envolve e protege nosso planeta' },
  { word: 'Hipotese', clue: 'Suposição formulada para ser comprovada por experimentos' },
  { word: 'Labirinto', clue: 'Estrutura complexa de caminhos que desafia o raciocínio' },
  { word: 'Resiliencia', clue: 'Habilidade de se adaptar e superar momentos difíceis' },
  { word: 'Filosofia', clue: 'Investigação profunda sobre a existência, mente e verdade' }
];

const MATH_DATA = [
  // 3-5
  { id: 'm3-1', text: 'Quantas maçãs você vê? Toque nas maçãs para contar!', hint: 'Toque em cada maçã para contar: 1, 2, 3!' },
  { id: 'm3-2', text: 'Quantas estrelinhas estão brilhando? Vamos contar!', hint: 'Conte devagarzinho: 1, 2, 3, 4, 5 estrelas!' },
  { id: 'm3-3', text: 'Quantos carrinhos você vê aqui na tela?', hint: 'Tem 1 e depois 2!' },
  { id: 'm3-4', text: 'Quantos balões coloridos estão flutuando?', hint: 'São quatro balões: 1, 2, 3, 4!' },
  { id: 'm3-5', text: 'Dois gatinhos mais um gatinho. Quantos gatinhos ficam?', hint: 'Junte 2 gatinhos com mais 1 gatinho = 3 gatinhos!' },
  { id: 'm3-6', text: 'Um cachorrinho mais um cachorrinho. Quanto dá?', hint: '1 mais 1 é igual a 2!' },
  { id: 'm3-7', text: 'Quantos sóis você vê?', hint: 'Temos apenas um sol radiante!' },

  // 6-8
  { id: 'm6-1', text: 'Quanto é 5 mais 4?', hint: 'Pense: 5 mais 5 é 10, então 5 mais 4 é 9!' },
  { id: 'm6-2', text: 'Quanto é 8 mais 7?', hint: '8 mais 2 é 10, com mais 5 dá 15!' },
  { id: 'm6-3', text: 'Se você tem 10 e tira 4, quanto sobra?', hint: 'Conte voltando de 10 tirando 4: 9, 8, 7, 6!' },
  { id: 'm6-4', text: 'Quanto é 14 menos 6?', hint: '14 menos 4 é 10, menos 2 é 8!' },
  { id: 'm6-5', text: 'Complete a sequência de 2 em 2: 2, 4, 6, e o próximo é?', hint: 'Estamos contando de 2 em 2. Depois de 6 vem o 8!' },
  { id: 'm6-6', text: 'Se você já tem 7, quantos faltam para chegar no 10?', hint: '7 mais 3 dá 10!' },
  { id: 'm6-7', text: 'Qual é o dobro de 6? 6 mais 6!', hint: '6 mais 6 é uma dúzia: 12!' },

  // 9-11
  { id: 'm9-1', text: 'Quanto é 7 vezes 8?', hint: 'Lembre-se da tabuada: 7 vezes 7 é 49. Some mais 7 e terá 56!' },
  { id: 'm9-2', text: 'Quanto é 6 vezes 9?', hint: '6 vezes 10 é 60. Subtraia 6 e você terá 54!' },
  { id: 'm9-3', text: 'Quanto é 48 dividido por 6?', hint: 'Qual número multiplicado por 6 dá 48? É o 8!' },
  { id: 'm9-4', text: 'Quanto é 72 dividido por 9?', hint: 'Pense: 9 vezes quanto é igual a 72? É o 8!' },
  { id: 'm9-5', text: 'Quanto é 45 mais 38?', hint: '45 mais 30 dá 75, mais 8 resulta em 83!' },
  { id: 'm9-6', text: 'Quanto é 100 menos 37?', hint: '100 menos 30 dá 70. 70 menos 7 dá 63!' },
  { id: 'm9-7', text: 'Qual é o dobro de 18?', hint: '18 vezes 2: 10x2=20 mais 8x2=16 -> 36!' },

  // 12-14
  { id: 'm12-1', text: 'Se x mais 9 é igual a 24, qual é o valor de x?', hint: 'Isole o x: subtraia 9 de 24. x = 24 - 9 = 15!' },
  { id: 'm12-2', text: 'Quanto é vinte e cinco por cento de oitenta?', hint: '25% é o mesmo que dividir por 4. 80 ÷ 4 = 20!' },
  { id: 'm12-3', text: 'Qual o valor de 3 elevado a 3?', hint: 'Multiplique 3 por ele mesmo 3 vezes: 3 × 3 = 9, e 9 × 3 = 27!' },
  { id: 'm12-4', text: 'Qual é a raiz quadrada de 144?', hint: 'Qual número multiplicado por ele mesmo dá 144? 12 × 12 = 144!' },
  { id: 'm12-5', text: 'Quanto é a fração um meio mais um quarto?', hint: '1/2 equivale a 2/4. Somando 2/4 + 1/4 obtemos 3/4!' },
  { id: 'm12-6', text: 'Se 2x menos 4 é igual a 16, qual é o valor de x?', hint: 'Some 4 aos dois lados: 2x = 20. Divida por 2: x = 10!' },
  { id: 'm12-7', text: 'Se 3 livros custam 15 reais, quanto custam 6 livros?', hint: '6 livros é o dobro de 3, logo o preço é o dobro de 15: R$ 30!' }
];

export function buildPhraseCatalog() {
  const map = new Map();

  function add(key, text) {
    if (!map.has(key)) {
      map.set(key, text);
    }
  }

  // 1. Letters individual pronunciations
  for (const [letter, phonetic] of Object.entries(PT_LETTER_NAMES)) {
    add(`letra_${letter.toLowerCase()}`, phonetic);
    add(`proxima_letra_${letter.toLowerCase()}`, `A próxima letra é: ${phonetic}!`);
  }

  // 2. Counting numbers
  const COUNT_WORDS = ['Um!', 'Dois!', 'Três!', 'Quatro!', 'Cinco!', 'Seis!'];
  COUNT_WORDS.forEach((w, idx) => {
    add(`contar_${idx + 1}`, w);
  });

  // 3. UI & Global phrases
  add('fase_3_5', 'Fase 3 a 5 anos! Bem-vindo!');
  add('fase_6_8', 'Fase 6 a 8 anos! Vamos aprender!');
  add('fase_9_11', 'Fase 9 a 11 anos! Desafios incríveis!');
  add('fase_12_14', 'Fase 12 a 14 anos! Modo avançado!');
  add('modo_letras', 'Modo Letras e Palavras!');
  add('modo_matematica', 'Modo Matemática!');
  add('intro_test', 'Olá amiguinho! Estou muito feliz em aprender com você no Soletrando e Calculando!');
  add('acertou_geral', 'Parabéns! Resposta correta!');
  add('tente_novamente', 'Tente novamente! Você consegue!');

  // 4. Preset Words
  for (const item of WORDS_DATA) {
    const slug = textToSlug(item.word);
    add(`palavra_${slug}`, `Palavra: ${item.word}!`);
    add(`completou_${slug}`, `Muito bem! Você completou a palavra ${item.word}!`);

    if (item.clue) {
      add(`pista_${slug}`, `Pista: ${item.clue}`);
      add(`desafio_${slug}`, `Desafio de Soletrar! Pista: ${item.clue}. Qual é a palavra? É ${item.word}! Toque nas letras para soletrar.`);
    } else {
      add(`desafio_${slug}`, `Desafio de Soletrar! Soletre a palavra: ${item.word}! Toque nas letras na ordem certa para formar a palavra.`);
    }
  }

  // 5. Math problems
  for (const p of MATH_DATA) {
    add(`math_q_${p.id}`, p.text);
    add(`math_hint_${p.id}`, `Dica: ${p.hint}`);
  }

  return map;
}

async function run() {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    console.error("No GEMINI_API_KEY available.");
    process.exit(1);
  }

  const ai = new GoogleGenAI({ apiKey });
  const phrases = buildPhraseCatalog();
  console.log(`Total phrases to process: ${phrases.size}`);

  const manifest = {};
  let generated = 0;
  let skipped = 0;
  let errors = 0;

  for (const [key, text] of phrases.entries()) {
    const filePath = path.join(OUTPUT_DIR, `${key}.wav`);
    const webPath = `/audio/kore/${key}.wav`;
    manifest[key] = { text, path: webPath };

    if (fs.existsSync(filePath) && fs.statSync(filePath).size > 1000) {
      skipped++;
      continue;
    }

    try {
      console.log(`[${generated + skipped + 1}/${phrases.size}] Generating '${key}': "${text}"...`);
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
      if (audioPart?.inlineData?.data) {
        const rawPcm = Buffer.from(audioPart.inlineData.data, 'base64');
        const wavBuffer = pcmToWav(rawPcm, 24000, 1, 16);
        fs.writeFileSync(filePath, wavBuffer);
        generated++;
        console.log(`  -> Saved ${filePath} (${wavBuffer.length} bytes)`);
      } else {
        console.warn(`  -> No audio data returned for ${key}`);
        errors++;
      }

      // Small delay between calls to respect rate limits
      await new Promise(r => setTimeout(r, 650));
    } catch (err) {
      console.error(`  -> Error generating ${key}:`, err.message);
      errors++;
      // Wait a bit on error
      await new Promise(r => setTimeout(r, 2000));
    }
  }

  fs.writeFileSync(MANIFEST_PATH, JSON.stringify(manifest, null, 2), 'utf8');
  console.log(`Done! Generated: ${generated}, Skipped: ${skipped}, Errors: ${errors}`);
}

run();
