<!-- Shared code. Loads on top of the root AGENTS.md when an agent works in shared/. -->

# Shared contracts (`shared/contracts`)

The vocabulary both apps agree on. Three bundlers compile it: Expo on RN 0.85, Expo on react-native-tvos 0.81, and the Vega toolchain on RN 0.72. So it stays **plain TypeScript with zero runtime dependencies**: no React Native imports, no Node APIs and no newer syntax that RN 0.72's Babel can't handle.

```bash
npm test                 # protocol round-trips and rejection cases (from shared/)
npm run typecheck
npm run test:e2e         # real WebSocket loop: teacher LinkService + TV LinkClient + auto-calibration
```

## Changing the wire protocol (`contracts/src/protocol.ts`)

1. Add the message to `TeacherMessage` (phone → TV) or `TvMessage` (TV → phone), with a one-line comment saying what it means.
2. Add its case to `readTeacherMessage`/`readTvMessage`. Decoders **never throw** to callers: validate every field with the helpers (`num`, `int`, `oneOf`, `nullable`, …) and return `{ ok: false }` for anything malformed.
3. Prefer an **optional field** over a new message type when extending one (as `ptr.h` and `teams` on the start config and state did). Older apps keep working, so `PROTOCOL_VERSION` stays 1. Bump it only for a breaking change. Decode an absent optional field as absent (not as its default), so old messages still round-trip exactly.
4. Add samples to the round-trip lists in `contracts/src/protocol.test.ts`, plus at least one rejected input.
5. Handle it on both ends: `tv/packages/tv-shared/src/composition/createTvServices.ts` (`link.onMessage`) and `teacher/src/composition/container.ts` (`link.onMessage`). On the phone, also add a case to the switch in `teacher/src/features/link/application/linkService.ts` (it isn't checked for exhaustiveness).
6. Run `npm run test:e2e` if the message is part of the link or calibration flow.

Keep `ptr` messages tiny: they stream at camera rate for every tracked hand. `encodeMessage` rounds their coordinates to 3 decimals.

## Calibration pattern (`contracts/src/calibration.ts`)

The TV draws `CORNER_MARKERS`/`MARKER_SIZE`, and the phone's solver assumes exactly those positions. Change them in this file only, and re-run the teacher's `autoCalibration` tests and the e2e test.
