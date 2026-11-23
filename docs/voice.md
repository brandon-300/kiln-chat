# Voice

Spoken replies are synthetic. They are not a person. While a reply is playing, Kiln shows the label "AI voice".

You supply the speech key. Nothing is spoken until you pick a voice provider.

## Speech

| Provider | Key | Models | Voices |
| --- | --- | --- | --- |
| OpenAI | OpenAI | `gpt-4o-mini-tts`, `tts-1`, `tts-1-hd` | coral, alloy, ash, ballad, echo, sage, shimmer, nova, onyx, fable, verse, marin |
| ElevenLabs | ElevenLabs | `eleven_flash_v2_5`, `eleven_turbo_v2_5`, `eleven_multilingual_v2` | Rachel, Bella, Adam, Josh, Antoni, Elli, or any voice id |
| Gemini | Google AI | `gemini-2.5-flash-preview-tts`, `gemini-3.8-flash-tts` | Kore, Puck, Charon, Zephyr, Aoede, Fenrir, Leda, Orus |

Read replies aloud uses the selected speech provider after each answer. Each clip is capped at 2500 characters. ElevenLabs audio is a small MP3. Gemini PCM is wrapped as WAV so the phone can play it.

Test key does not spend speech credit for ElevenLabs. Play a reply to check that key.

## Transcription

The microphone uses the transcription provider in Settings.

| Provider | Key | Models |
| --- | --- | --- |
| Groq | Groq | `whisper-large-v3-turbo`, `whisper-large-v3` |
| OpenAI | OpenAI | `gpt-transcribe`, `whisper-1` |

Tap the mic to start, tap again to stop. Recordings stop on their own after 60 seconds and must stay under about 8 MB. Chrome on Android is the expected browser. Allow the microphone when asked.
