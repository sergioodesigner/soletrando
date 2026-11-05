import type { MascotId } from './types';

/**
 * Tutoriais "primeira vez". Regra do jogo: todo botão/comando que a criança usa é explicado pelo
 * mascote na primeira vez que aparece (e sempre que ela tocar no "?" ou em "Como se joga?").
 * Um passo só aparece quando o elemento alvo existe na tela e ainda não foi visto.
 */
export interface CoachStep {
  /** Identificador salvo em "já visto". Mudar o id faz o tutorial reaparecer (botão novo em atualização). */
  id: string;
  screen: 'worlds' | 'map' | 'result' | 'memory' | 'play-letras' | 'play-matematica' | 'play';
  /** Seletor CSS do elemento a destacar. */
  target: string;
  mascot: MascotId;
  text: string;
  /** 'tap' = espera a criança tocar no elemento; 'ok' = botão "Entendi!". */
  mode: 'tap' | 'ok';
  /** 'firstClear' = só aparece depois da 1ª fase vencida (o começo fica leve: aprende jogando). */
  after?: 'firstClear';
}

export const COACH_STEPS: CoachStep[] = [
  // ---- mapa-múndi ----
  { id: 'worlds.pick.v1', screen: 'worlds', target: '[data-coach="world-letras"]', mascot: 'fox', mode: 'tap',
    text: 'Este é o mapa-múndi! Cada ilha é um mundo. Toque na minha ilha, o Reino das Letras!' },
  { id: 'worlds.locked.v1', screen: 'worlds', target: '[data-coach="world-fe"]', mascot: 'fox', mode: 'ok', after: 'firstClear',
    text: 'As ilhas com cadeado ainda estão trancadas. Em breve vão abrir para você!' },

  // ---- mapa ----
  { id: 'map.pin.v1', screen: 'map', target: '[data-coach="pin-available"]', mascot: 'fox', mode: 'tap',
    text: 'Este é o mapa! Cada bolinha é uma fase. Toque na que está brilhando para começar!' },
  { id: 'map.stats.v1', screen: 'map', target: '[data-coach="stats"]', mascot: 'fox', mode: 'ok', after: 'firstClear',
    text: 'Aqui ficam suas estrelas e moedas. Você ganha mais quando acerta sem errar!' },
  { id: 'map.mascot.v1', screen: 'map', target: '[data-coach="mascot"]', mascot: 'fox', mode: 'tap', after: 'firstClear',
    text: 'Toque em mim para conversar! Posso contar curiosidades e explicar como se joga.' },
  { id: 'map.album.v1', screen: 'map', target: '[data-coach="album"]', mascot: 'fox', mode: 'ok', after: 'firstClear',
    text: 'Este é o seu álbum. Cada fase vencida ganha uma figurinha nova!' },
  { id: 'map.age.v1', screen: 'map', target: '[data-coach="age"]', mascot: 'fox', mode: 'ok', after: 'firstClear',
    text: 'Aqui você escolhe o seu nível, por idade. Cada nível tem desafios do seu tamanho.' },
  { id: 'map.worlds.v1', screen: 'map', target: '[data-coach="worlds"]', mascot: 'fox', mode: 'ok', after: 'firstClear',
    text: 'Quer visitar outro mundo? Toque aqui para voltar ao mapa-múndi.' },

  { id: 'map.ally.v1', screen: 'map', target: '[data-coach="ally"]', mascot: 'fox', mode: 'tap', after: 'firstClear',
    text: 'Olha! O chefe virou seu amigo e agora anda com a gente. Toque nele para conversar!' },

  // ---- resultado ----
  { id: 'result.training.v1', screen: 'result', target: '[data-coach="btn-training"]', mascot: 'fox', mode: 'ok', after: 'firstClear',
    text: 'O Momento Treino repete as palavras em que você mais precisa treinar. Se acertar tudo, ganha moedas de bônus!' },
  { id: 'result.memory.v1', screen: 'result', target: '[data-coach="btn-memory"]', mascot: 'fox', mode: 'ok', after: 'firstClear',
    text: 'O Jogo da Memória também dá bônus. Vire duas cartas e ache os pares!' },

  // ---- jogo da memória ----
  { id: 'memory.cards.v1', screen: 'memory', target: '[data-coach="memory-grid"]', mascot: 'fox', mode: 'ok',
    text: 'Toque numa carta para virar. Vire outra: se combinarem, ficam abertas. Se não, elas se escondem de novo!' },

  // ---- dentro da fase (geral) ----
  { id: 'play.boss.v1', screen: 'play', target: '[data-coach="boss-bar"]', mascot: 'fox', mode: 'ok',
    text: 'Este é o chefe! Cada resposta certa tira um pedaço da barra de vida dele. Quando acabar, você vence!' },
  { id: 'play.bubble.v1', screen: 'play', target: '[data-coach="bubble"]', mascot: 'fox', mode: 'tap', after: 'firstClear',
    text: 'O que eu falo também aparece aqui, escrevendo devagarzinho. Toque no balão para ler mais rápido!' },
  { id: 'play.back.v1', screen: 'play', target: '[data-coach="back"]', mascot: 'fox', mode: 'ok', after: 'firstClear',
    text: 'Este botão volta para o mapa. Seu progresso fica guardado!' },
  { id: 'play.sound.v1', screen: 'play', target: '[data-coach="sound"]', mascot: 'fox', mode: 'ok', after: 'firstClear',
    text: 'Aqui você liga e desliga o som.' },

  // ---- soletrar ----
  { id: 'letras.listen.v1', screen: 'play-letras', target: '#btn-speak-word-prominent', mascot: 'fox', mode: 'tap', after: 'firstClear',
    text: 'Toque aqui para ouvir a pergunta de novo, quantas vezes quiser!' },
  { id: 'letras.bank.v1', screen: 'play-letras', target: '#letter-bank', mascot: 'fox', mode: 'tap',
    text: 'Toque nas letras, uma por uma, na ordem da palavra. Pode começar!' },
  { id: 'letras.next.v1', screen: 'play-letras', target: '#btn-speak-next-letter', mascot: 'fox', mode: 'tap',
    text: 'Ficou com dúvida? Este botão me faz dizer qual é a próxima letra!' },
  { id: 'letras.hint1.v1', screen: 'play-letras', target: '#btn-hint-letter-1', mascot: 'fox', mode: 'tap',
    text: 'Errou algumas vezes? Toque aqui para ganhar uma dica!' },
  { id: 'letras.hint2.v1', screen: 'play-letras', target: '#btn-hint-letter-2', mascot: 'fox', mode: 'tap',
    text: 'Ainda difícil? Esta é a segunda dica, ela ajuda ainda mais.' },

  // ---- matemática ----
  { id: 'mat.options.v1', screen: 'play-matematica', target: '.tv-math-option', mascot: 'owl', mode: 'tap',
    text: 'Toque na resposta certa. Se errar, pode tentar de novo!' },
  { id: 'mat.hint.v1', screen: 'play-matematica', target: '#btn-hint-math-1', mascot: 'owl', mode: 'tap',
    text: 'Está difícil? Toque aqui para uma dica da coruja!' },
];
