/**
 * Navegação espacial por setas do controle remoto (D-pad).
 * Encontra o botão focável mais próximo na direção pressionada.
 */

const FOCUSABLE =
  'button:not([disabled]):not([aria-hidden="true"]), a[href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

function isVisible(el: HTMLElement): boolean {
  if (el.closest('[aria-hidden="true"]')) return false;
  const style = window.getComputedStyle(el);
  if (style.visibility === 'hidden' || style.display === 'none') return false;
  const rect = el.getBoundingClientRect();
  return rect.width > 2 && rect.height > 2;
}

function center(rect: DOMRect) {
  return { x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 };
}

export function focusFirstTvControl(root: ParentNode = document): void {
  const el = root.querySelector<HTMLElement>('[data-tv-autofocus], #btn-speak-next-letter, #btn-speak-full-word, button');
  el?.focus({ preventScroll: false });
}

export function initTvSpatialNavigation(): () => void {
  const onKeyDown = (e: KeyboardEvent) => {
    if (!document.documentElement.classList.contains('tv-mode')) return;

    // Escape fecha modais
    if (e.key === 'Escape') {
      const closeBtn = document.querySelector<HTMLElement>('[data-tv-close]');
      if (closeBtn) {
        e.preventDefault();
        closeBtn.click();
      }
      return;
    }

    // Algumas TVs enviam "Select" em vez de Enter
    if (e.key === 'Select' || e.key === 'MediaSelect') {
      const active = document.activeElement as HTMLElement | null;
      if (active && (active.tagName === 'BUTTON' || active.getAttribute('role') === 'button')) {
        if (!(active as HTMLButtonElement).disabled) {
          e.preventDefault();
          active.click();
        }
      }
      return;
    }

    const dir =
      e.key === 'ArrowUp'
        ? 'up'
        : e.key === 'ArrowDown'
          ? 'down'
          : e.key === 'ArrowLeft'
            ? 'left'
            : e.key === 'ArrowRight'
              ? 'right'
              : null;

    if (!dir) return;

    // Inputs de texto: deixa o browser cuidar (exceto setas em botões)
    const active = document.activeElement as HTMLElement | null;
    if (
      active &&
      (active.tagName === 'INPUT' || active.tagName === 'TEXTAREA' || active.tagName === 'SELECT')
    ) {
      return;
    }

    const candidates = Array.from(document.querySelectorAll<HTMLElement>(FOCUSABLE)).filter(
      isVisible
    );
    if (candidates.length === 0) return;

    const current = (active && candidates.includes(active) ? active : null) || candidates[0];
    const curRect = current.getBoundingClientRect();
    const cur = center(curRect);

    let best: HTMLElement | null = null;
    let bestScore = Infinity;

    for (const el of candidates) {
      if (el === current) continue;
      const rect = el.getBoundingClientRect();
      const c = center(rect);
      const dx = c.x - cur.x;
      const dy = c.y - cur.y;

      // Exige progresso na direção
      const primary =
        dir === 'left' ? -dx : dir === 'right' ? dx : dir === 'up' ? -dy : dy;
      if (primary < 12) continue;

      const secondary = dir === 'left' || dir === 'right' ? Math.abs(dy) : Math.abs(dx);
      // Penaliza desalinhamento lateral
      const score = primary + secondary * 2.2;
      if (score < bestScore) {
        bestScore = score;
        best = el;
      }
    }

    if (best) {
      e.preventDefault();
      best.focus({ preventScroll: false });
      best.scrollIntoView({ block: 'nearest', inline: 'nearest', behavior: 'smooth' });
    }
  };

  window.addEventListener('keydown', onKeyDown, true);
  return () => window.removeEventListener('keydown', onKeyDown, true);
}
