#!/usr/bin/env bash
# ProjectPlay: build and run both apps on real devices over adb (USB or wireless).
#
#   scripts/devices.sh doctor     # check tools, list devices, show which is the TV / the phone
#   scripts/devices.sh tv         # terminal 1: build + install + run the TV app (Metro on :8081)
#   scripts/devices.sh teacher    # terminal 2: build + install + run the teacher app (Metro on :8082)
#   scripts/devices.sh verify     # terminal 3: check both apps run, are linked, and calibrated themselves
#   scripts/devices.sh crash      # print the last crash of either app (Java or native), straight from the device
#   scripts/devices.sh release    # build standalone release APKs of both apps into dist/release/ (no Metro needed)
#
# Add --reinstall to tv/teacher to uninstall the app first (clears stale app data and native libraries).
# Add --clean to also throw away the app's Gradle outputs and rebuild them from scratch. Use it instead of
# `./gradlew clean`, which fails on React Native's C++ codegen and leaves half-cleaned outputs behind
# (e.g. an R.jar missing whole libraries: "NoClassDefFoundError: androidx/startup/R$string" at launch).
# While tv/teacher run, a watcher prints the app's crash log here the moment it crashes on the device.
#
# Override detection with TV_SERIAL=... PHONE_SERIAL=... TEACHER_HOST=<phone ip>.
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cmd="${1:-doctor}"
REINSTALL=0
CLEAN=0
[ $# -gt 0 ] && shift
for arg in ${1+"$@"}; do # (portable form of "$@" for macOS bash 3.2 under set -u)
  case "$arg" in
    --reinstall) REINSTALL=1 ;;
    --clean) CLEAN=1; REINSTALL=1 ;;
    *) printf '\033[1;31m✗ Unknown option %s (use --reinstall or --clean)\033[0m\n' "$arg"; exit 1 ;;
  esac
done

say()  { printf '\033[1;36m▸ %s\033[0m\n' "$*"; }
warn() { printf '\033[1;33m! %s\033[0m\n' "$*"; }
die()  { printf '\033[1;31m✗ %s\033[0m\n' "$*"; exit 1; }

yarn_cmd() { "$ROOT/scripts/yarn.sh" "$@"; }

serials() { adb devices | awk 'NR>1 && $2=="device" {print $1}'; }
is_tv()   { [ "$(adb -s "$1" shell pm has-feature android.software.leanback 2>/dev/null | tr -d '\r')" = "true" ]; }
model()   { adb devices -l | awk -v s="$1" '$1==s { for (i=1;i<=NF;i++) if ($i ~ /^model:/) { sub("model:","",$i); print $i } }'; }
abi()     { adb -s "$1" shell getprop ro.product.cpu.abi | tr -d '\r'; }
running() { [ -n "$(adb -s "$1" shell pidof "$2" 2>/dev/null | tr -d '\r')" ]; }
# Filter first, then keep the tail: the phone's camera driver logs so much that `-t 3000` alone
# drops app lines (such as the last calibration) within minutes.
js_log()  { adb -s "$1" logcat -d -s ReactNativeJS:V 2>/dev/null | tr -d '\r' | tail -n 3000; }
TV_PACKAGE=com.projectplay.tv
TEACHER_PACKAGE=com.projectplay.teacher
LINK_PORT_HEX=2253 # 8787, the phone's WebSocket server
wifi_ip() { adb -s "$1" shell ip -f inet addr show wlan0 2>/dev/null | awk '/inet /{print $2}' | cut -d/ -f1 | head -1; }

# Crash log of one app from the device's crash buffer (Java exceptions and native tombstone summaries).
crash_log() { adb -s "$1" logcat -b crash -d 2>/dev/null | tr -d '\r' | grep -B2 -A60 -E "Process: $2|>>> $2 <<<" | head -80 || true; }
# Recent warnings/errors that explain a start-up failure without a crash (dev launcher, Metro connection, JS).
startup_log() { adb -s "$1" logcat -d -t 4000 '*:W' 2>/dev/null | tr -d '\r' | grep -iE "$2|DevLauncher|ReactNativeJS|ReactHost|SoLoader|AndroidRuntime|Unable to load script|Could not connect" | tail -25 || true; }

