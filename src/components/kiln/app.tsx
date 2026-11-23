import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import {
  Check,
  Copy,
  Menu,
  Mic,
  Moon,
  Plus,
  RotateCcw,
  Search,
  Send,
  Settings,
  Square,
  Sun,
  Trash2,
  Volume2,
  X,
} from "lucide-react";
import {
  KEY_FIELDS,
  PROVIDERS,
  TEXT_MODELS,
  ELEVEN_MODELS,
  ELEVEN_VOICES,
  GEMINI_TTS_MODELS,
  GEMINI_VOICES,
  GROQ_STT_MODELS,
  OPENAI_STT_MODELS,
  OPENAI_TTS_MODELS,
  OPENAI_VOICES,
  modelLabel,
  providerById,
  type ProviderId,
} from "@/lib/kiln/catalog";
import { pickRecorderMime, postChat, speakText, stopSpeech, transcribeBlob } from "@/lib/kiln/client";
import { Markdown } from "@/lib/kiln/markdown";
import {
  applyTheme,
  resolvedDark,
  useKiln,
  type ChatMessage,
  type ThemeMode,
  type VoiceSettings,
} from "@/lib/kiln/store";

const PROMPTS = [
  "Explain shear force like I am new to it",
  "Tighten this anime recap into 5 lines",
  "Give me a calm plan for the next hour",
];

function when(ts: number) {
  const date = new Date(ts);
  const now = new Date();
  if (date.toDateString() === now.toDateString()) {
    return date.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
  }
  return date.toLocaleDateString([], { month: "short", day: "numeric" });
}

