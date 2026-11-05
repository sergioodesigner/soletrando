/**
 * Navegação por D-pad / setas do controle remoto.
 * Compatível com Tizen, webOS, Android TV e navegadores antigos
 * que usam keyCode (37–40) em vez de e.key === "ArrowLeft".
 */

const FOCUSABLE =
  'button:not([disabled]):not([aria-hidden="true"]), a[href], [tabindex]:not([tabindex="-1"])';

import { isBackKey, isBackspace, runAdvance, runBack, setDpad, setPointer } from './dpad';

type Dir = 'up' | 'down' | 'left' | 'right';

/** Onde estava o foco por último (se o elemento sumir, escolhemos o vizinho mais próximo dali). */
let lastCenter: { x: number; y: number } | null = null;

/** Janela/ficha aberta: a navegação fica presa dentro dela. */
function navScope(): ParentNode {
  const modals = document.querySelectorAll('[data-tv-modal]');
  if (modals.length) return modals[modals.length - 1];
  return document.querySelector('[data-tv-nav]') || document;
}

function isVisible(el: HTMLElement): boolean {
  if (el.closest('[aria-hidden="true"]')) return false;
  if (el.closest('.tv-hide-on-tv') && document.documentElement.classList.contains('tv-mode')) {
    return false;
  }
  const style = window.getComputedStyle(el);
  if (style.visibility === 'hidden' || style.display === 'none' || style.pointerEvents === 'none') {
    return false;
  }
  const rect = el.getBoundingClientRect();
  return rect.width > 2 && rect.height > 2 && rect.bottom > 0 && rect.top < window.innerHeight + 80;
}

function center(rect: DOMRect) {
  return { x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 };
}

/** Lê direção do D-pad em qualquer TV (key, code, keyCode, which). */
export function readDpadDirection(e: KeyboardEvent): Dir | null {
  const key = e.key || '';
  const code = e.code || '';
  const keyCode = e.keyCode || (e as KeyboardEvent & { which?: number }).which || 0;

  if (
    key === 'ArrowLeft' ||
    key === 'Left' ||
    code === 'ArrowLeft' ||
    keyCode === 37 ||
    keyCode === 21 // Android KEYCODE_DPAD_LEFT (às vezes vaza pro browser)
  ) {
    return 'left';
  }
  if (
    key === 'ArrowUp' ||
    key === 'Up' ||
    code === 'ArrowUp' ||
    keyCode === 38 ||
    keyCode === 19
  ) {
    return 'up';
  }
  if (
    key === 'ArrowRight' ||
    key === 'Right' ||
    code === 'ArrowRight' ||
    keyCode === 39 ||
    keyCode === 22
  ) {
    return 'right';
  }
  if (
    key === 'ArrowDown' ||
    key === 'Down' ||
    code === 'ArrowDown' ||
    keyCode === 40 ||
    keyCode === 20
  ) {
    return 'down';
  }
  return null;
}

export function isConfirmKey(e: KeyboardEvent): boolean {
  const key = e.key || '';
  const code = e.code || '';
  const keyCode = e.keyCode || (e as KeyboardEvent & { which?: number }).which || 0;
  return (
    key === 'Enter' ||
    key === 'Select' ||
    key === 'MediaSelect' ||
    key === ' ' ||
    key === 'Spacebar' ||
    code === 'Enter' ||
    code === 'NumpadEnter' ||
    code === 'Space' ||
    keyCode === 13 ||
    keyCode === 23 || // Android DPAD_CENTER
    keyCode === 32
  );
}

function collectFocusables(root?: ParentNode | null): HTMLElement[] {
  const scope = root || document;
  const list = Array.from(scope.querySelectorAll<HTMLElement>(FOCUSABLE));

  // Ordenação visual: cima → baixo, esquerda → direita
  return list
    .filter(isVisible)
    .sort((a, b) => {
      const ra = a.getBoundingClientRect();
      const rb = b.getBoundingClientRect();
      const row = Math.round(ra.top / 24) - Math.round(rb.top / 24);
      if (row !== 0) return row;
      return ra.left - rb.left;
    });
}

