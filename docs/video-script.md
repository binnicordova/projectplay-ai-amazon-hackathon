# Demo video script (target 2:45, hard limit 3:00)

**The story in one line:** a classroom in the Andes with a projector and no internet gets a wall that answers back, for about $75, with things the school already has.

**Format rules (from the hackathon rules):**
- Under 3 minutes, in English, public on YouTube or Vimeo, with no copyrighted music.
- It **must show the app running on a real Fire TV device or on the Fire TV / Vega simulator.**

**Pace:** the voiceover is about 337 words, roughly 140 words per minute with pauses. Read it once with a timer before recording. If it runs long, cut the lines marked *(optional)* first.

---

## 0:00–0:20 · A friendly start

| Picture | Voiceover |
|---|---|
| Wide shot from behind the children: the projected lesson on the wall. A child stretches up to a farm-animal tile and holds it there. The tile fills and turns green. Natural classroom sound, no music for the first 3 seconds. | *(3 s classroom sound)* Hi! I'm Binni, from Peru. Picture a classroom high in the Andes: thirty five-year-olds, one old projector, and no internet at all. Now look at that wall. It isn't a touchscreen. It's that same projector, a Fire TV Stick… and the teacher's phone. |

**Caption on screen:** ProjectPlay · a touch wall with no internet

## 0:20–0:45 · What it costs, and who is left out

| Picture | Voiceover |
|---|---|
| The cost chart from the README (`docs/images/cost-comparison.svg`), bars appearing one by one, ProjectPlay's tiny orange bar last. | Interactive whiteboards and panels cost from about sixteen hundred to more than six thousand dollars per classroom. ProjectPlay costs about seventy-five: a Fire TV Stick and a phone tripod. One SMART Board pays for fifty-six classrooms. |
| The impact map (`docs/images/impact-map.svg`): zoom from South America to the shaded Andean regions, then the "6 in 10" number. Cut to the Americas map (`docs/images/americas-global-impact.svg`) and the "≈ 3 million schools" number. | And in Peru, about six in ten public primary schools have no internet. Across Latin America it's the same story, and worldwide about three million schools are offline. So ProjectPlay never needs the internet. |

## 0:45–1:05 · Setup (the Fire TV moment)

| Picture | Voiceover |
|---|---|
| **Must show the Fire TV:** close-up of the Fire TV Stick in the projector's HDMI port, then the Fire TV home screen with the ProjectPlay tile. Press OK on the remote. | The Fire TV Stick is the classroom computer: it plays the lesson. |
| The phone on a tripod behind the children. Quick cut to the phone's quick settings: **mobile data off**, hotspot on. The TV flashes four white squares; the phone draws the green outline of the projection. | The teacher's phone opens its own hotspot, the TV finds it, four white squares flash, and in seconds the phone knows where the picture is on the wall. No cables, no typing, no internet. |

## 1:05–1:40 · Play

| Picture | Voiceover |
|---|---|
| A card from *Sílabas de la granja*: the teacher says "PA", animal tiles on each half. Two children point and hold. Fill rings grow. | Now the children play. The teacher reads the syllable, and each team points at the animal that starts with it. Hold still, and the tile fills with your team's colour. |
| One child moves their arm to another tile before the countdown ends. | Changed your mind? Point somewhere else before time runs out. |
| Feedback: "+175", the 🔥×3 streak, then "¡Subimos al nivel 2!". *(optional)* One child alone, three stars and a new record. | Fast answers and streaks score more, mistakes never cost points, and when the class gets it right, the lesson gets harder. |

## 1:40–2:05 · Lessons for every age, made with AI

| Picture | Voiceover |
|---|---|
| Teacher app: **Biblioteca**, scrolling from letters for five-year-olds to *Ecuaciones con trampa*. Then **Crear con IA**: "créame 6 ejercicios para reforzar la sílaba RO para niñas de 5 años", the draft with right answers in green, **Guardar y jugar**, "pe-RRO" on the wall. | The phone carries lessons from kindergarten to secondary school. With a signal, the teacher just asks for what the class needs: the AI picks the exercise, the phone computes every answer, and the lesson then plays offline, forever. |

## 2:05–2:25 · How it works: Fire TV + VisionCamera

| Picture | Voiceover |
|---|---|
| The teacher app's camera view with the skeleton and hand dot next to the wall, the cursor moving in sync. Then the Vega Virtual Device window or the code side by side. | On the phone, VisionCamera and an on-device pose model turn a raised hand into a cursor; camera images never leave the phone. On the TV, Amazon's multi-TV sample gave us one codebase for Fire OS and Vega OS. |

> If you didn't run the Vega Virtual Device, say "one codebase **builds for** Fire OS and Vega OS" instead. Don't show or claim a run that didn't happen.

## 2:25–2:50 · Close

| Picture | Voiceover |
|---|---|
| Back to the children cheering at a green tile. Then the map again with "108,239 schools" and the logo, `github.com/binnicordova/projectplay-ai-amazon-hackathon`, "Open source · No internet needed · Private". | From the Andes to the three million schools around the world without internet, every classroom with a projector can have a wall that answers back, for about two dollars fifty per child. ProjectPlay: open source, and ready for the next class. |

---

## Recording checklist

**Before you film**
- [ ] **Fire TV device** in shot at least once (the stick and the Fire TV home screen). A Google TV / onn box does **not** count. If you have no Fire TV, record the **Vega Virtual Device** instead and say so in the video.
- [ ] Written consent from parents for any child on camera. Film from **behind**, with no faces or names, and no school name or uniform crest. Adults or family members work just as well.
- [ ] Phone fully charged; Do Not Disturb on. Record the **Crear con IA** clip first with internet on, then turn mobile data **off** for the class (it's part of the story).
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
- **Visibility:** Public (not Unlisted or Private), with **Allow embedding** on (Devpost embeds the player). Link: https://youtu.be/qqOpJ-z_jQY
- **Title:** `ProjectPlay: turn any classroom projector into a touch wall (Fire TV + phone, offline)`
- **Description:**

  ```
  ProjectPlay turns a classroom projector into a touch wall for about $75 (interactive whiteboards cost $1,600–$6,500). A Fire TV Stick plays the lesson; the teacher's phone watches the children with VisionCamera and on-device pose detection, and kids answer by pointing at the wall. Made for schools with no internet, like most public primary schools in the Andes of Peru. Teachers create lessons for ages 4–15 by chatting with AI; classes need no internet, no server, and no images leave the phone.

  Built for the Build, Ship, Shape: Amazon Developer Hackathon (Fire TV track).
  Code (MIT): https://github.com/binnicordova/projectplay-ai-amazon-hackathon
  Exercise engine (MIT): https://github.com/binnicordova/projectplay-exercise-engine

  Stat: UNESCO Global Education Monitoring Report 2023.
  ```
