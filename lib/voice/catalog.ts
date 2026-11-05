// Catálogo de TODAS as falas do jogo (o que precisa ser gravado), por personagem.
// Usado por scripts/voice/export-catalog.ts → scripts/voice/catalog.json → gerador de áudio.
// Sem React/Next. Se o jogo ganhar uma fala nova, ela entra aqui (ou aparece em "Falas sem áudio" nas
// configurações do jogo, que gera a lista para scripts/voice/extra.json).

import { INITIAL_WORDS, MATH_PROBLEMS, formatWordForSpeech } from '../game/data';
import { MEM_LETRAS, NUM_M, WORD_BANK, allMathItems } from '../game/content';
import { COACH_STEPS } from '../game/coach';
import { ALLY_LINES, BOSS_OF, INTRO_TEMPLATES, STORIES } from '../game/story';
import { GREEK, ITEM_NAMES } from '../game/items';
import { WORLDS } from '../game/worlds';
import { SPEAKERS } from '../game/types';
import { FALLBACK_FACTS } from '../brain';
import { PT_LETTER_PHONETICS } from './letters';
import {
  PH, pCompletou, pDesafio, pDica2Paridade, pDicaBloqueia, pDicaParidade, pDicaTipo, pGanhou, pPalavra, pPista,
  pParabensResposta, pProximaLetra, pRespostaCerta, pSoletre,
} from './phrases';
import { speechFromTemplate, staticKeyId, textKey, voiceId } from './ids';

export interface CatalogEntry {
  /** Id do arquivo: `${speaker}_${hash do texto canônico}`. */
  id: string;
  /** Nome legível único (use em --only=). */
  label: string;
  group: string;
  speaker: string;
  /** Texto canônico (o que o jogo pede; pode ter {nome}). */
  text: string;
  /** O que realmente é enviado à voz (sem {nome}); pode ser trocado em scripts/voice/overrides.json. */
  say: string;
  /** Outras chaves que devem achar este áudio (nome antigo, letra crua…). */
  aliases: string[];
}

const slug = (s: string) =>
  s
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '')
    .slice(0, 36);

