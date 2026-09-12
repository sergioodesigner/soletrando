import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const OUTPUT_DIR = path.resolve(process.cwd(), 'public/audio/recorded');

if (!fs.existsSync(OUTPUT_DIR)) {
  fs.mkdirSync(OUTPUT_DIR, { recursive: true });
}

export const PT_LETTER_NAMES = {
  A: 'A',
  B: 'B',
  C: 'C',
  D: 'D',
  E: 'E',
  F: 'F',
  G: 'G',
  H: 'H',
  I: 'I',
  J: 'J',
  K: 'K',
  L: 'L',
  M: 'M',
  N: 'N',
  O: 'O',
  P: 'P',
  Q: 'Q',
  R: 'R',
  S: 'S',
  T: 'T',
  U: 'U',
  V: 'V',
  W: 'W',
  X: 'X',
  Y: 'Y',
  Z: 'Z'
};

export const WORDS_WITH_CLUES = [
  // 3-5
  { word: 'BOLA', clue: 'Brinquedo redondo que usamos para chutar ou jogar' },
  { word: 'GATO', clue: 'Animal de estimação fofinho que faz miau' },
  { word: 'CASA', clue: 'Lugar quentinho onde moramos com a nossa família' },
  { word: 'SOL', clue: 'Estrela brilhante que ilumina o nosso dia' },
  { word: 'PATO', clue: 'Ave que nada na lagoa e faz quá-quá' },
  { word: 'PEIXE', clue: 'Animal que vive nadando na água do mar e do rio' },
  { word: 'DADO', clue: 'Objeto de seis lados com pontinhos para jogos' },
  { word: 'URSO', clue: 'Animal peludo e forte que gosta de mel' },
  { word: 'LUA', clue: 'Brilha linda no céu durante a noite' },
  { word: 'SAPO', clue: 'Animal verdinho que pula na lagoa e faz coaxar' },
  { word: 'MAMA', clue: 'Pessoa cheia de carinho que cuida de nós' },
  { word: 'PAPA', clue: 'Pessoa especial que brinca e cuida da gente' },
  // 6-8
  { word: 'ESCOLA', clue: 'Lugar onde aprendemos e brincamos' },
  { word: 'PIPOCA', clue: 'Lanche crocante que estoura na panela' },
  { word: 'JANELA', clue: 'Abre para ver a luz do sol e o vento' },
  { word: 'AMIZADE', clue: 'O carinho sincero entre amigos' },
  { word: 'FOGUETE', clue: 'Voa alto em direção às estrelas' },
  { word: 'CANETA', clue: 'Usada para escrever no caderno' },
  { word: 'CAVALO', clue: 'Animal forte e veloz' },
  { word: 'ESTRELA', clue: 'Brilha no céu durante a noite' },
  { word: 'JARDIM', clue: 'Cheio de flores e plantas coloridas' },
  // 9-11
  { word: 'DINOSSAURO', clue: 'Criaturas gigantes que habitaram a Terra no passado' },
  { word: 'AVENTURA', clue: 'Uma emocionante viagem cheia de desafios' },
  { word: 'UNIVERSO', clue: 'A imensidão com todos os planetas e galáxias' },
  { word: 'CORAGEM', clue: 'Força interior para enfrentar o desconhecido' },
  { word: 'NATUREZA', clue: 'O conjunto de florestas, rios, oceanos e animais' },
  { word: 'BRILHANTE', clue: 'Algo que reflete muita luz ou muito inteligente' },
  { word: 'BORBOLETA', clue: 'Inseto gracioso que passa por metamorfose' },
  { word: 'PLANETA', clue: 'Corpo celeste como a Terra, Marte ou Júpiter' },
  // 12-14
  { word: 'METAFORA', clue: 'Figura de linguagem com comparação implícita' },
  { word: 'CONSCIENCIA', clue: 'Capacidade de perceber e julgar a própria mente' },
  { word: 'PARADOXO', clue: 'Ideia que desafia a lógica comum com sentidos opostos' },
  { word: 'ATMOSFERA', clue: 'Camada de gases que envolve e protege nosso planeta' },
  { word: 'HIPOTESE', clue: 'Suposição formulada para ser comprovada por experimentos' },
  { word: 'LABIRINTO', clue: 'Estrutura complexa de caminhos que desafia o raciocínio' },
  { word: 'RESILIENCIA', clue: 'Habilidade de se adaptar e superar momentos difíceis' },
  { word: 'FILOSOFIA', clue: 'Investigação profunda sobre a existência, mente e verdade' }
];

