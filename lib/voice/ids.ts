// Identificadores estáveis das falas. IGUAIS no navegador e no Node (catálogo/gerador): hash FNV-1a puro.
// Sem imports.

/** Normaliza para comparar: NFC, minúsculas, espaços colapsados. */
export function normText(t: string): string {
  return t.normalize('NFC').replace(/\s+/g, ' ').trim().toLowerCase();
}

/** Hash FNV-1a 32 bits em base36 (8 caracteres). */
export function fnv(s: string): string {
  let h = 0x811c9dc5;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return (h >>> 0).toString(36).padStart(7, '0');
}

/** Chave de um texto (já com o nome do jogador trocado, ou o molde com {nome}). */
export const textKey = (text: string): string => 'h' + fnv(normText(text));

/** Id do arquivo de áudio: quem fala + chave do texto. */
export const voiceId = (speaker: string, text: string): string => `${speaker}_${textKey(text)}`;

/** Chave de busca por nome antigo/estático (ex.: letra_b). */
export const staticKeyId = (key: string): string => 'k_' + key;

/**
 * O áudio é pré-gravado SEM o nome do jogador. "Oi, {nome}! Eu sou…" → "Oi! Eu sou…".
 * O texto da tela continua com o nome; só a voz fala a versão sem nome.
 */
export function speechFromTemplate(t: string): string {
  return t
    .replace(/,\s*\{nome\}/g, '')
    .replace(/\{nome\},\s*/g, '')
    .replace(/\{nome\}/g, 'amigo')
    .replace(/\s+([!?.,])/g, '$1')
    .trim();
}
