<!-- Agent instructions for every coding agent (Claude Code reads AGENTS.md natively).
     Keep this file under ~150 lines: repo-wide rules only. Package rules live in
     teacher/AGENTS.md, tv/AGENTS.md and shared/AGENTS.md, which load when an agent works there. -->

# Mimikai (formerly ProjectPlay)

The product, both apps and the octopus pet are called **Mimikai** (package IDs `com.mimikai.teacher` and `com.mimikai.tv`, packages `@mimikai/*`). The GitHub repo and the v1.0.0 release still use the old name ProjectPlay. Brand masters and rules: `docs/brand/README.md`.

A classroom projector becomes a touch wall. The teacher's phone (camera on a tripod, Wi-Fi hotspot) runs on-device pose detection and sends *what the body did* over a local WebSocket. A Fire TV app owns the screen and decides *what it means*. The phone also holds the lessons: a starter collection plus lessons the teacher creates by chatting with an AI (DeepSeek, only when online). Classes need no backend and no internet; camera images never leave the phone.

Entry for the Amazon "Build, Ship, Shape" hackathon, Fire TV track. Deadline: **Fri 23 Oct 2026, 12:00 PDT**. Requirements and the demo plan are in `docs/submission-kit.md`.

## Three projects, one repo

| Path | What | Package manager | Stack |
|---|---|---|---|
| `shared/contracts` | Wire protocol, lesson format + checker, `Result` | npm | Pure TypeScript, **zero runtime deps** |
| `shared/exercise-engine` | Builds lesson cards (syllables, letters, numbers, English, sentences, fractions, equations) | npm | Pure TypeScript; imports only types from contracts |
| `teacher/` | Phone app (camera, pose model, WebSocket server, lesson library, AI chat) | npm | Expo SDK 56, RN 0.85, new architecture, dev build |
| `tv/` | TV app, forked from AmazonAppDev/react-native-multi-tv-app-sample | **Yarn 4** (corepack) | `apps/expo-tv`: Expo 54 + react-native-tvos 0.81 (legacy arch) · `apps/vega`: Vega SDK, RN 0.72 · `packages/tv-shared` |

Both apps consume `shared/contracts` from source (`file:` in teacher, `portal:` in tv, plus Metro `watchFolders`). Only the teacher app uses `shared/exercise-engine`: the TV plays whatever lesson it is sent. Never copy contract types into an app.

## Commands

Run from the repo root unless noted.

```bash
npm run setup                 # install shared/, teacher/ (npm) and tv/ (corepack yarn)
npm run fetch-model           # MoveNet INT8 model → teacher/assets/models (needed to bundle the teacher app)
npm run check                 # everything: typecheck + lint + unit tests in all three projects
npm run test:e2e              # real WebSocket phone ⇄ TV loop, including calibration and a lesson
npm --prefix shared run build:content   # regenerate teacher/assets/lessons + generated TS (after engine or lexicon changes)
npm --prefix teacher run check
cd tv && corepack yarn check  # never plain `yarn` (global Yarn 1 breaks the workspace)
```

On real devices (wireless adb; the script tells the TV from the phone by the Leanback feature):

```bash
scripts/devices.sh doctor            # tools + connected devices
scripts/devices.sh tv                # build, install, run the TV app (Metro :8081)
scripts/devices.sh teacher           # build, install, run the phone app (Metro :8082)
scripts/devices.sh verify            # both apps running, linked, calibrated, no JS errors
scripts/devices.sh crash             # last crash (Java or native) of either app
scripts/devices.sh release           # standalone release APKs of both apps → dist/release/
scripts/devices.sh <app> --clean     # rebuild from scratch: use this, never ./gradlew clean
```

