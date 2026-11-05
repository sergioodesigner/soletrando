# Vozes do Soletrando (OpenRouter · heygen)

Gera **todas as falas do jogo** — letras, palavras, pistas, contas, tutoriais, história e personagens (Rufo, Sofia, chefes e NPCs) — e o jogo passa a tocá-las em vez das vozes antigas.

O jogo só toca o que existe em `public/audio/voice/manifest.json`. Falas sem arquivo caem nas vozes antigas, então dá para gerar aos poucos.

## 1. Vozes e formato

O modelo `heygen/heygen-voice-1-turbo:free` devolve **PCM** (áudio cru, 16-bit mono, sem cabeçalho). O script pede PCM, converte para **MP3 compacto** com o `ffmpeg`, **corta o silêncio** do começo/fim e **nivela o volume** entre as falas (sem isso umas ficam bem mais baixas que outras).

- **Precisa do `ffmpeg`** (`brew install ffmpeg` · `apt install ffmpeg`; no GitHub Actions já vem). Sem ele o script grava WAV, que funciona mas ocupa ~6× mais espaço.
- **Taxa do PCM:** o PCM não diz a própria taxa de amostragem. Se estiver errada a voz sai **grossa e lenta** (taxa assumida baixa demais) ou fina e rápida. O padrão é **44100 Hz** (estimado pelo tom das vozes do heygen). O `--probe` mede o tom de cada voz, recomenda a taxa e grava a mesma fala em 3 taxas em `_probe/teste-de-taxa/` para você escolher **ouvindo**. Ajuste com `--pcm-rate=`, `"pcmRate"` no `voices.json` ou `--probe --fix-rate`.

Vozes (`scripts/voice/voices.json`): **8 vozes** — masculinas `bram`, `gareth`, `weston`, `lucian` e femininas `nadine`, `noelle`, `meredith`, `sabrina` (gênero assumido pelo nome; o teste abaixo confere pelo tom).

| Personagem | Voz | | Personagem | Voz |
|---|---|---|---|---|
| Rufo (mascote) | `bram` | | Sofia (mascote) | `nadine` |
| Dragão Borrão | `weston` | | Hidra | `noelle` |
| Seu Tião · Velho Bento · Faroleiro Teo · Zênon | `gareth` | | Dona Rosa · Dona Olívia | `meredith` |
| Seu Moa · Rei Bartolomeu · Corredor Pan | `lucian` | | Guarda Bia · Ariadne | `sabrina` |
| Seu Beto · Capitão Nico | `weston` | | Dona Lia · Sábia Selene | `noelle` |
| Dimitri | `bram` | | | |

Regra: o personagem de uma fase **nunca usa a voz do mascote que aparece junto** (Letras: ninguém usa `bram`; Grécia: ninguém usa `nadine`). Para trocar a voz de alguém, edite `voice` (e `genero`) dele no `voices.json`. `rate` (perto de 1) dá um leve toque extra de tom/velocidade ao tocar no jogo.

```bash
npm run voice:info                         # o que o OpenRouter publica sobre o modelo
npm run voice:vozes -- --key=SUA_CHAVE     # a MESMA frase em cada uma das 8 vozes → _probe/vozes/ (confere o gênero pelo tom)
npm run voice:probe -- --key=SUA_CHAVE     # 1 fala por personagem → _probe/ (ouça antes de gerar tudo)
```

## 2. Gerar

```bash
npm run voice:generate -- --key=SUA_CHAVE --dry-run          # só conta (quantas falas / caracteres)
npm run voice:generate -- --key=SUA_CHAVE --group=letras      # comece pelas letras
npm run voice:generate -- --key=SUA_CHAVE                     # tudo o que falta
```

(ou `export OPENROUTER_API_KEY=...` e omita `--key`.)

- **Retoma sozinho:** pula o que já existe; limite de taxa (429) e erros 5xx são tentados de novo com espera.
- Opções: `--group=a,b` · `--skip-group=classico,memoria_numeros` · `--speaker=fox,owl` · `--only=trecho` · `--limit=50` · `--delay=2000`
- Grupos: `letras proxima_letra palavras completou pistas soletrar classico dicas matematica dicas_mat jogo resultado fases chefes curiosidades historia tutorial memoria memoria_numeros`
- `classico` = falas do modo clássico (sem mapa); `memoria_numeros` = “12!”, “13!”… (pode pular se quiser economizar).

## 3. Ouvir e refazer o que ficou esquisito

Abra `public/audio/voice/review.html` (no navegador). Toque cada fala, **marque as ruins** e clique em *Copiar comando*:

```bash
npm run voice:generate -- --key=SUA_CHAVE --redo=letra_g,letra_h
```

Para **mudar o que é falado** sem mexer no jogo (pronúncia), use `scripts/voice/overrides.json`:

```json
{ "letra_a": "Á", "palavras:palavra_paradoxo": "Palavra: Paradóquiso!" }
```

A chave é o nome (`label`) que aparece no `review.html`. Depois `--redo=<nome>`.

## 4. Falas novas / sem áudio

Se o jogo mudar ou pedir uma fala que não está no catálogo, ela aparece em **Configurações → Vozes gravadas → “X fala(s) sem gravação”**.
Clique *Copiar lista*, cole em `scripts/voice/extra.json` e rode o gerador de novo.
Se alterar textos do jogo: `npm run voice:catalog` (reconstrói `catalog.json`).

## Rodar online (sem usar seu computador)

No GitHub: **Actions → “Gerar vozes” → Run workflow**. Guarde a chave em *Settings → Secrets → `OPENROUTER_API_KEY`*.
O fluxo gera os áudios e envia para um branch `audio/voice-<número>` — é só revisar e fazer o merge.

## Observações

- O áudio é gravado **sem o nome da criança** (“Oi! Eu sou o Rufo…”); na tela o texto continua com o nome.
- Nada disto roda no navegador do jogador: os arquivos ficam em `public/audio/voice/` e funcionam offline depois de baixados.
- A voz Faber no navegador (Piper) está em standby; para religar: `NEXT_PUBLIC_ENABLE_PIPER=1`.
- Opções de áudio: `--no-trim` (não corta silêncio) · `--no-normalize` (não nivela volume) · `--format=mp3` (se o modelo passar a devolver MP3).
