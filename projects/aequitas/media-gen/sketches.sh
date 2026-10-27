#!/usr/bin/env bash
# ИИ-эскизы героев и знаков Aequitas для презентации вариативности.
# Запуск — workflow aequitas-sketches.yml. ITEMS — имена через пробел (пусто — все),
# VARIANTS — вариантов на эскиз, ROUND — номер круга правок (папка вывода).
set -euo pipefail

ROOT="$GITHUB_WORKSPACE"
NUL="node $ROOT/tools/nullume/bin/nullume.js"
OUT="$ROOT/docs/projects/aequitas/media/sketches/r${ROUND:-1}"
mkdir -p "$OUT"

DARK="Deep graphite background #141518, single warm desk-lamp light from upper left, brass #C9A66B and ivory #ECE6DA only. Calm, precise, expensive, quiet evening study mood. Absolutely no text, no letters, no numbers, no watermark, no signature, no frame, no people faces."
MARK="Minimal premium logo symbol, centered on a plain flat graphite #141518 background, drawn with thin uniform brass #C9A66B lines like a fine engraving or jeweller's line, perfect symmetry where appropriate, generous empty space around it, flat vector look, no gradients, no shadows, no mockup, no paper texture, no extra elements. No words, no letters other than the one described, no watermark."

declare -A P=(
  [hero-scales]="Photorealistic still life: antique-style precision brass balance scale, a thin straight beam on a slim black column with a small counterweight and two shallow pans, perfectly level, standing on a dark wooden desk. Rim light on the brass edges, fine engraved graduation marks on a small arc dial above the beam. Not Lady Justice, no blindfold, no sword, no gavel. $DARK"
  [hero-poverenny]="Elegant editorial line illustration in the style of a New Yorker cover: a gentleman in a three-piece suit standing upright beside a tall arched window, drawn with a single thin continuous brass line on graphite, no fill. Instead of a head he has a small precision balance scale (beam and two pans) rising from his collar, no face. He holds a document folder. Through the window a minimal line silhouette of Moscow: Stalinist high-rise with a spire, a TV tower, modern towers. Correct human proportions, refined, not cartoonish. $DARK"
  [hero-seal-pen]="Photorealistic close-up: a brass desk seal stamp with a plain round face and a black fountain pen with a gold nib resting on a sheet of heavy ivory paper, a fresh dark ink signature-like flourish line (abstract, not letters) on the paper. Lamp light pooling on the paper. $DARK"
  [hero-hourglass]="Photorealistic still life: a slender brass and clear glass hourglass with fine golden sand running, on a dark desk next to a closed leather folder. Shallow depth of field. $DARK"
  [hero-column]="Photorealistic architectural fragment: a single fluted travertine column capital with a plain smooth entablature above it, lit dramatically from the side, the rest falls into darkness. The entablature surface is smooth and blank. $DARK"
  [hero-masses]="Minimal 3D render: a polished platinum sphere and a brushed steel rectangular block balanced on a long thin lever over an off-centre triangular brass pivot, perfectly level, on a deep ink-blue #0D1524 background with soft studio light. Calm, engineering precision, private banking mood. No text, no letters, no numbers, no watermark."
  [logo-e-medallion]="A round medallion: two thin concentric circles with a single elegant serif Cyrillic capital letter Э (the Russian letter E-reversed, like a backwards C with a middle bar pointing left) in the centre, classical Roman proportions. $MARK"
  [logo-ae]="A single elegant classical serif ligature Æ (A and E joined), high-contrast strokes like Garamond, with a thin brass rule underneath. $MARK"
  [logo-scales]="A geometric precision balance scale: vertical post on a small stepped base, a thin straight horizontal beam with a tiny pivot circle, two shallow triangular-suspended pans, perfectly level. $MARK"
  [logo-section]="The section sign § in a classical serif, inside a solid brass square plaque, the sign cut out in graphite. $MARK"
  [logo-poverenny-head]="A circle containing a minimal balance scale used as a head: a short neck rising from a suggested jacket collar and tie at the bottom of the circle, the scale beam and two pans form the head, no face. $MARK"
  [logo-masses]="Geometric mark: a solid circle and a solid tall rectangle standing on a thin horizontal line, balanced over a small brass triangle pivot placed off-centre. Ivory shapes, brass pivot. $MARK"
  [logo-seal]="A round seal impression: two concentric thin rings with a ring of tiny evenly spaced dots between them instead of lettering, and a small elegant balance-scale symbol in the centre. $MARK"
)

ORDER=(hero-scales hero-poverenny hero-seal-pen hero-hourglass hero-column hero-masses logo-e-medallion logo-ae logo-scales logo-section logo-poverenny-head logo-masses logo-seal)
[ -n "${ITEMS:-}" ] && read -r -a ORDER <<< "$ITEMS"

for name in "${ORDER[@]}"; do
  prompt="${P[$name]}"
  [ -n "${EXTRA:-}" ] && prompt="$prompt $EXTRA"
  ar="1:1"; case "$name" in hero-*) ar="4:5";; esac
  for v in $(seq 1 "${VARIANTS:-1}"); do
    tmp=$(mktemp -d)
    if $NUL generate create nano-banana-2 --prompt "$prompt" \
        --set aspect_ratio="$ar" --set resolution=1K --set output_format=png \
        --wait --yes --out "$tmp"; then
      cp "$(ls "$tmp"/* | head -1)" "$OUT/$name-v$v.png"
    else
      echo "::warning::$name v$v failed"
    fi
  done
done
ls -la "$OUT"