function focusEl(el: HTMLElement) {
  lastCenter = center(el.getBoundingClientRect());
  try {
    el.focus({ preventScroll: false });
  } catch {
    el.focus();
  }
  el.scrollIntoView({ block: 'nearest', inline: 'nearest', behavior: 'smooth' });
}

export function focusFirstTvControl(root?: ParentNode): void {
  const candidates = collectFocusables(root ?? navScope());
  const preferred =
    candidates.find((el) => el.hasAttribute('data-tv-autofocus')) ||
    candidates.find((el) => el.id === 'btn-speak-math-prominent') ||
    candidates.find((el) => el.id === 'letter-bank') ||
    candidates[0];
  if (preferred) focusEl(preferred);
}

function moveFocus(dir: Dir): boolean {
  const candidates = collectFocusables(navScope());
  if (candidates.length === 0) return false;

  const active = document.activeElement as HTMLElement | null;
  const currentIndex = active ? candidates.indexOf(active) : -1;

  // Nada focado (o botão sumiu, ou 1ª seta): vai para o mais próximo de onde o foco estava
  if (currentIndex < 0) {
    if (lastCenter) {
      let near = candidates[0];
      let nd = Infinity;
      for (const el of candidates) {
        const c = center(el.getBoundingClientRect());
        const d = Math.hypot(c.x - lastCenter.x, c.y - lastCenter.y);
        if (d < nd) {
          nd = d;
          near = el;
        }
      }
      focusEl(near);
    } else {
      focusEl(candidates[0]);
    }
    return true;
  }

  const current = candidates[currentIndex];
  const curRect = current.getBoundingClientRect();
  const cur = center(curRect);

  // 1) Tentativa geométrica (melhor para grades de letras)
  let best: HTMLElement | null = null;
  let bestScore = Infinity;

  for (const el of candidates) {
    if (el === current) continue;
    const rect = el.getBoundingClientRect();
    const c = center(rect);
    const dx = c.x - cur.x;
    const dy = c.y - cur.y;

    const primary =
      dir === 'left' ? -dx : dir === 'right' ? dx : dir === 'up' ? -dy : dy;
    if (primary < 8) continue;

    const secondary = dir === 'left' || dir === 'right' ? Math.abs(dy) : Math.abs(dx);
    const score = primary + secondary * 2.5;
    if (score < bestScore) {
      bestScore = score;
      best = el;
    }
  }

  if (best) {
    focusEl(best);
    return true;
  }

  // Fallback linear — sempre funciona (prev/next na ordem visual)
  const delta = dir === 'left' || dir === 'up' ? -1 : 1;
  const nextIndex = (currentIndex + delta + candidates.length) % candidates.length;
  focusEl(candidates[nextIndex]);
  return true;
}

function ensureTvModeClass() {
  // No RPG as setas só mostram o anel de foco; o modo TV (tela grande) vem por ?tv=1 ou navegador de TV
  if ((window as unknown as { __soletrandoGameActive?: boolean }).__soletrandoGameActive) {
    setDpad(true);
    return;
  }
  if (!document.documentElement.classList.contains('tv-mode')) {
    document.documentElement.classList.add('tv-mode');
    document.documentElement.dataset.tv = '1';
    try {
      localStorage.setItem('aprender_tv_mode_v1', '1');
    } catch {
      // ignore
    }
    window.dispatchEvent(new CustomEvent('aprender:tv-mode', { detail: true }));
  }
}

function refocusIfLost() {
  const a = document.activeElement as HTMLElement | null;
  if (a && a !== document.body && document.contains(a)) return;
  if (!lastCenter) return;
  // cenas de história: o OK avança a fala, não pode haver botão focado
  if (document.querySelector('[data-tv-cutscene]')) return;
  const candidates = collectFocusables(navScope());
  let near: HTMLElement | null = null;
  let nd = Infinity;
  for (const el of candidates) {
    const c = center(el.getBoundingClientRect());
    const d = Math.hypot(c.x - lastCenter.x, c.y - lastCenter.y);
    if (d < nd) {
      nd = d;
      near = el;
    }
  }
  if (near) focusEl(near);
}

