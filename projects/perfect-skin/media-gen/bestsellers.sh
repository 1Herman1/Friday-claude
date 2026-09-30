#!/usr/bin/env bash
# Сцена «рука + 4 товара» для блока бестселлеров. Запуск — workflow
# perfect-skin-bestsellers-media.yml. STAGE=images: ключевые кадры K0–K4
# для 16:9 и 9:16. STAGE=videos: ролики K(i-1)→K(i) по готовым кадрам.
set -euo pipefail

ROOT="$GITHUB_WORKSPACE"
NUL="node $ROOT/tools/nullume/bin/nullume.js"
PUB="$ROOT/projects/perfect-skin/client/public/products-optimized"
REF="$ROOT/docs/projects/perfect-skin/media/bestsellers"
OUT="$ROOT/docs/projects/perfect-skin/media/bestsellers-v2"
mkdir -p "$OUT"

P1="$PUB/scrub-lotion-krem-dlya-snyatiya-makiyazha/card@2x.webp"
P2="$PUB/kerathor-plus-izotonicheskij-tonik/card@2x.webp"
P3="$PUB/hidrorrenovadora-krem-dlya-stimulirovaniya-tkanej/card@2x.webp"
P4="$PUB/serum-triple-accion-syvorotka-trojnogo-dejstviya/card@2x.webp"
NAMES=("ISSEIMI Scrublotion tall white bottle with blue band" "ISSEIMI Kerathor 50 Plus tall white bottle with violet band" "ISSEIMI MD Hidrorrenovadora frosted glass jar with silver lid" "GLACEE Triple Accion pink serum dropper bottle")

STYLE="Premium editorial still life for a pharmacy-grade Spanish skincare shop. Warm cream background #F4F2EC, warm light stone tabletop, soft diffused daylight from the left, gentle long soft shadows, subtle warm gold highlights on metal caps. Calm, precise, expensive, no props, no text overlays, no boxes or packaging cartons, products only. Photorealistic, sharp labels exactly as in the reference photos."

gen_image() { # out_name aspect prompt images...
  local name="$1" ar="$2" prompt="$3"; shift 3
  local args=(); for i in "$@"; do args+=(--image "$i"); done
  local tmp; tmp=$(mktemp -d)
  $NUL generate create nano-banana-2 --prompt "$prompt" "${args[@]}" \
    --set aspect_ratio="$ar" --set resolution=2K --set output_format=png \
    --wait --yes --out "$tmp"
  cp "$(ls "$tmp"/* | head -1)" "$OUT/$name.png"
}

gen_video() { # out_name aspect prompt first last
  local name="$1" ar="$2" prompt="$3" first="$4" last="$5"
  local tmp; tmp=$(mktemp -d)
  $NUL generate create bytedance/seedance-1.5-pro --prompt "$prompt" \
    --image "$first" --image "$last" \
    --set aspect_ratio="$ar" --set resolution=1080p --set duration=4 --set fixed_lens=true \
    --wait --wait-timeout 900 --yes --out "$tmp"
  cp "$(ls "$tmp"/* | head -1)" "$OUT/$name.mp4"
}

for fmt in desktop mobile; do
  if [ "$fmt" = desktop ]; then AR="16:9"; LAYOUT="The four products stand in one row on the right two thirds of the frame, left third is empty calm background."; else AR="9:16"; LAYOUT="The four products stand in one row in the lower half of the vertical frame, centered, upper half is empty calm background."; fi

  if [ "$STAGE" = images ]; then
    gen_image "$fmt-k0" "$AR" "$STYLE $LAYOUT From left to right: ${NAMES[0]}, ${NAMES[1]}, ${NAMES[2]}, ${NAMES[3]}. Use the first four reference images for the exact product look. Use the last reference image only for composition and camera angle. No hands." \
      "$P1" "$P2" "$P3" "$P4" "$REF/1.png"
  fi

  if [ "$STAGE" = images ] || [ "$STAGE" = hands ]; then
    PRODUCTS=("$P1" "$P2" "$P3" "$P4")
    for i in 1 2 3 4; do
      gen_image "$fmt-k$i" "$AR" "Edit the first image only. Keep EVERYTHING in it pixel-identical: the same exactly four products (${NAMES[0]}; ${NAMES[1]}; ${NAMES[2]}; ${NAMES[3]}), their order, positions, sizes, labels, background, table, light, shadows, camera and framing. Do not add, remove, duplicate, replace or restyle any product. Do not add any other bottles, brands or objects. The ONLY change: add one elegant slender female hand with a natural nude manicure, no jewelry, coming in from the top right edge of the frame, fingertips gently touching the top of product number $i counting from the left, which is ${NAMES[$((i-1))]} (the second image shows this exact product). The other three products are not touched." \
        "$OUT/$fmt-k0.png" "${PRODUCTS[$((i-1))]}"
    done
  fi

  if [ "$STAGE" = videos ]; then
    for i in 1 2 3 4; do
      gen_video "$fmt-$((i-1))-$i" "$AR" "Static locked camera. A slender female hand with nude manicure moves smoothly and slowly from its start position to gently touch product number $i from the left, as in the last frame. Products stay still and unchanged, calm premium product commercial, soft warm light, no text." \
        "$OUT/$fmt-k$((i-1)).png" "$OUT/$fmt-k$i.png"
    done
  fi
done
ls -la "$OUT"
