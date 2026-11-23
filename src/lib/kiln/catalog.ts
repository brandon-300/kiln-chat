export type ProviderId =
  | "groq"
  | "deepseek"
  | "google"
  | "openai"
  | "anthropic"
  | "xai"
  | "mistral"
  | "openrouter"
  | "custom";

export type Wire = "openai" | "anthropic" | "gemini";

export type ProviderInfo = {
  id: ProviderId;
  name: string;
  wire: Wire;
  base?: string;
  keyHint: string;
};

export type TextModel = {
  provider: ProviderId;
  model: string;
  label: string;
};

export const PROVIDERS: ProviderInfo[] = [
  { id: "groq", name: "Groq", wire: "openai", base: "https://api.groq.com/openai/v1", keyHint: "gsk_…" },
  { id: "deepseek", name: "DeepSeek", wire: "openai", base: "https://api.deepseek.com", keyHint: "sk-…" },
  { id: "google", name: "Google", wire: "gemini", keyHint: "AIza…" },
  { id: "openai", name: "OpenAI", wire: "openai", base: "https://api.openai.com/v1", keyHint: "sk-…" },
  { id: "anthropic", name: "Anthropic", wire: "anthropic", keyHint: "sk-ant-…" },
  { id: "xai", name: "xAI", wire: "openai", base: "https://api.x.ai/v1", keyHint: "xai-…" },
  { id: "mistral", name: "Mistral", wire: "openai", base: "https://api.mistral.ai/v1", keyHint: "…" },
  { id: "openrouter", name: "OpenRouter", wire: "openai", base: "https://openrouter.ai/api/v1", keyHint: "sk-or-…" },
  { id: "custom", name: "Custom", wire: "openai", keyHint: "your key" },
];

export const TEXT_MODELS: TextModel[] = [
  { provider: "groq", model: "openai/gpt-oss-20b", label: "GPT OSS 20B" },
  { provider: "groq", model: "openai/gpt-oss-120b", label: "GPT OSS 120B" },
  { provider: "groq", model: "qwen/qwen3.8-27b", label: "Qwen 3.8 27B" },
  { provider: "deepseek", model: "deepseek-flash", label: "DeepSeek Flash" },
  { provider: "deepseek", model: "deepseek-v4-pro", label: "DeepSeek V4 Pro" },
  { provider: "google", model: "gemini-4-hydrogen", label: "Gemini 4 Hydrogen" },
  { provider: "google", model: "gemini-4-neon", label: "Gemini 4 Neon" },
  { provider: "google", model: "gemini-4-carbon", label: "Gemini 4 Carbon" },
  { provider: "google", model: "gemini-2.5-flash", label: "Gemini 2.5 Flash" },
  { provider: "google", model: "gemini-2.5-pro", label: "Gemini 2.5 Pro" },
  { provider: "openai", model: "gpt-6-luna", label: "GPT-6 Luna" },
  { provider: "openai", model: "gpt-6.1-terra", label: "GPT-6.1 Terra" },
  { provider: "openai", model: "gpt-6.2-sol", label: "GPT-6.2 Sol" },
  { provider: "openai", model: "gpt-6.2-astra", label: "GPT-6.2 Astra" },
  { provider: "anthropic", model: "claude-haiku-5-5", label: "Claude Haiku 5.5" },
  { provider: "anthropic", model: "claude-sonnet-5-5", label: "Claude Sonnet 5.5" },
  { provider: "anthropic", model: "claude-opus-5-5", label: "Claude Opus 5.5" },
  { provider: "anthropic", model: "claude-fable-5-2", label: "Claude Fable 5.2" },
  { provider: "xai", model: "grok-4.5", label: "Grok 4.5" },
  { provider: "xai", model: "grok-4.6", label: "Grok 4.6" },
  { provider: "xai", model: "grok-4.7", label: "Grok 4.7" },
  { provider: "xai", model: "grok-4.20", label: "Grok 4.20" },
  { provider: "mistral", model: "mistral-small-2506", label: "Mistral Small" },
  { provider: "mistral", model: "magistral-small-2509", label: "Magistral Small" },
  { provider: "mistral", model: "codestral-2501", label: "Codestral" },
  { provider: "mistral", model: "mistral-large-2411", label: "Mistral Large" },
  { provider: "openrouter", model: "openai/gpt-6-luna", label: "GPT-6 Luna" },
  { provider: "openrouter", model: "openai/gpt-6.2-sol", label: "GPT-6.2 Sol" },
  { provider: "openrouter", model: "anthropic/claude-haiku-5.5", label: "Claude Haiku 5.5" },
  { provider: "openrouter", model: "anthropic/claude-sonnet-5.5", label: "Claude Sonnet 5.5" },
  { provider: "openrouter", model: "anthropic/claude-opus-5.5", label: "Claude Opus 5.5" },
  { provider: "openrouter", model: "google/gemini-4-hydrogen", label: "Gemini 4 Hydrogen" },
  { provider: "openrouter", model: "google/gemini-4-neon", label: "Gemini 4 Neon" },
  { provider: "openrouter", model: "google/gemini-4-carbon", label: "Gemini 4 Carbon" },
  { provider: "openrouter", model: "x-ai/grok-4.7", label: "Grok 4.7" },
  { provider: "openrouter", model: "deepseek/deepseek-v4.1-flash", label: "DeepSeek V4.1 Flash" },
  { provider: "openrouter", model: "qwen/qwen3.8-flash", label: "Qwen 3.8 Flash" },
  { provider: "openrouter", model: "qwen/qwen4-max", label: "Qwen 4 Max" },
  { provider: "openrouter", model: "mistralai/mistral-large-4-0", label: "Mistral Large 4" },
  { provider: "openrouter", model: "moonshotai/kimi-k3", label: "Kimi K3" },
];

