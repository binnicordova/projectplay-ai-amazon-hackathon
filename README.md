# ProjectPlay

**Turn any classroom projector into a touch wall.** A Fire TV plugged into the projector runs the game; the teacher's phone, on a tripod, watches the children with on-device pose detection and turns a pointing hand into a touch. There's no school Wi-Fi, no internet, no server and no extra hardware involved, and no images ever leave the phone.

Built for the [Build, Ship, Shape: Amazon Developer Hackathon](https://amazonappdev2026.devpost.com/) · **Fire TV track** (computer vision, multi-modal UX, family entertainment).

```
 ┌──────────── teacher phone (hotspot + camera) ────────────┐        ┌────────── Fire TV → projector ───────────┐
 │ VisionCamera v5 ─► GPU resizer ─► MoveNet (TFLite, INT8)  │        │ LinkClient  (finds the phone by itself)  │
 │   main camera, 2 lanes, one lane per frame, on-device     │  ws:// │ PointerHub  hover → dwell → select       │
 │ PerceptionPipeline: hand → homography → One Euro filter   │ ─────► │ Session reducer (rules, timer, scores)   │
 │   lanes with a child get most frames                      │ ◄───── │ Exercise engine (offline, adaptive)      │
 │ WebSocket server on the hotspot (no internet needed)      │  state │ Screens: pairing · lobby · play · summary│
 └───────────────────────────────────────────────────────────┘        └──────────────────────────────────────────┘
```

The phone only reports **where each raised hand points** (`ptr`, `lost`). The TV owns the screen layout, so it decides **what that means** (hit-testing, dwell selection, game rules). See [`shared/contracts/src/protocol.ts`](shared/contracts/src/protocol.ts).

## How children play

Children answer by **pointing**: they reach for a tile on the wall with either hand and hold it there for about 0.6 s. In the classroom that is what they do by themselves, so it is the only way to answer (whole-body gestures and jump counting were tried and removed).

| Question | What the child does |
|---|---|
| Pick the number | Points at one of four number tiles on their team's half (or, playing alone, in the row across the wall) |
| True or false | Points at TRUE or FALSE under the statement |

- **Changing your mind is allowed.** The chosen tile turns solid in the team's colour, and holding another tile switches to it. A question always runs its full time (20 s, or 15 s for true/false), with the seconds shown on the wall; the choice a team holds when time runs out is the one that counts. The teacher can still press **Next question**.
- **How a hand becomes a touch:** hand ≈ wrist + 30% of the forearm, mapped to the wall with a homography found by automatic calibration, smoothed with a One Euro filter, then run through a forgiving dwell on the TV (the tile fills up, and sinks back if the hand slips off).

The teacher picks **who plays** on the phone before starting:

| Who plays | On the wall | On the phone |
|---|---|---|
| **Two teams** (default) | Team A on the left half, team B on the right, four tiles each; the team with more right answers wins | Two camera *lanes*, one per half, one child per team at a time |
| **One player** | One child uses the whole wall: four tall tiles in a row (or TRUE on the left, FALSE on the right), one score, and a summary that counts right answers instead of naming a winner | One lane over the whole projection, so a child walking from one end of the wall to the other is never cut in half at the middle. Children can take turns |

**Practice with the remote** on the TV is always one player: one remote is one cursor, so it gets the whole wall.

Only a body shaped like a child standing in front of the wall is tracked: a torso big enough for the projection's size, hips below the shoulders. MoveNet always "finds" someone, even in an empty lane, and those phantoms on the projected tiles never reach the TV or the preview. When the wrist is lost against the bright wall, a lifted elbow still points the hand (about one upper arm further on).

## Repository layout

```
projectplay/
├─ shared/contracts/          Wire protocol + shared vocabulary. Pure TS, zero dependencies.
├─ teacher/                   Phone app: Expo SDK 56 (RN 0.85), Expo Router, Jotai, dev build
│  └─ src/
│     ├─ app/                 routes: home · calibrate · class · touchpad
│     ├─ features/
│     │  ├─ perception/       domain (pose math, gestures, homography) · application · infrastructure (camera) · ui
│     │  ├─ link/             domain (RFC 6455 codec, SHA-1) · application (LinkService) · infrastructure (TCP)
│     │  └─ console/          teacher controls + touchpad fallback
│     ├─ composition/         the only place that wires adapters to use cases
│     └─ ui-kit/
└─ tv/                        Fork of AmazonAppDev/react-native-multi-tv-app-sample (Yarn 4 workspace)
   ├─ apps/expo-tv/           Fire OS / Android TV / tvOS / web: Expo SDK 54 + react-native-tvos, Expo Router
   ├─ apps/vega/              Fire TV on Vega OS: Vega SDK (RN 0.72), same screens, no router
   └─ packages/
      ├─ tv-shared/           features: session · interaction · link · game (ui) · composition
      └─ exercise-engine/     offline arithmetic engine, misconception-based distractors (MIT, standalone)
```

Layering inside every feature: `domain` (pure TypeScript) → `application` (use cases, Jotai atoms, ports) → `infrastructure` (native adapters) / `ui`. In the teacher app, ESLint enforces these rules (`teacher/eslint.config.js`). **Jotai is the only state manager**, with one store per app. High-frequency data (camera frames, cursor positions) never goes through React state.

## Quick start

**Prerequisites:** Node 22, Android Studio (SDK + platform tools), a Fire TV with [ADB debugging enabled](https://developer.amazon.com/docs/fire-tv/connecting-adb-to-device.html), and an Android phone (iOS works too with Xcode). For Vega OS, also install the [Vega SDK](https://developer.amazon.com/docs/vega/0.21/install-vega-sdk.html).

```bash
npm run setup          # installs shared/, teacher/ (npm) and tv/ (Yarn 4 via corepack)
npm run fetch-model    # downloads MoveNet SinglePose Lightning INT8 (~3 MB) into teacher/assets/models
npm run check          # typecheck + lint + all unit tests
```

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
3. Tap **Start class**, pick a skill and an answer mode, and press **Start on the TV**.

No phone at hand? On the TV, choose **Practice with the remote**. The D-pad moves a cursor and OK selects, which is handy on the Fire TV / Vega simulators. No tripod? Use **phone as touchpad** in the teacher app.

**Working with coding agents:** `AGENTS.md` (repo-wide) plus `teacher/`, `tv/` and `shared/` `AGENTS.md` files hold the project rules; Claude Code reads them natively. `.claude/settings.json` pre-approves the test commands, and `.claude/skills/` adds `/device-check` and `/friction-entry`. Device workflow: `scripts/devices.sh doctor | tv | teacher | verify | crash`.

**Developer shortcut:** `EXPO_PUBLIC_TEACHER_HOST=192.168.1.20 corepack yarn web` runs the TV app in a browser that connects straight to a phone on your Wi-Fi.

## What has been verified (and what has not)

| Check | Result |
|---|---|
| Unit tests: protocol (48), teacher (106), TV + exercise engine (63) | ✅ 217 passing (`npm test`) |
| Strict typecheck against the real installed type definitions (VisionCamera 5.2, fast-tflite 3, worklets 0.8, tcp-socket 6.4, Expo Router 6/56) | ✅ teacher and Fire OS TV app |
| Layer-boundary lint (teacher) | ✅ including a self-test that a violation fails |
| JS bundles: teacher (Hermes, Android), Fire OS TV (`EXPO_TV=1`), Vega OS (Metro 0.76, `--platform kepler`) | ✅ all three build; Vega picks the `.kepler.ts` files |
| End-to-end on loopback: phone WebSocket server ⇄ TV `LinkClient` using a standards-compliant WebSocket client (hello, 30 pointers, state, ping/pong, disconnect) | ✅ `npm run test:e2e` |
| On-device runs: Galaxy A26 (phone) + onn 4K box (Android TV) | ✅ automatic calibration, practice with the remote, a choice changed mid-question, every question running its full time. Not yet on a real Fire TV stick or the Vega simulator |
| MoveNet accuracy from *behind* children, at 3–5 m, in classroom light | 🟡 in a dark room the upper body is found against the projection; legs in the dark are guessed. Light on the children helps most |
| Perception speed on the Galaxy A26 (`[perf]` lines in `adb logcat -s ReactNativeJS`) | ✅ Main camera (`[camera] main camera 0, 12.5 MP, f/1.8, frames 960×720`). One lane per frame: 60–104 ms of camera-thread work per frame at thermal status 2, against 130–146 ms when both lanes ran per frame (status 3), so a pose waits for one inference instead of two. A lane with a child gets 7–11 updates per second; an empty lane is checked 2–4 times per second |

## Key design decisions

- **SinglePose per lane, not MultiPose.** The MultiPose TFLite model has a dynamic input shape, and `react-native-fast-tflite` cannot resize input tensors (it would silently copy nothing). SinglePose Lightning INT8 has a fixed `[1,192,192,3]` uint8 input, is about 3 MB, and is more accurate per person. Teams stand on their own half anyway, so each half of the camera image runs through the model separately.
- **One player gets one lane, not two lanes on one team.** A child alone walks along the wall to reach the tiles, and two half-lanes would cut them in two at the centre line, where neither half passes the body check. One square crop over the whole projection is barely bigger, because the body below the projection already sets its height: for a 16:9 projection its side grows from about 1.85 to 2.2 projection heights, so the child keeps about 84% of the model's pixels and gets every frame. The phone tells the TV with an optional `teams` field on the start command (and the TV echoes it in its state). Older phones and TVs ignore it and play two teams.
- **Pointing is the only way to answer.** In the field test children pointed at the TRUE/FALSE tiles instead of raising or crossing their arms. One interaction means nothing to explain, and the phone does less per frame. Arms-up/crossed, step and jump detection (and the `gesture`/`count` messages) were removed; the decoders reject them, so an older phone's messages are dropped rather than misread.
- **A question runs its full time.** Ending a round as soon as both teams had chosen locked in first impulses. Now a choice can change until the countdown ends, the final choice counts, and the teacher can skip with **Next question** (the remote's ⏩ key does the same in practice mode).
- **One lane per camera frame.** Running MoveNet on both lanes per frame made every pose wait for the other lane: ~130 ms from picture to pointer on the A26. Now each frame runs one lane (`laneSchedule.ts`): lanes with a child take turns, and an empty lane is only checked on every 4th frame, so a single child gets most frames. With the One Euro filter re-tuned for the real update rate, the simulated cursor settles on a tile 48 ms after the hand stops (median), instead of 113 ms.
- **The main camera, and no camera zoom.** The phone films with its main back camera, chosen explicitly (`cameraChoice.ts`): the largest sensor and brightest lens (f/1.8 against f/2.2 on the A26's ultra-wide), and no barrel distortion to bend the homography. Optical/ISP zoom does not help MoveNet here: each lane is already cropped to the projection before the model, and the model's input is a fixed 192 × 192, so zooming would not give the model more pixels of the child. It would only help a phone so far back that a lane needs less than 30% of the frame height (`MIN_LANE_SIDE`): then the crop stays larger than the child needs, and zoom would give the child more of the model's pixels.
- **The exercise engine is not an LLM.** It is offline, kilobytes in size, and correct by construction (a wrong answer key in front of 30 kids destroys trust). It also keeps the classroom free of mobile-data costs. Wrong options come from real misconceptions: counting slips, wrong operation, copied numbers, place-value errors. Difficulty adapts per class with a staircase.
- **The phone is the server.** It is the hotspot, so it is the TV's gateway. The TV only needs the WebSocket client built into React Native, which exists on Fire OS *and* Vega OS. That is why the shared TV code has zero native dependencies. The ~150-line RFC 6455 codec on the phone is unit-tested and also tested against a real client.
- **The GPU cuts the crops, not JavaScript.** The resizer outputs the camera image at exactly the scale where each lane is 192 × 192, so a lane is 192 native row copies. Resampling pixel by pixel in the camera worklet cost ~35 ms per lane, and made the phone hot enough to throttle.
- **Dwell, not touch.** One camera cannot tell touching the wall from hovering near it, so a target is selected by holding still on it. The tile fills up as the countdown runs, a short slip off the edge is forgiven, and each team can only select tiles on its own half.
- **No backend, on purpose.** Classrooms without internet are the target. Results stay on the teacher's phone.
- **Android release builds block `ws://` by default.** The TV app sets `usesCleartextTraffic` and keeps the screen awake so the Fire TV screensaver never interrupts a class.

## Known gaps / next steps

- Vega OS: `networkInfo.kepler.ts` cannot read the device IP yet, so discovery tries the well-known hotspot gateways only (iPhone `172.20.10.1`, Android `192.168.43.1`). If your Android hotspot uses another subnet, set the host in `apps/vega/src/App.tsx` (`preferredHosts`).
- Calibration assumes the preview and the frame output share the same field of view (`enablePreviewSizedOutputBuffers`). The skeleton overlay shows instantly whether that holds: dots should sit on the child.
- Persist calibration and class results (MMKV), more skills (multiplication, number bonds), and a third lane for small groups.
- Speed: MoveNet stays on one CPU thread. On the A26 (only two fast cores), NNAPI, the GPU delegate and extra threads were all *slower*. At thermal status 3: 1 thread 216 ms per frame (4.4 fps), 2 threads 247 ms (3.9 fps), 4 threads 403 ms (2.4 fps) ([F14](docs/friction-log.md)). Keep the phone cool (unplugged, no screen mirroring such as scrcpy, which took 27–44% of a CPU): a hot phone takes about twice as long per frame as a cool one.
- Camera zoom ("auto-framing"): worth it only when the phone stands so far back that a lane needs less than 30% of the frame height (`MIN_LANE_SIDE`, ~216 of the 720 rows). It would need a second calibration at the zoomed field of view.
- Phantoms: in an empty, dark room the body gate can still accept a "child" made of furniture (seen on the A26 in a corner below the projection). It can only answer if its "hand" lands on a tile, but it does earn its lane more frames.

## Licenses

- ProjectPlay code: MIT ([`LICENSE`](LICENSE)). `tv/packages/exercise-engine` is designed to be published on its own (Open Source mini challenge).
- `tv/` is derived from [AmazonAppDev/react-native-multi-tv-app-sample](https://github.com/AmazonAppDev/react-native-multi-tv-app-sample), MIT-0 ([`tv/LICENSE-sample-MIT-0`](tv/LICENSE-sample-MIT-0)).
- MoveNet model © Google, Apache-2.0 (see [`teacher/assets/models/README.md`](teacher/assets/models/README.md)).

See also: [`docs/submission-kit.md`](docs/submission-kit.md) (Devpost checklist, video shot list, product-feedback outline) · [`docs/friction-log.md`](docs/friction-log.md).
