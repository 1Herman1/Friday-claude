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
  local args=() img; for img in "$@"; do args+=(--image "$img"); done
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
    # Хват зависит от формы: за корпус, никогда за пипетку или крышку-помпу.
    GRIPS=("holding the tall bottle by its white body just below the silver cap: thumb on the near side, index and middle fingers on the far side, ring finger and pinky relaxed and slightly lifted"
           "holding the tall bottle by its white body just below the silver cap: thumb on the near side, index and middle fingers on the far side, ring finger and pinky relaxed and slightly lifted"
           "holding the short jar by the sides of its frosted glass body (not by the lid): thumb on the near side, two fingers on the far side, pinky slightly lifted"
           "holding the glass dropper bottle by its glass body below the shoulder — the fingers do NOT touch the white dropper bulb or the silver collar at all: thumb on the near side, index and middle fingers on the far side, pinky slightly lifted")
    if [ "$fmt" = desktop ]; then LIFT="3 centimeters"; else LIFT="2 centimeters"; fi
    HAND="one graceful feminine hand of a woman aged 25-35: soft smooth skin, slender fingers, short natural nude manicure, no rings or jewelry, relaxed elegant pose with a gentle natural curve of the wrist, entering the frame from the top right edge"
    # K0h — стартовый кадр ролика: рука уже в кадре и парит над товарами.
    if [ -z "${FRAMES:-}" ] || [[ " $FRAMES " == *" $fmt-k0h "* ]]; then
      for v in $(seq 1 "${VARIANTS:-1}"); do
      name="$fmt-k0h"; [ "${VARIANTS:-1}" -gt 1 ] && name="$fmt-k0h-v$v"
      gen_image "$name" "$AR" "Edit the image. Keep EVERYTHING pixel-identical: the same exactly four products (${NAMES[0]}; ${NAMES[1]}; ${NAMES[2]}; ${NAMES[3]}), their order, positions, sizes, labels, background, table, light, shadows, camera and framing. All four products stay standing on the table, untouched. The ONLY change: add $HAND, hovering in the air above the row of products, roughly above the first and second product from the left, fingers softly open and relaxed as if about to choose a product, palm facing down and slightly towards the camera. The hand touches nothing and casts only a faint soft shadow. $LABELS" \
        "$OUT/$fmt-k0.png"
      done
    fi
    for i in 1 2 3 4; do
      # FRAMES="desktop-k1 mobile-k2" — перегенерировать только эти кадры;
      # VARIANTS=3 — несколько вариантов name-v1..vN для ручного выбора.
      if [ -n "${FRAMES:-}" ] && [[ " $FRAMES " != *" $fmt-k$i "* ]]; then continue; fi
      for v in $(seq 1 "${VARIANTS:-1}"); do
      name="$fmt-k$i"; [ "${VARIANTS:-1}" -gt 1 ] && name="$fmt-k$i-v$v"
      gen_image "$name" "$AR" "Edit the first image only. Keep EVERYTHING in it pixel-identical: the same exactly four products (${NAMES[0]}; ${NAMES[1]}; ${NAMES[2]}; ${NAMES[3]}), their order, positions, sizes, labels, background, table, light, shadows, camera and framing. Do not add, remove, duplicate, replace or restyle any product. Do not add any other bottles, brands or objects. The ONLY change: add $HAND, ${GRIPS[$((i-1))]}. The hand holds product number $i counting from the left, which is ${NAMES[$((i-1))]} (the second image shows this exact product). The product is lifted exactly $LIFT straight up, DIRECTLY ABOVE ITS OWN ORIGINAL SPOT: same horizontal position, same depth as the neighbouring products (NOT moved backwards, NOT behind the other products, NOT forward, NOT sideways), same size as before, perfectly vertical, label facing the camera and crisp. Below it a small gap of empty table is visible, and its soft contact shadow lies on the table directly under the product; no shadow or trace remains at the old contact point other than that. This product exists ONLY ONCE in the image. Exactly three products remain standing on the table untouched; exactly four products in total. $LABELS" \
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
# Ролики для сайта: без звука, ключевой кадр каждые 6 кадров — чтобы
# перемотка скроллом шла без рывков; постеры из ключевых кадров.
if [ "$STAGE" = videos ]; then
  PUBV="$ROOT/projects/perfect-skin/client/public/video/bestsellers"
  for fmt in desktop mobile; do
    mkdir -p "$PUBV/$fmt"
    if [ "$fmt" = desktop ]; then SCALE="scale=1920:-2"; else SCALE="scale=1080:-2"; fi
    for i in 1 2 3 4; do
      ffmpeg -y -loglevel error -i "$OUT/$fmt-$((i-1))-$i.mp4" -an -vf "$SCALE" -c:v libx264 -preset slow -crf 26 -g 6 -pix_fmt yuv420p -movflags +faststart "$PUBV/$fmt/$((i-1))-$i.mp4"
    done
    for k in 0 1 2 3 4; do
      ffmpeg -y -loglevel error -i "$OUT/$fmt-k$k.png" -vf "$SCALE" -q:v 4 "$PUBV/$fmt/k$k.jpg"
    done
  done
  ls -la "$PUBV"/*
fi
ls -la "$OUT"
