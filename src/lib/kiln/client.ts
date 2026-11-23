import { previewPathPrefix } from "@/lib/preview-path-prefix";

export function apiUrl(path: string): string {
  if (typeof window === "undefined") return path;
  const prefix = previewPathPrefix(window.location.hostname, window.location.pathname);
  return prefix ? `${prefix}${path}` : path;
}

export type StreamEvent = { d?: string; error?: string; done?: boolean };

export async function readEventStream(
  res: Response,
  onEvent: (event: StreamEvent) => void,
  signal: AbortSignal,
) {
  const reader = res.body?.getReader();
  if (!reader) throw new Error("The connection closed before a reply arrived.");
  const decoder = new TextDecoder();
  let buf = "";
  const cancel = () => {
    reader.cancel().catch(() => {});
  };
  signal.addEventListener("abort", cancel);
  try {
    while (true) {
      if (signal.aborted) break;
      const { done, value } = await reader.read();
      if (done) break;
      buf += decoder.decode(value, { stream: true });
      let split = buf.indexOf("\n\n");
      while (split >= 0) {
        const raw = buf.slice(0, split);
        buf = buf.slice(split + 2);
        const line = raw
          .split(/\r?\n/)
          .map((item) => item.trim())
          .find((item) => item.startsWith("data:"));
        if (line) {
          try {
            onEvent(JSON.parse(line.slice(5).trim()) as StreamEvent);
          } catch {
          }
        }
        split = buf.indexOf("\n\n");
      }
    }
  } finally {
    signal.removeEventListener("abort", cancel);
  }
}

export async function postChat(body: unknown, signal: AbortSignal, onDelta: (text: string) => void) {
  const res = await fetch(apiUrl("/api/chat"), {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
    signal,
  });
  const ctype = res.headers.get("content-type") || "";
  if (!res.ok || ctype.includes("application/json")) {
    const json = (await res.json().catch(() => null)) as { error?: string } | null;
    throw new Error(json?.error || "The model could not answer.");
  }
  let error: string | null = null;
  await readEventStream(
    res,
    (event) => {
      if (event.error) error = event.error;
      if (event.d) onDelta(event.d);
    },
    signal,
  );
  if (error) throw new Error(error);
}

let currentAudio: HTMLAudioElement | null = null;
let currentUrl: string | null = null;

export function stopSpeech() {
  if (currentAudio) {
    currentAudio.pause();
    currentAudio.src = "";
    currentAudio = null;
  }
  if (currentUrl) {
    URL.revokeObjectURL(currentUrl);
    currentUrl = null;
  }
}

export async function speakText(body: unknown): Promise<void> {
  stopSpeech();
  const res = await fetch(apiUrl("/api/speak"), {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const ctype = res.headers.get("content-type") || "";
  if (!res.ok || ctype.includes("application/json")) {
    const json = (await res.json().catch(() => null)) as { error?: string } | null;
    throw new Error(json?.error || "Could not play that voice.");
  }
  const blob = await res.blob();
  const url = URL.createObjectURL(blob);
  currentUrl = url;
  const audio = new Audio(url);
  currentAudio = audio;
  audio.setAttribute("playsinline", "true");
  await new Promise<void>((resolve, reject) => {
    audio.onended = () => {
      stopSpeech();
      resolve();
    };
    audio.onerror = () => {
      stopSpeech();
      reject(new Error("This phone could not play that audio."));
    };
    audio.play().catch((error: unknown) => {
      stopSpeech();
      reject(error instanceof Error ? error : new Error("Playback was blocked."));
    });
  });
}

export async function transcribeBlob(blob: Blob, provider: string, model: string, apiKey: string) {
  const form = new FormData();
  const ext = blob.type.includes("mp4") ? "m4a" : blob.type.includes("wav") ? "wav" : "webm";
  form.set("file", blob, `speech.${ext}`);
  form.set("provider", provider);
  form.set("model", model);
  form.set("apiKey", apiKey);
  const res = await fetch(apiUrl("/api/transcribe"), { method: "POST", body: form });
  const json = (await res.json().catch(() => null)) as { text?: string; error?: string } | null;
  if (!res.ok || !json?.text) throw new Error(json?.error || "Could not transcribe that recording.");
  return json.text;
}

export function pickRecorderMime(): string {
  const types = ["audio/webm;codecs=opus", "audio/webm", "audio/mp4"];
  if (typeof MediaRecorder === "undefined") return "";
  return types.find((type) => MediaRecorder.isTypeSupported(type)) ?? "";
}
