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
NAMES=("tall white cylindrical bottle with a polished SILVER cap and a blue band at the bottom, label text exactly: 'ISSÉIMI MD' / 'MADRID' / 'SCRUBLOTION' / 'Scrub desmaquillante'" "tall white cylindrical bottle with a polished SILVER cap and a violet band at the bottom, label text exactly: 'ISSÉIMI' / 'MADRID' / 'KERATHOR 50 PLUS' / 'Solución isotónica'" "short frosted glass jar with a polished SILVER lid, label text exactly: 'ISSEIMI MD' / 'HIDRORRENOVADORA' / 'Crema estimulación tisular con FCE'" "clear glass dropper bottle with pink liquid, SILVER dropper collar and white bulb, round black label with text exactly: 'GLACÉE' / 'SKINCARE' / 'SERUM TRIPLE ACCIÓN'")
LABELS="Copy every product label letter by letter from its own reference photo. Never write ISSEIMI on the GLACÉE serum, never write GLACÉE on the ISSEIMI products. All caps and lids are silver, not gold. No other text anywhere."

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
    gen_image "$fmt-k0" "$AR" "$STYLE $LAYOUT From left to right: ${NAMES[0]}, ${NAMES[1]}, ${NAMES[2]}, ${NAMES[3]}. The four reference images are these four products in the same order; reproduce each one exactly (shape, color, cap, label). $LABELS No hands." \
      "$P1" "$P2" "$P3" "$P4"
  fi

  if [ "$STAGE" = images ] || [ "$STAGE" = hands ]; then
    PRODUCTS=("$P1" "$P2" "$P3" "$P4")
    for i in 1 2 3 4; do
      # FRAMES="desktop-k1 mobile-k2" — перегенерировать только эти кадры;
      # VARIANTS=3 — несколько вариантов name-v1..vN для ручного выбора.
      if [ -n "${FRAMES:-}" ] && [[ " $FRAMES " != *" $fmt-k$i "* ]]; then continue; fi
      for v in $(seq 1 "${VARIANTS:-1}"); do
      name="$fmt-k$i"; [ "${VARIANTS:-1}" -gt 1 ] && name="$fmt-k$i-v$v"
      gen_image "$name" "$AR" "Edit the first image only. Keep EVERYTHING in it pixel-identical: the same exactly four products (${NAMES[0]}; ${NAMES[1]}; ${NAMES[2]}; ${NAMES[3]}), their order, positions, sizes, labels, background, table, light, shadows, camera and framing. Do not add, remove, duplicate, replace or restyle any product. Do not add any other bottles, brands or objects. The ONLY change: add one elegant slender female hand with a natural nude manicure, no jewelry, coming in from the top right edge of the frame, already holding product number $i counting from the left, which is ${NAMES[$((i-1))]} (the second image shows this exact product): fingers wrapped around its cap and upper body, the product raised 4 centimeters straight up so there is a clearly visible gap of empty table between the bottom of the product and the tabletop, its soft contact shadow stays on the table below the gap. The product is upright, not tilted, label fully readable. This product exists ONLY ONCE in the image — it is now in the hand, so its original spot on the table is EMPTY (only its faint shadow). Exactly three products remain standing on the table and they stay untouched, exactly four products in total in the whole image. $LABELS" \
        "$OUT/$fmt-k0.png" "${PRODUCTS[$((i-1))]}"
      done
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
