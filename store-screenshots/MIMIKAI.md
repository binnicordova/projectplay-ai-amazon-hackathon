# Mimikai store screenshots

Editor scaffolded with the [app-store-screenshots](https://github.com/ParthJadhav/app-store-screenshots) skill (MIT). The decks live in `app-store-screenshots.json`; exports are copied to `docs/store/play/`.

```bash
bun install
bun run dev --port 3210   # → http://localhost:3210, then "Export bundle"
```

- **Android Phone** deck → Google Play phone screenshots (1080×1920) for Mimikai.
- **Apple TV** deck (16:9, drawn frame, no Apple bezel) → Google Play Android TV screenshots for Mimikai TV (use the 1920×1080 export).
- Phone captures are real screens from the Galaxy phone (`adb exec-out screencap`), rotated 90° so they sit in a sideways phone. TV captures come from the TV app (device and web build).
- Theme `mimikai` in `src/lib/constants.ts` follows `docs/brand/README.md`.
