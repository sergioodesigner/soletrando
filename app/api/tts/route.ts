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

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { text, voice = "Kore", model } = body;

    if (!text || typeof text !== "string") {
      return NextResponse.json({ error: "Texto obrigatório" }, { status: 400 });
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

    // Accept user-specified model, defaulting to the official Gemini TTS preview model
    // Allowed models for TTS include 'gemini-3.1-flash-tts-preview' and 'gemini-2.5-flash-preview-tts'
    const requestedModel = model || "gemini-2.5-flash-preview-tts";
    const fallbackModel = "gemini-3.1-flash-tts-preview";

    let response;
    let usedModel = requestedModel;

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
    } catch (modelError) {
      // If requested model (e.g. gemini-2.5-flash-preview-tts) isn't recognized or errors, fallback to gemini-3.1-flash-tts-preview
      console.warn(`Tentativa com ${requestedModel} falhou, tentando ${fallbackModel}:`, modelError);
      usedModel = fallbackModel;
      response = await ai.models.generateContent({
        model: fallbackModel,
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
    }

    const audioPart = response.candidates?.[0]?.content?.parts?.find(
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
    console.error("Erro na rota Gemini TTS:", error);
    const msg = error instanceof Error ? error.message : "Erro desconhecido";
    return NextResponse.json(
      { error: msg, fallback: true },
      { status: 200 }
    );
  }
}
