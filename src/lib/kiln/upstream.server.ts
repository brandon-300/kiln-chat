import { providerById, type ProviderId, type Wire } from "@/lib/kiln/catalog";

export type ChatTurn = { role: "system" | "user" | "assistant"; content: string };

const PROVIDER_IDS = new Set<ProviderId>([
  "groq",
  "deepseek",
  "google",
  "openai",
  "anthropic",
  "xai",
  "mistral",
  "openrouter",
  "custom",
]);

const MODEL_RE = /^[A-Za-z0-9_.:/+@-]{1,160}$/;

export function asProvider(value: unknown): ProviderId {
  if (typeof value === "string" && PROVIDER_IDS.has(value as ProviderId)) return value as ProviderId;
  throw new Error("Choose a provider from the list.");
}

export function asModel(value: unknown): string {
  if (typeof value !== "string" || !MODEL_RE.test(value.trim())) {
    throw new Error("That model id is not valid.");
  }
  return value.trim();
}

export function asKey(value: unknown): string {
  if (typeof value !== "string") throw new Error("Add an API key for this provider.");
  const key = value.trim();
  if (key.length < 8 || key.length > 400) throw new Error("Add an API key for this provider.");
  return key;
}

function scrub(message: string, secret: string): string {
  const clean = message.replace(/\s+/g, " ").trim().slice(0, 500);
  if (!secret) return clean || "The provider returned an error.";
  return (clean || "The provider returned an error.").split(secret).join("…");
}

async function errorText(res: Response, secret: string): Promise<string> {
  let raw = "";
  try {
    raw = await res.text();
  } catch {
    raw = res.statusText;
  }
  try {
    const json = JSON.parse(raw) as {
      error?: { message?: string } | string;
      message?: string;
    };
    const nested = typeof json.error === "string" ? json.error : json.error?.message;
    return scrub(nested || json.message || raw, secret);
  } catch {
    return scrub(raw || `Request failed (${res.status})`, secret);
  }
}

function assertPublicHttps(raw: string): URL {
  let url: URL;
  try {
    url = new URL(raw.trim());
  } catch {
    throw new Error("Enter a full https endpoint, like https://api.example.com/v1");
  }
  if (url.protocol !== "https:") throw new Error("Custom endpoints must use https.");
  const host = url.hostname.toLowerCase().replace(/^\[|\]$/g, "");
  if (
    host === "localhost" ||
    host.endsWith(".local") ||
    host.endsWith(".internal") ||
    host === "0.0.0.0" ||
    host === "::1" ||
    /^(127\.|10\.|192\.168\.|169\.254\.|0\.|172\.(1[6-9]|2\d|3[0-1])\.)/.test(host)
  ) {
    throw new Error("That address is not allowed. Use a public https API.");
  }
  return url;
}

function chatUrl(provider: ProviderId, customBase: string | undefined): string {
  if (provider === "custom") {
    const url = assertPublicHttps(customBase || "");
    const path = url.pathname.replace(/\/$/, "");
    if (path.endsWith("/chat/completions")) return url.toString();
    url.pathname = `${path}/chat/completions`.replace(/\/{2,}/g, "/");
    return url.toString();
  }
  const info = providerById(provider);
  if (!info.base) throw new Error("This provider is not OpenAI-compatible.");
  if (provider === "deepseek") return `${info.base}/chat/completions`;
  return `${info.base}/chat/completions`;
}

function splitSystem(messages: ChatTurn[]): { system: string; turns: ChatTurn[] } {
  const system = messages
    .filter((m) => m.role === "system")
    .map((m) => m.content.trim())
    .filter(Boolean)
    .join("\n\n");
  const turns = messages.filter((m) => m.role !== "system" && m.content.trim());
  return { system, turns };
}

type Emit = (text: string) => void;

async function readUpstream(res: Response, secret: string, onDelta: Emit, wire: Wire) {
  if (!res.ok) throw new Error(await errorText(res, secret));
  if (!res.body) throw new Error("The provider returned an empty response.");
  const ctype = res.headers.get("content-type") || "";
  if (ctype.includes("application/json") && !ctype.includes("text/event-stream")) {
    const json = (await res.json()) as Record<string, unknown>;
    const text = textFromJson(json, wire);
    if (text) onDelta(text);
    return;
  }
  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buf = "";
  let reasoning = "";
  let emitted = false;
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buf += decoder.decode(value, { stream: true });
    const lines = buf.split(/\r?\n/);
    buf = lines.pop() ?? "";
    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed.startsWith("data:")) continue;
      const data = trimmed.slice(5).trim();
      if (!data || data === "[DONE]") continue;
      try {
        const json = JSON.parse(data) as Record<string, unknown>;
        const piece = deltaFromJson(json, wire);
        if (piece.reasoning) reasoning += piece.reasoning;
        if (piece.text) {
          emitted = true;
          onDelta(piece.text);
        }
      } catch {
      }
    }
  }
  if (!emitted && reasoning.trim()) onDelta(reasoning.slice(0, 4000));
}

