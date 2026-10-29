# Friction log

Submissions with friction logs can earn up to a 10% judging bonus. Each entry covers the task, the steps, expected vs. actual result, severity, the workaround, and a suggestion.

The first entries were observed while scaffolding the project on 2026-10-20 (no device yet). **Add your own entries while you build and test on the Fire TV.** On-device problems are the most valuable feedback, so write them down the moment they happen, with exact error text.

---

### F1 · The multi-TV sample resolves React Native TV to a release candidate
- **Task:** Start from `react-native-multi-tv-app-sample` with Expo SDK 54.
- **Steps:** `yarn install` in the sample, then inspect `apps/expo-multi-tv/node_modules/react-native/package.json`.
- **Expected:** The stable `react-native-tvos` matching Expo SDK 54 (RN 0.81.5, `0.81-stable`).
- **Actual:** `"react-native": "npm:react-native-tvos@~0.81.0-0"` resolves to `0.81.0-0rc5`.
- **Severity:** Medium. Builds work, but the starter ships an RC and drifts from what Expo SDK 54 tests against.
- **Workaround:** Kept the lockfile's version for the hackathon.
- **Suggestion:** Pin `npm:react-native-tvos@0.81-stable` (or the exact stable patch) in the sample and document the Expo SDK ↔ tvOS mapping in its README.

### F2 · Sample `package.json` mixes Expo SDK 52 and SDK 54 package versions
- **Task:** Add Expo Router to the sample's Expo app.
- **Steps:** Compare the dependencies with `expo/bundledNativeModules.json` for SDK 54.
- **Expected:** SDK-54-aligned versions (what `npx expo install --fix` would produce).
- **Actual:** `expo ~54` sits next to `expo-font ~13`, `expo-constants ~17`, `expo-splash-screen ~0.29` and `@expo/metro-runtime ~4` (SDK 52 versions). `expo-router@6` needs `@expo/metro-runtime ^6.1.2` and `expo-constants ^18`.
- **Severity:** Medium. Adding the most common Expo library forces a manual dependency audit.
- **Workaround:** Re-aligned the Expo packages we kept to SDK 54 and removed unused ones (video, drawer, reanimated).
- **Suggestion:** Run `expo install --check` in the sample's CI.

### F3 · Strict TypeScript fails on the sample's remote-control layer
- **Task:** Typecheck shared TV code with `strict: true`.
- **Steps:** `tsc --noEmit` over `packages/shared-ui/src`.
- **Expected:** A clean typecheck. The sample advertises "Full TypeScript support".
- **Actual:** `RemoteControlManagerInterface.addKeydownListener` declares `() => void`, but every implementation returns the listener. The `configureRemoteControl` key mapping misses `PlayPause`, `FastForward` and `Rewind` (TS2739). `react-native-pixel-perfect` has no types.
- **Severity:** Low. Easy fixes, but it surprises new developers in the first hour.
- **Workaround:** Fixed the interface, completed the mapping, and added a `.d.ts` for pixel-perfect.
- **Suggestion:** Add `yarn typecheck` to the sample's CI, plus a small upstream PR (we can send ours).

### F4 · Code shared between Fire OS and Vega OS must target an older JS toolchain
- **Task:** Share game code between the Expo (RN 0.81, Metro 0.83) and Vega (RN 0.72, Metro 0.76) apps.
- **Steps:** Bundle the Vega app with `react-native bundle --platform kepler`.
- **Expected:** The same libraries work on both.
- **Actual:** Vega's Metro does not support package `exports`, and its `sourceExts` do not include `.cjs`. ESM-only libraries such as Jotai v3, and libraries with `.cjs` entry points such as zod v4, need extra config or will not resolve.
- **Severity:** Medium. You only find out when you bundle for Vega.
- **Workaround:** Pinned Jotai 2.20 (ships CJS files at the package root) and replaced zod with zero-dependency validators.
- **Suggestion:** A short "Writing code shared with Vega OS" doc page listing the JS/Metro constraints, or enable `unstable_enablePackageExports` in the Vega Metro preset.

