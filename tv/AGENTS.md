<!-- TV workspace. Loads on top of the root AGENTS.md when an agent works in tv/. -->

# TV app (Fire OS, Android TV, Vega OS)

A Yarn 4 workspace forked from AmazonAppDev/react-native-multi-tv-app-sample. One game, two runtimes:

| Workspace | Runtime | Notes |
|---|---|---|
| `apps/expo-tv` | Expo SDK 54 + react-native-tvos 0.81, **legacy architecture**, Expo Router | Fire OS / Android TV. Always run with `EXPO_TV=1` (the scripts do it) |
| `apps/vega` | Vega SDK, **React Native 0.72**, no router | Fire TV on Vega OS. `TvApp` from tv-shared renders the screen for the current state |
| `packages/tv-shared` | Everything both apps share | Features: `session` (lesson player: reducer, levels, points, timer), `interaction` (dwell, layout, PointerHub), `link` (WebSocket client, discovery), `game` (screens), `calibration` (pattern layer), `pet` (Mimikai in the class: cues, spotlight; the model and rig are `shared/pet`) |

The TV has **no lesson content and no exercise engine**: the phone's start command carries the lesson and its SVG art (protocol v2), and the TV keeps them in memory only (`sessionAtom`, `artAtom`). Without the phone the TV shows pairing or the lobby; there is no practice mode.

## Commands (from `tv/`)

```bash
corepack yarn install         # Yarn 4 via corepack; plain `yarn` may be global Yarn 1 and breaks the workspace
corepack yarn check           # typecheck (expo-tv, which includes tv-shared) + vitest
cd apps/vega && npx eslint src --ext .ts,.tsx
../scripts/devices.sh tv      # build, install and run on the Fire TV / Android TV (Metro :8081)
```

Vega bundles: `cd apps/vega && npx react-native bundle --platform kepler --dev false --entry-file index.js --bundle-output /tmp/vega.bundle`. Full builds need the Vega SDK (`corepack yarn build:vega`).

## Rules for `packages/tv-shared`

- It must run on **React Native 0.72** (Vega) as well as 0.81.
  - No `transformOrigin`, no newer RN-only APIs, no Expo modules.
  - Platform differences go in `*.kepler.ts` files, which Vega's Metro resolves first (see `packages/tv-shared/src/platform/remote-control/` and `packages/tv-shared/src/features/link/infrastructure/networkInfo*.ts`).
- The screen layout is normalised projection space (0..1). Convert with `useRectStyle()` and size with `scaledPixels()` (1080p reference).
- Cursors, dwell progress and the calibration pattern update through listeners and `Animated` values, not React state.
- The calibration pattern layer sits above every screen in `TvServicesProvider`. It must stay pure black and white at the positions in `shared/contracts/src/calibration.ts`, and confirm with `calibrationShown` only after it has been drawn.
- The TV remote has to work everywhere: D-pad focus via `react-tv-space-navigation`, and the remote is also a virtual pointer during a class (⏩ = next card). That is how judges test on the Fire TV simulator, with the phone connected.
- Lesson play (`session/domain/`): `progression.ts` moves the level after a 2-round window (≥ 75 % up, ≤ 25 % down) and picks the next unplayed card nearest that level; `scoring.ts` gives 100/150/200 by level + speed bonus + streak bonus, and never takes points away; `session.ts` holds timers per age group (`QUESTION_TIME`). Keep these pure and seeded (`random.ts`) so tests are exact.
- Pictures: `game/ui/Picture.tsx` draws the SVG with `react-native-svg` (`SvgXml`) on Fire OS; `Picture.kepler.tsx` shows the emoji on Vega, which has no stock `react-native-svg`. The pet's layers follow the same split (`shared/pet/src/rig/RigPart.tsx` and `RigPart.kepler.tsx`). Don't import `react-native-svg` anywhere else in tv-shared.
- Mimikai, the class pet (`pet/`), is on every screen and reacts to the class. Its mood is a pure function, `cueOf(moment, memory, now)` in `pet/domain/cue.ts`, of the pet's own view of the class (`pet/application/classMoment.ts` is the only place it reads the session). `spotlightOf` (`pet/domain/stage.ts`) puts it full screen like Duo for the class's greeting and for level-up and streak parties, in the answer panel for each reaction, and small in its corner while children choose; `game/ui/PlayPet.tsx` is the one pet that springs between the three. The session gives those moments their own time: the first card opens after `INTRO_MS`, and a round with a milestone (`Outcome.milestone`) keeps the answer screen up longer (`partyMsOf`: `LEVEL_UP_PARTY_MS` for Rayitas's jump through the new ring, `BIG_STREAK_PARTY_MS` for a team's first five in a row, when Rayitas bounds through every ring, `CELEBRATION_MS` otherwise). Rayitas, Mimikai's tiger cub, comes only to those parties and to the lobby (never during a question); `spotlight.rayitas` says which scene, and `sceneStageAround` measures its stage from where Mimikai is drawn. Every class ends with the energy ball (`EnergyFinale`, then the scores): its ending comes from the stars of the whole class's right answers and a beaten record, timed from the session's `endedAt`. Moods, keyframes, the rings and the rig live in `shared/pet` (design master: `docs/brand/motion/mimikai-moods.html`). The rig moves only transforms and opacity on the native driver, never through React state. Every new animated node is a round trip to the native side when the mood changes (about 0.5 s for ~120 nodes in a debug build on an onn 4K box), so `Pet` and `ClassPet` are memoised, still values are plain numbers and blends exist only where a value would jump (`shared/pet/src/rig/motion.ts`).
- In the lobby, Mimikai is the wall's one target (`PET_TARGET`, set by the composition root): a hand held on it tickles it, which practises the answer gesture. The remote's OK does the same.
- Back must not leave a running game (see `apps/expo-tv/src/app/_layout.tsx`). Keep the screen awake.
- A session has one or two teams (`SessionConfig.teams`, absent = 2). One player is team A on the whole wall. Anything on screen or in the rules iterates `playingTeams(config)`, never `TEAMS`, and the composition root keeps `PointerHub.setTeamCount` in step so every hand lands on a playing team.

## Native config (Fire OS app)

- `apps/expo-tv/android/` is generated by `EXPO_TV=1 expo prebuild --clean`. Change it through `app.json` or `apps/expo-tv/plugins/*.js` (config plugins), never by hand.
- `usesCleartextTraffic` must stay on: the link is plain `ws://` on the local hotspot.
- `tsconfigPaths` stays off in `app.json`: the tsconfig `"*"` mapping breaks Metro resolution.