export function buildCatalog(): CatalogEntry[] {
  const byId = new Map<string, CatalogEntry>();
  const labels = new Set<string>();

  const add = (group: string, speaker: string, text: string, opts: { aliases?: string[]; label?: string; say?: string } = {}) => {
    const t = text.trim();
    if (!t) return;
    const id = voiceId(speaker, t);
    const existing = byId.get(id);
    if (existing) {
      for (const a of opts.aliases ?? []) if (!existing.aliases.includes(a)) existing.aliases.push(a);
      return;
    }
    let label = opts.label ?? `${group}:${slug(t)}`;
    if (labels.has(label)) label = `${label}_${id.slice(-4)}`;
    labels.add(label);
    byId.set(id, {
      id, label, group, speaker, text: t, say: opts.say ?? speechFromTemplate(t),
      aliases: [...(opts.aliases ?? [])],
    });
  };

  // ------------------------------------------------------------------ letras (Rufo)
  // Forma ESCRITA para a voz (o modelo lê com sotaque de inglês se receber "Bê" solto): vírgula + minúscula
  // + vogais acentuadas funcionaram nos testes de voz (voice:lab: "Letra, bê." / "Letra, á.").
  const VOGAL_ACENTO: Record<string, string> = { A: 'á', E: 'é', I: 'í', O: 'ó', U: 'ú' };
  for (const [L, phon] of Object.entries(PT_LETTER_PHONETICS)) {
    const l = L.toLowerCase();
    const spoken = VOGAL_ACENTO[L] ?? phon.toLowerCase();
    // Ajustes de pronúncia pedidos após ouvir os áudios
    const FALA_LETRA: Record<string, string> = {
      Z: 'Lêtra, zê.', Y: 'Lêtra, ípsilon.', X: 'Lêtra, xís.', W: 'Lêtra, dáblio.', I: 'Lêtra, í.',
      S: 'Letra, éssi.', R: 'Letra, érri.', N: 'Letra, éni.', J: 'Letra, Jóta.',
    };
    const FALA_PROX: Record<string, string> = { S: 'éssi', N: 'ení', M: 'emí', L: 'éli' };
    add('letras', 'fox', phon, { label: `letra_${l}`, say: FALA_LETRA[L] ?? `Letra, ${spoken}.`, aliases: [textKey(L), staticKeyId(`letra_${l}`)] });
    add('proxima_letra', 'fox', pProximaLetra(phon), { label: `proxima_letra_${l}`, say: `A próxima letra é ${FALA_PROX[L] ?? spoken}!`, aliases: [staticKeyId(`proxima_letra_${l}`)] });
  }

  // ------------------------------------------------------------------ palavras (Rufo)
  const words = new Map<string, string | undefined>(); // WORD -> pista (1ª encontrada)
  const pairs: { word: string; clue?: string }[] = [];
  for (const age of Object.keys(INITIAL_WORDS) as (keyof typeof INITIAL_WORDS)[]) {
    for (const w of INITIAL_WORDS[age]) pairs.push({ word: w.word, clue: w.clue });
  }
  for (const w of Object.values(WORD_BANK)) pairs.push({ word: w.word, clue: w.clue });
  for (const { word, clue } of pairs) {
    const f = formatWordForSpeech(word);
    const s = word.toLowerCase();
    words.set(word, clue ?? words.get(word));
    add('palavras', 'fox', pPalavra(f), { aliases: [staticKeyId(`palavra_${s}`)] });
    add('completou', 'fox', pCompletou(f), { aliases: [staticKeyId(`completou_${s}`)] });
    if (clue) {
      add('pistas', 'fox', pPista(clue), { aliases: [staticKeyId(`pista_${s}`)] });
      add('soletrar', 'fox', pSoletre(f, clue));
    }
    add('classico', 'fox', pDesafio(f, clue), { aliases: [staticKeyId(`desafio_${s}`)] });
  }

  // ------------------------------------------------------------------ fixas do soletrar (Rufo)
  add('dicas', 'fox', PH.pulaPalavra, { aliases: [staticKeyId('pula_palavra')] });
  add('dicas', 'fox', PH.dicaBrilhoTraco, { aliases: [staticKeyId('dica_brilho')] });
  add('dicas', 'fox', PH.dicaBrilho);
  add('dicas', 'fox', PH.tracadoOk, { aliases: [staticKeyId('dica_tracado_ok')] });
  for (const tipo of ['vogal', 'consoante'] as const) {
    add('dicas', 'fox', pDicaTipo(tipo), { aliases: [staticKeyId(`dica_tipo_${tipo}`)] });
    add('dicas', 'fox', pDicaBloqueia(tipo), { aliases: [staticKeyId(`dica_bloqueia_${tipo}`)] });
  }
  for (const sp of ['fox', 'owl']) add('dicas', sp, PH.parabens, { aliases: [staticKeyId('parabens_acertou')] });
  add('classico', 'fox', PH.modoLetras);
  add('classico', 'owl', PH.modoMatematica);
  add('classico', 'fox', PH.faixa35, { aliases: [staticKeyId('fase_3_5')] });
  add('classico', 'fox', PH.faixa68, { aliases: [staticKeyId('fase_6_8')] });
  add('classico', 'fox', PH.faixa911, { aliases: [staticKeyId('fase_9_11')] });
  add('classico', 'fox', PH.faixa1214, { aliases: [staticKeyId('fase_12_14')] });

  // ------------------------------------------------------------------ matemática (Sofia)
  const problems = [
    ...Object.values(MATH_PROBLEMS).flat().map((p) => ({ id: p.id, speech: p.speechText, hint: p.hint, answer: p.answer })),
    ...allMathItems().map((p) => ({ id: p.id, speech: p.speechText, hint: p.hint, answer: p.answer })),
  ];
  for (const p of problems) {
    add('matematica', 'owl', p.speech, { aliases: [staticKeyId(`math_pergunta_${p.id}`)] });
    if (p.hint) add('dicas_mat', 'owl', p.hint, { aliases: [staticKeyId(`math_dica_${p.id}`)] });
    add('matematica', 'owl', pParabensResposta(p.answer));
    add('dicas_mat', 'owl', pRespostaCerta(p.answer));
  }
  add('matematica', 'owl', PH.mathDepois);
  add('matematica', 'owl', PH.tenteDeNovo, { aliases: [staticKeyId('tente_de_novo')] });
  add('dicas_mat', 'owl', PH.mathInterativa, { aliases: [staticKeyId('dica_math_interativa')] });
  add('dicas_mat', 'owl', PH.mathElimina, { aliases: [staticKeyId('math_dica_elimina')] });
  add('dicas_mat', 'owl', PH.mathElimina2, { aliases: [staticKeyId('math_dica2_elimina')] });
  for (const tipo of ['par', 'impar'] as const) {
    add('dicas_mat', 'owl', pDicaParidade(tipo), { aliases: [staticKeyId(`math_dica_paridade_${tipo}`)] });
    add('dicas_mat', 'owl', pDica2Paridade(tipo), { aliases: [staticKeyId(`math_dica2_${tipo}`)] });
  }

  // ------------------------------------------------------------------ jogo (RPG): falas dos mascotes
  const mascotOf = (worldId: string) => WORLDS.find((w) => w.id === worldId)?.mascot ?? 'fox';
  for (const sp of ['fox', 'owl']) {
    add('jogo', sp, PH.aquiComVoce);
    add('jogo', sp, PH.faseTrancada);
    add('resultado', sp, PH.estrelas3);
    add('resultado', sp, PH.estrelas2);
    add('resultado', sp, PH.estrelas1);
    add('resultado', sp, PH.treinoPerfeito);
    add('resultado', sp, PH.treinoBom);
    add('resultado', sp, PH.memoriaPerfeita);
    add('resultado', sp, PH.memoriaBoa);
  }
  add('jogo', 'fox', PH.oiFox);
  add('jogo', 'owl', PH.oiOwl);
  add('jogo', 'fox', PH.paraOndeVamos);
  add('jogo', 'fox', PH.memoriaLetras);
  add('jogo', 'owl', PH.memoriaNumeros);
  add('jogo', 'owl', PH.memoriaContas);
  for (const w of WORLDS) {
    if (w.lockedHint) add('jogo', 'fox', w.lockedHint);
    const sp = mascotOf(w.id);
    for (const pin of w.pins) {
      add('fases', sp, pin.intro);
      // prêmio da fase: "Olha só, você ganhou: X!"
      const name = GREEK[pin.rewardItem]?.[1] ?? ITEM_NAMES[pin.rewardItem];
      if (name) add('resultado', sp, pGanhou(name));
    }
  }
  add('jogo', 'fox', PH.emBreve);

  // ------------------------------------------------------------------ chefes aliados
  for (const [worldId, boss] of Object.entries(BOSS_OF)) add('chefes', mascotOf(worldId), boss.ally);
  for (const [id, lines] of Object.entries(ALLY_LINES)) for (const t of lines) add('chefes', id, t);

  // ------------------------------------------------------------------ curiosidades
  for (const t of FALLBACK_FACTS.letras) add('curiosidades', 'fox', t);
  for (const t of FALLBACK_FACTS.matematica) add('curiosidades', 'owl', t);

  // ------------------------------------------------------------------ história (introdução + fases)
  for (const l of INTRO_TEMPLATES) add('historia', l.who, l.text, { label: `intro_${l.who}_${slug(l.text)}` });
  for (const subject of ['letras', 'matematica'] as const) {
    STORIES[subject].forEach((story, i) => {
      story.open.forEach((l, k) => add('historia', l.who, l.text, { label: `${subject}${i + 1}_abre${k + 1}_${l.who}` }));
      story.close.forEach((l, k) => add('historia', l.who, l.text, { label: `${subject}${i + 1}_fecha${k + 1}_${l.who}` }));
    });
  }

  // ------------------------------------------------------------------ tutoriais
  for (const step of COACH_STEPS) {
    const speakers =
      step.screen === 'worlds' ? ['fox']
      : step.screen === 'play-letras' ? ['fox']
      : step.screen === 'play-matematica' ? ['owl']
      : ['fox', 'owl'];
    for (const sp of speakers) add('tutorial', sp, step.text, { label: `tut_${step.id}_${sp}` });
  }

  // ------------------------------------------------------------------ jogo da memória
  for (const p of MEM_LETRAS) add('memoria', 'fox', p.say);
  for (let q = 1; q <= 6; q++) add('memoria', 'owl', `${NUM_M[q][0].toUpperCase()}${NUM_M[q].slice(1)}!`);
  for (let n = 4; n <= 100; n++) add('memoria_numeros', 'owl', `${n}!`);

  // ------------------------------------------------------------------ extras (lista colada das "falas sem áudio")
  return [...byId.values()];
}

/** Personagens e a descrição para escolher a voz de cada um. */
export function speakerList() {
  return Object.values(SPEAKERS).map((s) => ({ id: s.id, name: s.name, kind: s.kind }));
}