export const MATH_ITEMS = [
  // 3-5
  { id: 'm3-1', question: 'Quantas maçãs você vê? Toque nas maçãs para contar!', hint: 'Toque em cada maçã para contar: 1, 2, 3!' },
  { id: 'm3-2', question: 'Quantas estrelinhas estão brilhando? Vamos contar!', hint: 'Conte devagarzinho: 1, 2, 3, 4, 5 estrelas!' },
  { id: 'm3-3', question: 'Quantos carrinhos você vê aqui na tela?', hint: 'Tem 1 e depois 2!' },
  { id: 'm3-4', question: 'Quantos balões coloridos estão flutuando?', hint: 'São quatro balões: 1, 2, 3, 4!' },
  { id: 'm3-5', question: 'Dois gatinhos mais um gatinho. Quantos gatinhos ficam?', hint: 'Junte 2 gatinhos com mais 1 gatinho, igual a 3 gatinhos!' },
  { id: 'm3-6', question: 'Um cachorrinho mais um cachorrinho. Quanto dá?', hint: '1 mais 1 é igual a 2!' },
  { id: 'm3-7', question: 'Quantos sóis você vê no céu?', hint: 'Temos apenas um sol radiante!' },

  // 6-8
  { id: 'm6-1', question: 'Quanto é 5 mais 4?', hint: '5 mais 5 é 10, então 5 mais 4 é 9!' },
  { id: 'm6-2', question: 'Quanto é 8 mais 7?', hint: '8 mais 2 é 10, com mais 5 dá 15!' },
  { id: 'm6-3', question: 'Se você tem 10 e tira 4, quanto sobra?', hint: 'Conte voltando de 10 tirando 4: 9, 8, 7, 6!' },
  { id: 'm6-4', question: 'Quanto é 14 menos 6?', hint: '14 menos 4 é 10, menos 2 é 8!' },
  { id: 'm6-5', question: 'Complete a sequência de 2 em 2: 2, 4, 6, e o próximo?', hint: 'Estamos contando de 2 em 2. Depois de 6 vem o 8!' },
  { id: 'm6-6', question: 'Se você tem 7, quantos faltam para chegar no 10?', hint: '7 mais 3 dá 10!' },
  { id: 'm6-7', question: 'Qual é o dobro de 6? 6 mais 6!', hint: '6 mais 6 é uma dúzia: 12!' },

  // 9-11
  { id: 'm9-1', question: 'Quanto é 7 vezes 8?', hint: '7 vezes 7 é 49. Some mais 7 e terá 56!' },
  { id: 'm9-2', question: 'Quanto é 6 vezes 9?', hint: '6 vezes 10 é 60. Subtraia 6 e você terá 54!' },
  { id: 'm9-3', question: 'Quanto é 48 dividido por 6?', hint: 'Qual número multiplicado por 6 dá 48? É o 8!' },
  { id: 'm9-4', question: 'Quanto é 72 dividido por 9?', hint: '9 vezes quanto é igual a 72? É o 8!' },
  { id: 'm9-5', question: 'Quanto é 45 mais 38?', hint: '45 mais 30 dá 75, mais 8 resulta em 83!' },
  { id: 'm9-6', question: 'Quanto é 100 menos 37?', hint: '100 menos 30 dá 70. 70 menos 7 dá 63!' },
  { id: 'm9-7', question: 'Qual é o dobro de 18?', hint: '18 vezes 2 é igual a 36!' },

  // 12-14
  { id: 'm12-1', question: 'Se x mais 9 é igual a 24, qual é o valor de x?', hint: 'Subtraia 9 de 24. x é igual a 15!' },
  { id: 'm12-2', question: 'Quanto é vinte e cinco por cento de oitenta?', hint: '25% é o mesmo que dividir por 4. 80 dividido por 4 é 20!' },
  { id: 'm12-3', question: 'Qual o valor de 3 elevado a 3?', hint: 'Multiplique 3 por ele mesmo 3 vezes: 3 vezes 3 é 9, vezes 3 é 27!' },
  { id: 'm12-4', question: 'Qual é a raiz quadrada de 144?', hint: '12 vezes 12 é igual a 144!' },
  { id: 'm12-5', question: 'Quanto é a fração um meio mais um quarto?', hint: 'Um meio mais um quarto é igual a três quartos!' },
  { id: 'm12-6', question: 'Se 2x menos 4 é igual a 16, qual é o valor de x?', hint: '2x é igual a 20, então x é igual a 10!' },
  { id: 'm12-7', question: 'Se 3 livros custam 15 reais, quanto custam 6 livros?', hint: 'O dobro da quantidade é o dobro do valor: 30 reais!' }
];

