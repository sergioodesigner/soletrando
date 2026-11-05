// Nomes das letras para falar (soletrar). Sem imports: usado pelo jogo e pelo catálogo de vozes.
// Evitar Á/É/Ó — o sintetizador exagera o acento agudo (ex.: A de CASA virava “Á”).
export const PT_LETTER_PHONETICS: Record<string, string> = {
  A: 'A',
  B: 'Bê',
  C: 'Cê',
  D: 'Dê',
  E: 'E',
  F: 'efe',
  G: 'Gê',
  H: 'agá',
  I: 'I',
  J: 'jota',
  K: 'cá',
  L: 'ele',
  M: 'eme',
  N: 'ene',
  O: 'O',
  P: 'Pê',
  Q: 'quê',
  R: 'erre',
  S: 'esse',
  // "Tê" maiúsculo/agudo costuma soar como inglês "tea" ou alongar demais.
  T: 'tê',
  U: 'U',
  V: 'Vê',
  W: 'dáblio',
  // Minúsculo evita inglês "ex" / "eks".
  X: 'xis',
  Y: 'ípsilon',
  Z: 'Zê',
};
