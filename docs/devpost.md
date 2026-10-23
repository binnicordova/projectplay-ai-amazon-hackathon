# Devpost submission text

Paste each section into the matching Devpost field. Items in **[brackets]** need your input: they are facts only you can confirm (a quote, a link, your device). Don't submit with brackets left in.

---

## Project name

ProjectPlay

## Tagline (max ~200 characters)

A Fire TV Stick and the teacher's phone turn any classroom projector into a touch wall for about $75, with no internet. Kids answer by pointing; lessons for ages 4–15, made with AI.

## Track and mini challenge

- **Track:** Fire TV
- **Mini challenge:** Open Source. The exercise engine is published as its own MIT repository, and we sent fixes upstream to Amazon's multi-TV sample (links below).

## Links

- Code: https://github.com/binnicordova/projectplay-ai-amazon-hackathon (MIT)
- Demo video: https://www.youtube.com/watch?v=wkKDgb5G7V0
- Open source: https://github.com/binnicordova/projectplay-exercise-engine · upstream pull requests: https://github.com/AmazonAppDev/react-native-multi-tv-app-sample/pull/141 and https://github.com/AmazonAppDev/react-native-multi-tv-app-sample/pull/142

## Open Source mini challenge fields

- **GitHub username:** binnicordova
- **Repo URL:** https://github.com/binnicordova/projectplay-exercise-engine
- **Contribution URLs:** https://github.com/AmazonAppDev/react-native-multi-tv-app-sample/pull/141 (TV config plugin that crashed prebuild) and https://github.com/AmazonAppDev/react-native-multi-tv-app-sample/pull/142 (Node and Corepack prerequisites), from the fork https://github.com/binnicordova/react-native-multi-tv-app-sample
- **What we did:**
  - We published ProjectPlay's question engine as its own MIT library.
  - We sent fixes back to Amazon's multi-TV sample for problems we hit while building on it: a config plugin that crashed `expo prebuild`, strict-TypeScript errors, and a button that couldn't be centred.
- **How it works:**
  - Questions are built from their answer, so the answer key can't be wrong.
  - Wrong options are generated from real misconceptions: subtracting instead of adding, copying a number from the question, counting one too many, losing a ten, swapping digits. `diagnose()` names the mistake behind a child's pick.
  - A seeded generator makes the same `(seed, round)` produce the same question on every device.
  - There are zero dependencies, and the build avoids features the Vega OS toolchain can't load. It runs on Fire OS, Vega OS, the web and Node.
  - The repo includes docs, examples, a demo and CI on Node 20, 22 and 24.
- **Why it matters:**
  - Most maths quiz apps use random wrong answers, which children rule out easily and which tell the teacher nothing.
  - This engine works offline, fits in kilobytes, and turns every wrong pick into a hint about what the class misunderstood.
  - Any classroom, TV or worksheet app can use it.

---

## At a glance

| | |
|---|---|
| **100% offline in class** | No school Wi-Fi, no mobile data, no server, no account. The phone opens its own hotspot and the Fire TV joins it. Built for the schools UNESCO counts as unconnected: only ~40% of primary schools worldwide are online, and about 6 in 10 public primary schools in Peru are not. |
| **Nothing extra to download** | One install per device and you're done: the teacher APK is 52.5 MB and the Fire TV APK 55.3 MB, with the pose model (3 MB), all 11 starter lessons (121 exercises, ~104 KB) and every picture inside. No content packs, no updates needed to teach. The only optional online feature is creating a new lesson with AI: 10–20 KB per lesson. |
| **≈ $75 per classroom** | A Fire TV Stick plus a phone tripod, on the projector or TV the school already has, and the teacher's own Android phone. Interactive boards cost $1,608–$6,491 per classroom: one SMART Board pays for 56 ProjectPlay classrooms (about $2.50 per child in a class of 30). |
| **Works on any projector** | Fire TV in the projector's HDMI port; the projection becomes a touch wall for a whole class, two teams at once or one child alone. |
| **Setup in 4 steps, about a minute** | 1. Turn on the phone's hotspot. 2. Connect the Fire TV to it and open both apps: the TV finds the phone by itself. 3. Put the phone on a tripod facing the wall: the TV flashes four squares and the phone calibrates automatically. 4. Pick a lesson and tap **Jugar en la TV**. |
| **Learning that feels like a game** | Children answer by pointing. Levels rise as the class gets answers right, fast answers and streaks score more, mistakes never cost points, teams compete and solo players chase three stars and a record. Lessons from kindergarten (ages 4–6) to secondary (fractions, equations). |
| **Private by design** | Camera images never leave the phone; only ~60-byte pointer events reach the TV. No child accounts. |

