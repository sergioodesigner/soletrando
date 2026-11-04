# Soletrando

App educativo para aprender letras, palavras e matemática, com falas em português brasileiro (voz Bella / ElevenLabs pré-gravadas).

## Rodar localmente

**Requisitos:** Node.js 18+

```bash
npm install
cp .env.example .env.local
# Edite .env.local e coloque GEMINI_API_KEY (opcional para TTS ao vivo)
npm run dev
```

Abra [http://localhost:3000](http://localhost:3000).

## Variáveis de ambiente

| Variável | Obrigatória | Uso |
|---|---|---|
| `GEMINI_API_KEY` | Só se quiser TTS Gemini em tempo real | Fallback de voz na API `/api/tts` |
| `ELEVENLABS_API_KEY` | Não (só script local) | Gerar áudios com `scripts/generate_elevenlabs_audios.mjs` |
| `ELEVENLABS_VOICE_ID` | Não | Padrão: Bella (`hpp4J3VqNfWAUOO0d1Us`) |

Os áudios em `public/audio/recorded/` já vão no deploy — o app funciona offline sem ElevenLabs.

## Jogo RPG (mapa, mascotes e fases)

Fluxo: **Título → Perfil (nome + idade) → Introdução → Mapa-múndi → Mapa do mundo (pins) → Fase → Resultado**, com álbum de figurinhas.

- **Mundos:** Reino das Letras (Rufo, o Raposo — Português) e Grécia dos Números (Sofia, a Coruja — Matemática). *Terra da Fé* e *Era dos Dinossauros* aparecem bloqueados. Os mundos são só configuração em `lib/game/worlds.ts`.
- **Fases:** 8 pins por mundo e por idade (6 normais, 1 mini-chefe, 1 chefe). Estrelas por poucos erros; o chefe pede 12 estrelas. Os jogos "por dentro" são os de sempre (soletrar / contas).
- **Idade:** cada perfil tem sua faixa (3-5, 6-8, 9-11, 12-14) e o progresso é salvo por idade (`localStorage`, chave `soletrando_game_v1`).
- **Diálogo:** o mascote fala (voz Faber) e o texto aparece **digitando no ritmo da voz** (`lib/game/dialogue.ts`). Toque no balão para ler tudo de uma vez.
- **Primeira vez:** todo botão novo é explicado pelo mascote com destaque na tela (`lib/game/coach.ts`). Para adicionar um tutorial novo, crie um passo com id novo.
- **Arte:** `public/game/` (mascotes sem fundo, cenários provisórios e `items/` com os ícones das figurinhas). Mapas e pins ficam em `lib/game/worlds.ts` (posições em %).
- **Modo clássico** (sem mapa) em Configurações; o modo TV usa a interface clássica por enquanto e será reformulado.

## Voz Faber no navegador (Piper)

O app pode falar com a voz neural **Piper `pt_BR-faber-medium`** (a mesma do [tts-api](https://github.com/sergioodesigner/tts-api)) rodando **dentro do navegador do usuário** — sem servidor.

- Ative em **Configurações → Voz Faber no Navegador → Baixar e ativar** (~63 MB, uma única vez; fica na Cache API e depois funciona offline).
- Ordem de prioridade das falas: MP3 gravado → memória local (IndexedDB) → **Piper (navegador)** → API Gemini → voz do aparelho.
- Falas geradas pelo Piper são guardadas no IndexedDB, então cada palavra nova só é sintetizada uma vez.
- Como funciona: `public/piper/piper-worker.js` (Web Worker) → espeak-ng WASM (fonemas) + ONNX Runtime Web (modelo VITS). Cliente em `lib/piperTts.ts`.
- O modelo vem do repositório oficial `rhasspy/piper-voices` (Hugging Face) e o runtime WASM do jsDelivr (versões fixadas). Para self-host, defina `NEXT_PUBLIC_PIPER_MODEL_BASE`, `NEXT_PUBLIC_PIPER_ORT_BASE` e `NEXT_PUBLIC_PIPER_PHONEMIZE_BASE` (veja `.env.example`).

## Tutor inteligente (cérebro de texto + voz)

O **Gemini escreve o texto** (`/api/brain`) e o app entrega esse texto à voz (**Piper Faber** no navegador, ou a voz do aparelho se o Piper não estiver ativo) — o modelo de texto nunca gera áudio.

- **Tutor de erros:** a cada 2 erros seguidos em letras, e do 2º erro em diante em matemática, o Gemini escreve uma dica curta **sem revelar a resposta** (a rota rejeita textos que vazem o valor/palavra) e a voz fala. Se o texto não vier, o jogo usa as falas padrão.
- **Pista + frase de exemplo** para palavras personalizadas (as que não têm áudio gravado); ficam salvas com a palavra e a frase é falada ao completá-la.
- Só funciona online e no Modo Híbrido; pode ser desligado em Configurações → Tutor Inteligente. Só a palavra/pergunta é enviada.
- Requer `GEMINI_API_KEY`. Modelo de texto padrão `gemini-2.5-flash` (troque com `GEMINI_TEXT_MODEL`).

## Regenerar falas (ElevenLabs)

```bash
set -a && source .env.local && set +a
node scripts/generate_elevenlabs_audios.mjs
# ou force tudo de novo:
node scripts/generate_elevenlabs_audios.mjs --force
```

## Modo TV (controle remoto)

Abra na Smart TV e use **setas + OK**:

- Link direto: `https://SEU-DOMINIO/?tv=1`
- Ou toque em **Modo TV** no canto superior
- Setas movem o destaque amarelo; **OK/Enter** confirma

Detecta automaticamente várias Smart TVs (Tizen, webOS, Android TV, etc.).


1. Importe o repositório [sergioodesigner/soletrando](https://github.com/sergioodesigner/soletrando) na Vercel.
2. Framework: **Next.js** (detectado automaticamente).
3. Em **Environment Variables**, adicione `GEMINI_API_KEY` se for usar o TTS Gemini.
4. Deploy — os MP3 estáticos em `public/` entram no build.

Não coloque `ELEVENLABS_API_KEY` na Vercel a menos que vá gerar áudio no servidor (não é necessário neste projeto).
