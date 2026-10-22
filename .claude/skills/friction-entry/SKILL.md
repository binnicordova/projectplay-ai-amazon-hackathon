---
name: friction-entry
description: Add an entry to docs/friction-log.md (counts for up to a 10% hackathon judging bonus). Use right after hitting a problem with an Amazon, Fire TV, Vega, Expo, React Native or tooling SDK, or when asked to log friction.
---

# Add a friction log entry

Append a new entry to `docs/friction-log.md`, before the `### Template for device-time entries` section. Number it after the last `### F<n>` heading.

```markdown
### F<n> · <short title naming the symptom>
- **Task:** <what we were trying to do, one line>
- **Steps:** <exact commands or clicks>
- **Expected:** <what should have happened>
- **Actual:** <exact error text, file and line; what made it confusing>
- **Severity:** Critical / High / Medium / Low, plus one clause on the impact.
- **Workaround:** <what we did; link the commit or script in this repo>
- **Suggestion:** <a concrete change for the SDK, sample or docs owner>
```

## What makes an entry valuable

- Exact error text and versions (e.g. `react-native-tvos 0.81`, `Vega SDK 0.21`, `Expo SDK 56`). Quote them; don't paraphrase.
- On-device findings (Fire TV, Vega simulator) are worth more than build-setup notes.
- One problem per entry. If the root cause differed from the first error shown, say so: a misleading message is itself friction.
- Keep the user's own words when they reported the problem, then add the technical detail.
- Don't invent problems or overstate severity; judges can check.
