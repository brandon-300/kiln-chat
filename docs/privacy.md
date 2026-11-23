# Privacy and keys

Keys and chats stay in local storage on the device. Kiln does not write them to a database.

Phone browsers block most model APIs. Each message, transcription, and speech request is relayed to the provider you chose. The relay sees the key only for that request and does not store it.

Do not use Kiln on a shared phone. Anyone who can open this browser can read the saved keys.

Custom endpoints must be public `https` URLs. Private network addresses are rejected.

A key shorter than 8 characters is treated as missing.
