// Cliente do "cérebro" de texto (Gemini via /api/brain). Ele só escreve o texto;
// quem fala é o Piper (voz Faber no navegador) através do playSmartAudio.

export type AgeGroupId = '3-5' | '6-8' | '9-11' | '12-14';

export type BrainRequest =
  | {
      task: 'explain_error';
      subject: 'letras';
      ageGroup: AgeGroupId;
      word: string;
      /** Parte da palavra já acertada. */
      spelled: string;
      /** Letra tocada errada. */
      picked: string;
    }
  | {
      task: 'explain_error';
      subject: 'matematica';
      ageGroup: AgeGroupId;
      question: string;
      chosen: string | number;
      /** Só vai para o servidor para guiar a explicação — ele é instruído a não revelar. */
      answer: string | number;
      explanation?: string;
    }
  | { task: 'clue'; ageGroup: AgeGroupId; word: string }
  | { task: 'fun_fact'; ageGroup: AgeGroupId; world: 'letras' | 'matematica'; /** muda a chave do cache para variar */ n?: number };

export interface BrainReply {
  text?: string;
  clue?: string;
  sentence?: string;
}

const ENABLED_KEY = 'aprender_brain_enabled_v1';

export function readBrainEnabled(): boolean {
  try {
    return localStorage.getItem(ENABLED_KEY) !== '0'; // ligado por padrão
  } catch {
    return true;
  }
}

export function writeBrainEnabled(on: boolean): void {
  try {
    localStorage.setItem(ENABLED_KEY, on ? '1' : '0');
  } catch {
    // ignore
  }
}

const cache = new Map<string, BrainReply>();
let cooldownUntil = 0;

export async function askBrain(req: BrainRequest, timeoutMs = 6000): Promise<BrainReply | null> {
  if (typeof window === 'undefined' || Date.now() < cooldownUntil) return null;

  const key = JSON.stringify(req);
  const hit = cache.get(key);
  if (hit) return hit;

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch('/api/brain', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(req),
      signal: controller.signal,
    });
    if (!res.ok) return null;
    const data = await res.json();
    if (!data.success) {
      // sem chave / cota: não insiste por 1 minuto
      if (data.reason === 'quota' || data.reason === 'no_api_key' || data.reason === 'rate_limited') {
        cooldownUntil = Date.now() + 60_000;
      }
      return null;
    }
    const reply: BrainReply = { text: data.text, clue: data.clue, sentence: data.sentence };
    if (cache.size > 200) cache.clear();
    cache.set(key, reply);
    return reply;
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}

export interface BrainTestResult {
  ok: boolean;
  text?: string;
  /** no_api_key | quota | model_error | rate_limited | rejected | bad_json | network ... */
  reason?: string;
  detail?: string;
  ms: number;
}

/** Diagnóstico para a tela de configurações: chama o tutor de verdade e mostra o motivo se falhar. */
export async function testBrain(): Promise<BrainTestResult> {
  const t0 = Date.now();
  try {
    const res = await fetch('/api/brain', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        task: 'explain_error',
        subject: 'letras',
        ageGroup: '6-8',
        word: 'CASA',
        spelled: 'CA',
        picked: 'T',
      }),
    });
    const ms = Date.now() - t0;
    if (!res.ok) return { ok: false, reason: `http_${res.status}`, ms };
    const data = await res.json();
    if (data.success) return { ok: true, text: data.text, ms };
    return { ok: false, reason: data.reason || 'unknown', detail: data.detail, ms };
  } catch (e) {
    return { ok: false, reason: 'network', detail: (e as Error).message, ms: Date.now() - t0 };
  }
}

export const BRAIN_REASON_LABEL: Record<string, string> = {
  no_api_key: 'GEMINI_API_KEY não está configurada no servidor (Vercel → Settings → Environment Variables).',
  quota: 'Cota do Gemini esgotada — tente em 1 minuto.',
  model_error: 'O Gemini recusou o pedido (modelo ou chave).',
  rate_limited: 'Muitos pedidos seguidos — aguarde um pouco.',
  rejected: 'O texto gerado foi barrado pelo filtro de segurança — tente de novo.',
  bad_json: 'O modelo devolveu um formato inesperado.',
  network: 'Sem conexão com o servidor.',
};

/** Curiosidades de reserva (sem internet / sem chave): o mascote nunca fica sem o que dizer. */
export const FALLBACK_FACTS: Record<'letras' | 'matematica', string[]> = {
  letras: [
    'Sabia que "borboleta" tem 9 letras e todas as vogais, menos a letra U? Procure só para conferir!',
    'A palavra "ônibus" é uma das poucas que começam com vogal acentuada. Que tal procurar outras?',
    'O alfabeto da língua portuguesa tem 26 letras. Dá para formar milhões de palavras com elas!',
    'Os livros mais antigos eram escritos à mão, com penas de ave e tinta. Dava um trabalhão!',
  ],
  matematica: [
    'Na Grécia Antiga, os números eram escritos com letras. Os gregos também inventaram muita geometria!',
    'Pitágoras descobriu uma regra especial para os triângulos que têm um canto reto. Ela é usada até hoje!',
    'A coruja era a companheira de Atena, a deusa da sabedoria. Por isso eu sou tão esperta!',
    'As Olimpíadas nasceram na Grécia, há quase 3 mil anos. Os atletas competiam em Olímpia!',
  ],
};