function textFromJson(json: Record<string, unknown>, wire: Wire): string {
  if (wire === "anthropic") {
    const content = json.content;
    if (!Array.isArray(content)) return "";
    return content
      .map((part) => {
        if (!part || typeof part !== "object") return "";
        const text = (part as { text?: unknown }).text;
        return typeof text === "string" ? text : "";
      })
      .join("");
  }
  if (wire === "gemini") {
    return geminiText(json);
  }
  const choices = json.choices;
  if (!Array.isArray(choices) || !choices[0] || typeof choices[0] !== "object") return "";
  const message = (choices[0] as { message?: { content?: unknown } }).message;
  return typeof message?.content === "string" ? message.content : "";
}

function deltaFromJson(json: Record<string, unknown>, wire: Wire): { text: string; reasoning: string } {
  if (wire === "anthropic") {
    const type = json.type;
    if (type === "content_block_delta") {
      const delta = json.delta as { type?: string; text?: string } | undefined;
      if (delta?.type === "text_delta" && delta.text) return { text: delta.text, reasoning: "" };
    }
    return { text: "", reasoning: "" };
  }
  if (wire === "gemini") {
    return { text: geminiText(json), reasoning: "" };
  }
  const choices = json.choices;
  if (!Array.isArray(choices) || !choices[0] || typeof choices[0] !== "object") {
    return { text: "", reasoning: "" };
  }
  const delta = (choices[0] as { delta?: { content?: unknown; reasoning_content?: unknown } }).delta;
  const text = typeof delta?.content === "string" ? delta.content : "";
  const reasoning = typeof delta?.reasoning_content === "string" ? delta.reasoning_content : "";
  return { text, reasoning };
}

function geminiText(json: Record<string, unknown>): string {
  const candidates = json.candidates;
  if (!Array.isArray(candidates) || !candidates[0] || typeof candidates[0] !== "object") return "";
  const content = (candidates[0] as { content?: { parts?: unknown } }).content;
  const parts = content?.parts;
  if (!Array.isArray(parts)) return "";
  return parts
    .map((part) => (part && typeof part === "object" && typeof (part as { text?: unknown }).text === "string"
      ? (part as { text: string }).text
      : ""))
    .join("");
}

function sseResponse(run: (send: (payload: Record<string, unknown>) => void) => Promise<void>): Response {
  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    async start(controller) {
      const send = (payload: Record<string, unknown>) => {
        controller.enqueue(encoder.encode(`data: ${JSON.stringify(payload)}\n\n`));
      };
      try {
        await run(send);
        send({ done: true });
      } catch (error) {
        const message = error instanceof Error ? error.message : "The request failed.";
        send({ error: message });
      } finally {
        controller.close();
      }
    },
  });
  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream; charset=utf-8",
      "Cache-Control": "no-cache, no-transform",
      "X-Accel-Buffering": "no",
    },
  });
}

export function streamChat(input: {
  provider: ProviderId;
  model: string;
  apiKey: string;
  messages: ChatTurn[];
  temperature: number;
  customBase?: string;
  probe?: boolean;
  origin?: string;
}): Response {
  return sseResponse(async (send) => {
    const wire = providerById(input.provider).wire;
    const maxTokens = input.probe ? 32 : 2048;
    let omitTemperature = wire === "openai" && input.provider === "openai";
    const call = async (dropTemperature: boolean) => {
      if (wire === "anthropic") return anthropicRequest(input, maxTokens);
      if (wire === "gemini") return geminiRequest(input, maxTokens, dropTemperature);
      return openaiRequest(input, maxTokens, dropTemperature || omitTemperature);
    };
    let res = await call(false);
    if (!res.ok && !input.probe) {
      const err = await res.clone().text();
      if (/temperature|max_tokens|max_completion_tokens/i.test(err)) {
        omitTemperature = true;
        res = await call(true);
      }
    }
    await readUpstream(res, input.apiKey, (text) => send({ d: text }), wire);
  });
}

async function openaiRequest(
  input: {
    provider: ProviderId;
    model: string;
    apiKey: string;
    messages: ChatTurn[];
    temperature: number;
    customBase?: string;
    origin?: string;
  },
  maxTokens: number,
  dropTemperature: boolean,
): Promise<Response> {
  const body: Record<string, unknown> = {
    model: input.model,
    messages: input.messages.map((m) => ({ role: m.role, content: m.content })),
    stream: true,
  };
  if (input.provider === "openai") body.max_completion_tokens = maxTokens;
  else body.max_tokens = maxTokens;
  if (!dropTemperature) body.temperature = input.temperature;
  const headers: Record<string, string> = {
    Authorization: `Bearer ${input.apiKey}`,
    "Content-Type": "application/json",
  };
  if (input.provider === "openrouter") {
    headers["HTTP-Referer"] = input.origin || "https://kiln.app";
    headers["X-Title"] = "Kiln";
  }
  return fetch(chatUrl(input.provider, input.customBase), {
    method: "POST",
    headers,
    body: JSON.stringify(body),
  });
}

