/** Itens/figurinhas (public/game/items/itemNN.png). Nomes dos que são recompensa de fase. */
export const ITEM_NAMES: Record<number, string> = {
  1: 'Pena Mágica',
  2: 'Tinteiro Encantado',
  4: 'Chave Dourada',
  5: 'Pena Vermelha',
  7: 'Cristal de Atena',
  9: 'Orbe Esmeralda',
  10: 'Poção Azul',
  13: 'Mapa do Tesouro',
  21: 'Folhas de Louro',
  23: 'Maçã Dourada',
  28: 'Carta Real',
  30: 'Estrela de Atena',
  33: 'Baú do Tesouro',
  35: 'Moeda de Ouro',
  39: 'Livro Vermelho',
  40: 'Livro da Floresta',
};

/** Figurinhas da Grécia (índices 100+): public/game/stickers/*.png */
const GREEK: Record<number, [string, string]> = {
  100: ['owl', 'Coruja de Atena'],
  101: ['amphora', 'Ânfora'],
  102: ['laurel', 'Coroa de Louro'],
  103: ['column', 'Coluna de Mármore'],
  104: ['ship', 'Trirreme'],
  105: ['olive', 'Ramo de Oliveira'],
  106: ['torch', 'Tocha Olímpica'],
  107: ['helmet', 'Elmo de Hoplita'],
  108: ['coin', 'Dracma de Prata'],
  109: ['sundial', 'Relógio de Sol'],
  110: ['apple', 'Maçã Dourada'],
  111: ['triangle', 'Pergaminho de Pitágoras'],
};

export const itemSrc = (n: number) =>
  GREEK[n] ? `/game/stickers/${GREEK[n][0]}.png` : `/game/items/item${String(n).padStart(2, '0')}.png`;
export const itemName = (n: number) => GREEK[n]?.[1] ?? ITEM_NAMES[n] ?? 'Figurinha';
