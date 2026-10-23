<!-- Teacher (phone) app. Loads on top of the root AGENTS.md when an agent works in teacher/. -->

# Teacher app (phone)

Expo SDK 56 · React Native 0.85 (new architecture, Hermes) · Expo Router · Jotai.
It is a **development build**, not Expo Go: native modules include VisionCamera v5 (Nitro), react-native-vision-camera-resizer (GPU), react-native-fast-tflite, react-native-worklets 0.8 and react-native-tcp-socket.

## Commands (from `teacher/`)

```bash
npm run check            # tsc + eslint (layer boundaries) + vitest
npx vitest run src/features/perception      # one feature
npm run fetch-model      # bundling and lint need assets/models/movenet-singlepose-lightning-int8.tflite
../scripts/devices.sh teacher               # build, install and run on the phone (Metro :8082)
```

## Expo has changed: don't trust your training data

- Read the `expo` version in `package.json` and check `https://docs.expo.dev/versions/v56.0.0/` before using any Expo or React Native API. https://docs.expo.dev/llms.txt indexes the docs.
- Add packages with `npx expo install <pkg>` (SDK-compatible versions), never plain `npm install <pkg>`.
- `android/` and `ios/` are generated. Native settings go in `app.json` and config plugins. A new native module needs a rebuild (`../scripts/devices.sh teacher`), not just a reload.
- Routes live in `src/app/` (Expo Router). Every file there is a screen, so keep components and helpers out of it.
- If `npx expo install` can't reach `api.expo.dev` (sandboxed networks), take the version from `node_modules/expo/bundledNativeModules.json` and pin it with npm.

## AI key

`Crear con IA` reads `EXPO_PUBLIC_AI_PROVIDER`, `EXPO_PUBLIC_DEEPSEEK_API_KEY` and `EXPO_PUBLIC_DEEPSEEK_MODEL` from `teacher/.env` (copy `.env.example`). Expo inlines `EXPO_PUBLIC_*` at bundle time, so restart Metro after changing it, and remember the key ships inside the APK. `.env` is gitignored; never commit a key or print it in logs.

## Where things are

- `src/composition/`: the only place that knows concrete classes.
  - `container.ts` creates the store, link, pipeline and auto-calibrator.
  - `TrackingCamera.tsx` wires the camera to them.
- `src/features/perception/`: camera → pose → pointers; calibration. Pointing is the only interaction (no gestures, no jump counts).
  - The pipeline:
    1. `PoseCamera` films with the main back camera (`cameraChoice.ts`, logged as `[camera]`) and runs the GPU resizer at the lanes' scale (`laneLayout` in `lanes.ts`): each lane is exactly 192×192 pixels of its output.
    2. **One lane per frame**, picked by `laneForTurn` (`laneSchedule.ts`) from `busyLanesAtom`: lanes with a child take turns, an empty lane gets every 4th frame. Then `copyLane` (192 row copies) → MoveNet → `decodeRoi`. Running both lanes per frame doubled the picture-to-pointer delay.
    3. `PerceptionPipeline` gets one lane's pose per frame (`undefined` for the lane not looked at), keeps only bodies that pass `isPlausibleBody` (`body.ts`) for 2 looks in a row, then turns them into hands, homography, One Euro filter, `ptr`/`lost` messages, and reports `busyLanes` back to the camera. It returns a `PerceptionView` (tracked pose and sent pointers per lane): the preview draws exactly that, so dots on the screen mean "the TV gets this".
  - Lanes follow `teamCountAtom`: two (one per team half) or one over the whole projection for one player, so a child in the middle of the wall is never split between lanes. The composition root sets it with `teamCountFor` (`console.ts`): the TV's running session wins, else the teacher's "Who plays" choice. A change rebuilds the crops and makes `PerceptionPipeline.setLaneCount` report tracked children lost (logged as `[camera] one player…` / `[camera] two teams…`).
  - While `lumaCaptureAtom` is true, the same worklet instead runs a second resizer (960×720) and sends 320×240 greyscale frames to `AutoCalibrator`.
  - `[perf]` log lines (every 10 s: frames per second, camera-thread ms per frame, pose updates per lane) and the class screen's "Slow tracking" status come from `FrameRateMeter` (`frameRate.ts`) and the composition root.