# Runs in the background while Expo builds and launches: reports the first crash of the app right here.
watch_crashes() {
  local serial="$1" package="$2"
  adb -s "$serial" logcat -b crash -c 2>/dev/null || true
  (
    for _ in $(seq 1 900); do
      sleep 2
      kill -0 "$$" 2>/dev/null || exit 0
      log="$(crash_log "$serial" "$package")"
      if [ -n "$log" ]; then
        printf '\n\033[1;31m✗ %s crashed on %s. Crash log:\033[0m\n%s\n' "$package" "$(model "$serial")" "$log"
        if echo "$log" | grep -q 'NoClassDefFoundError: .*/R\$'; then
          printf '\033[1;33m  The APK is missing generated resource classes (stale Gradle outputs). Fix:  scripts/devices.sh %s --clean\033[0m\n\n' "$cmd"
        else
          printf '\033[1;33m  Send these lines to Claude, or retry with:  scripts/devices.sh %s --reinstall\033[0m\n\n' "$cmd"
        fi
        exit 0
      fi
    done
  ) &
  WATCHER=$!
  trap 'kill "$WATCHER" 2>/dev/null || true' EXIT
}

# Deletes an app module's Gradle outputs when --clean was given (the native .cxx cache is kept: it is fine
# and rebuilding it costs minutes). The next build regenerates resources, R classes, dex and the APK.
maybe_clean() {
  [ "$CLEAN" = 1 ] || return 0
  say "Deleting Gradle outputs in ${1#"$ROOT"/} (--clean): the next build starts from scratch"
  rm -rf "$1/app/build" "$1/build" "$1/.gradle"
}

# Uninstalls the app when --reinstall was given.
maybe_uninstall() {
  [ "$REINSTALL" = 1 ] || return 0
  say "Uninstalling $2 from $(model "$1") (--reinstall)"
  adb -s "$1" uninstall "$2" >/dev/null 2>&1 || warn "$2 was not installed"
}

# Gradle needs the Android SDK path; fall back to the Homebrew command-line tools install when the shell has none.
ensure_sdk() {
  [ -n "${ANDROID_HOME:-}${ANDROID_SDK_ROOT:-}" ] && return 0
  for dir in "$HOME/Library/Android/sdk" /opt/homebrew/share/android-commandlinetools; do
    if [ -d "$dir/platforms" ]; then export ANDROID_HOME="$dir" ANDROID_SDK_ROOT="$dir"; return 0; fi
  done
  warn "ANDROID_HOME is not set and no Android SDK was found: the Gradle build will fail"
}

# Expo SDK 56 generates a Gradle 9.x wrapper, but its Android Gradle Plugin (8.12) only supports Gradle up to 8.14.
# On Gradle 9 the APK silently lacks the R classes of dozens of libraries (React Android, AppCompat, AndroidX
# Startup...) and crashes on launch with NoClassDefFoundError: androidx/startup/R$string. Pin the same Gradle as the TV app.
pin_gradle() {
  local props="$1/android/gradle/wrapper/gradle-wrapper.properties"
  [ -f "$props" ] || return 0
  grep -q 'gradle-8.14.3-bin.zip' "$props" && return 0
  say "Pinning ${1#"$ROOT"/} to Gradle 8.14.3 (the Android Gradle Plugin does not support Gradle 9)"
  sed -i.bak -E 's#gradle-[0-9.]+-bin\.zip#gradle-8.14.3-bin.zip#' "$props" && rm -f "$props.bak"
}

detect() {
  TV_SERIAL="${TV_SERIAL:-}"; PHONE_SERIAL="${PHONE_SERIAL:-}"
  for s in $(serials); do
    if is_tv "$s"; then [ -n "$TV_SERIAL" ] || TV_SERIAL="$s"; else [ -n "$PHONE_SERIAL" ] || PHONE_SERIAL="$s"; fi
  done
}

