# @mimikai/exercise-engine

Builds the cards of a lesson, offline and deterministically. The teacher app uses it to turn a teacher's request (typed in the AI chat, or hand-written for the starter lessons) into a lesson file. The TV never needs it: it plays the cards it receives.

| Request kind | What children do | Answers come from |
|---|---|---|
| `numbers` | Count a group, choose the number; find the group that has N | Counting |
| `compare` | Count groups, point where there is more or less | Counting |
| `letters` | Find a letter; first letter of a picture; picture for a letter | The word's spelling |
| `syllableSounds` | Hear a syllable, point at the picture that starts with it | `syllabify` |
| `syllables` | First syllable, missing syllable, picture for a syllable | `syllabify` |
| `soundPractice` | Say a hard sound out loud (pe-RRO), then find it | `syllabify` + strong-R rule |
| `completeSentence` | Pick the word that completes a sentence | Curated sentences |
| `english` | Picture → English word, and back | The word list |
| `fractions` | Simplify, equivalents, biggest, add, fraction of a quantity | Exact rational arithmetic |
| `equations` | Solve linear equations built around common traps | Exact arithmetic |
| `arithmetic` | Addition, subtraction, missing addend, times tables | Arithmetic by construction |

Every card has a level (1 easy, 2 medium, 3 hard); a lesson climbs from easy to hard and the TV adapts to how the class is doing. Wrong options are the answers real mistakes produce (counting one too many, `manzana` split as `ma-…`, a minus sign not distributed), so a wrong pick tells the teacher what went wrong.

Pictures are [Twemoji](https://github.com/jdecked/twemoji) code points (graphics CC-BY 4.0); the teacher app bundles the SVGs for the words in `src/lexicon.ts`.

The arithmetic core (`arithmetic.ts`, `diagnose()`) is also published as **[mimikai-exercise-engine](https://github.com/binnicordova/projectplay-exercise-engine)** (MIT).
