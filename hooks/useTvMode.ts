'use client';

import { useCallback, useEffect, useState } from 'react';

// v2: o v1 era gravado automaticamente em notebooks/desktops (detecção por tamanho de tela) e prenderia o jogador no modo TV
const STORAGE_KEY = 'aprender_tv_mode_v2';

function readQueryTvFlag(): boolean | null {
  if (typeof window === 'undefined') return null;
  const v = new URLSearchParams(window.location.search).get('tv');
  if (v === '1' || v === 'true' || v === 'on') return true;
  if (v === '0' || v === 'false' || v === 'off') return false;
  return null;
}

function detectSmartTvUa(): boolean {
  if (typeof navigator === 'undefined') return false;
  const ua = navigator.userAgent || '';
  return /SmartTV|Smart-TV|WebOS|Web0S|Tizen|BRAVIA|Viera|NetCast|AppleTV|GoogleTV|Android TV|CrKey|HbbTV|VIDAA|Hisense|AFT[A-Z]|TV Safari|SamsungBrowser.*TV/i.test(
    ua
  );
}

function initialTvMode(): boolean {
  const query = readQueryTvFlag();
  if (query !== null) return query;
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved === '1') return true;
    if (saved === '0') return false;
  } catch {
    // ignore
  }
  // Telas grandes (notebook/desktop) NÃO ligam o modo TV sozinhas: o RPG funciona em qualquer tela.
  return detectSmartTvUa();
}

/**
 * Modo TV: foco grande + navegação por setas/OK do controle remoto.
 * Ative com ?tv=1, UA de Smart TV ou toggle manual. (Será reformulado: celular como teclado/controle.)
 */
export function useTvMode() {
  const [tvMode, setTvModeState] = useState(false);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    const enabled = initialTvMode();
    setTvModeState(enabled);
    setReady(true);
  }, []);

  useEffect(() => {
    if (!ready) return;
    const root = document.documentElement;
    if (tvMode) {
      root.classList.add('tv-mode');
      root.dataset.tv = '1';
    } else {
      root.classList.remove('tv-mode');
      delete root.dataset.tv;
    }
    try {
      localStorage.setItem(STORAGE_KEY, tvMode ? '1' : '0');
    } catch {
      // ignore
    }
  }, [tvMode, ready]);

  // Spatial nav pode ligar o modo TV na 1ª seta
  useEffect(() => {
    const onAuto = (ev: Event) => {
      // No RPG as setas do teclado não trocam para o modo TV
      if ((window as unknown as { __soletrandoGameActive?: boolean }).__soletrandoGameActive) return;
      const detail = (ev as CustomEvent).detail;
      if (detail) setTvModeState(true);
    };
    window.addEventListener('aprender:tv-mode', onAuto);
    return () => window.removeEventListener('aprender:tv-mode', onAuto);
  }, []);

  const setTvMode = useCallback((value: boolean) => {
    setTvModeState(value);
    try {
      const url = new URL(window.location.href);
      if (value) url.searchParams.set('tv', '1');
      else url.searchParams.delete('tv');
      window.history.replaceState({}, '', url.toString());
    } catch {
      // ignore
    }
  }, []);

  const toggleTvMode = useCallback(() => {
    setTvMode(!tvMode);
  }, [setTvMode, tvMode]);

  return { tvMode, ready, setTvMode, toggleTvMode };
}