Most changes are JavaScript only: the running apps hot-reload (press `r` in that app's Metro terminal). A native rebuild is needed only after changing native dependencies, `app.json` or config plugins.

## Architecture rules

- **Feature folders, layered:** `features/<context>/{domain,application,infrastructure,ui}`.
  - `domain` is pure TypeScript: no React, React Native, Expo or Jotai.
  - `application` holds use cases, Jotai atoms and ports.
  - `infrastructure` holds native adapters. `ui` holds components.
  - Only `composition/` wires adapters to use cases.
  - The teacher's `eslint.config.js` enforces these boundaries. Keep the same discipline in `tv/packages/tv-shared`.
- **Jotai is the only state manager**, one store per app, created in the composition root. No Redux, Zustand, React context state or MobX.
- **High-frequency data never goes through React state.**
  - Camera frames stay on the camera thread.
  - Cursor positions and dwell progress go to `Animated` values through listeners (`PointerHub.subscribe` and `subscribeProgress`).
  - When an atom changes often, subscribe screens to a narrow derived atom (e.g. `autoCalibrationStateAtom`), or the camera re-renders every frame.
- **The phone reports bodies; the TV owns meaning.** Hit-testing, dwell, rules, levels and scores live on the TV. Don't move game logic to the phone.
- **The phone owns lessons; the TV keeps nothing.** The start command carries the whole lesson and only the SVG art it shows (protocol v2). The TV holds them in memory for one class and never stores them. There is no lesson or practice mode without the phone.
- **The AI never writes an answer key the engine can compute.** For known exercise kinds it returns an `ExerciseRequest` and the engine builds the cards; free-form AI cards go through `decodeLesson` and the teacher's review. The provider is a strategy (`ChatModel` + registry in `authoring/infrastructure/providers.ts`).
- **Functional core in the lesson features.** In `library`, `authoring`, `pictures` and `console`, domain and application code has no classes and no `throw` (ESLint): pure functions over read-only data, `Result` values for errors, use cases made from their dependencies (`makeX(deps)`).
- **One player or two teams.** Two teams split the wall in halves, one camera lane each. One player (`teams: 1` on the start command, team A) gets the whole wall and one lane over all of it. Older apps leave `teams` out and play two teams.
- **Pointing is the only interaction.** Children answer by holding a hand on a tile; a choice can change until the question's time is up (no early end when everyone has chosen). Field tests showed kids point by themselves; don't bring back gestures or jump counting without new field evidence.
- **Offline by design.** The only network calls are the phone ⇄ TV WebSocket and, from the teacher's *Crear con IA* screen, the AI provider. No analytics. A new dependency must work offline and keep the APKs small.
- **Secrets:** the DeepSeek key lives only in `teacher/.env` (gitignored; `teacher/.env.example` documents it) as `EXPO_PUBLIC_DEEPSEEK_API_KEY`. Never commit a key, paste one in docs or logs, or hard-code it. CI fails on anything that looks like `sk-…`.
- No code duplication across apps: shared logic goes to `shared/contracts` (wire-level), `shared/exercise-engine` (lesson content) or `tv/packages/*` (TV-level).

## Conventions

- TypeScript strict; `readonly` data; small pure functions in `domain` with unit tests next to them (`*.test.ts`, Vitest).
- Comments explain *why* (constraints, physics, device quirks), not what the code does.
- User-facing text is written for a teacher in a busy classroom: short, plain, says what to do next.
- Kid-facing text (TV screens, lessons) is Spanish, for Peruvian classrooms; lesson subjects follow the Peruvian national curriculum areas.
- Logs that `scripts/devices.sh verify` reads use the tags `[link]` and `[calib]`. Keep them stable. The TV logs `[lesson]` when a class starts.
- Every SDK or tooling friction you hit while building gets an entry in `docs/friction-log.md`, using the template at its end. It counts toward the hackathon score.

## Coordinate spaces (read before touching camera, calibration or pointers)

- **Camera space:** normalised 0..1 of the *upright 4:3 frame stream* (the GPU resizer output). Poses, lane ROIs and calibration corners all live here.
- **Preview:** on Android it is a separate 4:3 stream, shown with `resizeMode="contain"`. Overlays must use `frameRect()` from `teacher/src/features/perception/domain/previewGeometry.ts`, never the view size. A mismatch makes boxes look bigger than what they mark.
- **Projection space:** normalised 0..1 of the TV screen, which is the projected image. The homography maps camera space to projection space. `POINTER_MARGIN` allows small overshoot.
- **Calibration is automatic:** the TV shows the `CORNER_MARKERS` pattern from `shared/contracts/src/calibration.ts`, then black, and the phone solves the corners. Changing the camera field of view invalidates a calibration; the composition root then drops it and recalibrates.

## Pitfalls already paid for (don't repeat them)

- `./gradlew clean` fails in React Native's CMake step after deleting library outputs. The next build then ships an APK missing R classes, and the app crashes at launch with `NoClassDefFoundError: …/R$string`. Use `scripts/devices.sh <app> --clean`.
- Expo CLI's `a` key opens the *first* adb device, often the TV. "No development build (com.mimikai.teacher) installed" there is harmless; use `shift+a` to pick the device.
- `@react-native-tvos/config-tv` older than 0.1.7 crashes `expo prebuild` and leaves a half-generated `android/` behind ("Unresolved reference R/BuildConfig"). Keep ≥ 0.1.7.
- `android/` and `ios/` are generated (Continuous Native Generation) and gitignored. Change native behaviour through `app.json` or config plugins (`tv/apps/expo-tv/plugins/`), never by editing generated files.
- A full disk silently corrupts Gradle outputs. On "ENOSPC" or odd build failures, free space first, then `--clean`.
- Reloading the teacher app's JS while a camera screen is open crashes it natively (SIGSEGV in TFLite). Reload from the home screen.
- A hot phone throttles (Android thermal status "severe" after ~1 h of camera + model + charging) and tracking slows down by half. Measure with the `[perf]` log lines (they include pose updates per lane) before tuning filters or dwell.
- Restarting the teacher app (force-stop) resets an "only this time" camera permission: the class screen then sits behind Android's permission dialog, and the TV link drops every few seconds until someone answers it.

## Definition of done

1. `npm run check` passes (and `npm run test:e2e` if the protocol, link or calibration changed).
2. For UI or camera changes: the teacher and TV bundles still build (`npx expo export --platform android` in `teacher/` and, with `EXPO_TV=1`, in `tv/apps/expo-tv/`).
3. On devices when available: `scripts/devices.sh verify` is green.
4. Docs you touched are still true (`README.md`, `docs/`); friction entries added.
