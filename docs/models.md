# Text models

Pick a provider, then a model. The id in the model sheet is what Kiln sends. If a lab renames a model, replace that id.

| Provider | What the key is for | Wire |
| --- | --- | --- |
| Groq | Fast chat and Whisper transcription | OpenAI-compatible, `https://api.groq.com/openai/v1` |
| DeepSeek | DeepSeek chat | OpenAI-compatible, `https://api.deepseek.com` |
| Google | Gemini chat and Gemini speech | Gemini API |
| OpenAI | GPT chat, speech, and transcription | OpenAI-compatible, `https://api.openai.com/v1` |
| Anthropic | Claude chat | Messages API |
| xAI | Grok chat | OpenAI-compatible, `https://api.x.ai/v1` |
| Mistral | Mistral chat | OpenAI-compatible, `https://api.mistral.ai/v1` |
| OpenRouter | Many labs with one key | OpenAI-compatible, `https://openrouter.ai/api/v1` |
| Custom | Your own public OpenAI-compatible HTTPS endpoint | OpenAI-compatible |

## Built-in ids

Groq: `openai/gpt-oss-20b`, `openai/gpt-oss-120b`, `qwen/qwen3.8-27b`

DeepSeek: `deepseek-flash`, `deepseek-v4-pro`

Google: `gemini-4-hydrogen`, `gemini-4-neon`, `gemini-4-carbon`, `gemini-2.5-flash`, `gemini-2.5-pro`

OpenAI: `gpt-6-luna`, `gpt-6.1-terra`, `gpt-6.2-sol`, `gpt-6.2-astra`

Anthropic: `claude-haiku-5-5`, `claude-sonnet-5-5`, `claude-opus-5-5`, `claude-fable-5-2`

xAI: `grok-4.5`, `grok-4.6`, `grok-4.7`, `grok-4.20`

Mistral: `mistral-small-2506`, `magistral-small-2509`, `codestral-2501`, `mistral-large-2411`

OpenRouter examples: `openai/gpt-6-luna`, `openai/gpt-6.2-sol`, `anthropic/claude-haiku-5.5`, `anthropic/claude-sonnet-5.5`, `anthropic/claude-opus-5.5`, `google/gemini-4-hydrogen`, `google/gemini-4-neon`, `google/gemini-4-carbon`, `x-ai/grok-4.7`, `deepseek/deepseek-v4.1-flash`, `qwen/qwen3.8-flash`, `qwen/qwen4-max`, `mistralai/mistral-large-4-0`, `moonshotai/kimi-k3`

OpenRouter ids use a slash and sometimes a dot. Direct Anthropic ids use hyphens (`claude-opus-5-5`), not the OpenRouter spelling.

## Limits

Kiln sends the system instructions plus up to 40 recent turns, 2048 output tokens (32 on a key test). Temperature is omitted for OpenAI flagship calls, and retried without temperature if a provider rejects it. Replies stream. On a slow phone, the text updates about every 80ms and is shown as plain text until the reply finishes.