### F5 · Reading the device IP on Vega OS
- **Task:** Discover the teacher's phone on a hotspot (the TV needs its own IP to find the gateway and subnet).
- **Expected:** A documented equivalent of `expo-network`'s `getIpAddressAsync()` for Vega.
- **Actual:** We could not find a documented API in the sample or the hackathon resources.
- **Severity:** Low/Medium. Discovery falls back to well-known hotspot gateways.
- **Workaround:** `networkInfo.kepler.ts` returns `null`; well-known gateways plus a manual `preferredHosts` setting.
- **Suggestion:** Add a network-info example to the Vega samples. *(Verify against the Vega docs before submitting. If the API exists, describe how hard it was to find instead.)*

### F6 · Local-network apps on Fire OS need cleartext and keep-awake settings
- **Task:** Connect the Fire TV to a WebSocket server on the phone's hotspot (`ws://`).
- **Expected:** Fire TV docs mention what local-network / second-screen apps need.
- **Actual:** Android release builds block cleartext traffic by default (`ws://` included). Long classes with no remote input also trigger the screensaver.
- **Severity:** Medium. Debug builds work and release builds silently do not: a classic demo-day surprise.
- **Workaround:** `expo-build-properties → android.usesCleartextTraffic: true` and `expo-keep-awake`.
- **Suggestion:** A "second-screen / companion device" guide for Fire TV covering cleartext, keep-awake and discovery.

