#!/bin/sh
# Builds every app icon and TV banner from the Mimikai SVG masters in docs/brand/icons/.
# Renders with rsvg-convert (`brew install librsvg`) or, without it, headless Google Chrome; resizes with
# ImageMagick 7 (`brew install imagemagick`). Run from anywhere; rebuild the native apps afterwards
# (`scripts/devices.sh tv --clean`, `scripts/devices.sh teacher --clean` or `npm run release:apks`), since prebuild bakes icons in.
set -eu
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
ICONS="$ROOT/docs/brand/icons"
TEACHER="$ROOT/teacher/assets"
TV="$ROOT/tv/apps/expo-tv/assets"
CHROME="${CHROME:-/Applications/Google Chrome.app/Contents/MacOS/Google Chrome}"
TMP="$(mktemp -d)"; trap 'rm -rf "$TMP"' EXIT

render() { # svg width height out.png
  if command -v rsvg-convert >/dev/null 2>&1; then
    rsvg-convert -w "$2" -h "$3" -o "$4" "$1"
    return
  fi
  [ -x "$CHROME" ] || { echo "Needs rsvg-convert (brew install librsvg) or Google Chrome (set CHROME=/path/to/chrome)" >&2; exit 1; }
  printf '<!doctype html><style>html,body{margin:0;background:transparent}img{display:block;width:%spx;height:%spx}</style><img src="file://%s">' \
    "$2" "$3" "$1" > "$TMP/page.html"
  rm -f "$TMP/shot.png"
  # Some Chrome builds stay alive after --screenshot, so wait for the file instead of the process.
  "$CHROME" --headless=new --disable-gpu --hide-scrollbars --no-first-run --no-default-browser-check \
    --default-background-color=00000000 --window-size="$2,$3" --screenshot="$TMP/shot.png" \
    --user-data-dir="$TMP/profile" "file://$TMP/page.html" >/dev/null 2>&1 &
  pid=$!; i=0
  while [ ! -s "$TMP/shot.png" ] && [ "$i" -lt 160 ]; do sleep 0.25; i=$((i + 1)); done
  sleep 0.5; kill "$pid" 2>/dev/null || true; wait "$pid" 2>/dev/null || true
  [ -s "$TMP/shot.png" ] || { echo "Chrome produced no image for $1" >&2; exit 1; }
  mv "$TMP/shot.png" "$4"
}

render "$ICONS/app-icon.svg" 1024 1024 "$TMP/icon.png"
render "$ICONS/adaptive-foreground.svg" 1024 1024 "$TMP/fg.png"
render "$ICONS/adaptive-background.svg" 1024 1024 "$TMP/bg.png"
# Android 13 themed icon: white silhouette with the face and suckers cut out; the launcher tints it.
render "$ICONS/adaptive-monochrome.svg" 1024 1024 "$TMP/mono.png"
render "$ICONS/splash-icon.svg" 1024 1024 "$TMP/splash.png"
render "$ICONS/favicon.svg" 256 256 "$TMP/favicon.png"
render "$ICONS/tv-banner-5x3.svg" 2000 1200 "$TMP/banner-5x3.png"
render "$ICONS/tv-banner-8x3.svg" 1920 720 "$TMP/banner-8x3.png"

for dir in "$TEACHER" "$TV"; do
  mkdir -p "$dir"
  magick "$TMP/icon.png" -strip "$dir/icon.png"
  magick "$TMP/fg.png" -strip "$dir/android-icon-foreground.png"
  magick "$TMP/bg.png" -strip "$dir/android-icon-background.png"
  magick "$TMP/mono.png" -strip "$dir/android-icon-monochrome.png"
done
magick "$TMP/splash.png" -strip "$TEACHER/splash-icon.png"
magick "$TMP/favicon.png" -resize 48x48 -strip "$TEACHER/favicon.png"

# Fire TV banners: the juggling Mimikai and the wordmark on the Night of the projected wall.
mkdir -p "$TV/tv_icons"
for size in 400x240 800x480 1280x768; do
  magick "$TMP/banner-5x3.png" -resize "$size!" -strip "$TV/tv_icons/icon-$size.png"
done
magick "$TMP/banner-8x3.png" -strip "$TV/tv_icons/icon-1920x720.png"
cp "$TV/tv_icons/icon-1920x720.png" "$ROOT/docs/brand/banner.png"
echo "Icons written to $TEACHER, $TV and docs/brand/"
