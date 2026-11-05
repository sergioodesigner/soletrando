/**
 * Controle remoto / setas: estado compartilhado e pilha de "Voltar".
 * - `using-dpad` (classe no <html>) liga o anel de foco do jogo; some ao tocar/clicar.
 * - Cada tela/janela aberta registra um handler de Voltar; o último registrado tem prioridade.
 */

export function isDpad(): boolean {
  if (typeof document === 'undefined') return false;
  const c = document.documentElement.classList;
  if (c.contains('using-pointer')) return false;
  return c.contains('using-dpad') || c.contains('tv-mode');
}

export function setDpad(on: boolean): void {
  if (typeof document === 'undefined') return;
  const c = document.documentElement.classList;
  c.toggle('using-dpad', on);
  if (on) c.remove('using-pointer');
}

/**
 * Muitos navegadores de TV (ex.: TCL/Android TV) movem um CURSOR com o controle e não mandam setas.
 * Ao ver o mouse mexer, entramos em "modo ponteiro": sem anel de foco, com destaque ao passar o cursor.
 */
export function setPointer(on: boolean): void {
  if (typeof document === 'undefined') return;
  const c = document.documentElement.classList;
  if (on) c.remove('using-dpad');
  c.toggle('using-pointer', on);
}

type BackHandler = () => boolean | void;
const stack: BackHandler[] = [];

/** Registra um handler de Voltar. Retorne `true` se tratou (fechou algo). Devolve o cleanup. */
export function registerBack(fn: BackHandler): () => void {
  stack.push(fn);
  return () => {
    const i = stack.lastIndexOf(fn);
    if (i >= 0) stack.splice(i, 1);
  };
}

/** Executa o Voltar: percorre os handlers do mais novo para o mais antigo até um tratar. */
export function runBack(): boolean {
  for (let i = stack.length - 1; i >= 0; i--) {
    if (stack[i]() === true) return true;
  }
  return false;
}

/** Tecla "Voltar" do controle: Tizen 10009, webOS 461, Android/geral (Escape, GoBack, BrowserBack). */
export function isBackKey(e: KeyboardEvent): boolean {
  const key = e.key || '';
  const kc = e.keyCode || (e as KeyboardEvent & { which?: number }).which || 0;
  return (
    key === 'Escape' || key === 'GoBack' || key === 'BrowserBack' || key === 'XF86Back' ||
    kc === 27 || kc === 10009 || kc === 461 || kc === 4 || kc === 166
  );
}

/** Backspace só conta como Voltar fora de campos de texto. */
export function isBackspace(e: KeyboardEvent): boolean {
  return e.key === 'Backspace' || e.keyCode === 8;
}

type AdvanceFn = () => void;
let advance: AdvanceFn | null = null;
/** A tela atual diz o que OK faz quando nada está focado (ex.: pular a digitação do balão). */
export function setAdvanceHandler(fn: AdvanceFn | null) {
  advance = fn;
}
export function runAdvance(): boolean {
  if (!advance) return false;
  advance();
  return true;
}
