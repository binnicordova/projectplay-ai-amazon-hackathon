#!/bin/sh
# Builds every app icon and TV banner from docs/brand/icon-source.png (drawn with Google Gemini).
# Needs ImageMagick 7 (`brew install imagemagick`). Run from anywhere; rebuild the native apps afterwards
# (`scripts/devices.sh tv --clean`, `scripts/devices.sh teacher --clean` or `npm run release:apks`), since prebuild bakes icons in.
set -eu
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
SRC="$ROOT/docs/brand/icon-source.png"
BG="#0B122C"       # the source's own background, so crops and padding never show a seam
ORANGE="#FF9900"
FONT="/System/Library/Fonts/Supplemental/Arial Rounded Bold.ttf"
TEACHER="$ROOT/teacher/assets"
TV="$ROOT/tv/apps/expo-tv/assets"
TMP="$(mktemp -d)"; trap 'rm -rf "$TMP"' EXIT

# Square icon: the source's art fills ~45 % of it, so crop to make it read at launcher size.
magick "$SRC" -gravity center -crop 820x820+0+0 +repage -resize 1024x1024 "$TMP/icon.png"
# Adaptive icon: the whole source as foreground keeps the art inside the 66/108 safe zone.
magick "$SRC" -resize 512x512 "$TMP/fg.png"
magick -size 512x512 "xc:$BG" "$TMP/bg.png"
# Monochrome (Android 13 themed icons): the art's glow merges into a blob as a silhouette, so use its star alone.
star=$(awk 'BEGIN { pi = atan2(0, -1); for (i = 0; i < 10; i++) { r = (i % 2) ? 52 : 120; a = -pi / 2 + i * pi / 5;
  printf "%.1f,%.1f ", 216 + r * cos(a), 226 + r * sin(a) } }')
magick -size 432x432 xc:none -fill white -stroke white -strokewidth 18 -draw "stroke-linejoin round polygon $star" "$TMP/mono.png"

for dir in "$TEACHER" "$TV"; do
  mkdir -p "$dir"
  cp "$TMP/icon.png" "$dir/icon.png"
  cp "$TMP/fg.png" "$dir/android-icon-foreground.png"
  cp "$TMP/bg.png" "$dir/android-icon-background.png"
  cp "$TMP/mono.png" "$dir/android-icon-monochrome.png"
done
magick "$TMP/icon.png" -resize 1024x1024 "$TEACHER/splash-icon.png"
magick "$TMP/icon.png" -resize 48x48 "$TEACHER/favicon.png"

# TV banners: the art's circle on the left, "ProjectPlay" on the right ("Play" in the orange of the art).
magick "$SRC" -gravity center -crop 720x720+0+0 +repage "$TMP/art.png"
banner() { # width height out
  w=$1; h=$2; out=$3
  art=$((h * 85 / 100)); [ "$art" -gt $((w * 40 / 100)) ] && art=$((w * 40 / 100))
  pt=$((h * 24 / 100))
  magick -background none -font "$FONT" -pointsize "$pt" -fill white label:Project \
    \( -background none -font "$FONT" -pointsize "$pt" -fill "$ORANGE" label:Play \) +append "$TMP/word.png"
  gap=$((h * 6 / 100))
  magick "$TMP/word.png" -resize "$((w * 90 / 100 - art - gap))x>" "$TMP/word.png"   # shrink only, to fit narrow banners
  ww=$(magick identify -format %w "$TMP/word.png"); total=$((art + gap + ww)); x=$(((w - total) / 2))
  magick -size "${w}x${h}" "xc:$BG" \
    \( "$TMP/art.png" -resize "${art}x${art}" \) -gravity west -geometry "+${x}+0" -composite \
    "$TMP/word.png" -gravity west -geometry "+$((x + art + gap))+0" -composite -depth 8 "$out"
}
mkdir -p "$TV/tv_icons"
banner 400 240 "$TV/tv_icons/icon-400x240.png"
banner 800 480 "$TV/tv_icons/icon-800x480.png"
banner 1280 768 "$TV/tv_icons/icon-1280x768.png"
banner 1920 720 "$TV/tv_icons/icon-1920x720.png"
cp "$TV/tv_icons/icon-1920x720.png" "$ROOT/docs/brand/banner.png"
echo "Icons written to $TEACHER, $TV and docs/brand/"
