# Vozes do Soletrando (OpenRouter · heygen)

Gera **todas as falas do jogo** — letras, palavras, pistas, contas, tutoriais, história e personagens (Rufo, Sofia, chefes e NPCs) — e o jogo passa a tocá-las em vez das vozes antigas.

O jogo só toca o que existe em `public/audio/voice/manifest.json`. Falas sem arquivo caem nas vozes antigas, então dá para gerar aos poucos.

## 1. Conferir o modelo e escolher as vozes

```bash
npm run voice:info                      # o que o OpenRouter publica sobre o modelo
```

Abra `scripts/voice/voices.json` e preencha `voice` de cada personagem com um id de voz do modelo
(`null` = voz padrão — todos soariam iguais). Em `extra` vai qualquer parâmetro do modelo (ex.: `{"speed": 1.0}`).
Os ids de voz estão na página do modelo no OpenRouter; se errar um id, o erro da API aparece no `--probe`.

```bash
npm run voice:probe -- --key=SUA_CHAVE   # 1 fala por personagem → public/audio/voice/_probe/
```

Ouça os arquivos de `_probe/` antes de gerar tudo.

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
