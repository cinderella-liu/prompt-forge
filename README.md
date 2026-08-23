# Prompt Forge

Prompt Forge is an intent-to-prompt translator. It turns one natural-language intent into four prompt types:

- Text
- Image
- Video
- Code

The current version is a local schema-driven MVP. It does not call a real LLM yet.

## Current Test Version

- Version under test: v0.6
- Platform: Web single-page app wrapped as Android APK with Capacitor
- Intent analysis is preserved but hidden by default
- Image and video prompts use "Chinese understanding + English executable prompt"

See [DECISIONS.md](./DECISIONS.md) before continuing product iteration.

## Development

```bash
npm install
npm run build
```

Run locally:

```bash
npm run dev
```

Build Android debug APK:

```bash
npm run build
npx cap sync android
cd android
./gradlew assembleDebug
```

APK output:

```text
android/app/build/outputs/apk/debug/app-debug.apk
```
