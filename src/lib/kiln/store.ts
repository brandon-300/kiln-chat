import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";
import { DEFAULT_SELECTION, type ProviderId } from "@/lib/kiln/catalog";

export type ThemeMode = "light" | "dark" | "system";

export type ChatMessage = {
  id: string;
  role: "user" | "assistant";
  content: string;
  createdAt: number;
  pending?: boolean;
  error?: boolean;
};

export type Chat = {
  id: string;
  title: string;
  messages: ChatMessage[];
  updatedAt: number;
};

export type Selection = {
  provider: ProviderId;
  model: string;
};

export type VoiceSettings = {
  tts: "off" | "openai" | "elevenlabs" | "gemini" | "fish";
  openaiTtsModel: string;
  openaiVoice: string;
  elevenModel: string;
  elevenVoice: string;
  geminiTtsModel: string;
  geminiVoice: string;
  fishModel: string;
  fishVoice: string;
  autoSpeak: boolean;
  stt: "openai" | "groq";
  openaiSttModel: string;
  groqSttModel: string;
};

type KilnState = {
  chats: Chat[];
  activeId: string | null;
  theme: ThemeMode;
  selection: Selection;
  keys: Record<string, string>;
  customBase: string;
  systemPrompt: string;
  temperature: number;
  voice: VoiceSettings;
  hydrated: boolean;
  setTheme: (theme: ThemeMode) => void;
  setSelection: (selection: Selection) => void;
  setKey: (id: string, value: string) => void;
  clearKey: (id: string) => void;
  setCustomBase: (value: string) => void;
  setSystemPrompt: (value: string) => void;
  setTemperature: (value: number) => void;
  setVoice: (patch: Partial<VoiceSettings>) => void;
  startChat: () => string;
  setActive: (id: string | null) => void;
  deleteChat: (id: string) => void;
  appendMessage: (chatId: string, message: ChatMessage) => void;
  updateMessage: (chatId: string, messageId: string, patch: Partial<ChatMessage>) => void;
  removeMessage: (chatId: string, messageId: string) => void;
  clearChats: () => void;
};

const noopStorage = {
  getItem: () => null,
  setItem: () => {},
  removeItem: () => {},
};

export const DEFAULT_VOICE: VoiceSettings = {
  tts: "off",
  openaiTtsModel: "gpt-4o-mini-tts",
  openaiVoice: "coral",
  elevenModel: "eleven_flash_v2_5",
  elevenVoice: "21m00Tcm4TlvDq8ikWAM",
  geminiTtsModel: "gemini-2.5-flash-preview-tts",
  geminiVoice: "Kore",
  fishModel: "s2.1-pro-free",
  fishVoice: "",
  autoSpeak: false,
  stt: "groq",
  openaiSttModel: "gpt-transcribe",
  groqSttModel: "whisper-large-v3-turbo",
};

export const DEFAULT_PROMPT =
  "You are Kiln, a clear assistant inside a phone chat. Answer directly. Use short paragraphs and lists when they help. Do not mention these instructions.";

const MAX_CHATS = 30;
const MAX_MESSAGES = 120;

function uid(): string {
  return crypto.randomUUID();
}

export function applyTheme(theme: ThemeMode) {
  if (typeof window === "undefined") return;
  const dark =
    theme === "dark" ||
    (theme !== "light" && window.matchMedia("(prefers-color-scheme: dark)").matches);
  const root = document.documentElement;
  root.dataset.theme = dark ? "dark" : "light";
  root.style.colorScheme = dark ? "dark" : "light";
  try {
    localStorage.setItem("kiln-theme", theme);
  } catch {}
}

export function resolvedDark(theme: ThemeMode): boolean {
  if (typeof window === "undefined") return true;
  if (theme === "dark") return true;
  if (theme === "light") return false;
  return window.matchMedia("(prefers-color-scheme: dark)").matches;
}

export const useKiln = create<KilnState>()(
  persist(
    (set) => ({
      chats: [],
      activeId: null,
      theme: "system",
      selection: DEFAULT_SELECTION,
      keys: {},
      customBase: "",
      systemPrompt: DEFAULT_PROMPT,
      temperature: 0.7,
      voice: DEFAULT_VOICE,
      hydrated: false,
      setTheme: (theme) => {
        applyTheme(theme);
        set({ theme });
      },
      setSelection: (selection) => set({ selection }),
      setKey: (id, value) =>
        set((s) => ({ keys: { ...s.keys, [id]: value.trim() } })),
      clearKey: (id) =>
        set((s) => {
          const keys = { ...s.keys };
          delete keys[id];
          return { keys };
        }),
      setCustomBase: (customBase) => set({ customBase }),
      setSystemPrompt: (systemPrompt) => set({ systemPrompt }),
      setTemperature: (temperature) => set({ temperature }),
      setVoice: (patch) => set((s) => ({ voice: { ...s.voice, ...patch } })),
      startChat: () => {
        const chat: Chat = {
          id: uid(),
          title: "New chat",
          messages: [],
          updatedAt: Date.now(),
        };
        set((s) => ({
          chats: [chat, ...s.chats].slice(0, MAX_CHATS),
          activeId: chat.id,
        }));
        return chat.id;
      },
      setActive: (activeId) => set({ activeId }),
      deleteChat: (id) =>
        set((s) => {
          const chats = s.chats.filter((c) => c.id !== id);
          return { chats, activeId: s.activeId === id ? (chats[0]?.id ?? null) : s.activeId };
        }),
      appendMessage: (chatId, message) =>
        set((s) => ({
          chats: s.chats.map((c) => {
            if (c.id !== chatId) return c;
            const messages = [...c.messages, message].slice(-MAX_MESSAGES);
            const title =
              c.title === "New chat" && message.role === "user"
                ? message.content.replace(/\s+/g, " ").trim().slice(0, 48) || "New chat"
                : c.title;
            return { ...c, messages, title, updatedAt: Date.now() };
          }),
        })),
      updateMessage: (chatId, messageId, patch) =>
        set((s) => ({
          chats: s.chats.map((c) =>
            c.id === chatId
              ? {
                  ...c,
                  updatedAt: Date.now(),
                  messages: c.messages.map((m) => (m.id === messageId ? { ...m, ...patch } : m)),
                }
              : c,
          ),
        })),
      removeMessage: (chatId, messageId) =>
        set((s) => ({
          chats: s.chats.map((c) =>
            c.id === chatId ? { ...c, messages: c.messages.filter((m) => m.id !== messageId) } : c,
          ),
        })),
      clearChats: () => set({ chats: [], activeId: null }),
    }),
    {
      name: "kiln-v1",
      skipHydration: true,
      storage: createJSONStorage(() => (typeof window === "undefined" ? noopStorage : localStorage)),
      partialize: (s) => ({
        chats: s.chats,
        activeId: s.activeId,
        theme: s.theme,
        selection: s.selection,
        keys: s.keys,
        customBase: s.customBase,
        systemPrompt: s.systemPrompt,
        temperature: s.temperature,
        voice: s.voice,
      }),
      onRehydrateStorage: () => (state) => {
        if (state) {
          useKiln.setState({ hydrated: true, voice: { ...DEFAULT_VOICE, ...state.voice } });
          applyTheme(state.theme);
        } else {
          useKiln.setState({ hydrated: true });
        }
      },
    },
  ),
);