## Inspiration

Picture a public classroom high in the Andes of Peru: thirty five-year-olds, one projector, and no internet. The projector shows slides, and the children sit still and watch. Young children learn better when they move: they point, they run to the board, they argue about the answer.

Making that wall interactive is out of reach. An interactive projector costs $1,608–$2,101 (Epson BrightLink 760Wi), a 75" SMART Board MX $4,167 and a Promethean ActivPanel 9 Pro $6,491, per classroom. And the schools that need it most are offline: in Peru about 6 in 10 public primary schools and 3 in 10 public secondary schools have no internet (Censo Educativo 2023), 18 regions have fewer than half their schools online (Amazonas 14%, Loreto 18%), and worldwide only about 40% of primary schools are connected (UNESCO GEM Report 2023).

The gap is not only Peru's. In Latin America the share of primary schools without internet is 96.5% in Nicaragua, about 75% in Paraguay and Honduras, 70% in Guatemala, 62% in Brazil and 53% in Peru (UNESCO Institute for Statistics, via Our World in Data). Worldwide, nearly half of the roughly 6 million schools, about 3 million, are not connected (Giga, UNICEF–ITU).

We asked: what is the cheapest way to make the wall itself answer back, using only things a teacher already has, with no internet at all?

The answer was a Fire TV Stick in the projector and the teacher's own phone on a tripod: about $75 per classroom, $2.50 per child, and one SMART Board's price equips 56 classrooms. Peru alone has 108,239 kindergarten, primary and secondary services (54,087 · 38,942 · 15,210; Minedu ESCALE 2020); every one with a projector or a TV could play.