function Sheet({
  open,
  title,
  onClose,
  side,
  children,
}: {
  open: boolean;
  title: string;
  onClose: () => void;
  side: "left" | "right";
  children: ReactNode;
}) {
  useEffect(() => {
    if (!open) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  if (!open) return null;
  return (
    <div className="fixed inset-0 z-40">
      <button type="button" className="absolute inset-0 bg-ink/40" aria-label="Close" onClick={onClose} />
      <div
        role="dialog"
        aria-modal="true"
        aria-label={title}
        className={`absolute inset-y-0 flex w-full max-w-md flex-col bg-bg ${side === "left" ? "left-0" : "right-0"}`}
      >
        <div className="flex h-14 shrink-0 items-center justify-between gap-3 border-b border-line px-4">
          <h2 className="font-display text-xl font-semibold text-fg">{title}</h2>
          <button type="button" className="grid size-11 place-items-center rounded-full text-fg" onClick={onClose} aria-label="Close">
            <X className="size-5" />
          </button>
        </div>
        <div className="thread-scroll min-h-0 flex-1">{children}</div>
      </div>
    </div>
  );
}

export function KilnApp() {
  const chats = useKiln((s) => s.chats);
  const activeId = useKiln((s) => s.activeId);
  const theme = useKiln((s) => s.theme);
  const selection = useKiln((s) => s.selection);
  const keys = useKiln((s) => s.keys);
  const customBase = useKiln((s) => s.customBase);
  const systemPrompt = useKiln((s) => s.systemPrompt);
  const temperature = useKiln((s) => s.temperature);
  const voice = useKiln((s) => s.voice);
  const setTheme = useKiln((s) => s.setTheme);
  const setSelection = useKiln((s) => s.setSelection);
  const setKey = useKiln((s) => s.setKey);
  const clearKey = useKiln((s) => s.clearKey);
  const setCustomBase = useKiln((s) => s.setCustomBase);
  const setSystemPrompt = useKiln((s) => s.setSystemPrompt);
  const setTemperature = useKiln((s) => s.setTemperature);
  const setVoice = useKiln((s) => s.setVoice);
  const startChat = useKiln((s) => s.startChat);
  const setActive = useKiln((s) => s.setActive);
  const deleteChat = useKiln((s) => s.deleteChat);
  const appendMessage = useKiln((s) => s.appendMessage);
  const updateMessage = useKiln((s) => s.updateMessage);
  const removeMessage = useKiln((s) => s.removeMessage);
  const clearChats = useKiln((s) => s.clearChats);

  const [chatsOpen, setChatsOpen] = useState(false);
  const [modelsOpen, setModelsOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [draft, setDraft] = useState("");
  const [banner, setBanner] = useState("");
  const [busy, setBusy] = useState(false);
  const [recording, setRecording] = useState(false);
  const [speakingId, setSpeakingId] = useState<string | null>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null);
  const [focusKey, setFocusKey] = useState<string | null>(null);
  const [probe, setProbe] = useState<string | null>(null);

  const threadRef = useRef<HTMLDivElement>(null);
  const pinRef = useRef(true);
  const abortRef = useRef<AbortController | null>(null);
  const recorderRef = useRef<MediaRecorder | null>(null);
  const boxRef = useRef<HTMLTextAreaElement>(null);
  const active = chats.find((chat) => chat.id === activeId) ?? null;
  const [dark, setDark] = useState(true);

  useEffect(() => {
    const sync = () => setDark(resolvedDark(useKiln.getState().theme));
    void Promise.resolve(useKiln.persist.rehydrate()).finally(() => {
      useKiln.setState({ hydrated: true });
      applyTheme(useKiln.getState().theme);
      sync();
    });
    const media = window.matchMedia("(prefers-color-scheme: dark)");
    const onScheme = () => {
      if (useKiln.getState().theme === "system") {
        applyTheme("system");
        sync();
      }
    };
    media.addEventListener("change", onScheme);
    return () => media.removeEventListener("change", onScheme);
  }, []);

  useEffect(() => {
    setDark(resolvedDark(theme));
  }, [theme]);

  useEffect(() => {
    if (!settingsOpen || !focusKey) return;
    document.getElementById(`key-${focusKey}`)?.scrollIntoView({ block: "center" });
  }, [settingsOpen, focusKey]);

  useEffect(() => {
    const el = threadRef.current;
    if (!el || !pinRef.current) return;
    el.scrollTop = el.scrollHeight;
  }, [active?.messages, busy]);

  useEffect(() => {
    const box = boxRef.current;
    if (!box) return;
    box.style.height = "0px";
    box.style.height = `${Math.min(box.scrollHeight, 160)}px`;
  }, [draft]);

  function stop() {
    abortRef.current?.abort();
  }

  function needKey(provider: ProviderId) {
    const name = providerById(provider).name;
    setBanner(`Add your ${name} key.`);
    setFocusKey(provider);
    setSettingsOpen(true);
  }

  async function runReply(chatId: string, asstId: string, prior: { role: "system" | "user" | "assistant"; content: string }[]) {
    const state = useKiln.getState();
    const key = state.keys[state.selection.provider] ?? "";
    if (key.trim().length < 8) {
      needKey(state.selection.provider);
      removeMessage(chatId, asstId);
      return;
    }
    if (state.selection.provider === "custom" && !state.customBase.trim()) {
      setBanner("Add the custom endpoint URL in Settings.");
      setFocusKey("custom");
      setSettingsOpen(true);
      removeMessage(chatId, asstId);
      return;
    }
    setBusy(true);
    setBanner("");
    const acc = { text: "" };
    let timer = 0;
    const flush = () => {
      timer = 0;
      updateMessage(chatId, asstId, { content: acc.text });
    };
    const ctrl = new AbortController();
    abortRef.current = ctrl;
    try {
      await postChat(
        {
          provider: state.selection.provider,
          model: state.selection.model,
          apiKey: key,
          temperature: state.temperature,
          customBase: state.customBase,
          messages: prior,
        },
        ctrl.signal,
        (delta) => {
          acc.text += delta;
          if (!timer) timer = window.setTimeout(flush, 80);
        },
      );
      window.clearTimeout(timer);
      const finalText = acc.text.trim();
      if (!finalText) {
        updateMessage(chatId, asstId, {
          content: "The model returned an empty reply. Try another model, or check the key.",
          pending: false,
          error: true,
        });
        return;
      }
      updateMessage(chatId, asstId, { content: acc.text, pending: false, error: false });
      if (state.voice.autoSpeak && state.voice.tts !== "off") {
        void playVoice(asstId, acc.text);
      }
    } catch (error) {
      window.clearTimeout(timer);
      if (ctrl.signal.aborted) {
        updateMessage(chatId, asstId, {
          content: acc.text || "Stopped.",
          pending: false,
          error: !acc.text,
        });
      } else {
        const message = error instanceof Error ? error.message : "The model could not answer.";
        updateMessage(chatId, asstId, { content: message, pending: false, error: true });
      }
    } finally {
      setBusy(false);
      abortRef.current = null;
    }
  }

  async function send(text: string) {
    const clean = text.trim();
    if (!clean || busy) return;
    const state = useKiln.getState();
    let chatId = state.activeId;
    if (!chatId || !state.chats.some((chat) => chat.id === chatId)) chatId = startChat();
    const user: ChatMessage = { id: crypto.randomUUID(), role: "user", content: clean, createdAt: Date.now() };
    const asst: ChatMessage = {
      id: crypto.randomUUID(),
      role: "assistant",
      content: "",
      createdAt: Date.now(),
      pending: true,
    };
    appendMessage(chatId, user);
    appendMessage(chatId, asst);
    setDraft("");
    pinRef.current = true;
    const prompt = state.systemPrompt.trim();
    const history = [
      ...(prompt ? [{ role: "system" as const, content: prompt }] : []),
      ...useKiln
        .getState()
        .chats.find((chat) => chat.id === chatId)!
        .messages.filter((m) => m.id !== asst.id && m.content && !m.error)
        .map((m) => ({ role: m.role, content: m.content })),
    ];
    await runReply(chatId, asst.id, history);
  }

  async function regenerate() {
    if (busy || !active) return;
    const msgs = active.messages;
    const last = msgs[msgs.length - 1];
    if (last?.role !== "assistant") return;
    const user = [...msgs].reverse().find((m) => m.role === "user" && !m.error);
    if (!user) return;
    removeMessage(active.id, last.id);
    const asst: ChatMessage = {
      id: crypto.randomUUID(),
      role: "assistant",
      content: "",
      createdAt: Date.now(),
      pending: true,
    };
    appendMessage(active.id, asst);
    const prompt = useKiln.getState().systemPrompt.trim();
    const history = [
      ...(prompt ? [{ role: "system" as const, content: prompt }] : []),
      ...useKiln
        .getState()
        .chats.find((chat) => chat.id === active.id)!
        .messages.filter((m) => m.id !== asst.id && m.content && !m.error)
        .map((m) => ({ role: m.role, content: m.content })),
    ];
    await runReply(active.id, asst.id, history);
  }

  async function playVoice(messageId: string, text: string) {
    const state = useKiln.getState();
    const choice = state.voice.tts;
    if (choice === "off") {
      setBanner("Pick a voice model in Settings.");
      setFocusKey(null);
      setSettingsOpen(true);
      return;
    }
    const spec =
      choice === "openai"
        ? { provider: "openai" as const, model: state.voice.openaiTtsModel, voice: state.voice.openaiVoice, keyId: "openai" }
        : choice === "elevenlabs"
          ? { provider: "elevenlabs" as const, model: state.voice.elevenModel, voice: state.voice.elevenVoice, keyId: "elevenlabs" }
          : { provider: "gemini" as const, model: state.voice.geminiTtsModel, voice: state.voice.geminiVoice, keyId: "google" };
    const apiKey = state.keys[spec.keyId] ?? "";
    if (apiKey.trim().length < 8) {
      setFocusKey(spec.keyId);
      setBanner("Add the key for that voice provider.");
      setSettingsOpen(true);
      return;
    }
    setSpeakingId(messageId);
    setBanner("");
    try {
      await speakText({ provider: spec.provider, model: spec.model, voice: spec.voice, text, apiKey });
    } catch (error) {
      if (speakingId === messageId || true) {
        setBanner(error instanceof Error ? error.message : "Could not play that voice.");
      }
    } finally {
      setSpeakingId((current) => (current === messageId ? null : current));
    }
  }

  async function toggleMic() {
    if (recorderRef.current) {
      recorderRef.current.stop();
      return;
    }
    const state = useKiln.getState();
    const keyId = state.voice.stt === "groq" ? "groq" : "openai";
    if ((state.keys[keyId] ?? "").trim().length < 8) {
      setFocusKey(keyId);
      setBanner(state.voice.stt === "groq" ? "Add a Groq key to transcribe speech." : "Add an OpenAI key to transcribe speech.");
      setSettingsOpen(true);
      return;
    }
    if (!navigator.mediaDevices?.getUserMedia || typeof MediaRecorder === "undefined") {
      setBanner("This browser cannot record audio. Try Chrome.");
      return;
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mime = pickRecorderMime();
      const rec = new MediaRecorder(stream, mime ? { mimeType: mime } : undefined);
      const chunks: Blob[] = [];
      rec.ondataavailable = (event) => {
        if (event.data.size) chunks.push(event.data);
      };
      rec.onstop = () => {
        stream.getTracks().forEach((track) => track.stop());
        recorderRef.current = null;
        setRecording(false);
        const blob = new Blob(chunks, { type: rec.mimeType || mime || "audio/webm" });
        if (blob.size < 800) {
          setBanner("That recording was too short.");
          return;
        }
        const latest = useKiln.getState();
        const model = latest.voice.stt === "groq" ? latest.voice.groqSttModel : latest.voice.openaiSttModel;
        void transcribeBlob(blob, latest.voice.stt, model, latest.keys[keyId] ?? "")
          .then((text) => {
            setDraft((current) => (current ? `${current.trim()} ${text}` : text));
            boxRef.current?.focus();
          })
          .catch((error: unknown) => {
            setBanner(error instanceof Error ? error.message : "Could not transcribe that recording.");
          });
      };
      recorderRef.current = rec;
      setRecording(true);
      setBanner("");
      rec.start();
      window.setTimeout(() => {
        if (recorderRef.current === rec && rec.state === "recording") rec.stop();
      }, 60_000);
    } catch {
      setBanner("Allow the microphone, then try again.");
    }
  }

  async function copyText(id: string, text: string) {
    try {
      await navigator.clipboard.writeText(text);
      setCopiedId(id);
      window.setTimeout(() => setCopiedId((current) => (current === id ? null : current)), 1200);
    } catch {
      setBanner("Could not copy that message.");
    }
  }

  async function testProvider(id: string) {
    if (id === "elevenlabs") {
      setBanner("Play a reply to check this key.");
      return;
    }
    const key = keys[id] ?? "";
    if (key.trim().length < 8) {
      setBanner("Paste a key first.");
      return;
    }
    const provider = id as ProviderId;
    const model =
      selection.provider === provider
        ? selection.model
        : (TEXT_MODELS.find((item) => item.provider === provider)?.model ?? "");
    if (!model || (provider === "custom" && !customBase.trim())) {
      setBanner(provider === "custom" ? "Add an endpoint and a model id first." : "Pick a model for that provider.");
      return;
    }
    setProbe(id);
    const ctrl = new AbortController();
    let saw = "";
    try {
      await postChat(
        {
          provider,
          model,
          apiKey: key,
          temperature: 0,
          customBase,
          probe: true,
          messages: [{ role: "user", content: "Reply with the single word OK." }],
        },
        ctrl.signal,
        (delta) => {
          saw += delta;
          if (saw.trim()) ctrl.abort();
        },
      );
      setBanner(saw.trim() ? `${providerById(provider).name} answered.` : "The key was accepted, but the reply was empty.");
    } catch (error) {
      if (saw.trim()) setBanner(`${providerById(provider).name} answered.`);
      else setBanner(error instanceof Error ? error.message : "That key did not work.");
    } finally {
      setProbe(null);
    }
  }

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return TEXT_MODELS.filter((model) => {
      if (!q) return true;
      return (
        model.label.toLowerCase().includes(q) ||
        model.model.toLowerCase().includes(q) ||
        providerById(model.provider).name.toLowerCase().includes(q)
      );
    });
  }, [query]);

  const currentLabel = modelLabel(selection.provider, selection.model);

  return (
    <main className="app-screen mx-auto flex w-full max-w-3xl flex-col bg-bg text-fg">
      <header className="flex h-14 shrink-0 items-center gap-1 border-b border-line px-2">
        <button type="button" className="grid size-11 place-items-center rounded-full" aria-label="Chats" onClick={() => setChatsOpen(true)}>
          <Menu className="size-5" />
        </button>
        <div className="min-w-0 flex-1">
          <h1 className="font-display text-xl font-semibold leading-none">Kiln</h1>
          <p className="truncate text-sm text-muted">{active?.title && active.title !== "New chat" ? active.title : "Your keys. Your models."}</p>
        </div>
        <button
          type="button"
          className="grid size-11 place-items-center rounded-full"
          aria-label={dark ? "Switch to light mode" : "Switch to dark mode"}
          onClick={() => setTheme(dark ? "light" : "dark")}
        >
          {dark ? <Sun className="size-5" /> : <Moon className="size-5" />}
        </button>
        <button type="button" className="grid size-11 place-items-center rounded-full" aria-label="Settings" onClick={() => setSettingsOpen(true)}>
          <Settings className="size-5" />
        </button>
      </header>

      <div
        ref={threadRef}
        className="thread-scroll min-h-0 flex-1 px-4 py-4"
        onScroll={(event) => {
          const el = event.currentTarget;
          pinRef.current = el.scrollHeight - el.scrollTop - el.clientHeight < 80;
        }}
      >
        {!active || active.messages.length === 0 ? (
          <div className="flex min-h-full flex-col justify-end gap-6 pb-4">
            <div className="max-w-sm">
              <img src="/favicon.svg" alt="" width={48} height={48} className="mb-4 size-12 rounded-xl" />
              <p className="font-display text-3xl font-semibold leading-tight">Bring a key. Pick a model. Start a fire.</p>
            </div>
            <div className="flex flex-col gap-2">
              {PROMPTS.map((prompt) => (
                <button
                  key={prompt}
                  type="button"
                  className="rounded-2xl border border-line bg-surface px-4 py-3 text-left text-base leading-snug"
                  onClick={() => {
                    setDraft(prompt);
                    boxRef.current?.focus();
                  }}
                >
                  {prompt}
                </button>
              ))}
            </div>
          </div>
        ) : (
          <div className="flex flex-col gap-4">
            {active.messages.map((message, index) => (
              <MessageRow
                key={message.id}
                message={message}
                isLast={index === active.messages.length - 1}
                copied={copiedId === message.id}
                speaking={speakingId === message.id}
                onCopy={() => void copyText(message.id, message.content)}
                onSpeak={() => {
                  if (speakingId === message.id) {
                    stopSpeech();
                    setSpeakingId(null);
                    return;
                  }
                  void playVoice(message.id, message.content);
                }}
                onRetry={() => void regenerate()}
              />
            ))}
          </div>
        )}
      </div>

      <div className="safe-bottom shrink-0 border-t border-line bg-bg px-3 pt-2">
        {banner ? (
          <p className="mb-2 rounded-xl bg-surface-2 px-3 py-2 text-sm leading-snug text-fg" role="status">
            {banner}
          </p>
        ) : null}
        <div className="mb-2 flex items-center gap-2">
          <button
            type="button"
            className="inline-flex h-11 max-w-full items-center gap-2 rounded-full border border-line bg-surface px-3 text-sm"
            onClick={() => setModelsOpen(true)}
          >
            <span className="truncate">{currentLabel}</span>
            <span className="shrink-0 text-muted">{providerById(selection.provider).name}</span>
          </button>
          {busy ? (
            <button type="button" className="ml-auto inline-flex h-11 items-center gap-2 rounded-full bg-ink px-3 text-sm text-paper" onClick={stop}>
              <Square className="size-4" />
              Stop
            </button>
          ) : null}
        </div>
        <form
          className="flex items-end gap-2 rounded-3xl border border-line bg-surface px-2 py-1"
          onSubmit={(event) => {
            event.preventDefault();
            void send(draft);
          }}
        >
          <button
            type="button"
            className={`grid size-11 shrink-0 place-items-center rounded-full ${recording ? "text-accent" : "text-fg"}`}
            aria-label={recording ? "Stop recording" : "Record a message"}
            aria-pressed={recording}
            onClick={() => void toggleMic()}
          >
            {recording ? <span className="caret size-3 rounded-full bg-accent" /> : <Mic className="size-5" />}
          </button>
          <label className="min-w-0 flex-1 py-2">
            <span className="sr-only">Message</span>
            <textarea
              ref={boxRef}
              rows={1}
              value={draft}
              maxLength={8000}
              placeholder={recording ? "Listening…" : "Message"}
              className="max-h-40 w-full resize-none bg-transparent text-base leading-normal text-fg outline-none placeholder:text-muted"
              onChange={(event) => setDraft(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === "Enter" && !event.shiftKey && !event.nativeEvent.isComposing) {
                  if (window.matchMedia("(pointer: coarse)").matches) return;
                  event.preventDefault();
                  void send(draft);
                }
              }}
            />
          </label>
          <button
            type="submit"
            className="mb-1 grid size-11 shrink-0 place-items-center rounded-full bg-accent text-accent-fg disabled:opacity-40"
            aria-label="Send"
            disabled={busy || !draft.trim()}
          >
            <Send className="size-5" />
          </button>
        </form>
      </div>

      <Sheet open={chatsOpen} title="Chats" side="left" onClose={() => setChatsOpen(false)}>
        <div className="flex flex-col gap-1 p-3">
          <button
            type="button"
            className="mb-2 inline-flex h-11 items-center justify-center gap-2 rounded-full bg-accent text-accent-fg"
            onClick={() => {
              stop();
              const id = startChat();
              setActive(id);
              setChatsOpen(false);
              setDraft("");
            }}
          >
            <Plus className="size-5" />
            New chat
          </button>
          {chats.length === 0 ? <p className="px-2 py-6 text-sm text-muted">No chats yet.</p> : null}
          {chats.map((chat) => (
            <div key={chat.id} className={`flex items-center gap-1 rounded-2xl ${chat.id === activeId ? "bg-surface-2" : ""}`}>
              <button
                type="button"
                className="min-w-0 flex-1 px-3 py-3 text-left"
                onClick={() => {
                  stop();
                  setActive(chat.id);
                  setChatsOpen(false);
                }}
              >
                <span className="block truncate text-base">{chat.title}</span>
                <span className="text-sm text-muted">{when(chat.updatedAt)}</span>
              </button>
              {confirmDelete === chat.id ? (
                <button
                  type="button"
                  className="px-3 text-sm text-accent"
                  onClick={() => {
                    deleteChat(chat.id);
                    setConfirmDelete(null);
                  }}
                >
                  Delete
                </button>
              ) : (
                <button type="button" className="grid size-11 place-items-center" aria-label={`Delete ${chat.title}`} onClick={() => setConfirmDelete(chat.id)}>
                  <Trash2 className="size-4" />
                </button>
              )}
            </div>
          ))}
        </div>
      </Sheet>

      <Sheet open={modelsOpen} title="Models" side="right" onClose={() => setModelsOpen(false)}>
        <div className="flex flex-col gap-4 p-4">
          <label className="flex h-11 items-center gap-2 rounded-full border border-line bg-surface px-3">
            <Search className="size-4 text-muted" />
            <span className="sr-only">Search models</span>
            <input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Search"
              className="w-full bg-transparent text-base outline-none"
            />
          </label>
          {PROVIDERS.filter((provider) => provider.id !== "custom").map((provider) => {
            const models = filtered.filter((model) => model.provider === provider.id);
            if (models.length === 0) return null;
            const hasKey = (keys[provider.id] ?? "").trim().length >= 8;
            return (
              <section key={provider.id}>
                <div className="mb-2 flex items-baseline justify-between gap-3">
                  <h3 className="text-sm font-semibold tracking-wide text-muted">{provider.name}</h3>
                  <span className="text-sm text-muted">{hasKey ? "Key saved" : "No key"}</span>
                </div>
                <div className="flex flex-col gap-1">
                  {models.map((model) => {
                    const selected = selection.provider === model.provider && selection.model === model.model;
                    return (
                      <button
                        key={model.model}
                        type="button"
                        className={`rounded-2xl px-3 py-3 text-left ${selected ? "bg-ink text-paper" : "bg-surface"}`}
                        onClick={() => {
                          setSelection({ provider: model.provider, model: model.model });
                          setModelsOpen(false);
                          if (!hasKey) needKey(model.provider);
                        }}
                      >
                        <span className="block text-base">{model.label}</span>
                      </button>
                    );
                  })}
                </div>
              </section>
            );
          })}
          <section className="rounded-2xl border border-line p-3">
            <h3 className="text-sm font-semibold text-muted">Model id</h3>
            <input
              value={selection.model}
              spellCheck={false}
              autoCapitalize="off"
              onChange={(event) => setSelection({ ...selection, model: event.target.value.trim() })}
              className="mt-3 h-11 w-full rounded-xl border border-line bg-surface px-3 font-mono text-sm outline-none"
            />
            <button
              type="button"
              className="mt-3 text-sm text-accent"
              onClick={() => {
                setSelection({ provider: "custom", model: selection.model || "model-id" });
              }}
            >
              Use a custom endpoint instead
            </button>
            {selection.provider === "custom" ? (
              <label className="mt-3 block text-sm">
                Endpoint
                <input
                  value={customBase}
                  spellCheck={false}
                  autoCapitalize="off"
                  placeholder="https://api.example.com/v1"
                  onChange={(event) => setCustomBase(event.target.value)}
                  className="mt-1 h-11 w-full rounded-xl border border-line bg-surface px-3 text-base outline-none"
                />
              </label>
            ) : null}
          </section>
        </div>
      </Sheet>

      <Sheet
        open={settingsOpen}
        title="Settings"
        side="right"
        onClose={() => {
          setSettingsOpen(false);
          setFocusKey(null);
        }}
      >
        <div className="flex flex-col gap-6 p-4 pb-16">
          <section>
            <h3 className="mb-2 text-sm font-semibold text-muted">Appearance</h3>
            <div className="grid grid-cols-3 gap-2">
              {(["light", "dark", "system"] as ThemeMode[]).map((mode) => (
                <button
                  key={mode}
                  type="button"
                  className={`h-11 rounded-full border text-sm capitalize ${theme === mode ? "border-ink bg-ink text-paper" : "border-line bg-surface"}`}
                  onClick={() => setTheme(mode)}
                >
                  {mode}
                </button>
              ))}
            </div>
          </section>

          <section>
            <h3 className="text-sm font-semibold text-muted">API keys</h3>
            <div className="mt-3 flex flex-col gap-3">
              {KEY_FIELDS.map((field) => (
                <label key={field.id} id={`key-${field.id}`} className="block rounded-2xl border border-line bg-surface p-3">
                  <span className="flex items-baseline justify-between gap-2">
                    <span className="text-base">{field.label}</span>
                    {(keys[field.id] ?? "").length >= 8 ? <span className="text-sm text-muted">Saved</span> : null}
                  </span>
                  <input
                    type="password"
                    value={keys[field.id] ?? ""}
                    autoComplete="off"
                    autoCapitalize="off"
                    spellCheck={false}
                    placeholder={field.hint}
                    onChange={(event) => setKey(field.id, event.target.value)}
                    className="mt-2 h-11 w-full rounded-xl border border-line bg-bg px-3 text-base outline-none"
                  />
                  <span className="mt-2 flex gap-3">
                    <button type="button" className="text-sm text-accent" onClick={() => void testProvider(field.id)}>
                      {probe === field.id ? "Checking…" : "Test key"}
                    </button>
                    {(keys[field.id] ?? "").length > 0 ? (
                      <button type="button" className="text-sm text-muted" onClick={() => clearKey(field.id)}>
                        Remove
                      </button>
                    ) : null}
                  </span>
                </label>
              ))}
              <label className="block text-sm">
                Custom endpoint
                <input
                  value={customBase}
                  spellCheck={false}
                  autoCapitalize="off"
                  placeholder="https://api.example.com/v1"
                  onChange={(event) => setCustomBase(event.target.value)}
                  className="mt-1 h-11 w-full rounded-xl border border-line bg-surface px-3 text-base outline-none"
                />
              </label>
            </div>
          </section>

          <VoiceFields voice={voice} setVoice={setVoice} />

          <section>
            <h3 className="text-sm font-semibold text-muted">Replies</h3>
            <label className="mt-2 block text-sm">
              Temperature {temperature.toFixed(1)}
              <input
                type="range"
                min={0}
                max={1.2}
                step={0.1}
                value={temperature}
                onChange={(event) => setTemperature(Number(event.target.value))}
                className="mt-2 w-full"
              />
            </label>
            <label className="mt-3 block text-sm">
              Instructions
              <textarea
                value={systemPrompt}
                rows={4}
                onChange={(event) => setSystemPrompt(event.target.value)}
                className="mt-1 w-full rounded-xl border border-line bg-surface px-3 py-2 text-base leading-relaxed outline-none"
              />
            </label>
          </section>

          <section className="border-t border-line pt-4">
            <button type="button" className="text-sm text-accent" onClick={clearChats}>
              Delete all chats on this device
            </button>
          </section>
        </div>
      </Sheet>
    </main>
  );
}