ensure_deps() {
  [ -d "$ROOT/shared/node_modules" ]  || (say "Installing shared/";  npm --prefix "$ROOT/shared" install)
  [ -d "$ROOT/teacher/node_modules" ] || (say "Installing teacher/"; npm --prefix "$ROOT/teacher" install)
  [ -d "$ROOT/tv/apps/expo-tv/node_modules" ] || (say "Installing tv/ (Yarn 4)"; cd "$ROOT/tv" && yarn_cmd install)
}

case "$cmd" in
  doctor)
    say "Tools"
    printf '  node    %s\n' "$(node -v 2>/dev/null || echo MISSING)"
    printf '  java    %s\n' "$(java -version 2>&1 | head -1 || echo MISSING)"
    printf '  adb     %s\n' "$(adb version 2>/dev/null | head -1 || echo MISSING)"
    printf '  ANDROID_HOME=%s\n' "${ANDROID_HOME:-${ANDROID_SDK_ROOT:-NOT SET}}"
    detect
    say "Devices"
    for s in $(serials); do
      kind=phone; is_tv "$s" && kind=TV
      printf '  %-5s %-48s model=%-16s abi=%-12s wifi=%s\n' "$kind" "$s" "$(model "$s")" "$(abi "$s")" "$(wifi_ip "$s")"
    done
    [ -n "$TV_SERIAL" ] || warn "No Android TV detected (needs android.software.leanback)."
    [ -n "$PHONE_SERIAL" ] || warn "No phone detected."
    [ -f "$ROOT/teacher/assets/models/movenet-singlepose-lightning-int8.tflite" ] && say "Pose model present" || warn "Pose model missing: run  npm run fetch-model"
    ;;
  tv)
    detect; [ -n "$TV_SERIAL" ] || die "No TV found. Run: scripts/devices.sh doctor"
    ensure_deps
    HOST="${TEACHER_HOST:-}"
    if [ -z "$HOST" ] && [ -n "$PHONE_SERIAL" ]; then HOST="$(wifi_ip "$PHONE_SERIAL")"; fi
    [ -n "$HOST" ] && say "TV will connect straight to the phone at $HOST (same Wi-Fi)" || warn "Phone IP unknown: the TV will search the network by itself"
    (cd "$ROOT/tv" && yarn_cmd install >/dev/null) || die "yarn install failed in tv/"
    cd "$ROOT/tv/apps/expo-tv"
    # A prebuild that crashed half-way leaves an android/ folder Expo will happily reuse.
    # A complete TV prebuild always has the Leanback launcher: regenerate when it is missing.
    if ! grep -q LEANBACK_LAUNCHER android/app/src/main/AndroidManifest.xml 2>/dev/null; then
      say "Generating the TV native project (expo prebuild --clean)"
      EXPO_TV=1 npx expo prebuild --platform android --clean --no-install
    fi
    maybe_clean "$ROOT/tv/apps/expo-tv/android"
    maybe_uninstall "$TV_SERIAL" "$TV_PACKAGE"
    watch_crashes "$TV_SERIAL" "$TV_PACKAGE"
    say "Building for $(model "$TV_SERIAL") [$(abi "$TV_SERIAL")]: the first build takes several minutes"
    EXPO_TV=1 EXPO_PUBLIC_TEACHER_HOST="$HOST" ORG_GRADLE_PROJECT_reactNativeArchitectures="$(abi "$TV_SERIAL")" \
      npx expo run:android --device "$(model "$TV_SERIAL")" --port 8081
    ;;
  teacher)
    detect; [ -n "$PHONE_SERIAL" ] || die "No phone found. Run: scripts/devices.sh doctor"
    ensure_deps
    [ -f "$ROOT/teacher/assets/models/movenet-singlepose-lightning-int8.tflite" ] || (say "Fetching the pose model"; npm --prefix "$ROOT/teacher" run fetch-model)
    ensure_sdk
    pin_gradle "$ROOT/teacher"
    maybe_clean "$ROOT/teacher/android"
    maybe_uninstall "$PHONE_SERIAL" "$TEACHER_PACKAGE"
    watch_crashes "$PHONE_SERIAL" "$TEACHER_PACKAGE"
    say "Building for $(model "$PHONE_SERIAL") [$(abi "$PHONE_SERIAL")]: the first build takes several minutes (C++ camera/ML modules)"
    cd "$ROOT/teacher"
    ORG_GRADLE_PROJECT_reactNativeArchitectures="$(abi "$PHONE_SERIAL")" \
      npx expo run:android --device "$(model "$PHONE_SERIAL")" --port 8082
    ;;
  verify)
    detect
    failures=0
    good() { printf '  \033[1;32m✓\033[0m %s\n' "$*"; }
    bad()  { printf '  \033[1;31m✗\033[0m %s\n' "$*"; failures=$((failures + 1)); }
    info() { printf '    %s\n' "$*"; }

    say "Devices (adb)"
    [ -n "$TV_SERIAL" ] && good "TV     $(model "$TV_SERIAL")  $TV_SERIAL" || bad "No Android TV connected (scripts/devices.sh doctor)"
    [ -n "$PHONE_SERIAL" ] && good "Phone  $(model "$PHONE_SERIAL")  $PHONE_SERIAL" || bad "No phone connected"

    say "Metro (JavaScript servers)"
    curl -fs --max-time 3 http://localhost:8081/status 2>/dev/null | grep -q running && good "TV Metro on :8081" || bad "TV Metro is not running: run  scripts/devices.sh tv"
    curl -fs --max-time 3 http://localhost:8082/status 2>/dev/null | grep -q running && good "Teacher Metro on :8082" || bad "Teacher Metro is not running: run  scripts/devices.sh teacher"

    say "Apps"
    if [ -n "$TV_SERIAL" ]; then
      running "$TV_SERIAL" "$TV_PACKAGE" && good "TV app is running" || bad "TV app is not running on the TV"
    fi
    if [ -n "$PHONE_SERIAL" ]; then
      running "$PHONE_SERIAL" "$TEACHER_PACKAGE" && good "Teacher app is running" || bad "Teacher app is not running on the phone"
    fi

    say "Phone ⇄ TV link"
    if [ -n "$PHONE_SERIAL" ]; then
      # /proc/net/tcp: column 2 = local address:port (hex), column 4 = state (0A listen, 01 established).
      states="$(adb -s "$PHONE_SERIAL" shell cat /proc/net/tcp /proc/net/tcp6 2>/dev/null | tr -d '\r' | awk -v p=":$LINK_PORT_HEX" 'substr($2, length($2) - 4) == p {print $4}' || true)"
      phone_log="$(js_log "$PHONE_SERIAL")"
      if echo "$states" | grep -q '^01$'; then good "TV connected to the phone (port 8787)"
      elif echo "$phone_log" | grep '\[link\]' | tail -1 | grep -q 'TV connected'; then good "TV connected to the phone (from the app log)"
      elif echo "$states" | grep -q '^0A$'; then bad "The phone is listening on 8787 but no TV is connected: open the TV app on the same Wi-Fi"
      else bad "No phone ⇄ TV link found: open both apps on the same Wi-Fi"
      fi

      say "Automatic calibration"
      calib="$(echo "$phone_log" | grep '\[calib\]' | sed 's/.*\[calib\]/[calib]/' | tail -4 || true)"
      if [ -z "$calib" ]; then
        bad "No calibration yet: on the phone open \"Start class\" (or \"Check camera view\") with the camera facing the projection"
      else
        echo "$calib" | while read -r line; do info "$line"; done
        echo "$calib" | tail -1 | grep -q 'done' && good "Projection found automatically" || bad "Last calibration did not finish (see the reason above)"
      fi
      [ -n "$TV_SERIAL" ] && js_log "$TV_SERIAL" | grep '\[calib\]' | sed 's/.*\[calib\]/  TV [calib]/' | tail -4 || true
    fi

    say "JavaScript errors in the last log lines"
    for s in $TV_SERIAL $PHONE_SERIAL; do
      errors="$(adb -s "$s" logcat -d -t 3000 ReactNativeJS:E AndroidRuntime:E '*:S' 2>/dev/null | tr -d '\r' | grep -E ' E (ReactNativeJS|AndroidRuntime)' | tail -5 || true)"
      if [ -z "$errors" ]; then good "$(model "$s"): none"; else bad "$(model "$s"):"; echo "$errors" | while read -r line; do info "$line"; done; fi
    done

    echo
    [ "$failures" -eq 0 ] && say "All checks passed" || die "$failures check(s) failed"
    ;;
  crash)
    detect
    for pair in "$PHONE_SERIAL:$TEACHER_PACKAGE" "$TV_SERIAL:$TV_PACKAGE"; do
      serial="${pair%%:*}"; package="${pair#*:}"
      [ -n "$serial" ] || continue
      say "$package on $(model "$serial")"
      if running "$serial" "$package"; then printf '  running (pid %s)\n' "$(adb -s "$serial" shell pidof "$package" | tr -d '\r')"; else printf '  not running\n'; fi
      log="$(crash_log "$serial" "$package")"
      if [ -n "$log" ]; then echo "$log"; else printf '  no crash in the device crash log; recent start-up warnings:\n'; startup_log "$serial" "$package"; fi
    done
    ;;
  release)
    # Standalone APKs with the JavaScript bundled in, for judges and testers: `adb install` and open, no Metro.
    # Expo signs release builds with the project's debug key, so they install over the dev builds too.
    ensure_deps
    ensure_sdk
    OUT="$ROOT/dist/release"
    mkdir -p "$OUT"

    (cd "$ROOT/tv" && yarn_cmd install >/dev/null) || die "yarn install failed in tv/"
    cd "$ROOT/tv/apps/expo-tv"
    # Always prebuild for a release: icons, banner, version and permissions come from app.json, and a stale android/
    # would ship the old ones. --clean only when it isn't a TV project yet (a phone prebuild left it behind).
    if grep -q LEANBACK_LAUNCHER android/app/src/main/AndroidManifest.xml 2>/dev/null; then clean=""; else clean="--clean"; fi
    say "Generating the TV native project (expo prebuild $clean)"
    EXPO_TV=1 npx expo prebuild --platform android $clean --no-install || die "TV prebuild failed"
    pin_gradle "$ROOT/tv/apps/expo-tv"
    # Many Fire TV sticks run a 32-bit userland: ship both ARM ABIs. No teacher address is baked in:
    # the TV finds the phone on the hotspot by itself.
    say "Building the TV release APK (armeabi-v7a + arm64-v8a)"
    (cd android && EXPO_TV=1 EXPO_PUBLIC_TEACHER_HOST="" ./gradlew assembleRelease -PreactNativeArchitectures=armeabi-v7a,arm64-v8a) \
      || die "TV release build failed"
    cp android/app/build/outputs/apk/release/app-release.apk "$OUT/projectplay-tv.apk"

    [ -f "$ROOT/teacher/assets/models/movenet-singlepose-lightning-int8.tflite" ] || (say "Fetching the pose model"; npm --prefix "$ROOT/teacher" run fetch-model)
    cd "$ROOT/teacher"
    say "Generating the teacher native project (expo prebuild)"
    npx expo prebuild --platform android --no-install || die "Teacher prebuild failed"
    [ -f .env ] || say "No teacher/.env: Crear con IA will be off in this APK (see teacher/.env.example)"
    pin_gradle "$ROOT/teacher"
    say "Building the teacher release APK (arm64-v8a)"
    (cd android && ./gradlew assembleRelease) || die "Teacher release build failed"
    cp android/app/build/outputs/apk/release/app-release.apk "$OUT/projectplay-teacher.apk"

    say "Release APKs"
    ls -lh "$OUT"/*.apk
    cat <<EOF2
  Before publishing, install both and play one round (release builds shrink code, so test them):
    adb -s <tv serial>    install -r "$OUT/projectplay-tv.apk"
    adb -s <phone serial> install -r "$OUT/projectplay-teacher.apk"
  Then attach them to a GitHub release:
    gh release create v1.0.0 "$OUT"/*.apk --title "ProjectPlay v1.0.0" --notes "Hackathon build: install the TV APK on a Fire TV and the teacher APK on an Android phone."
EOF2
    ;;
  *) die "Usage: scripts/devices.sh doctor|tv|teacher|verify|crash|release  (tv/teacher accept --reinstall, --clean)" ;;
esac
