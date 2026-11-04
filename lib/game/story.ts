import type { SpeakerId } from './types';

/** Texto com `{nome}` é trocado pelo nome da criança. */
export interface Line {
  who: SpeakerId;
  text: string;
}

export interface PinStory {
  /** Personagem da fase (retrato na cena). */
  npc: SpeakerId;
  /** Cena antes de jogar: apresenta o problema. */
  open: Line[];
  /** Cena depois de vencer: agradecimento + o que foi restaurado. */
  close: Line[];
}

const L = (who: SpeakerId, text: string): Line => ({ who, text });

export const STORIES: Record<'letras' | 'matematica', PinStory[]> = {
  letras: [
    {
      npc: 'tiao',
      open: [L('tiao', 'Ai, ai! Alguém derramou tinta nas placas da fazenda e apagou o nome dos bichos!'), L('fox', 'Foi o Dragão Borrão! Vamos soletrar para devolver as palavras, {nome}!')],
      close: [L('tiao', 'As placas voltaram! Muito obrigado, {nome}!'), L('fox', 'Uma palavra restaurada! O Borrão deixou pegadas de tinta rumo ao castelo...')],
    },
    {
      npc: 'rosa',
      open: [L('rosa', 'Socorro! A receita do meu pão sumiu. A tinta borrou todas as letras!'), L('fox', 'Vamos escrever as palavras da receita juntos!')],
      close: [L('rosa', 'Que cheirinho bom! Pão quentinho para você, {nome}!'), L('fox', 'A padaria voltou a ter cor e sabor!')],
    },
    {
      npc: 'moa',
      open: [L('moa', 'O vento embaralhou tudo e o moinho parou de girar!'), L('fox', 'Se soletrarmos certinho, o moinho volta a girar!')],
      close: [L('moa', 'Olhe só! O moinho está girando de novo!'), L('fox', 'Você é demais, {nome}!')],
    },
    {
      npc: 'bia',
      open: [L('bia', 'Alto lá! A ponte só abre para quem soletra a senha.'), L('fox', 'Vamos mostrar que somos bons de letras, {nome}!')],
      close: [L('bia', 'Senha certa! Pode passar, bravo viajante!'), L('fox', 'A ponte está aberta! Vamos ao mercado!')],
    },
    {
      npc: 'lia',
      open: [L('lia', 'As frutas perderam as etiquetas! Ninguém sabe qual é qual.'), L('fox', 'Soletrando, a gente devolve os nomes!')],
      close: [L('lia', 'Agora as bancas estão em ordem. Leve uma fruta, {nome}!'), L('fox', 'Hmm, que cheirinho de fruta fresca!')],
    },
    {
      npc: 'beto',
      open: [L('beto', 'O cardápio sumiu! Os clientes estão com fome e sem saber o que pedir.'), L('fox', 'Vamos escrever o cardápio de novo!')],
      close: [L('beto', 'Cardápio salvo! A sopa é por conta da casa!'), L('fox', 'Todo mundo comeu feliz!')],
    },
    {
      npc: 'bento',
      open: [L('bento', 'Os livros estão em branco... o Borrão apagou todas as histórias.'), L('fox', 'Vamos devolver as palavras para cada página!')],
      close: [L('bento', 'As histórias voltaram! Você é um verdadeiro Letrado, {nome}.'), L('fox', 'Só falta o castelo! O Borrão está lá...')],
    },
    {
      npc: 'rei',
      open: [
        L('rei', 'Valente {nome}! O Dragão Borrão está no meu salão!'),
        L('borrao', 'Hihihi! Eu adoro bagunçar as palavras! Vocês não me pegam!'),
        L('fox', 'Vamos soletrar tudo certinho para limpar a tinta, {nome}!'),
      ],
      close: [
        L('borrao', 'Ai, ai... eu só queria brincar. Desculpem pela bagunça.'),
        L('fox', 'Todo mundo erra às vezes. O importante é aprender!'),
        L('borrao', 'Posso ajudar a arrumar as palavras? Prometo não borrar mais nada!'),
        L('rei', 'Seja bem-vindo ao reino, Borrão!'),
      ],
    },
  ],
  matematica: [
    {
      npc: 'nico',
      open: [L('nico', 'Bem-vindo ao porto! Os números dos barcos sumiram e os navios não sabem para onde ir.'), L('owl', 'A Hidra das Contas embaralhou tudo. Vamos contar juntos, {nome}!')],
      close: [L('nico', 'Barcos numerados de novo! Zarpar!'), L('owl', 'Primeira conta resolvida. Muito bem!')],
    },
    {
      npc: 'olivia',
      open: [L('olivia', 'Minhas oliveiras estão cheias, mas perdi a conta dos ramos!'), L('owl', 'Contar com calma, um por um, é o segredo.')],
      close: [L('olivia', 'Agora eu sei quantos tenho! Obrigada, {nome}!'), L('owl', 'As oliveiras voltaram a brilhar.')],
    },
    {
      npc: 'dimitri',
      open: [L('dimitri', 'Preciso saber quantas ânforas vendi, mas os números fugiram!'), L('owl', 'Vamos somar e subtrair para ajudar o Dimitri.')],
      close: [L('dimitri', 'Contas certas, clientes felizes! Obrigado!'), L('owl', 'A ágora está em ordem.')],
    },
    {
      npc: 'teo',
      open: [L('teo', 'O farol só acende com a resposta certa. Estrelas demais, conta de menos!'), L('owl', 'Cada acerto acende uma luzinha!')],
      close: [L('teo', 'Olhe! O farol acendeu! Os barcos já enxergam o caminho.'), L('owl', 'Que lindo, {nome}!')],
    },
    {
      npc: 'ariadne',
      open: [L('ariadne', 'A peça começa já, mas as máscaras estão sem número!'), L('owl', 'Vamos numerar cada uma, {nome}!')],
      close: [L('ariadne', 'O teatro está pronto! Pode começar o espetáculo!'), L('owl', 'Bravo! Bravo!')],
    },
    {
      npc: 'pan',
      open: [L('pan', 'A Olimpíada vai começar! Mas quem conta as medalhas?'), L('owl', 'Nós contamos! Vamos lá!')],
      close: [L('pan', 'Todas as medalhas contadas! Você é um campeão!'), L('owl', 'Que olimpíada incrível!')],
    },
    {
      npc: 'selene',
      open: [L('selene', 'O relógio de sol parou! Só a sequência certa dos números o faz andar.'), L('owl', 'Vamos descobrir qual número vem antes e qual vem depois.')],
      close: [L('selene', 'O relógio voltou a marcar o tempo! Obrigada!'), L('owl', 'Só falta o grande templo...')],
    },
    {
      npc: 'zenon',
      open: [
        L('zenon', 'Os números dos deuses estão presos nas cabeças da Hidra!'),
        L('hidra', 'Hihi! Cada cabeça guarda um número. Descubram qual é!'),
        L('owl', 'Vamos contar com calma, uma cabeça de cada vez, {nome}!'),
      ],
      close: [
        L('hidra', 'Ufa! Vocês contaram todas as minhas cabeças... Que divertido! Posso brincar com vocês?'),
        L('owl', 'Claro! Amigos contam juntos.'),
        L('zenon', 'O relógio dos deuses voltou a funcionar! Obrigado, {nome}!'),
      ],
    },
  ],
};

