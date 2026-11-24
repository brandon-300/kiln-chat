# On a modest phone

Kiln is aimed at phones like the Infinix Hot 50i (HD screen, a small processor, limited RAM).

- One screen, no heavy blur, no large shadows, and motion only on the typing caret.
- Fonts are a few small files (Outfit and Fraunces), not a full family.
- Long threads skip offscreen message layout. A chat keeps the latest 120 messages. The device keeps the latest 30 chats.
- Streaming text is plain until the reply is done, so the phone is not re-parsing markdown on every token.
- The composer uses the dynamic viewport so the keyboard does not cover the box.
- Install the APK from the GitHub release if you want Kiln outside the browser. See [Android install](android.md). The package is one screen, no background service, and it refuses responses over 4 MB.


Light, dark, and system live in Settings. The header button switches between light and dark and remembers that choice on the device.