async function anthropicRequest(
  input: { model: string; apiKey: string; messages: ChatTurn[] },
  maxTokens: number,
): Promise<Response> {
  const { system, turns } = splitSystem(input.messages);
  const body: Record<string, unknown> = {
    model: input.model,
    max_tokens: maxTokens,
    stream: true,
    messages: turns.map((m) => ({ role: m.role, content: m.content })),
  };
  if (system) body.system = system;
  return fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "x-api-key": input.apiKey,
      "anthropic-version": "2023-06-01",
      "content-type": "application/json",
    },
    body: JSON.stringify(body),
  });
}

async function geminiRequest(
  input: { model: string; apiKey: string; messages: ChatTurn[]; temperature: number },
  maxTokens: number,
  dropTemperature: boolean,
): Promise<Response> {
  const { system, turns } = splitSystem(input.messages);
  const contents: { role: string; parts: { text: string }[] }[] = [];
  for (const turn of turns) {
    const role = turn.role === "assistant" ? "model" : "user";
    const last = contents[contents.length - 1];
    if (last && last.role === role) last.parts[0].text += `\n\n${turn.content}`;
    else contents.push({ role, parts: [{ text: turn.content }] });
  }
  const body: Record<string, unknown> = {
    contents,
    generationConfig: {
      maxOutputTokens: maxTokens,
      ...(dropTemperature ? {} : { temperature: input.temperature }),
    },
  };
  if (system) body.systemInstruction = { parts: [{ text: system }] };
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(input.model)}:streamGenerateContent?alt=sse`;
  return fetch(url, {
    method: "POST",
    headers: {
      "x-goog-api-key": input.apiKey,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });
}

export async function synthesize(input: {
  provider: "openai" | "elevenlabs" | "gemini";
  model: string;
  voice: string;
  text: string;
  apiKey: string;
}): Promise<Response> {
  const text = input.text.trim().slice(0, 2500);
  if (!text) throw new Error("Nothing to read aloud.");
  if (input.provider === "openai") return openaiSpeech(input.model, input.voice, text, input.apiKey);
  if (input.provider === "elevenlabs") return elevenSpeech(input.model, input.voice, text, input.apiKey);
  return geminiSpeech(input.model, input.voice, text, input.apiKey);
}

async function openaiSpeech(model: string, voice: string, text: string, apiKey: string): Promise<Response> {
  const body: Record<string, unknown> = {
    model: asModel(model),
    voice,
    input: text,
    response_format: "mp3",
  };
  if (model === "gpt-4o-mini-tts") body.instructions = "Speak clearly, calmly, and at a natural pace.";
  const res = await fetch("https://api.openai.com/v1/audio/speech", {
    method: "POST",
    headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error(await errorText(res, apiKey));
  const buf = await res.arrayBuffer();
  return new Response(buf, {
    headers: { "Content-Type": "audio/mpeg", "Cache-Control": "no-store" },
  });
}

async function elevenSpeech(model: string, voice: string, text: string, apiKey: string): Promise<Response> {
  if (!/^[A-Za-z0-9]{8,40}$/.test(voice)) throw new Error("Enter a valid ElevenLabs voice id.");
  const res = await fetch(
    `https://api.elevenlabs.io/v1/text-to-speech/${voice}?output_format=mp3_44100_64`,
    {
      method: "POST",
      headers: {
        "xi-api-key": apiKey,
        "Content-Type": "application/json",
        Accept: "audio/mpeg",
      },
      body: JSON.stringify({
        text,
        model_id: asModel(model),
      }),
    },
  );
  if (!res.ok) throw new Error(await errorText(res, apiKey));
  const buf = await res.arrayBuffer();
  return new Response(buf, {
    headers: { "Content-Type": "audio/mpeg", "Cache-Control": "no-store" },
  });
}