export const OPENAI_TTS_MODELS = [
  { id: "gpt-4o-mini-tts", label: "GPT-4o mini TTS" },
  { id: "tts-1", label: "TTS-1" },
  { id: "tts-1-hd", label: "TTS-1 HD" },
];

export const OPENAI_VOICES = ["coral", "alloy", "ash", "ballad", "echo", "sage", "shimmer", "nova", "onyx", "fable", "verse", "marin"];

export const ELEVEN_MODELS = [
  { id: "eleven_flash_v2_5", label: "Flash v2.5" },
  { id: "eleven_turbo_v2_5", label: "Turbo v2.5" },
  { id: "eleven_multilingual_v2", label: "Multilingual v2" },
];

export const ELEVEN_VOICES = [
  { id: "21m00Tcm4TlvDq8ikWAM", label: "Rachel" },
  { id: "EXAVITQu4vr4xnSDxMaL", label: "Bella" },
  { id: "pNInz6obpgDQGcFmaJgB", label: "Adam" },
  { id: "TxGEqnHWrfWFTfGW9XjX", label: "Josh" },
  { id: "ErXwobaYiN019PkySvjV", label: "Antoni" },
  { id: "MF3mGyEYCl7XYWbV9V6O", label: "Elli" },
];

export const GEMINI_TTS_MODELS = [
  { id: "gemini-2.5-flash-preview-tts", label: "Gemini 2.5 Flash TTS" },
  { id: "gemini-3.8-flash-tts", label: "Gemini 3.8 Flash TTS" },
];

export const GEMINI_VOICES = ["Kore", "Puck", "Charon", "Zephyr", "Aoede", "Fenrir", "Leda", "Orus"];

export const OPENAI_STT_MODELS = [
  { id: "gpt-transcribe", label: "GPT Transcribe" },
  { id: "whisper-1", label: "Whisper" },
];

export const GROQ_STT_MODELS = [
  { id: "whisper-large-v3-turbo", label: "Whisper Large v3 Turbo" },
  { id: "whisper-large-v3", label: "Whisper Large v3" },
];

export function providerById(id: ProviderId): ProviderInfo {
  const found = PROVIDERS.find((p) => p.id === id);
  if (!found) throw new Error("Unknown provider");
  return found;
}

export function modelLabel(provider: ProviderId, model: string): string {
  return TEXT_MODELS.find((m) => m.provider === provider && m.model === model)?.label ?? model;
}

export const DEFAULT_SELECTION = { provider: "groq" as const, model: "openai/gpt-oss-20b" };

export const KEY_FIELDS: { id: string; label: string; hint: string }[] = [
  { id: "groq", label: "Groq", hint: "gsk_…" },
  { id: "deepseek", label: "DeepSeek", hint: "sk-…" },
  { id: "google", label: "Google AI", hint: "AIza…" },
  { id: "openai", label: "OpenAI", hint: "sk-…" },
  { id: "anthropic", label: "Anthropic", hint: "sk-ant-…" },
  { id: "xai", label: "xAI", hint: "xai-…" },
  { id: "mistral", label: "Mistral", hint: "API key" },
  { id: "openrouter", label: "OpenRouter", hint: "sk-or-…" },
  { id: "elevenlabs", label: "ElevenLabs", hint: "xi-…" },
  { id: "custom", label: "Custom endpoint", hint: "Bearer token" },
];
