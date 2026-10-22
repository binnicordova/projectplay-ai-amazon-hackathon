# Demo video script (target 2:45, hard limit 3:00)

**The story in one line:** a wall that couldn't answer back, and now it can, with things the school already has.

**Format rules (from the hackathon rules):**
- Under 3 minutes, in English, public on YouTube or Vimeo, with no copyrighted music.
- It **must show the app running on a real Fire TV device or on the Fire TV / Vega simulator.**

**Pace:** the voiceover is about 380 words, roughly 140 words per minute with pauses. Read it once with a timer before recording. If it runs long, cut the lines marked *(optional)* first.

---

## 0:00–0:15 · Hook

| Picture | Voiceover |
|---|---|
| Wide shot from behind the children: the projected game on the wall. A child stretches up to a number tile and holds it there. The tile fills and turns green. Natural classroom sound, no music for the first 3 seconds. | *(3 s silence)* That wall isn't a touchscreen. It's an ordinary projector, a Fire TV stick… and the teacher's phone. |

**Caption on screen:** ProjectPlay

## 0:15–0:40 · The problem

| Picture | Voiceover |
|---|---|
| Static shots: a projector on a classroom ceiling showing a slide; rows of empty chairs or desks. Then on-screen text: "~40% of primary schools worldwide are connected to the internet (UNESCO, 2023)". | In many public classrooms, the projector is the most advanced thing in the room. It shows slides, and thirty six-year-olds sit still and watch. Interactive whiteboards cost thousands of dollars. And only about four in ten primary schools in the world are even online. |
| A child pointing at something, any natural movement. | But young children learn by moving: pointing, running to the board, arguing about the answer. So we asked: what's the cheapest way to make the wall itself answer back? |

## 0:40–1:05 · Setup (the Fire TV moment)

| Picture | Voiceover |
|---|---|
| **Must show the Fire TV:** close-up of the Fire TV stick in the projector's HDMI port, then the Fire TV home screen with the ProjectPlay tile. Press OK on the remote. | Meet ProjectPlay. The Fire TV runs the game. |
| The phone on a tripod behind the children, the teacher app open. Quick cut to the phone's quick settings showing **mobile data off** and the hotspot on. | The teacher's phone stands on a tripod at the back. It turns on its hotspot, and the TV finds it on its own: no cables, no typing, no internet. |
| The TV flashes four white squares. Split screen: the phone's preview finds them and draws the green outline of the projection. | Then the TV flashes four white squares, and in a few seconds the phone knows exactly where the picture is on the wall. |

## 1:05–1:45 · Play

| Picture | Voiceover |
|---|---|
| A question appears with four tiles per side. Two children, one per half of the wall, point and hold. Fill rings grow. | Now the children play. A question appears, with four answers for each team. A child points at an answer and holds still. The tile fills up and turns their team's colour. |
| One child moves their arm to a different tile before the countdown ends. The colour moves with them. | Changed your mind? Point somewhere else before the time runs out. |
| The result screen. Then a few seconds of one-player mode: one child walks along the wall to the answer. | Team A plays on the left, team B on the right. And with one child, the whole wall is theirs. |
| A TRUE / FALSE round. *(optional)* | *(optional)* The wrong answers aren't random. They come from real mistakes children make, like counting one too many or adding instead of subtracting. And the difficulty adapts to the class. |

## 1:45–2:10 · How it works

| Picture | Voiceover |
|---|---|
| Screen recording of the teacher app: camera preview with the skeleton and hand dot, next to the wall, the cursor moving in sync. | Here's what the phone sees. A pose model runs on the phone itself and turns a raised hand into a cursor on the wall. |
| Simple animated diagram: phone → "60-byte events" → TV. A crossed-out cloud icon. | Camera images never leave the phone. Only tiny messages, about sixty bytes each, travel to the TV. There's no server, no account and nothing to pay for. |

## 2:10–2:25 · Fire TV and Vega

| Picture | Voiceover |
|---|---|
| The same game on the Vega Virtual Device window (only if you ran it; otherwise show the code side by side). Then the remote-control cursor on the Fire TV. | The TV app is built on Amazon's multi-TV sample, so one codebase targets both Fire OS and Vega OS. And with no phone at all, the Fire TV remote becomes the cursor. |

> If you didn't run the Vega Virtual Device, say "one codebase **builds for** Fire OS and Vega OS" instead. Don't show or claim a run that didn't happen.

## 2:25–2:45 · Close

| Picture | Voiceover |
|---|---|
| Back to the hook shot: a group of children cheering at a green tile. Fade to the logo with the URL `github.com/binnicordova/projectplay-ai-amazon-hackathon` and "Open source · Offline · Private". | A projector, a Fire TV stick, and a phone the teacher already has. That's all it takes to turn any classroom wall into something children can touch. ProjectPlay: open source, offline, and ready for the next class. |

---

## Recording checklist

**Before you film**
- [ ] **Fire TV device** in shot at least once (the stick and the Fire TV home screen). A Google TV / onn box does **not** count. If you have no Fire TV, record the **Vega Virtual Device** instead and say so in the video.
- [ ] Written consent from parents for any child on camera. Film from **behind**, with no faces or names, and no school name or uniform crest. Adults or family members work just as well.
- [ ] Phone fully charged; mobile data **off** (it's part of the story); Do Not Disturb on.
- [ ] Projector focused; room lights at classroom level, not dark.

**Capture**
- [ ] Wall: a second phone or camera on a tripod behind the children, 1080p, landscape.
- [ ] Teacher phone screen: Android's built-in screen recorder, or `adb shell screenrecord /sdcard/teacher.mp4` (stops itself at 3 min).
- [ ] Fire TV screen, if you need a clean capture: `adb -s <tv> shell screenrecord /sdcard/tv.mp4`, then `adb pull`.
- [ ] Voiceover: record it separately in a quiet room, phone 20 cm from your mouth. Read from this file.

**Edit**
- [ ] Music: none, or a track from the YouTube Audio Library (no copyrighted music).
- [ ] Burn the UNESCO caption into the video, and upload **English subtitles** (paste the voiceover text).
- [ ] Final length under **2:55**.

**Publish**
- **Visibility:** Public (not Unlisted). Copy the link into Devpost.
- **Title:** `ProjectPlay: turn any classroom projector into a touch wall (Fire TV + phone, offline)`
- **Description:**

  ```
  ProjectPlay turns a classroom projector into a touch wall. A Fire TV runs the game; the teacher's phone watches the children with on-device pose detection, and kids answer by pointing at the wall. No internet, no server, no images leave the phone.

  Built for the Build, Ship, Shape: Amazon Developer Hackathon (Fire TV track).
  Code (MIT): https://github.com/binnicordova/projectplay-ai-amazon-hackathon
  Exercise engine (MIT): https://github.com/binnicordova/projectplay-exercise-engine

  Stat: UNESCO Global Education Monitoring Report 2023.
  ```