function activateFocused() {
  const active = document.activeElement as HTMLElement | null;
  if (!active) return false;
  if (active.tagName === 'BUTTON' || active.getAttribute('role') === 'button') {
    if ((active as HTMLButtonElement).disabled) return false;
    active.click();
    // se o botão sumir ou for trocado (ex.: letra escolhida), o foco passa ao vizinho mais próximo
    window.setTimeout(refocusIfLost, 160);
    return true;
  }
  return false;
}

/**
 * Inicia listeners globais. Retorna cleanup.
 * A 1ª seta liga o modo TV automaticamente.
 */
export function initTvSpatialNavigation(): () => void {
  let lastKeyAt = 0;
  let lastDir: string | null = null;

  const onKeyDown = (e: Event) => {
    const ke = e as KeyboardEvent;

    const tag = (document.activeElement as HTMLElement | null)?.tagName;
    const typing = tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT';

    // Voltar do controle
    if (!ke.altKey && !ke.ctrlKey && !ke.metaKey && (isBackKey(ke) || (!typing && isBackspace(ke)))) {
      setDpad(true);
      if (runBack()) {
        ke.preventDefault();
        ke.stopPropagation();
      }
      return;
    }

    let dir = readDpadDirection(ke);
    let confirm = isConfirmKey(ke);

    // Dentro de um campo de texto: ←/→ movem o cursor; ↑/↓ saem do campo; Enter confirma e sai
    if (typing) {
      if (dir === 'left' || dir === 'right') return;
      if (ke.key === 'Enter') {
        (document.activeElement as HTMLElement).blur();
        confirm = false;
        dir = 'down';
      } else if (!dir) return;
      confirm = false;
    }

    if (!dir && !confirm) return;
    if (ke.altKey || ke.ctrlKey || ke.metaKey) return;

    const now = Date.now();
    // Evita repeat do controle (segurar seta)
    if (ke.repeat) {
      ke.preventDefault();
      ke.stopPropagation();
      return;
    }
    if (now - lastKeyAt < 90 && lastDir === (dir || 'ok')) {
      ke.preventDefault();
      ke.stopPropagation();
      return;
    }
    lastKeyAt = now;
    lastDir = dir || 'ok';

    ensureTvModeClass();

    if (confirm) {
      ke.preventDefault();
      ke.stopPropagation();
      if (!activateFocused()) {
        // nada focado: OK avança a fala; se a tela não tem fala, foca o primeiro controle
        if (!runAdvance()) focusFirstTvControl();
      }
      return;
    }

    if (dir) {
      ke.preventDefault();
      ke.stopPropagation();
      moveFocus(dir);
    }
  };

  // toque/clique some com o anel de foco; no RPG não roubamos o foco ao abrir (só depois da 1ª tecla)
  const onPointer = () => setDpad(false);
  // cursor de TV (o controle move um ponteiro): vira modo ponteiro
  const onMove = (e: Event) => {
    const pe = e as PointerEvent;
    if (pe.pointerType && pe.pointerType !== 'mouse') return;
    if (!document.documentElement.classList.contains('using-pointer')) setPointer(true);
  };

  window.addEventListener('keydown', onKeyDown, true);
  window.addEventListener('pointerdown', onPointer, true);
  window.addEventListener('pointermove', onMove, true);

  const t = window.setTimeout(() => {
    const gameActive = (window as unknown as { __soletrandoGameActive?: boolean }).__soletrandoGameActive;
    if (!gameActive || document.documentElement.classList.contains('tv-mode')) focusFirstTvControl();
  }, 350);

  return () => {
    window.clearTimeout(t);
    window.removeEventListener('keydown', onKeyDown, true);
    window.removeEventListener('pointerdown', onPointer, true);
    window.removeEventListener('pointermove', onMove, true);
  };
}