Sources: [UNESCO via Our World in Data](https://ourworldindata.org/grapher/primary-schools-with-access-to-internet), [Giga via Swissinfo](https://swissinfo.ch/eng/international-geneva/the-un-plans-to-connect-every-school-to-the-internet-by-2030/83325727), [CDW-G](https://cdwg.com/product/promethean-activpanel-9-pro-75-interactive-touch-screen-display/7323057), [B&H Photo](https://www.bhphotovideo.com/c/product/1841163-REG/smart_technologies_smart_board_mx275_v5_75.html), [Jordan School District Epson price list Q3 2026](https://purchasing.jordandistrict.org/wp-content/uploads/sites/16/Epson-Projector-Pricing-2026-Quarter-3.pdf), [Notebookcheck (Fire TV Stick)](https://www.notebookcheck.net/Amazon-s-latest-Fire-TV-Stick-4K-4K-is-already-50-off-with-a-free-Game-Pass-subscription.1415665.0.html), [Gestión](https://gestion.pe/peru/brecha-digital-en-escuelas-publicas-solo-1-computadora-por-cada-12-estudiantes-de-primaria-censo-educativo-2023-ministerio-de-educacion-noticia/), [El Comercio](https://elcomercio.pe/ecdata/en-17-regiones-del-peru-menos-de-la-mitad-de-escuelas-tienen-acceso-a-agua-potable-colegios-en-peru-conexion-internet-pobreza-servicio-basico-ecdata-noticia/), [UNESCO IIEP-SITEAL](https://siteal.iiep.unesco.org/pais/peru). Charts and map: `docs/images/` in the repository.

## What it does

ProjectPlay turns the projected image into a touch wall for a whole class.

- **The Fire TV plays the lesson** on the projector: pictures, words, numbers or groups to count, with two to four tiles per team, or VERDADERO / FALSO.
- **The teacher's phone stands on a tripod behind the children.** It tracks their bodies with an on-device pose model and turns a raised, pointing hand into a cursor on the wall.
- **Children answer by pointing.** A child reaches for a tile and holds it for about half a second. The tile fills up and turns their team's colour.
  - They can change their mind until the countdown ends.
  - Team A plays on the left half of the wall, team B on the right.
  - In **one-player** mode a single child uses the whole wall.
- **Setup takes seconds.** The phone opens a hotspot and the TV finds it by itself. Then the TV flashes four white squares for about two seconds, and the phone finds the projection on the wall automatically. Nobody taps corners and nobody types an IP address.
- **A library of lessons on the teacher's phone.** It ships with 11 lessons (121 cards) written from a real teacher's requests: numbers 1–9 for 6-year-olds, letters for 5-year-olds, letters a–m with animals, the sounds of syllables with farm animals, the syllables MA, PA, RO, a lesson for girls who struggle to say the strong R in *perro*, fractions with big numbers and equations with traps for teenagers, English words from pictures, complete the sentence, and more-or-less.
- **New lessons by chatting with the AI.** With internet, the teacher types what the class needs in their own words ("créame 6 ejercicios de la tabla del 7 para niños de 8 años") and can ask for changes ("más fácil", "para 5 años"). DeepSeek picks the exercise; the phone's engine computes every answer, and the teacher sees the cards, right answers in green, before saving. Creating costs 10–20 KB of data; classes never need the internet.
- **Made for each age.** Inicial (4–6) gets pictures, two or three big tiles, longer timers, and a line on the phone for the teacher to read aloud ("Repitan conmigo: pe-RRO"). Primaria and secundaria get more tiles and more time for harder maths.
- **Levels, points and streaks keep kids playing.** Each lesson has easy, medium and hard cards. The class starts easy and climbs a level after two strong rounds ("¡Subimos al nivel 2!"). Right answers score more on harder cards and when answered fast, a fire streak grows on the team's score, and wrong answers never cost points. Two teams compete for the win; one player earns one to three stars and chases the lesson's record, kept on the phone.
- **The teacher runs the class from the phone:** pick a lesson, start, skip to the next card, and see each round's result and points.
- **There is no backend and no account.** Camera frames never leave the phone; the lesson travels to the TV once, and then only tiny pointer events (~60 bytes each) cross the local hotspot. The TV keeps nothing: lesson and pictures live in memory for one class.

## How we built it

Three apps in one repository, all TypeScript:

**Teacher phone app.** Expo SDK 56, React Native 0.85 new architecture, Expo Router, Jotai.
- **The camera pipeline:**
  - VisionCamera v5 delivers 960×720 frames from the main back camera.
  - A GPU resizer scales each frame so every camera *lane* (one per team) is exactly 192 pixels.
  - MoveNet SinglePose Lightning (TFLite, INT8, 3 MB) runs through react-native-fast-tflite, all inside a camera-thread worklet.
- **Lessons:** each lesson is a small JSON file (3–14 KB) with a strict, never-throwing checker shared by both apps. Pictures are Twemoji code points; the phone sends the TV only the SVGs a lesson shows.
- **Exercise engine (on the phone):** a rule-based Spanish syllable splitter (tested on 52 words, so *manzana* never starts with "MA"), a 125-word picture lexicon, and generators for numbers, comparing, letters, syllable sounds, a hard sound, sentences, English, arithmetic, fractions and equations. Wrong options are real mistakes: a look-alike letter, a near count, adding tops and bottoms of fractions, a minus sign not distributed. Same request and seed, same cards.
- **AI chat, domain-driven and functional:** the AI answers in JSON mode with an exercise request (or cards for topics the engine doesn't cover); the domain decodes and clamps it, the engine builds the cards, and an invalid answer goes back to the model once with the reason. The provider is a strategy (a `ChatModel` function per provider), so DeepSeek can be swapped without touching the domain. Lint rules forbid classes and `throw` in these features' domain and application code.
- **Speed:** one lane runs per frame. Lanes with a child take turns, and empty lanes are checked every fourth frame. A pose waits for one inference, not two.
- **From hand to cursor:**
  - The hand is estimated as wrist + 30% of the forearm, falling back to a lifted elbow when the wrist is lost against the bright wall.
  - A homography maps it onto the projection, and a One Euro filter smooths it.
  - A body check rejects the "people" MoveNet always finds in an empty lane.
- **Automatic calibration:**
  - The TV shows four white squares, then a black frame. Subtracting the two leaves only the markers, whatever else is in the room.
  - The phone finds the marker centres to a fraction of a pixel and solves the projection's corners.
- **The phone is the server:** a hand-written RFC 6455 WebSocket server on raw TCP, so the TV needs nothing beyond React Native's built-in WebSocket.

**Fire TV app.** Built on Amazon's `react-native-multi-tv-app-sample`.
- **Fire OS:** Expo SDK 54 + react-native-tvos with Expo Router.
- **Vega OS:** the Vega SDK (React Native 0.72), sharing the same screens.
- **Shared TV package:** the lesson player (a pure reducer with adaptive levels, points and streaks), dwell selection (progress fills while a hand holds a tile and drains slowly when it slips), discovery of the phone, the calibration pattern layer, and the remote-control cursor.
- **Pictures:** react-native-svg draws the Twemoji SVGs on Fire OS; Vega shows the same pictures as system emoji.
- **Fast updates:** cursors and tile fills update through `Animated` values, never React state, so 15 updates per second per hand cost nothing.

**Shared contracts.** A zero-dependency wire protocol and lesson format. Their decoders never throw, so a bad packet or a bad lesson file can never crash a class. It compiles under all three toolchains.

**Quality.**
- 396 unit tests, including synthetic camera images of the calibration pattern, every exercise generator × age group × 25 seeds through the lesson checker, and the AI adapter against recorded responses.
- An end-to-end test that runs the real phone server against the real TV client over a WebSocket: calibration, then a starter lesson streamed to the TV, played and scored back to the phone.
- Strict TypeScript, and lint rules that enforce the domain → application → infrastructure layering.
- A device script (`scripts/devices.sh doctor | tv | teacher | verify | crash`) that checks both devices, the link and the calibration in one command.

## Challenges we ran into

- **Children don't do what you design for.** We first built body gestures: arms up for TRUE, arms crossed for FALSE, and jumping to count. In the first test, children simply *pointed* at the TRUE tile. We removed every gesture and kept pointing as the only way to answer. The product got simpler, and the phone does less work per frame.
- **A mid-range phone is not a laptop.**
  - On a Galaxy A26, cropping the camera image for each team in JavaScript cost as much as the model itself, and the phone throttled within minutes.
  - We moved the cropping into the GPU resizer, ran one lane per frame, and kept MoveNet on a single CPU thread. NNAPI, the GPU delegate and extra threads were all slower on this phone (friction log F13, F14).
- **A dark room with a bright wall.** Auto-exposure turns children into silhouettes against the projection. Lane crops around the projection, brightness control and the elbow fallback recovered most of the lost poses.
- **Calibration that works without a technician.** Four taps on a phone was too fiddly in a noisy classroom. We designed the marker pattern, a differencing detector and a self-check. Then we debugged the camera stream from the phone itself, live, with a status line on screen.
- **Answer keys a child can trust.** Asking an AI for "syllable exercises" gave plausible cards with wrong keys (a MAN-zana counted as MA, a silent h). So the AI only picks the exercise and the engine computes the answers, with rules for Spanish syllables, the strong R and fair distractors.
- **Low-bandwidth schools.** An on-device model was 1 GB to download, unrealistic in the Andes. We moved generation online (10–20 KB per lesson) and kept every class offline.
- **Build tooling.** An Expo prebuild that generated a Gradle 9 wrapper for an Android Gradle Plugin that only supports Gradle 8 shipped an APK silently missing its resource classes. The TV sample's config plugin crashed prebuild, and Corepack disappeared from Node 26. All of these are documented with workarounds in our friction log (19 entries).

## Accomplishments that we're proud of

- **The whole class answers by pointing at a plain wall**, with hardware that costs less than one textbook per class.
- **Automatic calibration in about two seconds.** On synthetic test images it is accurate to under a pixel.
- **Fully offline and private by design.** Camera frames never leave the phone, there is no server to run or pay for, and no child accounts.
- **One codebase for Fire OS and Vega OS**, plus a phone app, with one tested contract between them.
- **An exercise engine that can't give a wrong answer key**: correct by construction, deterministic per seed, able to name the misconception behind a wrong pick, and free to reuse (MIT).
- **A teacher's own words become a lesson in seconds**, from a 5-year-old's syllables to a 15-year-old's equations, and the eleven requests of a real teacher became the starter collection.

## What we learned

- Watch children before designing gestures. Their instinct (point at the thing) beats any clever interaction.
- On mid-range phones, everything around the model costs as much as the model. Measure on the device, at the temperature it will actually run at.
- "Offline first" is a feature for schools, not a limitation. It removed the backend, the costs, the accounts and the privacy questions in one decision. The AI fits that by creating online once and playing offline forever.
- An LLM is a great interface for *what* to practise and a poor source of answer keys. Splitting the two made the AI both useful and safe in front of a class.
- Amazon's multi-TV sample made a single TV codebase for Fire OS and Vega OS realistic. The friction log lists what would make it smoother.

## What's next

- Classroom pilots with teachers, sharing lessons between teachers' phones over the hotspot, and a third lane for small groups.
- Saved class reports on the teacher's phone. They stay on the phone.
- Publishing on the Amazon Appstore for Fire TV.

## Built during the hackathon (pre-existing code)

Everything in this repository was written during the submission window except the TV app's starting point.

- **What we started from:** Amazon's [`react-native-multi-tv-app-sample`](https://github.com/AmazonAppDev/react-native-multi-tv-app-sample) (MIT-0). From it we kept the monorepo layout, the remote-control managers, spatial navigation, the theme and `FocusablePressable`.
- **What we changed in the sample:** aligned its Expo packages to SDK 54, fixed its strict-TypeScript errors, upgraded the TV config plugin that crashed prebuild, fixed button centring, and removed the media-player features this app doesn't use.
- **What is new:** everything else. The teacher app, all perception and calibration code, the wire protocol and lesson format, the lesson player (session, levels, scoring, dwell, screens), the exercise engine and starter lessons, the AI chat, the Vega app wiring, the tests and the device tooling.

---

## Testing instructions (for judges)

The TV always plays with the teacher's phone: the lessons live on the phone. About 5 minutes.
1. Install `projectplay-teacher.apk` on an Android phone (Android 8+, camera) and `projectplay-tv.apk` on the Fire TV (`adb install`). Both APKs are on the GitHub release page: https://github.com/binnicordova/projectplay-ai-amazon-hackathon/releases/tag/v1.0.0
2. Turn on the phone's hotspot and connect the Fire TV to it. Open both apps. The TV finds the phone by itself.
3. On the phone, open **Biblioteca**, pick a lesson (try *Sílabas de la granja* or *Fracciones con números grandes*) and tap **Usar en clase**.
4. Point the phone at the TV or projector screen from 2–4 m away and tap **Jugar en la TV**. The TV flashes four squares and the phone calibrates.
5. Stand in front of the screen and point at a tile with your arm raised until it fills. No room to stand? The Fire TV remote moves a cursor during the class (OK selects, ⏩ skips).
6. With internet on the phone, open **Crear con IA** and ask for a lesson in Spanish, e.g. "créame 6 ejercicios de la tabla del 7 para niños de 8 años".

**Building from source:** see the README, or `npm run setup && npm run check`.

---

## Product feedback (required: one block per tool)

### Fire TV / Fire OS (ADB, sideloading, Android TV features)
- **Used for:** running the game on the projector. The ProjectPlay TV app is installed over ADB.
- **What worked:**
  - Standard Android TV tooling just works: Leanback launcher, D-pad focus, `adb install`, `adb logcat`.
  - Being Android-based meant our React Native TV app needed no special code.
- **What needs work:**
  - There is no single guide for "companion device" apps (second screen, local network). We had to discover on our own that release builds block `ws://`, and that the screensaver interrupts long remote-free sessions (friction F6).
  - On a real Fire TV (Fire OS) the release APK sideloaded with `adb install` after turning on Developer Options and ADB debugging; it found the teacher's phone on the hotspot by itself, calibrated, and played full lessons with pointing, as shown in the demo video.
- **Onboarding:** under an hour from unboxing to the app running (most of it enabling Developer Options and ADB). 4/5.
- **Would we use it again?** Yes. A Fire TV stick in a projector is the cheapest "smart classroom" screen we know of.

### Vega OS SDK
- **Used for:** the Vega OS build of the same TV game (`tv/apps/vega`), sharing the game code with the Fire OS app.
- **What worked:**
  - The `.kepler.ts` platform files make it easy to keep one shared code base: only the remote-control and network adapters differ.
  - Bundling with the Vega Metro preset worked once the shared code avoided newer JavaScript packaging features.
- **What needs work:**
  - Code shared with Vega must target an older JavaScript toolchain: no package `exports`, no `.cjs` entry points. We only found out when bundling, and it ruled out Jotai v3 and zod v4 (F4).
  - We couldn't find a documented way to read the device's own IP address, which local discovery needs (F5).
  - We bundled the Vega app with Metro (`--platform kepler`, 1.07 MB, emoji pictures via `.kepler.tsx` files) but did not run it on the Vega Virtual Device during the hackathon; the demo runs on Fire OS.
- **Onboarding:** bundled only.
- **Would we use it again?** Yes for new Fire TV devices, especially with a documented network-info API and a list of the JS constraints.

### AmazonAppDev `react-native-multi-tv-app-sample`
- **Used for:** the TV app's starting point (monorepo layout, shared UI, remote-control managers, spatial navigation).
- **What worked:** one code base for Fire OS, Android TV, tvOS, web and Vega. The remote-control abstraction and spatial navigation saved days.
- **What needs work:**
  - It pins a react-native-tvos release candidate (F1) and mixes Expo SDK 52 and 54 packages (F2).
  - It fails strict TypeScript (F3), and its TV config plugin crashes `expo prebuild` with a misleading Gradle error (F7).
  - It doesn't work on Node 25+ without Corepack (F9), and its button can't be centred (F10).
  - We sent fixes upstream: [#141](https://github.com/AmazonAppDev/react-native-multi-tv-app-sample/pull/141) bumps the config plugin, [#142](https://github.com/AmazonAppDev/react-native-multi-tv-app-sample/pull/142) corrects the Node/Corepack prerequisites.
- **Onboarding:** about half a day to a green build on a real Android TV, mostly spent on F2 and F7.
- **Would we use it again?** Yes. It is the right starting point; CI with `typecheck` and `expo install --check` would catch most of what we hit.

### react-native-tvos + Expo (`EXPO_TV=1`, `@react-native-tvos/config-tv`)
- **Used for:** the Fire OS build with Expo Router, so the TV app uses the same routing as the phone app.
- **What worked:** `EXPO_TV=1 expo run:android` gives a Leanback-ready app with no hand-edited native code.
- **What needs work:** after a failed prebuild, Expo reuses a half-generated `android/` folder. The resulting error ("Unresolved reference R") points far away from the cause (F7).
- **Would we use it again?** Yes.

### Third-party libraries (context for Amazon's developer experience)
- **Expo SDK 56:** fast iteration and Expo Router on both phone and TV. Prebuild generated a Gradle 9 wrapper next to an Android Gradle Plugin that supports only Gradle 8, which silently produced a broken APK (F8).
- **VisionCamera v5, vision-camera-resizer, react-native-fast-tflite, react-native-worklets:** real-time on-device ML in React Native is now practical.
  - We'd like a crop option in the resizer (F13), `numThreads` in fast-tflite (F14), documented asynchronous frame-callback updates (F12), and a working "main back camera" filter on Android (F15).
  - Reloading JavaScript while the camera runs crashes natively (F11).
- **react-native-tcp-socket:** made the phone-as-server design possible with a small amount of code.
- **Jotai:** one store per app, small, and it works on all three toolchains (v2).
- **DeepSeek API (`deepseek-flash`, JSON mode):** OpenAI-compatible, cheap enough for a teacher's budget, and quick to wire with plain `fetch`. JSON mode guarantees JSON, not *our* JSON: there is no schema, so we validate every answer and send one correction back (F17).
- **react-native-svg + Twemoji:** light, sharp pictures on Fire OS; on Vega the SVG renderer is a separate port, so we fall back to emoji (F16).
- **Google Gemini:** drew the app icon and the Fire TV banner (`docs/brand/icon-source.png`). One prompt gave a usable, child-friendly image; we still had to cut the launcher, adaptive, themed and banner sizes ourselves (`scripts/brand-icons.sh`). Would use again for artwork.
- **Claude Code (AI coding agent):** used throughout. It built the apps with us, debugged on the devices over ADB, and kept the friction log. We share its project instructions in `AGENTS.md`.

## Feature requests (optional)

| Request | Why it matters | Priority |
|---|---|---|
| Vega OS: documented API for the device's own IP / network info | Local "companion device" apps need it for discovery | Important |
| Fire TV docs: a "companion device / local network" guide (cleartext, keep-awake, discovery) | Every second-screen or classroom app hits these on day one | Important |
| Multi-TV sample: CI with `typecheck` and `expo install --check`; pinned Node or a vendored Yarn | Keeps the starting point green for new developers | Important |
| Vega Metro preset: package `exports` and `.cjs` support, or a documented list of JS constraints | Shared Fire OS / Vega code shouldn't fail late | Nice-to-have |