function VoiceFields({ voice, setVoice }: { voice: VoiceSettings; setVoice: (patch: Partial<VoiceSettings>) => void }) {
  return (
    <section>
      <h3 className="text-sm font-semibold text-muted">Voice</h3>
      <div className="mt-3 grid grid-cols-2 gap-2">
        {(
          [
            ["off", "Off"],
            ["openai", "OpenAI"],
            ["elevenlabs", "ElevenLabs"],
            ["gemini", "Gemini"],
          ] as const
        ).map(([id, label]) => (
          <button
            key={id}
            type="button"
            className={`h-11 rounded-full border text-sm ${voice.tts === id ? "border-ink bg-ink text-paper" : "border-line bg-surface"}`}
            onClick={() => setVoice({ tts: id, autoSpeak: id === "off" ? false : voice.autoSpeak })}
          >
            {label}
          </button>
        ))}
      </div>
      {voice.tts === "openai" ? (
        <div className="mt-3 flex flex-col gap-2">
          <Select label="Speech model" value={voice.openaiTtsModel} onChange={(openaiTtsModel) => setVoice({ openaiTtsModel })} options={OPENAI_TTS_MODELS.map((m) => ({ value: m.id, label: m.label }))} />
          <Select label="Voice" value={voice.openaiVoice} onChange={(openaiVoice) => setVoice({ openaiVoice })} options={OPENAI_VOICES.map((v) => ({ value: v, label: v }))} />
        </div>
      ) : null}
      {voice.tts === "elevenlabs" ? (
        <div className="mt-3 flex flex-col gap-2">
          <Select label="Speech model" value={voice.elevenModel} onChange={(elevenModel) => setVoice({ elevenModel })} options={ELEVEN_MODELS.map((m) => ({ value: m.id, label: m.label }))} />
          <Select label="Voice" value={voice.elevenVoice} onChange={(elevenVoice) => setVoice({ elevenVoice })} options={ELEVEN_VOICES.map((v) => ({ value: v.id, label: v.label }))} />
          <label className="text-sm">
            Or a voice id
            <input
              value={voice.elevenVoice}
              spellCheck={false}
              autoCapitalize="off"
              onChange={(event) => setVoice({ elevenVoice: event.target.value.trim() })}
              className="mt-1 h-11 w-full rounded-xl border border-line bg-surface px-3 font-mono text-sm outline-none"
            />
          </label>
        </div>
      ) : null}
      {voice.tts === "gemini" ? (
        <div className="mt-3 flex flex-col gap-2">
          <Select label="Speech model" value={voice.geminiTtsModel} onChange={(geminiTtsModel) => setVoice({ geminiTtsModel })} options={GEMINI_TTS_MODELS.map((m) => ({ value: m.id, label: m.label }))} />
          <Select label="Voice" value={voice.geminiVoice} onChange={(geminiVoice) => setVoice({ geminiVoice })} options={GEMINI_VOICES.map((v) => ({ value: v, label: v }))} />
        </div>
      ) : null}
      <label className="mt-3 flex items-center justify-between gap-3 text-base">
        Read replies aloud
        <input
          type="checkbox"
          checked={voice.autoSpeak}
          disabled={voice.tts === "off"}
          onChange={(event) => setVoice({ autoSpeak: event.target.checked })}
          className="size-5"
        />
      </label>
      <div className="mt-4 grid grid-cols-2 gap-2">
        {(
          [
            ["groq", "Groq Whisper"],
            ["openai", "OpenAI transcribe"],
          ] as const
        ).map(([id, label]) => (
          <button
            key={id}
            type="button"
            className={`h-11 rounded-full border text-sm ${voice.stt === id ? "border-ink bg-ink text-paper" : "border-line bg-surface"}`}
            onClick={() => setVoice({ stt: id })}
          >
            {label}
          </button>
        ))}
      </div>
      <div className="mt-2">
        {voice.stt === "groq" ? (
          <Select label="Transcription model" value={voice.groqSttModel} onChange={(groqSttModel) => setVoice({ groqSttModel })} options={GROQ_STT_MODELS.map((m) => ({ value: m.id, label: m.label }))} />
        ) : (
          <Select label="Transcription model" value={voice.openaiSttModel} onChange={(openaiSttModel) => setVoice({ openaiSttModel })} options={OPENAI_STT_MODELS.map((m) => ({ value: m.id, label: m.label }))} />
        )}
      </div>
    </section>
  );
}

