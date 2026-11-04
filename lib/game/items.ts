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

export const itemSrc = (n: number) => `/game/items/item${String(n).padStart(2, '0')}.png`;
export const itemName = (n: number) => ITEM_NAMES[n] ?? 'Figurinha';
