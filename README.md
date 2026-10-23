# ProjectPlay

[![CI](https://github.com/binnicordova/projectplay-ai-amazon-hackathon/actions/workflows/ci.yml/badge.svg)](https://github.com/binnicordova/projectplay-ai-amazon-hackathon/actions/workflows/ci.yml)
[![License: MIT](https://img.shields.io/badge/license-MIT-blue.svg)](LICENSE)
![Fire TV](https://img.shields.io/badge/Fire%20TV-Fire%20OS%20%7C%20Vega%20OS-ff9900.svg)
![Classes play offline](https://img.shields.io/badge/class-offline-brightgreen.svg)

<!-- Demo video: add the YouTube link here on submission day. -->

**Turn any classroom projector into a touch wall.** A Fire TV plugged into the projector runs the game; the teacher's phone, on a tripod, watches the children with on-device pose detection and turns a pointing hand into a touch. Classes need no school Wi-Fi, no internet, no server and no extra hardware, and no images ever leave the phone.

**Lessons for every class, from 4-year-olds to teenagers.** The teacher app comes with a library of lessons (numbers, letters, syllables, a hard R sound, English words, sentences, more-or-less, fractions, equations). When the phone has internet, the teacher creates new ones by **chatting with the AI** ("créame 5 ejercicios sobre las sílabas MA, PA, RO"). The AI picks the exercise and the phone's engine computes every answer; the TV plays the lesson from memory, climbing levels as the class gets answers right.

Built for the [Build, Ship, Shape: Amazon Developer Hackathon](https://amazonappdev2026.devpost.com/) · **Fire TV track** (computer vision, multi-modal UX, family entertainment).

```
 ┌──────────── teacher phone (hotspot + camera) ────────────┐        ┌────────── Fire TV → projector ───────────┐
 │ VisionCamera v5 ─► GPU resizer ─► MoveNet (TFLite, INT8)  │        │ LinkClient  (finds the phone by itself)  │
 │ PerceptionPipeline: hand → homography → One Euro filter   │  ws:// │ PointerHub  hover → dwell → select       │
 │ Library: 11 starter lessons + the teacher's own (files)   │ ─────► │ Lesson player: levels, points, streaks   │
 │ Exercise engine: builds and checks every card             │ lesson │   (the lesson lives in memory only)      │
 │ AI chat → DeepSeek (only to create, when online)          │ ◄───── │ Screens: pairing · lobby · play · summary│
 │ WebSocket server on the hotspot (no internet needed)      │  state │ Pictures: Twemoji SVG sent by the phone  │
 └───────────────────────────────────────────────────────────┘        └──────────────────────────────────────────┘
```

The phone sends the lesson when a class starts, then only reports **where each raised hand points** (`ptr`, `lost`). The TV owns the screen layout, so it decides **what that means** (hit-testing, dwell selection, levels, scores). See [`shared/contracts/src/protocol.ts`](shared/contracts/src/protocol.ts) and the lesson format in [`shared/contracts/src/lesson.ts`](shared/contracts/src/lesson.ts).

## Try it in 2 minutes

You need a Fire TV (or any Android TV) with [ADB debugging on](https://developer.amazon.com/docs/fire-tv/connecting-adb-to-device.html) and an Android phone: the lessons live on the teacher's phone, so the TV always plays with it.

1. Download `projectplay-tv.apk` and `projectplay-teacher.apk` from the [latest release](https://github.com/binnicordova/projectplay-ai-amazon-hackathon/releases/latest).
2. `adb connect <fire-tv-ip>:5555 && adb install projectplay-tv.apk`, and `adb install projectplay-teacher.apk` on the phone.
3. Turn on the phone's hotspot, connect the Fire TV to it and open both apps: the TV finds the phone by itself.
4. On the phone: **Biblioteca** → pick a lesson → **Usar en clase**, point the phone at the screen from 2–4 m away and tap **Jugar en la TV**. The TV flashes four squares, the phone calibrates, and you answer by pointing at a tile with your arm raised. (On a simulator, the TV remote's D-pad moves a cursor and OK selects.)
5. With internet on the phone, try **Crear con IA**: "créame 6 ejercicios de la tabla del 7 para niños de 8 años".

To build the APKs yourself: `npm run setup && npm run release:apks` (they land in `dist/release/`).

## How children play

Children answer by **pointing**: they reach for a tile on the wall with either hand and hold it there for about 0.6 s (0.75 s for 4–6-year-olds). In the classroom that is what they do by themselves, so it is the only way to answer (whole-body gestures and jump counting were tried and removed).

| Card | What the child does |
|---|---|
| Choose | Points at one of 2–4 tiles on their team's half: pictures, words, numbers or groups of pictures to count |
| True or false | Points at VERDADERO or FALSO under the statement |

- **Made for each age.** Inicial (4–6) gets pictures, two or three big tiles, longer timers, and a line for the teacher to read aloud ("Repitan conmigo: pe-RRO") on the phone. Primaria gets three or four tiles; secundaria four, with more time for fractions and equations.
- **Changing your mind is allowed.** The chosen tile turns solid in the team's colour, and holding another tile switches to it. A card always runs its full time (20–30 s depending on age), with the seconds shown on the wall; the choice a team holds when time runs out is the one that counts. The teacher can still press **Siguiente**.
- **Levels, points and streaks keep them playing.** Every lesson has easy, medium and hard cards. The class starts easy and climbs a level after two strong rounds in a row (or drops after two weak ones), with a "¡Subimos al nivel 2!" banner. A right answer scores 100–200 points by level, up to 50 more for deciding fast and up to 100 more for a streak (🔥×3 shows on the team's score). Wrong answers never cost points.
- **How a hand becomes a touch:** hand ≈ wrist + 30% of the forearm, mapped to the wall with a homography found by automatic calibration, smoothed with a One Euro filter, then run through a forgiving dwell on the TV (the tile fills up, and sinks back if the hand slips off).

The teacher picks **who plays** on the phone before starting:

| Who plays | On the wall | On the phone |
|---|---|---|
| **Two teams** (default) | Team A on the left half, team B on the right, the same tiles each; the team with more points wins | Two camera *lanes*, one per half, one child per team at a time |
| **One player** | One child uses the whole wall: tall tiles in a row (or VERDADERO on the left, FALSO on the right), one to three stars, and the lesson's record to beat (kept on the phone) | One lane over the whole projection, so a child walking from one end of the wall to the other is never cut in half at the middle. Children can take turns |

Only a body shaped like a child standing in front of the wall is tracked: a torso big enough for the projection's size, hips below the shoulders. MoveNet always "finds" someone, even in an empty lane, and those phantoms on the projected tiles never reach the TV or the preview. When the wrist is lost against the bright wall, a lifted elbow still points the hand (about one upper arm further on).

## Lessons, the library and the AI

**One small file per lesson.** A lesson is JSON (3–14 KB): title, subject (Matemática, Comunicación, Ciencia y Tecnología, Personal Social, Arte y Cultura, Inglés), age group, and cards with a level, a prompt, the tiles and the right answer. Pictures are Twemoji code points (`1f438` is a frog), never embedded: the phone sends the TV only the SVG art a lesson shows, and the TV keeps lesson and art in memory only. The format and its checker are in [`shared/contracts/src/lesson.ts`](shared/contracts/src/lesson.ts).

**The starter collection** ([`teacher/assets/lessons/`](teacher/assets/lessons)) answers eleven real requests from a teacher, each recorded in its file:

| Request (teacher's words) | Lesson |
|---|---|
| genera 8 ejercicios para reconocer los numeros del 1 al 9 para niños de 6 años | Count a group, choose the number; find the group that has N |
| creame 12 ejercicios para reconocer las letras para niños de 5años inicial | Find the A among other letters, then among look-alikes (M N W), then the first letter of a picture |
| genera 13 ejercicios para reconocer las letras del 'a' a la 'm' usando animales | One animal per letter a–m, then the other way round |
| creame 15 ejercicios para reconocer como suenan las silabas con animales de la granja | The teacher says a syllable, children point at the farm animal that starts with it |
| creame 5 ejercicios sobre las silabas MA, PA, RO | First syllable, missing syllable (__SA), picture for a syllable |
| quiero 6 ejercicios para reforzar la silaba RO … pronunciar palabras como PERRO | Say it with the class (pe-RRO, bu-RRO, RO-sa), then find it; no distractor has an R |
| generame 12 ejercicios de fracciones para … 13 años con numeros grandes | Simplify 84/126, equivalents, the biggest, add 5/12 + 7/18, 3/8 of 960 |
| generame 5 ejercisios de ecuaciones para adolescentes de 15 años con trampas | Every wrong option is a classic mistake (minus not distributed, x² = 49 has two answers, "no solution") |
| quiero 20 ejercicios de ingles de como se traduce la imagen al ingles para niños de 6 años | Picture → English word, then word → picture |
| genera 15 ejercicios de completa la phrase para niños de 7 años | Everyday sentences with a gap |
| quiero ejercicios para decidir cual es mayor o menor, para que los niños cuenten y decidan | Count groups and point where there is more or less |

**The exercise engine** ([`shared/exercise-engine`](shared/exercise-engine)) builds all of these on the phone: a rule-based Spanish syllable splitter (so *manzana* is never "MA-…"), a word list with pictures, and generators whose wrong options are real mistakes. Same request and seed, same cards. `npm --prefix shared run build:content` regenerates the starter files, and a test fails if they drift.

**Create with AI** (teacher app → *Crear con IA*): the teacher chats in their own words and can ask for changes ("más fácil", "agrega 3", "para 5 años"). The AI answers with JSON: for anything the engine knows, it only fills an exercise request and the engine computes every answer; for other topics (science, history, art…) it writes the cards, which are checked like any lesson file and shown for review, right answers in green, before saving. An answer that breaks the format is sent back once with the reason. The provider is a strategy: [`authoring/infrastructure/providers.ts`](teacher/src/features/authoring/infrastructure/providers.ts) maps a name to a `ChatModel` function; DeepSeek is the first (`deepseek-flash`, JSON mode). Creating needs internet (about 10–20 KB per lesson); playing never does.

## Repository layout

```
projectplay/
├─ shared/
│  ├─ contracts/              Wire protocol, lesson format + checker, Result type. Pure TS, zero dependencies.
│  ├─ exercise-engine/        Builds lesson cards: syllables, letters, numbers, English, sentences, fractions, equations
│  └─ scripts/                build-content: starter lessons + Twemoji art for the teacher app
├─ teacher/                   Phone app: Expo SDK 56 (RN 0.85), Expo Router, Jotai, dev build
│  ├─ assets/lessons/         the starter collection (one JSON file per lesson)
│  └─ src/
│     ├─ app/                 routes: home · library · lesson/[id] · create · calibrate · class
│     ├─ features/
│     │  ├─ perception/       domain (pose math, homography) · application · infrastructure (camera) · ui
│     │  ├─ link/             domain (RFC 6455 codec, SHA-1) · application (LinkService) · infrastructure (TCP)
│     │  ├─ library/          domain (catalog, records) · application (use cases) · infrastructure (files) · ui (gallery)
│     │  ├─ authoring/        domain (AI reply → lesson, prompt) · application (chat) · infrastructure (DeepSeek) · ui (chat)
│     │  ├─ pictures/         Twemoji art and the Picture component
│     │  └─ console/          start a lesson, live class controls
│     ├─ composition/         the only place that wires adapters to use cases
│     └─ ui-kit/
└─ tv/                        Fork of AmazonAppDev/react-native-multi-tv-app-sample (Yarn 4 workspace)
   ├─ apps/expo-tv/           Fire OS / Android TV / tvOS / web: Expo SDK 54 + react-native-tvos, Expo Router
   ├─ apps/vega/              Fire TV on Vega OS: Vega SDK (RN 0.72), same screens, no router
   └─ packages/
      └─ tv-shared/           features: session (lesson player: levels, points) · interaction · link · game (ui) · composition
```

Layering inside every feature: `domain` (pure TypeScript) → `application` (use cases, Jotai atoms, ports) → `infrastructure` (native adapters) / `ui`. In the teacher app, ESLint enforces these rules (`teacher/eslint.config.js`), and in the lesson features (`library`, `authoring`, `pictures`, `console`) it also forbids classes and `throw` in domain and application code: functions over read-only data, errors returned as `Result` values, ports as function types. **Jotai is the only state manager**, with one store per app. High-frequency data (camera frames, cursor positions) never goes through React state.

## Quick start

**Prerequisites:** Node 22, Android Studio (SDK + platform tools), a Fire TV with [ADB debugging enabled](https://developer.amazon.com/docs/fire-tv/connecting-adb-to-device.html), and an Android phone (iOS works too with Xcode). For Vega OS, also install the [Vega SDK](https://developer.amazon.com/docs/vega/0.21/install-vega-sdk.html).

```bash
npm run setup          # installs shared/, teacher/ (npm) and tv/ (Yarn 4 via corepack)
npm run fetch-model    # downloads MoveNet SinglePose Lightning INT8 (~3 MB) into teacher/assets/models
npm run check          # typecheck + lint + all unit tests
cp teacher/.env.example teacher/.env   # then paste your DeepSeek key (only needed for "Crear con IA")
```

The key is read at build time (`EXPO_PUBLIC_DEEPSEEK_API_KEY`), so it ends up inside the teacher APK: anyone with the APK can use it. Keep a spending alert on the account. Git ignores `teacher/.env`, and CI fails if a key ever lands in the repository.

**1 · The TV (Fire OS)**: check *Settings → My Fire TV → About*. If it says Fire OS:

```bash
adb connect <fire-tv-ip>:5555
cd tv && corepack yarn android            # EXPO_TV=1 expo run:android
```

If it says **Vega OS**: `cd tv && corepack yarn build:vega`, then install with the Vega CLI (see the [Vega docs](https://developer.amazon.com/docs/vega/0.21/install-vega-sdk.html)).

**2 · The phone**

```bash
cd teacher && npm run android             # development build; Expo Go cannot run frame processors
```

**3 · In the classroom**
1. Turn on the phone's hotspot. Connect the Fire TV to it, then open ProjectPlay on the TV. It searches for the phone by itself.
2. Put the phone on a tripod behind the children, facing the projected image. Calibration is automatic: when the class starts, the TV flashes four white squares for about 2 seconds and the phone finds the projection. (Tapping the 4 corners by hand on **Check camera view** still works as a fallback.)
3. Pick a lesson in **Biblioteca** (or create one in **Crear con IA**), tap **Empezar clase**, choose who plays and how many cards, and press **Jugar en la TV**.

The TV needs the phone: lessons come from it. On the Fire TV / Vega simulators, the remote's D-pad moves a cursor during a class and OK selects.

**Release APKs:** `scripts/devices.sh release` builds both apps with the JavaScript bundled in (no Metro needed) into `dist/release/`, ready to attach to a GitHub release.

**Working with coding agents:** `AGENTS.md` (repo-wide) plus `teacher/`, `tv/` and `shared/` `AGENTS.md` files hold the project rules; Claude Code reads them natively. `.claude/settings.json` pre-approves the test commands, and `.claude/skills/` adds `/device-check` and `/friction-entry`. Device workflow: `scripts/devices.sh doctor | tv | teacher | verify | crash | release`.

**Developer shortcut:** `EXPO_PUBLIC_TEACHER_HOST=192.168.1.20 corepack yarn web` runs the TV app in a browser that connects straight to a phone on your Wi-Fi.

## What has been verified (and what has not)

| Check | Result |
|---|---|
| Unit tests: contracts + lesson format, exercise engine (52 Spanish syllable splits, every generator × age group × 25 seeds, answer keys recomputed), starter files in sync (210); teacher incl. library, AI chat, DeepSeek adapter with a fake network (142); TV lesson player, levels, scoring, layout (44) | ✅ 396 passing (`npm test`) |
| Starter collection | ✅ 11 lessons, 121 cards, regenerated byte-identical by `build:content` and checked by tests |
| Live call to DeepSeek | 🟡 not from the development sandbox (no network to the API): the adapter is tested with recorded responses; run *Crear con IA* on the phone to confirm |
| Strict typecheck against the real installed type definitions (VisionCamera 5.2, fast-tflite 3, worklets 0.8, tcp-socket 6.4, Expo Router 6/56) | ✅ teacher and Fire OS TV app |
| Layer-boundary lint (teacher) | ✅ including a self-test that a violation fails |
| JS bundles: teacher (Hermes, Android, 3.8 MB), Fire OS TV (`EXPO_TV=1`, 3.0 MB), Vega OS (Metro 0.76, `--platform kepler`) | ✅ all three build; Vega picks the `.kepler.ts(x)` files (emoji pictures, no SVG renderer) |
| End-to-end on loopback: phone WebSocket server ⇄ TV `LinkClient` using a standards-compliant WebSocket client (hello, 30 pointers, state, ping/pong, disconnect); a starter lesson and its pictures streamed to the TV's lesson player, a round scored and reported back | ✅ `npm run test:e2e` |
| On-device runs: Galaxy A26 (phone) + onn 4K box (Android TV) | ✅ automatic calibration, a choice changed mid-question, every question running its full time (before lessons). The lesson player, library and AI chat need a native rebuild (react-native-svg, expo-file-system) and a device run. Not yet on a real Fire TV stick or the Vega simulator |
| MoveNet accuracy from *behind* children, at 3–5 m, in classroom light | 🟡 in a dark room the upper body is found against the projection; legs in the dark are guessed. Light on the children helps most |
| Perception speed on the Galaxy A26 (`[perf]` lines in `adb logcat -s ReactNativeJS`) | ✅ Main camera (`[camera] main camera 0, 12.5 MP, f/1.8, frames 960×720`). One lane per frame: 60–104 ms of camera-thread work per frame at thermal status 2, against 130–146 ms when both lanes ran per frame (status 3), so a pose waits for one inference instead of two. A lane with a child gets 7–11 updates per second; an empty lane is checked 2–4 times per second |

## Key design decisions

- **SinglePose per lane, not MultiPose.** The MultiPose TFLite model has a dynamic input shape, and `react-native-fast-tflite` cannot resize input tensors (it would silently copy nothing). SinglePose Lightning INT8 has a fixed `[1,192,192,3]` uint8 input, is about 3 MB, and is more accurate per person. Teams stand on their own half anyway, so each half of the camera image runs through the model separately.
- **One player gets one lane, not two lanes on one team.** A child alone walks along the wall to reach the tiles, and two half-lanes would cut them in two at the centre line, where neither half passes the body check. One square crop over the whole projection is barely bigger, because the body below the projection already sets its height: for a 16:9 projection its side grows from about 1.85 to 2.2 projection heights, so the child keeps about 84% of the model's pixels and gets every frame. The phone tells the TV with an optional `teams` field on the start command (and the TV echoes it in its state). Older phones and TVs ignore it and play two teams.
- **Pointing is the only way to answer.** In the field test children pointed at the TRUE/FALSE tiles instead of raising or crossing their arms. One interaction means nothing to explain, and the phone does less per frame. Arms-up/crossed, step and jump detection (and the `gesture`/`count` messages) were removed; the decoders reject them, so an older phone's messages are dropped rather than misread.
- **A question runs its full time.** Ending a round as soon as both teams had chosen locked in first impulses. Now a choice can change until the countdown ends, the final choice counts, and the teacher can skip with **Siguiente** (the remote's ⏩ key does the same).
- **One lane per camera frame.** Running MoveNet on both lanes per frame made every pose wait for the other lane: ~130 ms from picture to pointer on the A26. Now each frame runs one lane (`laneSchedule.ts`): lanes with a child take turns, and an empty lane is only checked on every 4th frame, so a single child gets most frames. With the One Euro filter re-tuned for the real update rate, the simulated cursor settles on a tile 48 ms after the hand stops (median), instead of 113 ms.
- **The main camera, and no camera zoom.** The phone films with its main back camera, chosen explicitly (`cameraChoice.ts`): the largest sensor and brightest lens (f/1.8 against f/2.2 on the A26's ultra-wide), and no barrel distortion to bend the homography. Optical/ISP zoom does not help MoveNet here: each lane is already cropped to the projection before the model, and the model's input is a fixed 192 × 192, so zooming would not give the model more pixels of the child. It would only help a phone so far back that a lane needs less than 30% of the frame height (`MIN_LANE_SIDE`): then the crop stays larger than the child needs, and zoom would give the child more of the model's pixels.
- **The AI suggests, the engine computes, the teacher approves.** A wrong answer key in front of 30 kids destroys trust. So the AI only chooses *what* to practise (an exercise request) whenever the engine can build it, and the engine computes the answers: syllables by rule, arithmetic by construction, wrong options from real mistakes. AI-written cards for other topics go through the same checker and are reviewed before saving.
- **An online AI, not an on-device model.** A 1 GB model download is not realistic for rural schools in the Andes; a lesson created online costs 10–20 KB of data and a fraction of a cent. Classes never need the internet.
- **The engine lives on the phone, the TV is a player.** The phone builds lesson files; the TV receives the whole lesson with its start command and keeps it in memory only, so a Fire TV with little storage never fills up, and the TV app has no lesson logic to update when lessons change.
- **Levels on the TV, records on the phone.** The TV owns the rules (levels, points, streaks); the phone keeps each lesson's best score and sends it as the record to beat.
- **The phone is the server.** It is the hotspot, so it is the TV's gateway. The TV only needs the WebSocket client built into React Native, which exists on Fire OS *and* Vega OS. That is why the shared TV code has zero native dependencies. The ~150-line RFC 6455 codec on the phone is unit-tested and also tested against a real client.
- **The GPU cuts the crops, not JavaScript.** The resizer outputs the camera image at exactly the scale where each lane is 192 × 192, so a lane is 192 native row copies. Resampling pixel by pixel in the camera worklet cost ~35 ms per lane, and made the phone hot enough to throttle.
- **Dwell, not touch.** One camera cannot tell touching the wall from hovering near it, so a target is selected by holding still on it. The tile fills up as the countdown runs, a short slip off the edge is forgiven, and each team can only select tiles on its own half.
- **No backend, on purpose.** Classrooms without internet are the target. Results stay on the teacher's phone. The AI is called straight from the phone, which is also why the key travels in the app (see Quick start).
- **Android release builds block `ws://` by default.** The TV app sets `usesCleartextTraffic` and keeps the screen awake so the Fire TV screensaver never interrupts a class.

## Known gaps / next steps

- Creating lessons needs internet and a DeepSeek key in the build. Lessons stay on the phone that made them (no sharing between teachers yet).
- Vega OS shows the pictures as system emoji (the SVG renderer is a separate port there).
- Vega OS: `networkInfo.kepler.ts` cannot read the device IP yet, so discovery tries the well-known hotspot gateways only (iPhone `172.20.10.1`, Android `192.168.43.1`). If your Android hotspot uses another subnet, set the host in `apps/vega/src/App.tsx` (`preferredHosts`).
- Calibration assumes the preview and the frame output share the same field of view (`enablePreviewSizedOutputBuffers`). The skeleton overlay shows instantly whether that holds: dots should sit on the child.
- Persist calibration, share lessons between teachers' phones, and a third lane for small groups.
- Speed: MoveNet stays on one CPU thread. On the A26 (only two fast cores), NNAPI, the GPU delegate and extra threads were all *slower*. At thermal status 3: 1 thread 216 ms per frame (4.4 fps), 2 threads 247 ms (3.9 fps), 4 threads 403 ms (2.4 fps) ([F14](docs/friction-log.md)). Keep the phone cool (unplugged, no screen mirroring such as scrcpy, which took 27–44% of a CPU): a hot phone takes about twice as long per frame as a cool one.
- Camera zoom ("auto-framing"): worth it only when the phone stands so far back that a lane needs less than 30% of the frame height (`MIN_LANE_SIDE`, ~216 of the 720 rows). It would need a second calibration at the zoomed field of view.
- Phantoms: in an empty, dark room the body gate can still accept a "child" made of furniture (seen on the A26 in a corner below the projection). It can only answer if its "hand" lands on a tile, but it does earn its lane more frames.

## Open source

- **[projectplay-exercise-engine](https://github.com/binnicordova/projectplay-exercise-engine)** (MIT): the arithmetic core of the engine, published on its own with docs, examples and CI. Wrong answers come from real misconceptions, `diagnose()` names the mistake behind a wrong pick, and it runs anywhere from Node to Vega OS with zero dependencies. The monorepo's `shared/exercise-engine` has grown beyond it (reading, English, fractions, equations).
- **Upstream fixes** for Amazon's [multi-TV sample](https://github.com/AmazonAppDev/react-native-multi-tv-app-sample), from what we hit while building on it (see the [friction log](docs/friction-log.md)): [#141](https://github.com/AmazonAppDev/react-native-multi-tv-app-sample/pull/141) bumps the TV config plugin that crashed `expo prebuild` (F7), and [#142](https://github.com/AmazonAppDev/react-native-multi-tv-app-sample/pull/142) documents the Node and Corepack versions the sample needs (F9).

## Built during the hackathon

Everything here was written during the submission window, except the starting point of `tv/`: Amazon's [react-native-multi-tv-app-sample](https://github.com/AmazonAppDev/react-native-multi-tv-app-sample) (MIT-0).

- **Kept from the sample:** the monorepo layout, remote-control managers, spatial navigation, theme and `FocusablePressable`.
- **Changed in the sample:** Expo packages aligned to SDK 54, strict-TypeScript fixes, the TV config plugin upgraded (it crashed prebuild), button centring, and the media-player features removed.
- **New:** the teacher app, all perception and calibration code, the wire protocol and lesson format, the lesson player, the exercise engine and starter lessons, the AI chat, the Vega wiring, the tests and the device tooling.

## Licenses

- ProjectPlay code: MIT ([`LICENSE`](LICENSE)). The exercise engine is also published on its own: [projectplay-exercise-engine](https://github.com/binnicordova/projectplay-exercise-engine) (MIT).
- `tv/` is derived from [AmazonAppDev/react-native-multi-tv-app-sample](https://github.com/AmazonAppDev/react-native-multi-tv-app-sample), MIT-0 ([`tv/LICENSE-sample-MIT-0`](tv/LICENSE-sample-MIT-0)).
- MoveNet model © Google, Apache-2.0 (see [`teacher/assets/models/README.md`](teacher/assets/models/README.md)).
- Pictures: [Twemoji](https://github.com/jdecked/twemoji) graphics © Twitter, Inc. and other contributors, CC-BY 4.0.

See also: [`docs/friction-log.md`](docs/friction-log.md) (17 SDK and tooling frictions, with workarounds) · [`docs/devpost.md`](docs/devpost.md) (submission text and product feedback) · [`docs/video-script.md`](docs/video-script.md) · [`docs/submission-kit.md`](docs/submission-kit.md).
