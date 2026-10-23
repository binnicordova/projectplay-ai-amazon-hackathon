<!-- Shared code. Loads on top of the root AGENTS.md when an agent works in shared/. -->

# Shared code (`shared/`)

- `contracts/`: the wire protocol, the lesson format and its checker (`lesson.ts`), and `Result` (`result.ts`). Both apps use it.
- `exercise-engine/`: builds lesson cards. Only the teacher app uses it (the TV plays what it is sent).
- `scripts/`: `build-content.ts` writes the starter lessons and the Twemoji art into the teacher app.

## Contracts

The vocabulary both apps agree on. Three bundlers compile it: Expo on RN 0.85, Expo on react-native-tvos 0.81, and the Vega toolchain on RN 0.72. So it stays **plain TypeScript with zero runtime dependencies**: no React Native imports, no Node APIs and no newer syntax that RN 0.72's Babel can't handle.

```bash
npm test                 # contracts, engine, starter files in sync (from shared/)
npm run typecheck        # also type-checks scripts/
npm run test:e2e         # real WebSocket loop: teacher LinkService + TV LinkClient + auto-calibration + a lesson
npm run build:content    # regenerate teacher/assets/lessons/*.json, starterLessons.generated.ts, twemojiArt.generated.ts
```

## Changing the wire protocol (`contracts/src/protocol.ts`)

1. Add the message to `TeacherMessage` (phone → TV) or `TvMessage` (TV → phone), with a one-line comment saying what it means.
2. Add its case to `readTeacherMessage`/`readTvMessage`. Decoders **never throw** to callers: validate every field with the helpers (`num`, `int`, `oneOf`, `nullable`, …) and return `{ ok: false }` for anything malformed.
3. Prefer an **optional field** over a new message type when extending one (as `ptr.h` and `teams` on the start config and state did). Older apps keep working, so `PROTOCOL_VERSION` stays as it is. Bump it only for a breaking change (it is 2 since the start command carries a lesson instead of a skill). Decode an absent optional field as absent (not as its default), so old messages still round-trip exactly.
4. Add samples to the round-trip lists in `contracts/src/protocol.test.ts`, plus at least one rejected input.
5. Handle it on both ends: `tv/packages/tv-shared/src/composition/createTvServices.ts` (`link.onMessage`) and `teacher/src/composition/container.ts` (`link.onMessage`). On the phone, also add a case to the switch in `teacher/src/features/link/application/linkService.ts` (it isn't checked for exhaustiveness).
6. Run `npm run test:e2e` if the message is part of the link or calibration flow.

Keep `ptr` messages tiny: they stream at camera rate for every tracked hand. `encodeMessage` rounds their coordinates to 3 decimals.

## Lesson format (`contracts/src/lesson.ts`)

- A lesson file is JSON with `format: 1`. `decodeLesson` checks shape *and* rules (unique card ids, answer index in range, no two identical options, 2–4 options, ≤ 40 cards) and never throws. Lesson files from disk, from the AI and from the wire all go through it.
- Pictures are Twemoji code points (`IconId`, e.g. `1f438`), never embedded images. The phone sends the SVG for exactly the icons a lesson shows (`iconsOf`) in the start command's `art`; the decoder caps count and size.
- Adding a field: make it optional and keep `format: 1`, so existing files stay valid. Update `lesson.test.ts`.

## Exercise engine (`exercise-engine/`)

- Pure, deterministic functions: same request, band, count and seed → the same cards (`mulberry32`, `mixSeed`). No `Math.random`, no dates.
- `request.ts` is the entry point: `ExerciseRequest` (one case per generator), `EXERCISE_GUIDE` (what the AI is told it can ask for) and `generateCards`. A new generator needs a case in all three, a decoder case in `teacher/src/features/authoring/domain/draft.ts`, and tests in `generators.test.ts` (the property test runs every kind × band × seed through `decodeLesson`).
- Wrong options must be wrong for a reason a child could have (a look-alike letter, a near count, a classic algebra slip), never two equal tiles, and never a second right answer (watch syllables: `MA` vs `MAN`, silent `h`, `rr` vs `r`; `syllables.ts` has the rules and 52 test words).
- `lexicon.ts` words need a Twemoji icon that exists in `@twemoji/svg`; `build:content` fails otherwise. After any engine or lexicon change, run `npm run build:content` and commit the regenerated files (`scripts/content.test.ts` fails when they drift).
- `scripts/starterLessons.ts` maps each teacher request of the starter collection to an `ExerciseRequest`; keep the teacher's words in `request`.

## Calibration pattern (`contracts/src/calibration.ts`)

The TV draws `CORNER_MARKERS`/`MARKER_SIZE`, and the phone's solver assumes exactly those positions. Change them in this file only, and re-run the teacher's `autoCalibration` tests and the e2e test.
