# Devpost submission text

Paste each section into the matching Devpost field. Items in **[brackets]** need your input: they are facts only you can confirm (a quote, a link, your device). Don't submit with brackets left in.

---

## Project name

ProjectPlay

## Tagline (max ~200 characters)

Turn any classroom projector into a touch wall. A Fire TV runs the game, the teacher's phone watches the children, and kids answer by pointing at the wall. No internet, no new hardware.

## Track and mini challenge

- **Track:** Fire TV
- **Mini challenge:** Open Source. The exercise engine is published as its own MIT repository, and we sent fixes upstream to Amazon's multi-TV sample (links below).

## Links

- Code: https://github.com/binnicordova/projectplay-ai-amazon-hackathon (MIT)
- Demo video: **[YouTube link]**
- Open source: https://github.com/binnicordova/projectplay-exercise-engine · upstream pull request: **[PR link]**

## Open Source mini challenge fields

- **GitHub username:** binnicordova
- **Repo URL:** https://github.com/binnicordova/projectplay-exercise-engine
- **Contribution URL:** **[the PR to AmazonAppDev/react-native-multi-tv-app-sample, or your fork's branch]**
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

## Inspiration

Most public classrooms we know already have a projector. What they don't have is a $3,000 interactive whiteboard, reliable Wi-Fi, or a tablet for every child. Worldwide, only about 40% of primary schools are connected to the internet (UNESCO GEM Report 2023).

So the projector shows slides, and 30 six-year-olds sit still and watch. Young children learn better when they move. They point, they run to the board, they argue about the answer.

We asked: what is the cheapest way to make the wall itself answer back, using only things a teacher already has, or can buy for the price of a lunch?

The answer was a Fire TV stick in the projector and the teacher's own phone on a tripod.

## What it does

ProjectPlay turns the projected image into a touch wall for a whole class.

- **The Fire TV runs the game** on the projector: arithmetic questions with four number tiles per team, or TRUE / FALSE.
- **The teacher's phone stands on a tripod behind the children.** It tracks their bodies with an on-device pose model and turns a raised, pointing hand into a cursor on the wall.
- **Children answer by pointing.** A child reaches for a tile and holds it for about half a second. The tile fills up and turns their team's colour.
  - They can change their mind until the countdown ends.
  - Team A plays on the left half of the wall, team B on the right.
  - In **one-player** mode a single child uses the whole wall.
- **Setup takes seconds.** The phone opens a hotspot and the TV finds it by itself. Then the TV flashes four white squares for about two seconds, and the phone finds the projection on the wall automatically. Nobody taps corners and nobody types an IP address.
- **The teacher runs the class from the phone:** pick a skill, start, go to the next question, and see each round's result.
- **The questions are built offline by an adaptive engine.** It produces addition, subtraction and missing-addend questions, with wrong answers built from real misconceptions (counting slips, using the wrong operation, copying a number from the question). Difficulty adapts to the class.
- **There is no backend, no internet and no account.** Camera frames never leave the phone; only tiny pointer events (~60 bytes each) travel to the TV over the local hotspot.
- **No phone? Practice with the remote:** the Fire TV remote becomes a cursor, so the game also works on the Fire TV and Vega simulators.

## How we built it

Three apps in one repository, all TypeScript:

**Teacher phone app.** Expo SDK 56, React Native 0.85 new architecture, Expo Router, Jotai.
- **The camera pipeline:**
  - VisionCamera v5 delivers 960×720 frames from the main back camera.
  - A GPU resizer scales each frame so every camera *lane* (one per team) is exactly 192 pixels.
  - MoveNet SinglePose Lightning (TFLite, INT8, 3 MB) runs through react-native-fast-tflite, all inside a camera-thread worklet.
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
- **Shared TV package:** the game session reducer, dwell selection (progress fills while a hand holds a tile and drains slowly when it slips), discovery of the phone, the calibration pattern layer, and the remote-control cursor.
- **Fast updates:** cursors and tile fills update through `Animated` values, never React state, so 15 updates per second per hand cost nothing.

**Shared contracts.** A zero-dependency wire protocol. Its decoders never throw, so a bad packet can never crash a class. It compiles under all three toolchains.

**Quality.**
- 224 unit tests, including synthetic camera images of the calibration pattern.
- An end-to-end test that runs the real phone server against the real TV client over a WebSocket, calibration included.
- Strict TypeScript, and lint rules that enforce the domain → application → infrastructure layering.
- A device script (`scripts/devices.sh doctor | tv | teacher | verify | crash`) that checks both devices, the link and the calibration in one command.

## Challenges we ran into

- **Children don't do what you design for.** We first built body gestures: arms up for TRUE, arms crossed for FALSE, and jumping to count. In the first test, children simply *pointed* at the TRUE tile. We removed every gesture and kept pointing as the only way to answer. The product got simpler, and the phone does less work per frame.
- **A mid-range phone is not a laptop.**
  - On a Galaxy A26, cropping the camera image for each team in JavaScript cost as much as the model itself, and the phone throttled within minutes.
  - We moved the cropping into the GPU resizer, ran one lane per frame, and kept MoveNet on a single CPU thread. NNAPI, the GPU delegate and extra threads were all slower on this phone (friction log F13, F14).
- **A dark room with a bright wall.** Auto-exposure turns children into silhouettes against the projection. Lane crops around the projection, brightness control and the elbow fallback recovered most of the lost poses.
- **Calibration that works without a technician.** Four taps on a phone was too fiddly in a noisy classroom. We designed the marker pattern, a differencing detector and a self-check. Then we debugged the camera stream from the phone itself, live, with a status line on screen.
- **Build tooling.** An Expo prebuild that generated a Gradle 9 wrapper for an Android Gradle Plugin that only supports Gradle 8 shipped an APK silently missing its resource classes. The TV sample's config plugin crashed prebuild, and Corepack disappeared from Node 26. All of these are documented with workarounds in our friction log (15 entries).

## Accomplishments that we're proud of

- **The whole class answers by pointing at a plain wall**, with hardware that costs less than one textbook per class.
- **Automatic calibration in about two seconds.** On synthetic test images it is accurate to under a pixel.
- **Fully offline and private by design.** Camera frames never leave the phone, there is no server to run or pay for, and no child accounts.
- **One codebase for Fire OS and Vega OS**, plus a phone app, with one tested contract between them.
- **An exercise engine that can't give a wrong answer key**: correct by construction, deterministic per seed, able to name the misconception behind a wrong pick, and free to reuse (MIT).

## What we learned

- Watch children before designing gestures. Their instinct (point at the thing) beats any clever interaction.
- On mid-range phones, everything around the model costs as much as the model. Measure on the device, at the temperature it will actually run at.
- "Offline first" is a feature for schools, not a limitation. It removed the backend, the costs, the accounts and the privacy questions in one decision.
- Amazon's multi-TV sample made a single TV codebase for Fire OS and Vega OS realistic. The friction log lists what would make it smoother.

## What's next

- Classroom pilots with teachers, more skills (multiplication, number bonds, reading), and a third lane for small groups.
- Saved class reports on the teacher's phone. They stay on the phone.
- Publishing on the Amazon Appstore for Fire TV.

## Built during the hackathon (pre-existing code)

Everything in this repository was written during the submission window except the TV app's starting point.

- **What we started from:** Amazon's [`react-native-multi-tv-app-sample`](https://github.com/AmazonAppDev/react-native-multi-tv-app-sample) (MIT-0). From it we kept the monorepo layout, the remote-control managers, spatial navigation, the theme and `FocusablePressable`.
- **What we changed in the sample:** aligned its Expo packages to SDK 54, fixed its strict-TypeScript errors, upgraded the TV config plugin that crashed prebuild, fixed button centring, and removed the media-player features this app doesn't use.
- **What is new:** everything else. The teacher app, all perception and calibration code, the wire protocol, the game (session, dwell, screens), the exercise engine, the Vega app wiring, the tests and the device tooling.

---

## Testing instructions (for judges)

**Quickest: the TV app alone, no phone needed.**
1. Install the TV app on a Fire OS device: `adb install projectplay-tv.apk`. The APK is on the GitHub release page **[release link]**.
2. Open **ProjectPlay** and choose **Practice with the remote**.
3. Move the cursor onto an answer with the D-pad and hold it there (or press OK).

**Full experience: Fire TV + Android phone**, about 5 minutes.
1. Install `projectplay-teacher.apk` on an Android phone (Android 8+, camera) and the TV app on the Fire TV.
2. Turn on the phone's hotspot and connect the Fire TV to it. Open both apps. The TV finds the phone by itself.
3. Point the phone at the TV or projector screen from 2–4 m away and tap **Start class**. The TV flashes four squares and the phone calibrates.
4. Stand in front of the screen and point at a tile with your arm raised until it fills.

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
  - **[Add what you hit on the real Fire TV device: ADB pairing, Developer Options, performance, anything surprising.]**
- **Onboarding:** **[How long from unboxing the Fire TV to seeing the app? Rate it 1–5.]**
- **Would we use it again?** Yes. A Fire TV stick in a projector is the cheapest "smart classroom" screen we know of.

### Vega OS SDK
- **Used for:** the Vega OS build of the same TV game (`tv/apps/vega`), sharing the game code with the Fire OS app.
- **What worked:**
  - The `.kepler.ts` platform files make it easy to keep one shared code base: only the remote-control and network adapters differ.
  - Bundling with the Vega Metro preset worked once the shared code avoided newer JavaScript packaging features.
- **What needs work:**
  - Code shared with Vega must target an older JavaScript toolchain: no package `exports`, no `.cjs` entry points. We only found out when bundling, and it ruled out Jotai v3 and zod v4 (F4).
  - We couldn't find a documented way to read the device's own IP address, which local discovery needs (F5).
  - **[Add your Vega Virtual Device / build experience if you ran it.]**
- **Onboarding:** **[Time to first run on the Vega Virtual Device, or "bundled only"]**
- **Would we use it again?** Yes for new Fire TV devices, especially with a documented network-info API and a list of the JS constraints.

### AmazonAppDev `react-native-multi-tv-app-sample`
- **Used for:** the TV app's starting point (monorepo layout, shared UI, remote-control managers, spatial navigation).
- **What worked:** one code base for Fire OS, Android TV, tvOS, web and Vega. The remote-control abstraction and spatial navigation saved days.
- **What needs work:**
  - It pins a react-native-tvos release candidate (F1) and mixes Expo SDK 52 and 54 packages (F2).
  - It fails strict TypeScript (F3), and its TV config plugin crashes `expo prebuild` with a misleading Gradle error (F7).
  - It doesn't work on Node 25+ without Corepack (F9), and its button can't be centred (F10).
  - We sent fixes upstream: **[PR link]**.
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
- **Claude Code (AI coding agent):** used throughout. It built the apps with us, debugged on the devices over ADB, and kept the friction log. We share its project instructions in `AGENTS.md`.

## Feature requests (optional)

| Request | Why it matters | Priority |
|---|---|---|
| Vega OS: documented API for the device's own IP / network info | Local "companion device" apps need it for discovery | Important |
| Fire TV docs: a "companion device / local network" guide (cleartext, keep-awake, discovery) | Every second-screen or classroom app hits these on day one | Important |
| Multi-TV sample: CI with `typecheck` and `expo install --check`; pinned Node or a vendored Yarn | Keeps the starting point green for new developers | Important |
| Vega Metro preset: package `exports` and `.cjs` support, or a documented list of JS constraints | Shared Fire OS / Vega code shouldn't fail late | Nice-to-have |
