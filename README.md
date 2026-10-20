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

- **Voltar** do controle fecha o painel de configurações (Tizen 10009, webOS 461, Android 4, Esc)
- Se o botão focado some (ex.: letra acertada), o destaque vai para o vizinho mais próximo

Detecta automaticamente várias Smart TVs (Tizen, webOS, Android TV, etc.).

### Como colocar na TV

1. **Navegador da TV (mais simples):** faça o deploy (Vercel) e abra `https://SEU-DOMINIO/?tv=1` no navegador da Samsung/LG/Android TV. Favorite o endereço.
2. **Android TV / Google TV / Fire TV:** instale o Chrome/Puffin TV ou empacote o PWA como app (Bubblewrap/TWA) e faça sideload do APK.
3. **Samsung (Tizen) / LG (webOS):** empacote o site como app hospedado (Tizen Studio `.wgt` ou `ares-package` do webOS) apontando para a URL com `?tv=1`.
4. **Sem app na TV:** transmita do celular/PC (Chromecast, AirPlay, cabo HDMI) e use o controle do dispositivo.


1. Importe o repositório [sergioodesigner/soletrando](https://github.com/sergioodesigner/soletrando) na Vercel.
2. Framework: **Next.js** (detectado automaticamente).
3. Em **Environment Variables**, adicione `GEMINI_API_KEY` se for usar o TTS Gemini.
4. Deploy — os MP3 estáticos em `public/` entram no build.

Não coloque `ELEVENLABS_API_KEY` na Vercel a menos que vá gerar áudio no servidor (não é necessário neste projeto).
