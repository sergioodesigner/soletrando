/**
 * Navegação por D-pad / setas do controle remoto.
 * Compatível com Tizen, webOS, Android TV e navegadores antigos
 * que usam keyCode (37–40) em vez de e.key === "ArrowLeft".
 */

const FOCUSABLE =
  'button:not([disabled]):not([aria-hidden="true"]), a[href], [tabindex]:not([tabindex="-1"])';

type Dir = 'up' | 'down' | 'left' | 'right';

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
  try {
    el.focus({ preventScroll: false });
  } catch {
    el.focus();
  }
  el.scrollIntoView({ block: 'nearest', inline: 'nearest', behavior: 'smooth' });
}

export function focusFirstTvControl(root: ParentNode = document): void {
  const candidates = collectFocusables(root);
  const preferred =
    candidates.find((el) => el.hasAttribute('data-tv-autofocus')) ||
    candidates.find((el) => el.id === 'btn-speak-math-prominent') ||
    candidates.find((el) => el.id === 'letter-bank') ||
    candidates[0];
  if (preferred) focusEl(preferred);
}

function moveFocus(dir: Dir): boolean {
  const navRoot = document.querySelector('[data-tv-nav]') || document;
  const candidates = collectFocusables(navRoot);
  if (candidates.length === 0) return false;

  const active = document.activeElement as HTMLElement | null;
  let currentIndex = active ? candidates.indexOf(active) : -1;

  // Se nada focado (comum na TV), começa no primeiro e só move na próxima seta
  if (currentIndex < 0) {
    focusEl(candidates[0]);
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

/** TV Android/Google TV: o browser desenha uma "bolinha" de mouse; tenta travar o ponteiro. */
function isAndroidTvLike(): boolean {
  const ua = navigator.userAgent || '';
  return /Android|Tizen|Web0S|WebOS|SmartTV|GoogleTV|AFT[A-Z]|VIDAA|Hisense/i.test(ua);
}

function tryHidePointer() {
  if (!isAndroidTvLike()) return;
  if (document.pointerLockElement) return;
  try {
    const req = document.documentElement.requestPointerLock?.() as Promise<void> | undefined;
    req?.catch?.(() => {});
  } catch {
    // ignore
  }
}

function activateFocused() {
  const active = document.activeElement as HTMLElement | null;
  if (!active) return false;
  if (active.tagName === 'BUTTON' || active.getAttribute('role') === 'button') {
    if ((active as HTMLButtonElement).disabled) return false;
    active.click();
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
    if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return;

    const dir = readDpadDirection(ke);
    const confirm = isConfirmKey(ke);

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
    tryHidePointer();

    if (confirm) {
      ke.preventDefault();
      ke.stopPropagation();
      if (!activateFocused()) {
        focusFirstTvControl();
      }
      return;
    }

    if (dir) {
      ke.preventDefault();
      ke.stopPropagation();
      moveFocus(dir);
    }
  };

  // Bloqueia também keyup/keypress das setas: alguns browsers de TV movem a bolinha nesses eventos
  const onKeyOther = (e: Event) => {
    const ke = e as KeyboardEvent;
    const tag = (document.activeElement as HTMLElement | null)?.tagName;
    if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return;
    if (readDpadDirection(ke)) {
      ke.preventDefault();
      ke.stopPropagation();
    }
  };

  // Se a bolinha ainda aparecer, o botão sob ela vira o foco (setas e ponteiro ficam em sincronia)
  const onMouseOver = (e: Event) => {
    if (!document.documentElement.classList.contains('tv-mode')) return;
    const target = (e.target as HTMLElement | null)?.closest(FOCUSABLE) as HTMLElement | null | undefined;
    if (target && isVisible(target) && target !== document.activeElement) {
      try {
        target.focus({ preventScroll: true });
      } catch {
        // ignore
      }
    }
  };

  window.addEventListener('keydown', onKeyDown, true);
  window.addEventListener('keyup', onKeyOther, true);
  window.addEventListener('keypress', onKeyOther, true);
  document.addEventListener('mouseover', onMouseOver, true);

  window.setTimeout(() => focusFirstTvControl(), 350);

  return () => {
    window.removeEventListener('keydown', onKeyDown, true);
    window.removeEventListener('keyup', onKeyOther, true);
    window.removeEventListener('keypress', onKeyOther, true);
    document.removeEventListener('mouseover', onMouseOver, true);
  };
}