function Select({
  label,
  value,
  onChange,
  options,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  options: { value: string; label: string }[];
}) {
  return (
    <label className="block text-sm">
      {label}
      <select
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="mt-1 h-11 w-full rounded-xl border border-line bg-surface px-3 text-base outline-none"
      >
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
    </label>
  );
}

function MessageRow({
  message,
  isLast,
  copied,
  speaking,
  onCopy,
  onSpeak,
  onRetry,
}: {
  message: ChatMessage;
  isLast: boolean;
  copied: boolean;
  speaking: boolean;
  onCopy: () => void;
  onSpeak: () => void;
  onRetry: () => void;
}) {
  const mine = message.role === "user";
  return (
    <article className={`msg flex ${mine ? "justify-end" : "justify-start"}`}>
      <div className={`max-w-md ${mine ? "rounded-3xl rounded-br-md bg-ink px-4 py-3 text-paper" : "w-full"}`}>
        {mine ? (
          <p className="whitespace-pre-wrap text-base leading-relaxed">{message.content}</p>
        ) : message.pending ? (
          <p className="whitespace-pre-wrap text-base leading-relaxed">
            {message.content}
            <span className="caret ml-0.5 inline-block h-4 w-0.5 translate-y-0.5 bg-accent align-middle" />
          </p>
        ) : (
          <div className={`text-base leading-relaxed ${message.error ? "text-accent" : ""}`}>
            <Markdown text={message.content} />
          </div>
        )}
        {!mine && !message.pending && message.content ? (
          <div className="mt-2 flex items-center gap-1">
            <button type="button" className="grid size-11 place-items-center rounded-full text-muted" aria-label="Copy" onClick={onCopy}>
              {copied ? <Check className="size-4" /> : <Copy className="size-4" />}
            </button>
            <button type="button" className="grid size-11 place-items-center rounded-full text-muted" aria-label={speaking ? "Stop voice" : "Play AI voice"} onClick={onSpeak}>
              {speaking ? <Square className="size-4" /> : <Volume2 className="size-4" />}
            </button>
            {isLast ? (
              <button type="button" className="grid size-11 place-items-center rounded-full text-muted" aria-label="Regenerate" onClick={onRetry}>
                <RotateCcw className="size-4" />
              </button>
            ) : null}
            {speaking ? <span className="text-sm text-muted">AI voice</span> : null}
          </div>
        ) : null}
      </div>
    </article>
  );
}