export function textToSlug(text) {
  return text
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '')
    .slice(0, 60);
}

const ITEMS = [
  // 1. All 26 letters individually
  ...Object.entries(PT_LETTER_NAMES).map(([letter, phonetic]) => ({
    key: `letra_${letter.toLowerCase()}`,
    text: phonetic
  })),

  // 2. Next letter guidance
  ...Object.entries(PT_LETTER_NAMES).map(([letter, phonetic]) => ({
    key: `proxima_letra_${letter.toLowerCase()}`,
    text: `A próxima letra é ${phonetic}!`
  })),

  // 3. Counting numbers 1 to 10
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

  // 4. Celebrations and feedback
  { key: 'parabens_acertou', text: 'Muito bem! Resposta correta!' },
  { key: 'tente_de_novo', text: 'Tente de novo! Você consegue!' },
  { key: 'muito_bem', text: 'Muito bem!' },
  { key: 'excelente', text: 'Excelente!' },
  { key: 'fase_concluida', text: 'Parabéns, você concluiu a fase!' },

  // 5. Modes and age groups
  { key: 'modo_letras', text: 'Modo Letras e Palavras' },
  { key: 'modo_matematica', text: 'Modo Matemática' },
  { key: 'fase_3_5', text: 'Fase de três a cinco anos' },
  { key: 'fase_6_8', text: 'Fase de seis a oito anos' },
  { key: 'fase_9_11', text: 'Fase de nove a onze anos' },
  { key: 'fase_12_14', text: 'Fase de doze a quatorze anos' },

  // 6. Words pronunciation, challenge, clue & completion
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

  // 7. Math questions and hints
  ...MATH_ITEMS.flatMap(m => [
    { key: `math_pergunta_${m.id}`, text: m.question },
    { key: `math_dica_${m.id}`, text: m.hint }
  ])
];

async function fetchAudio(text) {
  const url = `https://translate.google.com/translate_tts?ie=UTF-8&tl=pt-BR&client=tw-ob&q=${encodeURIComponent(text)}`;
  const res = await fetch(url, {
    headers: {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
    }
  });
  if (!res.ok) {
    throw new Error(`HTTP ${res.status}`);
  }
  const arrayBuf = await res.arrayBuffer();
  return Buffer.from(arrayBuf);
}

async function main() {
  console.log(`Generating ${ITEMS.length} recorded audio files...`);
  const manifest = {};

  let successCount = 0;
  for (const item of ITEMS) {
    const filename = `${item.key}.mp3`;
    const filePath = path.join(OUTPUT_DIR, filename);
    const webPath = `/audio/recorded/${filename}`;

    manifest[item.key] = webPath;

    if (fs.existsSync(filePath) && fs.statSync(filePath).size > 500) {
      successCount++;
      continue;
    }

    try {
      const buffer = await fetchAudio(item.text);
      fs.writeFileSync(filePath, buffer);
      successCount++;
      process.stdout.write(`[${successCount}/${ITEMS.length}] Generated ${filename}\n`);
      // Small delay to be polite
      await new Promise(r => setTimeout(r, 120));
    } catch (err) {
      console.error(`Failed ${item.key}:`, err.message);
    }
  }

  // Also write the manifest directly to lib/recordedAudioManifest.json
  const manifestPath = path.resolve(process.cwd(), 'lib/recordedAudioManifest.json');
  fs.writeFileSync(manifestPath, JSON.stringify(manifest, null, 2), 'utf8');
  console.log(`Done! ${successCount} files saved. Manifest written to ${manifestPath}`);
}

// Only run when executed directly (not when imported by other scripts)
const isDirectRun =
  process.argv[1] &&
  path.resolve(process.argv[1]) === path.resolve(fileURLToPath(import.meta.url));
if (isDirectRun) {
  main();
}