- `src/features/link/`: RFC 6455 WebSocket server over raw TCP (hand-written codec in `domain/`), heartbeat, TV session mirror.
- `src/features/library/`: the lesson gallery. `domain/catalog.ts` (subjects, age groups, records), `application/library.ts` (atoms + `makeLibrary({store, files, starterFiles})`), `infrastructure/fileLessonStore.ts` (expo-file-system: `document/lessons/*.json`, `records.json`). Starter lessons are bundled from `infrastructure/starterLessons.generated.ts` (generated: run `npm --prefix ../shared run build:content`, don't edit).
- `src/features/authoring/`: chat with the AI to create a lesson. `domain/draft.ts` decodes the AI's JSON and turns it into a lesson (engine for known kinds, checked cards otherwise); `domain/prompt.ts` is the system prompt; `application/lessonChat.ts` asks, validates and retries once with the reason; `infrastructure/deepseek.ts` + `providers.ts` are the strategy (`ChatModel` per `ProviderId`). Tests use a fake `fetch`; there is no live call in CI.
- `src/features/pictures/`: Twemoji SVG art (`iconArtAtom`, generated `twemojiArt.generated.ts`) and the `Picture` component (emoji fallback).
- `src/features/console/`: start a lesson on the TV (`startCommand` sends the lesson, its art and the record), and live class controls.
- **Functional core:** in `library`, `authoring`, `pictures` and `console`, ESLint forbids classes and `throw` in `domain/` and `application/`. Return `Result` values (`@projectplay/contracts`), build use cases as `makeX(deps)`, and keep ports as function types.
- `domain/testing/`: synthetic poses and synthetic camera images of the calibration pattern. Use them in tests instead of mocks.

## Camera thread rules (VisionCamera v5 + worklets)

- Any function called inside `onFrame` must start with `'worklet'`. Values it captures are copied when the callback is installed, so capture plain values only, not class instances.
- Pass results to JS with `scheduleOnRN`.
  - Small data (pose arrays) goes as plain arrays.
  - Large buffers go as a **string** (`encodeLuma`/`decodeLuma`); that was the reliable path on the test phone.
- Always `dispose()` the `Frame` and the resized `GPUFrame` in `finally`.
- Exceptions inside `onFrame` are caught by VisionCamera and only logged on the camera runtime. A broken worklet looks like "no frames arriving", so add a status or counter rather than guessing.
- Every re-render of `PoseCamera` reinstalls the frame callback. Screens around the camera must subscribe to narrow atoms (`autoCalibrationStateAtom`, not the whole status).
- A reinstall is a job queued on the camera thread: on a hot phone processing frames back to back it lands seconds late. A flag that must take effect on the next frame goes through a `createSynchronizable` the worklet reads (as the calibration mode does), not a captured prop.
- No per-pixel loops in the worklet: JS there costs ~1 µs per pixel (~35 ms per 192×192 lane). Use typed-array bulk operations (`set`, `subarray`, `fill`) or make the GPU resizer do the work.
- Don't reload JS (Metro `r`) while a camera screen is open: the frame thread calls TFLite on a model the reload destroyed and the app dies with SIGSEGV. Go to the home screen first. A reload can also leave port 8787 bound ("Server error"); then force-stop and relaunch the app.
- Exposure: the teacher's brightness setting (0/1/2 EV) applies to tracking only. Calibration forces bias 0. Don't toggle low-light boost while running: it restarts the camera session.

## Perception tuning knobs (change with tests)

- `pose.ts` `MIN_KEYPOINT_SCORE`; `perceptionPipeline.ts` `DEFAULT_PIPELINE_OPTIONS` (frames to acquire / lose a child).
- `body.ts` `BODY_GATE`: the score bar is low on purpose and the shape decides; check changes against field frames with phantoms in empty lanes.
- `lanes.ts` `LANE_MARGINS`, `MIN_LANE_SIDE`; `pointing.ts` `HAND_EXTENSION`, `MIN_HAND_SCORE`, `MAX_REACH`, `ELBOW_REACH`.
- `oneEuroFilter.ts` `DEFAULT_ONE_EURO`: responsiveness vs. jitter (the comment has the simulated trade-off at the measured lane rates).
- `laneSchedule.ts` `PROBE_EVERY`: how often an empty lane is checked (higher = more frames for the children already there, slower to notice a newcomer).
- `cameraChoice.ts`: which back camera films the class. Keep it a single physical camera: a lens switch changes the field of view under the calibration.
- `markers.ts` thresholds; `autoCalibration.ts` (application) `CALIBRATION_STEPS` waits and retries.
- Dwell timing is on the TV (`tv/packages/tv-shared/src/features/interaction/domain/dwell.ts`), not here.
