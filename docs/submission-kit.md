# Submission kit

Deadline: **Fri Oct 23, 2026, 12:00 PDT** (14:00 Lima). Aim to submit by 11:00 Lima to keep a buffer.

## Checklist

Status as of Thu Oct 22. ✅ done · ⬜ still to do.

- ✅ **Mini challenge material:** [projectplay-exercise-engine](https://github.com/binnicordova/projectplay-exercise-engine) (MIT, CI) plus upstream PRs [#141](https://github.com/AmazonAppDev/react-native-multi-tv-app-sample/pull/141) and [#142](https://github.com/AmazonAppDev/react-native-multi-tv-app-sample/pull/142).
- ⬜ **On Devpost, select:** track **Fire TV**, mini challenge **Open Source**. Only add AWS Builder if you actually used an AWS service or Kiro Crew.
- ✅ **Repository:** [binnicordova/projectplay-ai-amazon-hackathon](https://github.com/binnicordova/projectplay-ai-amazon-hackathon) is public, GitHub detects MIT in the About section, and CI is green.
- ✅ README has setup and run instructions, a "Try it in 2 minutes" section, and the MoveNet model committed.
- ⬜ **Release APKs:** run `npm run release:apks`, install both, play one round, then `gh release create v1.0.0 dist/release/*.apk` (the README's "Try it" links to it).
- ⬜ **Demo video under 3 minutes**, public on YouTube or Vimeo, in English, with no copyrighted music. It must show the app **running on a real Fire TV device or the Fire TV/Vega simulator**. Script: [`video-script.md`](video-script.md).
- ⬜ **Devpost text and product feedback:** drafted in [`devpost.md`](devpost.md). Fill in every **[bracket]** (video link, Fire TV device notes, onboarding times), then paste.
- ⬜ **Friction log** ([`friction-log.md`](friction-log.md)): 15 entries; add what you hit on the real Fire TV.
- ✅ Optional **feature requests** with priority: the table at the end of `devpost.md`.

## Video shot list (≈ 2:45)

The full script, with voiceover and a recording checklist, is in [`video-script.md`](video-script.md).

| Time | Shot |
|---|---|
| 0:00–0:20 | Wide shot: Fire TV stick in the projector, two children reach for tiles on the wall, the tile fills and turns green. No talking needed. |
| 0:20–0:40 | The problem: interactive boards cost thousands; most public classrooms have a projector and a teacher with a phone. |
| 0:40–1:05 | Setup in about 10 seconds: hotspot on, TV finds the phone, the TV flashes four squares and the phone calibrates itself. **Show mobile data switched off.** |
| 1:05–1:40 | Point and hold: number tiles, then TRUE / FALSE. One child changes their mind before the countdown ends and the new tile turns their colour. A few seconds of **One player**: a single child walks along the wall to the answer. |
| 1:40–2:05 | How it works: phone screen with the skeleton overlay next to the wall. Camera frames never leave the phone; only ~60-byte events do. |
| 2:05–2:25 | Architecture slide (diagram from the README) and the same screens on Fire OS and Vega OS. |
| 2:25–2:45 | Impact: classrooms with no internet, a few dollars' worth of hardware, privacy for children. Same app at home for active family learning. |

## Product feedback outline (one block per tool)

The drafted feedback, ready to paste, is in [`devpost.md`](devpost.md#product-feedback-required-one-block-per-tool).

For each tool: what you used it for · what worked well · what needs work · onboarding (zero to hello world) · would you build with it again, and why.

1. **Fire TV / Fire OS + react-native-tvos + Expo** (`EXPO_TV=1`, config-tv plugin, ADB to device)
2. **AmazonAppDev react-native-multi-tv-app-sample** (monorepo layout, shared UI, remote-control managers, spatial navigation). See friction F1–F3.
3. **Vega OS SDK** (separate RN 0.72 toolchain, `.kepler.ts` platform files, simulator). See F4–F5.
4. **Amazon Devices Builder Tools (MCP / Agent Skills)**, if you used them.
5. Third-party libraries (not Amazon, but useful context): VisionCamera v5, react-native-fast-tflite, react-native-tcp-socket, Expo Router, Jotai.

## Description skeleton (Devpost)

The full Devpost text is in [`devpost.md`](devpost.md). This short version is kept for the YouTube description.

**What it does.** ProjectPlay turns any classroom projector into a touch wall. A Fire TV runs the game; the teacher's phone watches the children with on-device pose detection. Children answer by pointing: they reach for a tile on the wall and hold still, and they may change their minds until the countdown ends.

**How we built it.** On the phone, the main camera (VisionCamera v5) feeds a GPU resizer and MoveNet (TFLite, INT8) in two camera lanes, one per team (or one lane over the whole wall when a single child plays); lanes take turns on the model, so a hand reaches the TV one inference after the picture. Automatic calibration finds the projection, a homography maps hands onto it and a One Euro filter smooths them. The phone hosts the hotspot and a WebSocket server. The Fire TV app (Expo Router on Fire OS, the Vega SDK on Vega OS, both from Amazon's multi-TV sample) hit-tests hands with dwell selection and runs an offline, adaptive exercise engine.

**Why it matters.** It needs no internet, no server and no new hardware, and no images ever leave the phone. It fits Fire TV priority categories: computer vision, multi-modal UX and family entertainment.

**What's next.** More skills, a third lane for small groups, saved class reports, and Fire TV Appstore distribution.
