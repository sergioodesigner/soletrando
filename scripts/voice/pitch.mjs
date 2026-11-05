// Estimativa do tom (f0) de um PCM 16-bit mono e da taxa de amostragem provável.
// Ideia: PCM não traz a taxa. Se a taxa assumida estiver errada, a voz sai "grossa e lenta" (ou fina e rápida).
// O tom de uma voz humana é previsível (masculina ≈ 120 Hz, feminina ≈ 210 Hz): comparamos e deduzimos a taxa.

export const STANDARD_RATES = [16000, 22050, 24000, 32000, 44100, 48000];
export const TARGET_F0 = { m: 125, f: 210 };

/** f0 mediano (Hz) das partes sonoras, por autocorrelação. Retorna 0 se não achar voz. */
export function estimateF0(pcm, rate) {
  const n = Math.round(rate * 0.04);       // quadros de 40 ms
  const hop = Math.round(rate * 0.02);
  const lagMin = Math.floor(rate / 450), lagMax = Math.ceil(rate / 60);
  const total = Math.floor(pcm.length / 2);
  const x = new Float32Array(total);
  let peak = 0;
  for (let i = 0; i < total; i++) { x[i] = pcm.readInt16LE(i * 2); peak = Math.max(peak, Math.abs(x[i])); }
  if (peak < 200) return 0;
  const f0s = [];
  for (let s = 0; s + n + lagMax < total; s += hop) {
    let e = 0, mean = 0;
    for (let i = 0; i < n; i++) mean += x[s + i];
    mean /= n;
    for (let i = 0; i < n; i++) { const v = x[s + i] - mean; e += v * v; }
    if (Math.sqrt(e / n) < peak * 0.04) continue;       // silêncio / respiração
    const ac = new Float32Array(lagMax + 1);
    for (let lag = lagMin; lag <= lagMax; lag++) {
      let sum = 0, e2 = 0;
      for (let i = 0; i < n; i++) { const a = x[s + i] - mean, b = x[s + i + lag] - mean; sum += a * b; e2 += b * b; }
      ac[lag] = sum / (Math.sqrt(e * e2) + 1e-9);
    }
    let best = lagMin;
    for (let lag = lagMin; lag <= lagMax; lag++) if (ac[lag] > ac[best]) best = lag;
    if (ac[best] < 0.6) continue;                        // não é som de voz (sem periodicidade clara)
    // evita erro de oitava para baixo: se a metade do atraso é quase tão boa, prefere ela (tom mais alto)
    const half = Math.round(best / 2);
    if (half >= lagMin && ac[half] > ac[best] * 0.9) best = half;
    f0s.push(rate / best);
  }
  if (f0s.length < 8) return 0;
  f0s.sort((a, b) => a - b);
  return f0s[Math.floor(f0s.length / 2)];
}

/** Dado o tom medido a `usedRate`, devolve a taxa padrão que deixaria a voz no tom esperado para o gênero. */
export function suggestRate(f0, usedRate, gender) {
  const target = TARGET_F0[gender] ?? TARGET_F0.m;
  const exact = usedRate * (target / f0);
  let best = STANDARD_RATES[0];
  for (const r of STANDARD_RATES) if (Math.abs(Math.log(r / exact)) < Math.abs(Math.log(best / exact))) best = r;
  return { exact: Math.round(exact), rate: best, target };
}