async function geminiSpeech(model: string, voice: string, text: string, apiKey: string): Promise<Response> {
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(asModel(model))}:generateContent`;
  const res = await fetch(url, {
    method: "POST",
    headers: { "x-goog-api-key": apiKey, "Content-Type": "application/json" },
    body: JSON.stringify({
      contents: [{ parts: [{ text }] }],
      generationConfig: {
        responseModalities: ["AUDIO"],
        speechConfig: { voiceConfig: { prebuiltVoiceConfig: { voiceName: voice } } },
      },
    }),
  });
  if (!res.ok) throw new Error(await errorText(res, apiKey));
  const json = (await res.json()) as {
    candidates?: { content?: { parts?: { inlineData?: { mimeType?: string; data?: string } }[] } }[];
  };
  const inline = json.candidates?.[0]?.content?.parts?.find((p) => p.inlineData?.data)?.inlineData;
  if (!inline?.data) throw new Error("Gemini did not return audio. Check the speech model id.");
  const bytes = bodyBytes(new Uint8Array(Buffer.from(inline.data, "base64")));
  const mime = inline.mimeType || "";
  if (mime.includes("mpeg") || mime.includes("mp3") || mime.includes("wav")) {
    const type = mime.includes("wav") ? "audio/wav" : "audio/mpeg";
    return new Response(bytes, { headers: { "Content-Type": type, "Cache-Control": "no-store" } });
  }
  const rate = /rate=(\d+)/.exec(mime)?.[1];
  const wav = pcmToWav(new Uint8Array(bytes), rate ? Number(rate) : 24000);
  return new Response(wav, { headers: { "Content-Type": "audio/wav", "Cache-Control": "no-store" } });
}

function bodyBytes(bytes: Uint8Array): ArrayBuffer {
  const copy = new ArrayBuffer(bytes.byteLength);
  new Uint8Array(copy).set(bytes);
  return copy;
}

function pcmToWav(pcm: Uint8Array, sampleRate: number): ArrayBuffer {
  const header = new ArrayBuffer(44);
  const view = new DataView(header);
  const write = (offset: number, value: string) => {
    for (let i = 0; i < value.length; i += 1) view.setUint8(offset + i, value.charCodeAt(i));
  };
  write(0, "RIFF");
  view.setUint32(4, 36 + pcm.byteLength, true);
  write(8, "WAVE");
  write(12, "fmt ");
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true);
  view.setUint16(22, 1, true);
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, sampleRate * 2, true);
  view.setUint16(32, 2, true);
  view.setUint16(34, 16, true);
  write(36, "data");
  view.setUint32(40, pcm.byteLength, true);
  const wav = new ArrayBuffer(44 + pcm.byteLength);
  const out = new Uint8Array(wav);
  out.set(new Uint8Array(header), 0);
  out.set(pcm, 44);
  return wav;
}

export async function transcribe(form: FormData): Promise<string> {
  const provider = form.get("provider");
  const model = asModel(form.get("model"));
  const apiKey = asKey(form.get("apiKey"));
  const file = form.get("file");
  if (!(file instanceof File)) throw new Error("No recording was received.");
  if (file.size > 8_000_000) throw new Error("That recording is too long. Keep it under a minute.");
  if (provider !== "openai" && provider !== "groq") throw new Error("Choose a transcription model.");
  const url =
    provider === "groq"
      ? "https://api.groq.com/openai/v1/audio/transcriptions"
      : "https://api.openai.com/v1/audio/transcriptions";
  const body = new FormData();
  body.set("file", file, file.name || "speech.webm");
  body.set("model", model);
  const res = await fetch(url, {
    method: "POST",
    headers: { Authorization: `Bearer ${apiKey}` },
    body,
  });
  if (!res.ok) throw new Error(await errorText(res, apiKey));
  const json = (await res.json()) as { text?: string };
  const text = json.text?.trim();
  if (!text) throw new Error("No speech was detected.");
  return text;
}

export function parseChatBody(raw: unknown, origin?: string): Parameters<typeof streamChat>[0] {
  if (!raw || typeof raw !== "object") throw new Error("Missing request.");
  const body = raw as Record<string, unknown>;
  const provider = asProvider(body.provider);
  const model = asModel(body.model);
  const apiKey = asKey(body.apiKey);
  if (!Array.isArray(body.messages) || body.messages.length === 0) {
    throw new Error("Write a message first.");
  }
  if (body.messages.length > 40) throw new Error("This chat is too long to send. Start a new one.");
  const messages: ChatTurn[] = [];
  for (const item of body.messages) {
    if (!item || typeof item !== "object") continue;
    const role = (item as { role?: unknown }).role;
    const content = (item as { content?: unknown }).content;
    if ((role !== "system" && role !== "user" && role !== "assistant") || typeof content !== "string") {
      continue;
    }
    const trimmed = content.trim().slice(0, 16_000);
    if (!trimmed) continue;
    messages.push({ role, content: trimmed });
  }
  if (!messages.some((m) => m.role === "user")) throw new Error("Write a message first.");
  const temperatureRaw = typeof body.temperature === "number" ? body.temperature : 0.7;
  const temperature = Math.min(1.5, Math.max(0, temperatureRaw));
  const customBase = typeof body.customBase === "string" ? body.customBase.slice(0, 300) : undefined;
  return {
    provider,
    model,
    apiKey,
    messages,
    temperature,
    customBase,
    probe: body.probe === true,
    origin,
  };
}
