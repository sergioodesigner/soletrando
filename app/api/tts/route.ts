import { GoogleGenAI, Modality } from "@google/genai";
import { NextRequest, NextResponse } from "next/server";

// Helper to convert raw 16-bit PCM (24kHz Mono) into standard WAV format
function pcmToWav(pcmBuffer: Buffer, sampleRate = 24000, numChannels = 1, bitsPerSample = 16): Buffer {
  const byteRate = (sampleRate * numChannels * bitsPerSample) / 8;
  const blockAlign = (numChannels * bitsPerSample) / 8;
  const dataSize = pcmBuffer.length;
  const header = Buffer.alloc(44);

  // RIFF chunk descriptor
  header.write("RIFF", 0);
  header.writeUInt32LE(36 + dataSize, 4);
  header.write("WAVE", 8);

  // "fmt " sub-chunk
  header.write("fmt ", 12);
  header.writeUInt32LE(16, 16); // SubChunk1Size for PCM
  header.writeUInt16LE(1, 20); // AudioFormat: 1 = PCM
  header.writeUInt16LE(numChannels, 22);
  header.writeUInt32LE(sampleRate, 24);
  header.writeUInt32LE(byteRate, 28);
  header.writeUInt16LE(blockAlign, 32);
  header.writeUInt16LE(bitsPerSample, 34);

  // "data" sub-chunk
  header.write("data", 36);
  header.writeUInt32LE(dataSize, 40);

  return Buffer.concat([header, pcmBuffer]);
}

// Server-side cooldown when Google AI Studio free tier quota is reached
let quotaCooldownUntil = 0;

function isQuotaExhaustedError(err: unknown): boolean {
  const msg = err instanceof Error ? err.message : String(err);
  return (
    msg.includes("429") ||
    msg.includes("RESOURCE_EXHAUSTED") ||
    msg.includes("Quota exceeded") ||
    msg.includes("quota")
  );
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { text, voice = "Kore", model } = body;

    if (!text || typeof text !== "string") {
      return NextResponse.json({ error: "Texto obrigatório" }, { status: 400 });
    }

    // If quota is currently in cooldown, smoothly notify client to use local audio immediately
    if (Date.now() < quotaCooldownUntil) {
      return NextResponse.json(
        {
          success: false,
          fallback: true,
          isQuota: true,
          message: "Cota de voz na API em pausa temporária. Usando voz local."
        },
        { status: 200 }
      );
    }

    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      return NextResponse.json(
        { error: "GEMINI_API_KEY não configurada", fallback: true },
        { status: 200 }
      );
    }

    const ai = new GoogleGenAI({
      apiKey,
      httpOptions: {
        headers: {
          "User-Agent": "aistudio-build",
        },
      },
    });

    const requestedModel = model || "gemini-3.1-flash-tts-preview";

    let response;
    const usedModel = requestedModel;

    try {
      response = await ai.models.generateContent({
        model: requestedModel,
        contents: [{ parts: [{ text: text.trim() }] }],
        config: {
          responseModalities: [Modality.AUDIO],
          speechConfig: {
            voiceConfig: {
              prebuiltVoiceConfig: { voiceName: voice || "Kore" },
            },
          },
        },
      });
    } catch (modelError: unknown) {
      if (isQuotaExhaustedError(modelError)) {
        // Quota is 3 requests/minute on Free Tier. Cooldown 40 seconds to recover cleanly.
        quotaCooldownUntil = Date.now() + 40 * 1000;
        return NextResponse.json(
          {
            success: false,
            fallback: true,
            isQuota: true,
            message: "Cota temporária do Gemini TTS atingida (limite de 3 req/min). Alternando para voz local."
          },
          { status: 200 }
        );
      }

      return NextResponse.json(
        { error: "Falha na síntese de voz na nuvem. Alternando para voz local.", fallback: true },
        { status: 200 }
      );
    }

    const audioPart = response?.candidates?.[0]?.content?.parts?.find(
      (p) => p.inlineData?.data
    );

    if (!audioPart?.inlineData?.data) {
      return NextResponse.json(
        { error: "Nenhum dado de áudio retornado pelo modelo", fallback: true },
        { status: 200 }
      );
    }

    const rawData = audioPart.inlineData.data;
    const incomingMime = audioPart.inlineData.mimeType || "audio/pcm;rate=24000";

    // Convert raw PCM to browser-ready WAV if not already encoded
    let base64Audio = rawData;
    let mimeType = incomingMime;

    if (
      incomingMime.includes("pcm") ||
      (!incomingMime.includes("wav") && !incomingMime.includes("mp3") && !incomingMime.includes("ogg"))
    ) {
      const pcmBuffer = Buffer.from(rawData, "base64");
      const wavBuffer = pcmToWav(pcmBuffer, 24000, 1, 16);
      base64Audio = wavBuffer.toString("base64");
      mimeType = "audio/wav";
    }

    return NextResponse.json({
      success: true,
      audio: base64Audio,
      mimeType,
      modelUsed: usedModel,
      voice,
    });
  } catch (error: unknown) {
    const isQuota = isQuotaExhaustedError(error);
    if (isQuota) {
      quotaCooldownUntil = Date.now() + 5 * 60 * 1000;
    }
    const msg = error instanceof Error ? error.message : "Erro desconhecido";
    return NextResponse.json(
      { error: msg, fallback: true, isQuota },
      { status: 200 }
    );
  }
}