/** Quem vira aliado ao vencer o chefe de cada mundo. */
export const BOSS_OF: Record<string, { id: string; name: string; ally: string }> = {
  letras: { id: 'borrao', name: 'Dragão Borrão', ally: 'Agora o Borrão é seu amigo e faz desenhos bonitos!' },
  matematica: { id: 'hidra', name: 'Hidra das Contas', ally: 'Agora a Hidra é sua amiga e conta junto com você!' },
};

export const ALLY_LINES: Record<string, string[]> = {
  borrao: [
    'Eu sou o Borrão! Agora só faço desenhos bonitos.',
    'Cuidado com a tinta... brincadeira!',
    'Soletrar é divertido, não é?',
  ],
  hidra: [
    'Uma, duas, três... cinco cabeças contando!',
    'Cada cabeça tem um palpite, mas só uma acerta!',
    'Vamos contar juntos?',
  ],
};

/** Fundo de uma fase: cenário próprio por cima, parque ao pôr do sol por baixo (se o arquivo ainda não existir). */
export const sceneBg = (scene?: string) => ({
  backgroundImage: scene ? `url(/game/scenes/${scene}.jpg), url(/game/park.jpg)` : 'url(/game/park.jpg)',
  backgroundSize: 'cover',
  backgroundPosition: 'center',
});

export const fillName = (text: string, name: string) => text.replaceAll('{nome}', name);
