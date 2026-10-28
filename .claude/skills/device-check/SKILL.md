---
name: device-check
description: Run, verify and debug Mimikai on the real phone and Fire TV over adb. Use when asked to test on devices, check that the TV and teacher apps are running and linked, read device logs, or fix an app that crashes, won't install, won't connect or won't calibrate.
---

# Run and check both apps on real devices

The phone and the TV are usually connected over **wireless adb**: serials look like `adb-XXXX._adb-tls-connect._tcp`. `scripts/devices.sh` works out which one is the TV (Leanback feature) and which is the phone.

## 1. See what is connected

```bash
scripts/devices.sh doctor
```

If a device is missing, ask the user to re-enable wireless debugging on it. Don't try to pair devices yourself.

## 2. Start the apps (long-running: start each in the background)

```bash
scripts/devices.sh tv          # Metro on :8081, installs + launches the TV app
scripts/devices.sh teacher     # Metro on :8082, installs + launches the phone app
```

- Run each as a background command and read its output, because both keep Metro running.
- "Waiting on http://localhost:808x" means a Metro for that app is already running. Reuse it: JS changes hot-reload.
- A crash watcher prints the device crash log in that output the moment the app crashes.

## 3. Verify

```bash
scripts/devices.sh verify
```

All sections should be ✓: devices, Metro, apps running, phone ⇄ TV link, automatic calibration, no JS errors.

Calibration only runs while the phone shows a camera screen ("Start class" or "Check camera view") with the TV connected. If it's missing, ask the user to open one of those screens.

## 4. Diagnose

| Symptom | Look at | Usual fix |
|---|---|---|
| App closes at launch | `scripts/devices.sh crash` | `NoClassDefFoundError …/R$…` → `scripts/devices.sh <app> --clean` |
| "No development build … installed" after pressing `a` | which device Expo picked | Harmless: `a` targets the first adb device. Use `shift+a` |
| Calibration stops | phone panel line "TV: … · Camera: N pictures" and `[calib]` logs | No pictures → camera/worklet path. TV never confirms → link or TV pattern layer |
| TV never pairs | `[link]` logs on the phone, TV pairing screen | Same Wi-Fi/hotspot; `EXPO_PUBLIC_TEACHER_HOST` is set by `devices.sh tv` |
| Build fails oddly | free disk space | Free space, then `--clean` |

Device logs, filtered to the app's JS:

```bash
adb -s <serial> logcat -d -t 3000 -s ReactNativeJS:V | grep -E "\[calib\]|\[link\]|Error"
```

## Rules

- Never run `./gradlew clean` (see AGENTS.md); use `--clean`.
- Don't uninstall apps or clear app data unless the user agrees, or the fix needs it (`--reinstall` and `--clean` do it explicitly).
- Report what you saw on the devices (verify output, crash lines), not what you expected.
