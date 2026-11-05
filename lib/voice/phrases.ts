// TODAS as frases que o jogo fala por texto fixo ou montado. Fonte única: o jogo e o catálogo de
// vozes (scripts/voice) importam daqui, então o texto falado e o áudio gerado nunca divergem.
// Sem imports de React/Next.

export const PH = {
  // ---- soletrar ----
  pulaPalavra: 'Vamos tentar essa palavra de novo mais tarde!',
  dicaBrilhoTraco: 'Olha a letra brilhando! Trace o caminho com o dedinho!',
  dicaBrilho: 'Olha a letra brilhando!',
  tracadoOk: 'Muito bem! Agora você sabe qual letra é. Encontre ela!',
  parabens: 'Muito bem! Você acertou!',
  // ---- matemática ----
  mathDepois: 'Vamos tentar essa de novo mais tarde! Próxima pergunta!',
  tenteDeNovo: 'Tente de novo! Você tem mais uma chance!',
  mathInterativa: 'Vamos resolver juntos com um desafio divertido!',
  mathElimina: 'Dica: Essa resposta não está certa! Tente as outras.',
  mathElimina2: 'Mais uma dica: Eliminei uma opção errada!',
  // ---- modo clássico ----
  modoLetras: 'Modo Letras e Palavras!',
  modoMatematica: 'Modo Matemática!',
  faixa35: 'Fase 3 a 5 anos! Bem-vindos pequenos!',
  faixa68: 'Fase 6 a 8 anos! Vamos praticar!',
  faixa911: 'Fase 9 a 11 anos! Desafios incríveis!',
  faixa1214: 'Fase 12 a 14 anos! Modo expert!',
  // ---- RPG ----
  aquiComVoce: 'Estou aqui com você! Toque no "?" azul se quiser rever as explicações.',
  oiFox: 'Oi! O que você quer fazer?',
  oiOwl: 'Olá! Em que posso ajudar?',
  faseTrancada: 'Esta fase ainda está trancada. Vença as anteriores!',
  paraOndeVamos: 'Para onde vamos hoje?',
  emBreve: 'Em breve!',
  estrelas3: 'Perfeito! Você arrasou!',
  estrelas2: 'Muito bem! Quase perfeito!',
  estrelas1: 'Você conseguiu! Que tal tentar de novo para ganhar mais estrelas?',
  treinoPerfeito: 'Treino perfeito! Você acertou tudo sem errar!',
  treinoBom: 'Bom treino! Praticando você fica cada vez melhor!',
  memoriaPerfeita: 'Que memória incrível! Você achou todos os pares com pouquíssimas jogadas!',
  memoriaBoa: 'Muito bem! Você achou todos os pares!',
  memoriaLetras: 'Jogo da Memória! Ache a figura e a palavra que combinam.',
  memoriaNumeros: 'Jogo da Memória! Ache o número e a quantidade que combinam.',
  memoriaContas: 'Jogo da Memória! Ache cada conta e o resultado dela.',
} as const;

export const pProximaLetra = (phonetic: string) => `A próxima letra é ${phonetic}!`;
export const pPalavra = (f: string) => `Palavra: ${f}!`;
export const pPista = (clue: string) => `Pista: ${clue}`;
export const pSoletre = (f: string, clue: string) => `Soletre ${f}! Pista: ${clue}.`;
export const pDesafio = (f: string, clue?: string) =>
  clue
    ? `Desafio de Soletrar! Pista: ${clue}. Qual é a palavra? É ${f}! Toque nas letras para soletrar.`
    : `Desafio de Soletrar! Soletre a palavra: ${f}! Toque nas letras na ordem certa para formar a palavra.`;
export const pCompletou = (f: string) => `Muito bem! Você completou a palavra ${f}!`;
export const pDicaTipo = (tipo: 'vogal' | 'consoante') => `Dica: A próxima letra é uma ${tipo}!`;
export const pDicaBloqueia = (tipo: 'vogal' | 'consoante') =>
  `Dica: É uma ${tipo}! As outras letras do tipo errado ficaram bloqueadas.`;
export const pParabensResposta = (ans: string | number) => `Parabéns! Resposta correta: ${ans}!`;
export const pRespostaCerta = (ans: string | number) => `Muito bem! A resposta certa é ${ans}! Encontre nas opções!`;
export const pDicaParidade = (tipo: 'par' | 'impar') => `Dica: A resposta é um número ${tipo === 'par' ? 'par' : 'ímpar'}!`;
export const pDica2Paridade = (tipo: 'par' | 'impar') => `Mais uma dica: A resposta é ${tipo === 'par' ? 'par' : 'ímpar'}!`;
export const pGanhou = (item: string) => `Olha só, você ganhou: ${item}!`;
