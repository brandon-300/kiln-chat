# Android app

Kiln for the phone is an APK, not a store listing. It is a single WebView plus a small network bridge. There is no extra background service, and the app does not request a large memory heap.

The bridge only sends HTTPS requests, refuses private network addresses, and stops a response at 4 MB. Chat text is streamed in small pieces instead of being held all at once. That is so a phone like the Infinix Hot 50i (Helio G81, about 4 GB of RAM, 720p) is not pushed into a reboot.

## Install

1. Download [Kiln.apk](https://github.com/brandon-300/kiln-chat/releases/download/v1.0.0/Kiln.apk).
2. Open the file in the Files or Downloads app.
3. If Android asks, allow this install. The build is signed so the phone can update it later with the same signature.
4. Open Kiln. Paste your own keys in Settings. They stay on the phone.

The speaker under a reply reads it with the voice provider selected in Settings, including Fish Audio.

Keys and chats are stored in the app's private storage. Uninstalling Kiln deletes them.
