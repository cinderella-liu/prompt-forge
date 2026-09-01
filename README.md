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
- Image and video prompts use "Chinese understanding + structured draft preserving the original language"

See [DECISIONS.md](./DECISIONS.md) before continuing product iteration.

## Development

```bash
npm install
npm test
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

## Regression checks

`npm test` runs the intent-preservation and edit/history regression suite. Pull requests run tests and the production build; deployment also runs the tests first.

Generators live in `src/generator.ts`, shared data types in `src/types.ts`, and history reconciliation in `src/history.ts`. Explicit platform, language and aspect-ratio requirements take priority over defaults. Drafts remain rule-based and do not translate Chinese into English.

Edits update both the prompt library and history. When loading older history, matching library assets supply the latest text. Local history retains 20 batches and the library retains 200 prompts; important content should be backed up separately.