### F7 · `expo prebuild` crashes on the sample's TV config plugin, then Gradle fails with "Unresolved reference R / BuildConfig"
- **Task:** First native build of the Fire OS / Android TV app (`EXPO_TV=1 expo run:android`) on a real Android TV.
- **Steps:** Fresh `yarn install`, then `expo run:android`.
- **Expected:** Prebuild applies the TV plugin (Leanback launcher, banner) and Gradle compiles.
- **Actual:** `@react-native-tvos/config-tv@0.0.10` (pinned by the sample) calls `glob.sync` without declaring `glob`. With glob v13 hoisted, prebuild throws `withAndroidDangerousBaseMod: Cannot read properties of undefined (reading 'sync')`. Expo then reuses the half-generated `android/` on the next run: Gradle `namespace "com.projectplay"` vs Kotlin `package com.projectplay.tv` → `Unresolved reference 'R'` / `'BuildConfig'`, an error far away from the real cause.
- **Severity:** High. It blocks the first device build, and the message is misleading.
- **Workaround:** Upgraded to `@react-native-tvos/config-tv@^0.1.7` (declares `glob`). Our `scripts/devices.sh tv` regenerates `android/` with `expo prebuild --clean` when the TV manifest is incomplete.
- **Suggestion:** Bump config-tv in the sample (we sent it upstream: [AmazonAppDev/react-native-multi-tv-app-sample#141](https://github.com/AmazonAppDev/react-native-multi-tv-app-sample/pull/141)). Ideally Expo should not reuse a native folder from a prebuild that failed.


### F8 · `./gradlew clean` breaks the next build, and the app then crashes at launch
- **Task:** Rebuild the teacher app (Expo SDK 56, RN 0.85, new architecture) on a Samsung Galaxy A26 over wireless adb.
- **Steps:** `cd teacher/android && ./gradlew clean`, then `npx expo run:android`.
- **Expected:** A clean rebuild.
- **Actual:** `clean` fails in React Native's CMake (`add_subdirectory given source …/react-native-worklets/android/build/generated/source/codegen/jni/ which is not an existing directory`) after deleting the libraries' outputs, but not the app's. The next build succeeds, yet its `R.jar` lacks the R classes of dozens of libraries (React Android, AppCompat, AndroidX Startup, Lifecycle…). The APK installs, then dies before any JavaScript runs: `NoClassDefFoundError: Failed resolution of: Landroidx/startup/R$string` in `InitializationProvider`. Expo CLI meanwhile reports an unrelated `No development build (…) is installed` when `a` opens the first adb device (the TV).
- **Severity:** High. A routine "clean" produces a silently broken APK, and the crash points at AndroidX rather than the build.
- **Root cause (found later):** `expo prebuild` generates a Gradle 9.3.1 wrapper, but the Android Gradle Plugin it ships (8.12.0) only supports Gradle up to 8.14. On Gradle 9 the `R.jar` silently drops those libraries' R classes on *every* build, including from-scratch ones, so `--clean` alone does not fix it. The TV app, on Gradle 8.14.3, is fine.
- **Fix:** `scripts/devices.sh teacher` now pins `teacher/android/gradle/wrapper/gradle-wrapper.properties` to Gradle 8.14.3 before building (the file is generated and gitignored, so the pin is reapplied after every prebuild). It also falls back to the Homebrew Android SDK when `ANDROID_HOME` is unset.
- **Workaround (older):** `scripts/devices.sh teacher --clean` deletes the app module's Gradle outputs (keeping the native `.cxx` cache), uninstalls and rebuilds. The script also watches the device and prints the crash log the moment the app crashes.
- **Suggestion:** Make React Native's `externalNativeBuildClean` tolerate missing codegen folders, and have AGP verify that R.jar covers every runtime dependency with resources.

### F9 · Node 26 no longer ships Corepack, so the TV workspace's Yarn 4 cannot start
- **Task:** Run the whole-repo check (`npm run check`) on a Mac with Node 26 (Homebrew and nvm).
- **Steps:** `npm run check` from the repo root. The shared and teacher steps pass, then `cd tv && corepack yarn check` runs.
- **Expected:** The TV workspace (forked from the multi-TV sample, `"packageManager": "yarn@4.5.0"`) checks like the others.
- **Actual:** `sh: corepack: command not found`. Node stopped bundling Corepack from v25, and the sample has no vendored Yarn release (`.yarn/releases`, `yarnPath`) to fall back on. Plain `yarn` is no option either: a global Yarn 1 breaks the workspace.
- **Severity:** Medium. Every TV command in the README fails on a current Node, with nothing pointing at the Node version.
- **Workaround:** Use Node 24 LTS, or install Corepack separately (`npm install -g corepack`). A machine where Corepack once ran still has Yarn in its cache: `node ~/.cache/node/corepack/v1/yarn/4.5.0/yarn.js check` (from `tv/`) works without it.
- **Suggestion:** Pin a Node version in the sample (`.nvmrc` / `engines`) or commit the Yarn release with `yarnPath`, so it works without Corepack. We sent the `.nvmrc` and corrected prerequisites upstream: [#142](https://github.com/AmazonAppDev/react-native-multi-tv-app-sample/pull/142).
- **Fix in this repo:** every root script and `scripts/devices.sh` call Yarn through `scripts/yarn.sh`, which uses Corepack when it is installed and `npx -y corepack` otherwise, so `npm run check` passes on Node 26.

### F10 · The sample's `FocusablePressable` cannot be centred
- **Task:** Centre a single remote-control button under the lobby content on the projected wall (onn 4K Google TV box, 1920×1080).
- **Steps:** Put the sample's `FocusablePressable` in a `SpatialNavigationView` inside a column with `alignItems: 'center'`.
- **Expected:** The button centred on screen, label on one line.
- **Actual:** The button sat 38 px left of centre (visible box x 785–1058, its focus wrapper 785–1136, measured with `uiautomator dump`), with "Practice with the remote" wrapped onto two lines. The sample's style has `alignSelf: 'flex-start'` and `maxWidth: '90%'`. The focus wrapper shrinks to fit the button, so the percentage resolves against the button's own width: the button shrinks to 90 % of itself and is pinned to the wrapper's left edge. Users reported it as misaligned, since the wall's centre line is also where the phone splits the two teams.
- **Severity:** Low. It is cosmetic, but on a projection every off-centre pixel is magnified.
- **Workaround:** Removed both properties from the component; the screen now decides where the button goes.
- **Suggestion:** Drop `alignSelf` and percentage `maxWidth` from the sample's button, so containers control alignment.

### F11 · Reloading JS while VisionCamera and fast-tflite run kills the app natively
- **Task:** Iterate on the perception code with Metro reload, with the teacher app on its camera screen (Galaxy A26, dev build).
- **Steps:** Open the camera view, then reload JS (Metro `r`, or the `/message` reload command).
- **Expected:** The JS restarts; the camera and model come back with the new code.
- **Actual:** `Fatal signal 11 (SIGSEGV)` in thread `lo.camera.frame`. The frame worklet keeps running during the reload and calls `runSync` on a TFLite model the reload destroyed; NitroTflite's error path then creates a `JSError` on the torn-down runtime (`createStringFromUtf8` in `libhermesvm.so`). After a reload from the home screen, the native TCP server of the previous JS instance could also keep port 8787: "Server error: undefined".
- **Severity:** Medium. It costs a relaunch each time, and the crash looks like a model bug.
- **Workaround:** Reload only from a screen without the camera; when the port stays bound, force-stop and relaunch the app. Both are in AGENTS.md.
- **Suggestion:** VisionCamera could stop frame delivery before the JS runtime is invalidated, and Nitro modules could refuse calls from a dead runtime instead of crashing.

### F12 · A new VisionCamera frame callback can arrive seconds late on a busy camera thread
- **Task:** Switch the frame worklet from pose tracking to calibration (greyscale frames) when automatic calibration starts.
- **Steps:** The `captureLuma` prop changes, so `useFrameOutput` installs the new `onFrame` (via `scheduleOnRuntime` on the camera thread) while the hot phone processes frames back to back (200–340 ms each).
- **Expected:** The next frame runs the new callback.
- **Actual:** Pose frames kept arriving for the whole ~6 s calibration window and not a single greyscale frame did: "The camera is not sending pictures to the calibration", twice in a row.
- **Severity:** High. Recalibration fails exactly when the phone is busiest, and nothing points at the callback swap.
- **Workaround:** The mode flag lives in a `createSynchronizable` that the worklet reads on every frame; a mode change no longer needs a new callback.
- **Suggestion:** Document that `onFrame` updates are asynchronous, or give `useFrameOutput` a documented way to pass per-frame parameters (a shared value) to the worklet.

### F13 · The GPU resizer cannot crop, so per-lane crops cost ~35 ms of JavaScript each
- **Task:** Feed two 192×192 regions of each camera frame (one per team) to MoveNet.
- **Steps:** `react-native-vision-camera-resizer` resizes the whole frame (960×720 RGB); the worklet then resampled each region pixel by pixel into the model input.
- **Expected:** Cropping is cheap next to the model.
- **Actual:** Measured on the Galaxy A26: resize 8 ms, crops 62–74 ms, model 86–95 ms per frame, so 6 fps on a cool phone and 3 fps once it throttled. `Resizer.resize(frame)` has no region-of-interest option.
- **Severity:** High for multi-region models: the crop costs nearly as much as inference and heats the phone.
- **Workaround:** Ask the resizer for the exact output size at which each lane is 192 pixels wide, then cut a lane with 192 `Uint8Array.set` row copies (~1 ms). Same thermal state: 210–270 ms per frame before, 98–144 ms after.
- **Suggestion:** Add an optional crop rectangle to `resize()`; ML pipelines that crop around people (MoveNet's own recommended usage) need it.

### F14 · fast-tflite: NNAPI, the GPU delegate and extra CPU threads are all slower than one CPU thread for MoveNet INT8
- **Task:** Speed up MoveNet SinglePose Lightning INT8 on the Galaxy A26 (Exynos 1280: 2× Cortex-A78 + 6× Cortex-A55).
- **Steps:**
  - Delegates: same app and scene, `useTensorflowModel(model, delegates)` with `[]`, `['nnapi']` and `['android-gpu']`; per-frame time for two inferences from the worklet.
  - Threads: fast-tflite creates the interpreter with default options (one thread) and has no JS option for it, so a temporary native patch called `TfLiteInterpreterOptionsSetNumThreads(options, N)` before `TfLiteInterpreterCreate`, with N read from a debug system property (one build for every N). Alternating 40 s runs with N = 1, 2 and 4 on "Check camera view", all at thermal status 3. The first `[perf]` line of each run is dropped, because it is a moving average still carrying the previous run.
- **Expected:** A hardware delegate, or more threads, is faster than one CPU thread. On a desktop the same model takes 6.0 ms with 1 thread, 4.1 ms with 2 and 3.6 ms with 4.
- **Actual:**
  - Delegates: CPU 86–95 ms, NNAPI 120–150 ms, GPU (OpenCL, "Created 1 GPU delegate kernels") 126–144 ms.
  - Threads, median per frame at thermal status 3: 1 thread 216 ms (4.4 fps, 18 samples), 2 threads 247 ms (3.9 fps, 21 samples), 4 threads 403 ms (2.4 fps, 6 samples).
  - Ranges: 107–291 ms, 140–324 ms and 384–424 ms. Status 3 spans several degrees, so only many alternating runs separate 1 from 2 threads; 4 is clearly worse.
  - Why: the phone has only two fast cores, and the scheduler moves the inference threads onto the slow A55s (5 of 12 per-thread samples during a 2-thread run), so every layer waits for the slowest thread. At status 3 the A78s are also capped at 1.82 GHz (2.4 GHz when cool).
- **Severity:** Medium. Every obvious speed-up makes it slower on this phone, and finding that out for threads takes a native patch.
- **Workaround:** One CPU thread, no delegate: the library default, so the patch was dropped. Cut everything around the model instead (F13).
- **Suggestion:** Expose `numThreads` in `loadTensorflowModel` (phones with four big cores may still gain), document that extra threads can be slower on phones with two big cores, and document which delegates help quantised models on Android.

### F15 · VisionCamera's device filter cannot pick "the main back camera" on Android
- **Task:** Make sure the class is filmed with the Galaxy A26's main camera (4080×3060, f/1.8), not its ultra-wide (3264×2448, f/2.2, barrel distortion that bends the calibration homography) or the logical camera that switches lenses as it zooms. `adb shell dumpsys media.camera` lists four cameras: back main, front, back ultra-wide, back logical.
- **Steps:** The documented way: `useCameraDevice('back', { physicalDevices: ['wide-angle'] })` (react-native-vision-camera 5.2.3).
- **Expected:** The back camera whose lens is the main wide-angle one.
- **Actual:** On Android the filter cannot match anything. `getCameraDevice` scores each device by the `type` of its `physicalDevices`, but those are `HybridPhysicalCameraDevice`s backed by CameraX's `PhysicalCameraInfoAdapter`, whose `deviceType` is always `UNKNOWN` (`CameraInfo+deviceType.kt`: "PhysicalCameraInfoAdapter throws when accessing `intrinsicZoomRatio`"). Every device scores the same or worse, and the hook returns the first back camera in CameraX's list, whichever lens that is. Without a filter, `getDefaultCamera('back')` is also "the first one". Nothing fails or warns, so which lens films the class depends on the phone.
- **Severity:** Medium. It only matters in low light or with the projection near the frame edges, which is exactly a classroom from behind the children, and it is silent.
- **Workaround:** Rank the devices ourselves (`teacher/src/features/perception/domain/cameraChoice.ts`): a physical `type === 'wide-angle'` camera first (Android derives it from `intrinsicZoomRatio == 1`), then the most pixels from `getSupportedResolutions('photo')`, then the lowest `lensAperture`; logical cameras (`isVirtualDevice`) only as a fallback. The choice is logged as `[camera]`.
- **Suggestion:** Score the device's own `type` when it has no usable physical devices, expose `intrinsicZoomRatio`/field of view, and document that `physicalDevices` types are `unknown` on Android.

### F16 · Vega's react-native-svg port doesn't say whether it can draw an SVG string (`SvgXml`)
- **Task:** Show lesson pictures (Twemoji SVGs the phone sends as strings) on both TV runtimes from one shared component.
- **Steps:** On Fire OS, `react-native-svg` 15.12.1 with `<SvgXml xml={svg} />`. For Vega we read the [react-native-svg page of the Vega API docs](https://developer.amazon.com/docs/vega-api/0.24/react-native-svg.html): the port is `@amazon-devices/react-native-svg` (`~2.0.x` for React Native 0.72, `~3.0.x` for 0.83), system-deployed and autolinked.
- **Expected:** The page says which entry points work, so shared code can rely on them.
- **Actual:** It lists unsupported elements (Polygon, Polyline, TextPath, Symbol, Pattern, Marker, ForeignObject) and APIs (markers, touch events, patterns), and lists Polyline both as supported and unsupported. It never mentions `SvgXml`, `SvgCss` or `SvgUri`, the parts that parse an SVG string or file. Our 140 icons only use `path`, `circle`, `ellipse` and `g`, all supported, but without a Vega Virtual Device at hand we could not check that `SvgXml` exists, and a missing export fails only at runtime on the device.
- **Severity:** Low. Pictures still show, as emoji.
- **Workaround:** `Picture.kepler.tsx` (resolved first by Vega's Metro) renders the emoji as text; Fire OS keeps `SvgXml`. The shared code imports `react-native-svg` only in `Picture.tsx`, so the Vega bundle doesn't contain it.
- **Suggestion:** List the supported top-level exports (`SvgXml`, `SvgCss`, `SvgUri`, `SvgFromXml`) on the page, fix the Polyline contradiction, and say which Vega SDK version ships which port.

### F17 · DeepSeek JSON mode guarantees JSON, not your JSON, and can return empty content
- **Task:** Let a teacher create a lesson by chatting: the model must answer with `{ "reply", "lesson" }` in our format.
- **Steps:** `POST https://api.deepseek.com/chat/completions` with `response_format: { "type": "json_object" }`, a Spanish system prompt containing the word "json", our format and examples, `max_tokens: 8000`, from plain `fetch` in React Native.
- **Expected:** A way to pass a JSON schema, as other OpenAI-compatible APIs do (`json_schema`), so the reply has the right fields and types.
- **Actual:** JSON mode only promises *valid JSON*. The [JSON mode guide](https://api-docs.deepseek.com/guides/json_mode/) asks for the word "json" in the prompt, an example of the output, and a large enough `max_tokens` to avoid truncation, and warns that the API "may occasionally return empty content". There is no schema parameter, so wrong field names, an answer index out of range or a truncated object are all possible and only show up in the app.
- **Severity:** Medium. A teacher in front of a class can't debug a malformed answer.
- **Workaround:** Treat the reply as untrusted input: `decodeAiReply` validates and clamps every field, then `decodeLesson` checks the rules. If it fails (or the content is empty), the reason goes back to the model once ("your answer was not valid because …"), then the teacher sees a plain error. For exercises the engine knows, the model only fills a small request and the engine builds the cards, so most of the answer can't be wrong. Tested with recorded responses; the development sandbox could not reach the API, so the first live call is on the phone.
- **Suggestion:** Support `response_format: { type: "json_schema" }` (or a `strict` flag), and return a finish reason or error instead of empty content.

### F18 · A native module installed after the last Gradle run is silently left out of the dev build
- **Task:** Run the teacher app on the phone right after adding `react-native-svg` 15.15.4 (Expo SDK 56, RN 0.85.3, new architecture).
- **Steps:** `npm --prefix teacher install react-native-svg`, then `npm run dev:teacher` (`npx expo run:android`). Gradle had last generated `teacher/android/build/generated/autolinking/autolinking.json` at 23:40; the package landed in `node_modules` at 23:43.
- **Expected:** `expo run:android` sees the new native module and links it, or says the native project is stale.
- **Actual:** The build succeeded, installed, and the app showed a red screen at launch: `com.facebook.react.uimanager.IllegalViewOperationException: Can't find ViewManager 'RNSVGPath' nor 'RCTRNSVGPath' in ViewManagerRegistry`. The phone shows only the stack trace (the message is cut off), and the full list of registered view managers is only in `adb logcat` under `DevLauncher`. Meanwhile `npx expo-modules-autolinking react-native-config --platform android` did list `react-native-svg`: only Gradle's cached autolinking output was stale.
- **Severity:** Medium. It looks like a broken library rather than a stale build, and hot reload can't fix it.
- **Workaround:** `scripts/devices.sh teacher --clean` (deletes the Gradle outputs, reinstalls). The first launch after that crashed once natively (`SIGSEGV` in `facebook::react::MountingCoordinator::pullTransaction`) while the dev launcher reopened the app with the Metro URL; launching again worked.
- **Suggestion:** Make the autolinking Gradle task depend on `package.json`/lockfile and `node_modules` package manifests, or have `expo run:android` compare the resolved native module list with the last build and rebuild (or warn) when they differ. Show "native module missing from this build: rebuild" for this error in the dev client.

---

### F19 · react-native-fast-tflite 3 cannot load a bundled model in an Android release build
- **Task:** Build the teacher app as a standalone release APK for judges (`scripts/devices.sh release`) and start a class on a Galaxy A26.
- **Steps:** `useTensorflowModel(require('…/movenet-singlepose-lightning-int8.tflite'), [])`, exactly as the library's README shows, then `./gradlew assembleRelease` and open the class screen.
- **Expected:** The model loads as it does in the development build.
- **Actual:** `Pose model failed to load: java.net.MalformedURLException: no protocol: assets_models_movenetsingleposelightningint8` (from `HybridAssetLoader`). The Nitro rewrite (3.0.1) reads every source with `java.net.URL(path)`. In debug, `Image.resolveAssetSource` gives Metro's `http://` URL, so it works. In release, it gives the bare `res/raw` resource name. Every debug run passed; only the release APK failed, and the model *was* in the APK (`res/Dw.tflite`).
- **Severity:** Critical. Tracking is the whole product, and the bug only shows in the build you hand out.
- **Workaround:** `teacher/src/features/perception/infrastructure/model.ts` resolves the model with `expo-asset` (`Asset.loadAsync`), which copies the raw resource to the cache and returns a `file://` URI, then calls `loadTensorflowModel({ url })`. The same path works in debug.
- **Suggestion:** In `HybridAssetLoader`, fall back to `resources.getIdentifier(name, "raw", packageName)` when the path has no scheme, as v2 did. Add a release-build smoke test to the example app.

### F20 · `eas credentials:configure-build` cannot create a keystore without a terminal
- **Task:** Create the EAS-managed Android upload keystores for both apps before the first Play Store build, from a script (no build yet).
- **Steps:** `npx eas-cli credentials:configure-build -p android -e production` with the answer piped in (`printf 'y\n' | …`).
- **Expected:** A `--non-interactive` mode that generates the keystore (as `eas build --non-interactive` does), or a flag such as `--generate-keystore`.
- **Actual:** `Input is required, but stdin is not readable. Failed to display prompt: Generate a new Android Keystore?` The command has no flag for the one question it asks, so the only scripted ways are a full (billed, slow) `eas build`, or faking a terminal.
- **Severity:** Low. It blocks automation and CI set-up, not people at a keyboard.
- **Workaround:** Run it under a pseudo-terminal: `(sleep 15; printf 'y\r'; sleep 40) | script -q /dev/null npx eas-cli credentials:configure-build -p android -e production`.
- **Suggestion:** Add `--non-interactive` to `credentials:configure-build`, generating a new keystore when none exists (the same default `eas build` uses).

### F21 · EAS Build installs a Yarn 4 workspace with Yarn 1 unless the profile says `corepack: true`
- **Task:** First store build of the TV app (`tv/apps/expo-tv`, a Yarn 4 workspace with `"packageManager": "yarn@4.5.0"`) on EAS Build.
- **Steps:** `EXPO_TV=1 npx eas-cli build -p android -e production` from `tv/apps/expo-tv`.
- **Expected:** EAS sees `packageManager` (it already detects the workspace) and runs the Yarn version it names.
- **Actual:** After a long free-tier queue, the build failed in *Install dependencies*: `This project's package.json defines "packageManager": "yarn@4.5.0". However the current global version of Yarn is 1.22.22 ... Corepack must currently be enabled`. The CLI reported only `UNKNOWN_ERROR`; the reason was inside a compressed log file.
- **Severity:** Medium. It costs a whole queue wait and a build credit, and the error code says nothing.
- **Workaround:** `"corepack": true` in every build profile of `tv/apps/expo-tv/eas.json`.
- **Suggestion:** Enable Corepack automatically when `package.json` has `packageManager`, or fail in seconds, before queueing, with that message as the error.

### F22 · expo-updates fails to compile on the TV app: its KSP version follows `kotlinVersion`, not the Kotlin compiler in use
- **Task:** Add `expo-updates` (SDK 54) to the TV app (react-native-tvos 0.81) and build a release bundle.
- **Steps:** `npx expo install expo-updates`, then `./gradlew bundleRelease` (locally and on EAS Build). `app.json` pinned `expo-build-properties` → `android.kotlinVersion: "2.0.21"`.
- **Expected:** expo-updates builds with the project's Kotlin.
- **Actual:** `:expo-updates:kspReleaseKotlin FAILED` with `e: java.lang.NoSuchMethodError: ... KotlinTypeMapper$Companion.getLANGUAGE_VERSION_SETTINGS_DEFAULT()` ("Internal compiler error"). expo-updates picks KSP `2.0.21-1.0.28` from `kotlinVersion`, but the React Native Gradle plugin puts Kotlin 2.1.20 on the classpath, so KSP and the compiler disagree. EAS showed only `EAS_BUILD_UNKNOWN_GRADLE_ERROR`.
- **Severity:** High. The store build fails after a long queue, and nothing points at the Kotlin pin.
- **Workaround:** `kotlinVersion: "2.1.20"` in `tv/apps/expo-tv/app.json` (and the fallback in `plugins/withKotlinJvmTarget.js`), matching React Native 0.81's Gradle plugin.
- **Suggestion:** Derive the KSP version from the Kotlin Gradle plugin actually applied, or fail at configuration time when `kotlinVersion` and the applied plugin differ.

### F23 · The TV sample targets API 34; Play only says so after the bundle is uploaded
- **Task:** First production release of the TV app on Google Play.
- **Steps:** `eas build -p android -e production`, upload the AAB to a Production release draft, open *Preview and confirm*.
- **Expected:** The starting template (AmazonAppDev/react-native-multi-tv-app-sample) targets an API level Play accepts, or the build warns about it.
- **Actual:** `Your app currently targets API level 34 and must target at least API level 36`. The sample pins `targetSdkVersion: 34` in `expo-build-properties`; nothing in Expo, EAS or Gradle warns, so it shows up only after a queued build, a download and an upload.
- **Severity:** Medium. One more full build-and-upload cycle on release day.
- **Workaround:** `targetSdkVersion: 36` in `tv/apps/expo-tv/app.json` (`compileSdkVersion` was already 36).
- **Suggestion:** Keep the sample's `targetSdkVersion` at Play's current minimum, and have `eas build` (production profile) warn when `targetSdkVersion` is below it.

### Template for device-time entries

```
### F# · <short title>
- Task:
- Steps:
- Expected:
- Actual:            (exact error text / screenshot)
- Severity:          Critical / High / Medium / Low
- Workaround:
- Suggestion:
```
