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
  # kling-3.0: image_urls = [первый кадр, последний кадр]; pro = 1080p.
  # multi_prompt нужен API только в multi-shot, но каталог считает его
  # обязательным — передаём пустой список.
  echo '[]' > "$tmp/mp.json"
  $NUL generate create kling-3.0/video --prompt "$prompt" \
    --image "$first" --image "$last" \
    --set aspect_ratio="$ar" --set mode=pro --set duration="${DUR:-4}" --set sound=false --set multi_shots=false --set multi_prompt="@$tmp/mp.json" \
    --wait --wait-timeout 1200 --yes --out "$tmp"
  cp "$(ls "$tmp"/* | head -1)" "$OUT/$name.mp4"
}

if [ "$STAGE" = hero-start ]; then
  OUT="$ROOT/docs/projects/perfect-skin/media/hero"
  P="Edit this image to create the opening frame of an animation. Remove the woman completely: no face, no skin, no hair, nothing human. In her place continue the same thick matte foundation cream layer so that the cream covers the whole area where her face was, smooth and intact, only very fine first hairline cracks starting in the centre of where the face will appear, and a soft subtle bulge as if something is pressing from behind. Keep everything else pixel-identical: the flat background on the left, the existing cream strokes, colour, light and composition. No text, no objects."
  gen_image "hero-start-desk" 16:9 "$P" "$OUT/hero-desk3-v2.png" &
  gen_image "hero-start-mob" 9:16 "$P" "$OUT/hero-mob3-v1.png" &
  wait
  exit 0
fi

if [ "$STAGE" = hero-start2 ]; then
  OUT="$ROOT/docs/projects/perfect-skin/media/hero"
  P="Edit the FIRST image to create the opening frame of an animation, in the same manner as the SECOND image: the woman's face is completely covered by the thick matte foundation cream layer, only the soft relief of her face (brow, nose, lips, chin) is faintly visible under the cream, like a face pressed into a cream mask from behind. No bulge, no sphere, no hole. Only a few very fine hairline cracks on the cream over the face. Keep the flat left background, the cracked cream strokes, colour, light and composition pixel-identical. No text."
  for v in 1 2; do gen_image "hero-start-desk2-v$v" 16:9 "$P" "$OUT/hero-desk3-v2.png" "$OUT/hero-start-mob.png" & done
  wait
  exit 0
fi

if [ "$STAGE" = hero-start3 ]; then
  OUT="$ROOT/docs/projects/perfect-skin/media/hero"
  P="Edit this image to create the opening frame of an animation. Remove the woman completely. Where her face was, there is one smooth, even, uniform surface of the same matte warm beige cream, seamlessly continuing the background: no face relief, no bulge, no cracks, no shadows of features. Keep the cracked cream strokes on the left of that area, the flat left background, colours and light pixel-identical. No text."
  for v in 1 2; do gen_image "hero-start-desk3-v$v" 16:9 "$P" "$OUT/hero-desk3-v2.png" & done
  wait
  exit 0
fi

if [ "$STAGE" = hero-start4 ]; then
  OUT="$ROOT/docs/projects/perfect-skin/media/hero"
  P="Edit this image to create the opening frame of an animation. Remove the woman and remove all cracks and all cream strokes. The whole right part of the frame becomes one perfectly smooth, even, matte surface of warm beige cream, absolutely uniform, no cracks, no relief, no texture lines, seamlessly blending into the flat background on the left. Same colours and light. No text."
  for v in 1 2; do gen_image "hero-start-desk4-v$v" 16:9 "$P" "$OUT/hero-desk3-v2.png" & done
  wait
  exit 0
fi

if [ "$STAGE" = hero-video ]; then
  OUT="$ROOT/docs/projects/perfect-skin/media/hero"
  V="Locked static camera, no zoom, no pan. Premium skincare commercial, macro detail, soft warm studio light. The thick layer of matte foundation cream slowly cracks open: fine hairline cracks spread outward like a drying clay mask, then deepen, flakes and small pieces of cream lift, curl and fall away in slow motion with tiny particles of cream dust drifting down, and the face of a young woman gradually emerges from behind the cream, pushing through calmly and gracefully, her eyes opening softly as she turns slightly into the final pose. The broken cream edges settle into the jagged torn edge of the final frame. Smooth, continuous, elegant motion, no jumps, no morphing of her features, skin stays clean and natural with fine pores and freckles. The flat background on the left stays perfectly still. No text."
  VD="Locked static camera, no zoom, slow realistic pace, nothing fast. Palette only warm beige, ivory and natural skin tones; every cream flake is pale beige on all sides. 0-2 s: the perfectly smooth cream surface on the right stays still, then the first fine hairline cracks appear. 2-4 s: cracks slowly spread across the entire right part of the frame. 4-6.5 s: a young woman's face, hidden beneath, gently moves forward a few millimetres; this movement breaks the layer, more and deeper cracks appear and parts of her face become visible through the breaks, eyes closed. 6.5-8.5 s: the remaining cream pieces slowly peel off and fall away with fine pale dust, revealing her whole face; the torn cream edge and cracked strokes of the final frame remain on the left side of her face. 8.5-10 s: she slowly opens her eyes, her gaze turns to the viewer, a slight gentle sway of the head, then she settles into the final pose. The flat background on the left stays perfectly still. No text."
  if [[ " ${CLIPS:-desk mob} " == *" desk "* ]]; then DUR=${HERO_DUR:-10} gen_video "hero-video-desk" 16:9 "$VD" "$OUT/${FRAMES:-hero-start-desk2-v1}.png" "$OUT/hero-desk3-v2.png" & fi
  if [[ " ${CLIPS:-desk mob} " == *" mob "* ]]; then DUR=5 gen_video "hero-video-mob" 9:16 "$V" "$OUT/hero-start-mob.png" "$OUT/hero-mob3-v1.png" & fi
  wait
  exit 0
fi

if [ "$STAGE" = hero-crack ]; then
  OUT="$ROOT/docs/projects/perfect-skin/media/hero"
  D="Edit this image. Keep the woman, her face, skin, the composition and the flat left background pixel-identical. Only on the cream layer near her cheek: add fine natural drying cracks, thin hairline fissures and a few deeper splits in the thick foundation cream, like a clay mask starting to dry, following the direction of the strokes. Cracks only inside the cream, none on the skin and none on the flat background. No text, no objects."
  M="Edit this image. Keep the upper 60% (face, skin, cream edge at the cheek) pixel-identical. In the lower part add a few broad, thick strokes of the same matte foundation cream, continuing down from the cream layer on the left and sweeping across the bottom, with layered torn edges and fine natural drying cracks on them, like a clay mask starting to dry. Leave the middle of the lower area calm enough for overlay text. Add the same fine cracks to the cream at the cheek. No cracks on the skin. No text, no objects."
  for v in 1 2; do gen_image "hero-desk3-v$v" 16:9 "$D" "$OUT/hero-desk2-v3.png" & gen_image "hero-mob3-v$v" 9:16 "$M" "$OUT/hero-mob2-v2.png" & done
  wait
  exit 0
fi

if [ "$STAGE" = hero-wide2 ]; then
  OUT="$ROOT/docs/projects/perfect-skin/media/hero"
  D="Edit the FIRST image and keep its 16:9 composition: wide cream area on the left, face on the right. The woman must be exactly the woman from the SECOND image: same identity, head angle, eyes, brows, lips, freckles, skin texture and pores. Redo the transition between the background and the face exactly in the manner of the THIRD image: a thick layer of matte foundation cream covers the left cheek and breaks off in a jagged, layered, crusty torn edge with real thickness, lifted flakes and a few smeared strokes, the skin emerging from under it. Take nothing else from the third image, not her face. Left 45% of the frame: calm, even, flat cream-colored background with only subtle texture so text stays readable. Same warm soft light. No text, no logo, no objects."
  M="Edit this image. Keep everything in the upper 60% pixel-identical: face, skin, cream edge. In the lower 40% remove the horizontal cream smear and all cream strokes, replacing them with one uniform, flat, even background of the same warm beige as the area around the chin. No texture, no gradient, no objects, no text."
  for v in 1 2 3; do gen_image "hero-desk2-v$v" 16:9 "$D" "$OUT/hero-desktop169-v2.png" "$OUT/hero-t1.png" "$OUT/ref-face.png" & done
  for v in 1 2; do gen_image "hero-mob2-v$v" 9:16 "$M" "$OUT/hero-mobile-v2.png" & done
  wait
  exit 0
fi

if [ "$STAGE" = hero-wide ]; then
  OUT="$ROOT/docs/projects/perfect-skin/media/hero"
  for spec in "16:9:desktop169:the face occupies the right 55% of the width, the left 45% is calm empty background and cream layer for overlay text" "16:10:desktop1610:the face occupies the right 55% of the width, the left 45% is calm empty background and cream layer for overlay text" "9:16:mobile:the face occupies the upper 60% of the height, the lower 40% is calm empty background and cream layer for overlay text"; do
    ar="${spec%%:*}"; rest="${spec#*:}"; ar="$ar:${rest%%:*}"; rest="${rest#*:}"; name="${rest%%:*}"; place="${rest#*:}"
    WIDE="Extend the canvas of this image to aspect ratio $ar (outpainting). Keep the woman, her face, head angle, skin texture and pores, freckles, the torn cream layer and the lighting exactly as they are, pixel-identical. Continue the flat warm stone background and the torn foundation-cream layer naturally into the new area. Composition: $place. Do not zoom out so much that skin detail is lost: the face stays large. No text, no logo, no extra objects, no hands."
    for v in $(seq 1 "${VARIANTS:-2}"); do gen_image "hero-$name-v$v" "$ar" "$WIDE" "$OUT/hero-t1.png" & done
  done
  wait
  exit 0
fi

if [ "$STAGE" = hero-turn ]; then
  OUT="$ROOT/docs/projects/perfect-skin/media/hero"
  TURN="Edit the FIRST image. Keep the same woman exactly: identity, face shape, eyes, brows, lips, freckles, skin texture and pore detail, the torn cream layer on the left, the background color and the lighting. The ONLY change: turn her head further to her right (toward the left of the frame) so the face is seen at about 70 degrees, a deeper three-quarter view like the head angle in the SECOND image: the far eye partly hidden behind the nose bridge and cut by the right frame edge, the nose projecting toward the right edge, cheek and jaw line longer and more visible on the left. Use the second image ONLY for head angle; do not copy anything else from it (not the face, eyes, lips, brows, freckles or skin). Keep high skin detail: fine pores, light freckles, soft satin glow, no oily shine. Same crop: extreme close-up, forehead cut by the top edge. No text, no extra objects."
  for v in $(seq 1 "${VARIANTS:-3}"); do gen_image "hero-t$v" 4:5 "$TURN" "$OUT/hero-r3.png" "$OUT/hero-r1.png" & done
  wait
  exit 0
fi

if [ "$STAGE" = hero ]; then
  OUT="$ROOT/docs/projects/perfect-skin/media/hero"; mkdir -p "$OUT"
  REFH="$OUT/ref-face.png"
  HERO="Use the attached image as the composition, lighting and technique reference. Recreate the same concept as a NEW original photograph with a DIFFERENT woman (do not copy her identity). Vertical 4:5 beauty campaign close-up. Composition as in the reference: extreme close-up, face fills the right two-thirds of the frame and is cropped by the frame on the right and at the top of the forehead, three-quarter view, face turned slightly left, one eye fully visible and looking softly at the camera, the far eye partly cut by the frame edge, nose and full relaxed lips in the lower half, chin near the bottom edge. Technique as in the reference: the left third is a thick layer of matte foundation-like cream in warm stone ivory #F4F2EC that covers the left cheek and is torn away in a jagged, layered, crusty edge with real cream thickness, small lifted flakes and a few smeared strokes running down the lower left, so the face appears to emerge from the cream. Skin: luminous, healthy, fine visible pores and light freckles, soft satin glow on the cheekbone and nose bridge, no oily shine. Natural groomed brows, long natural lashes, nude lips with a soft satin finish. Light: soft diffused studio light from the upper left, gentle warm old-gold undertone #E4D3AC in the highlights. Background beyond the face: flat warm stone #F4F2EC, slightly cooler and paler than the reference beige, no peach or pink cast. Only the face and the cream background in the frame: no text, no logo, no products, no hands, no jewellery, no hair accessories, no clothing. Photographic realism, 100 mm macro beauty look."
  for v in $(seq 1 "${VARIANTS:-3}"); do gen_image "hero-r$v" 4:5 "$HERO" "$REFH" & done
  wait
  exit 0
fi


for fmt in desktop mobile; do
  if [ "$fmt" = desktop ]; then AR="16:9"; LAYOUT="The four products stand in one row on the right two thirds of the frame, left third is empty calm background."; else AR="9:16"; LAYOUT="The four products stand in one row in the lower half of the vertical frame, centered, upper half is empty calm background."; fi

  if [ "$STAGE" = images ]; then
    gen_image "$fmt-k0" "$AR" "$STYLE $LAYOUT From left to right: ${NAMES[0]}, ${NAMES[1]}, ${NAMES[2]}, ${NAMES[3]}. The four reference images are these four products in the same order; reproduce each one exactly (shape, color, cap, label). $LABELS No hands." \
      "$P1" "$P2" "$P3" "$P4"
  fi

  if [ "$STAGE" = images ] || [ "$STAGE" = hands ] || [ "$STAGE" = gaps ]; then
    PRODUCTS=("$P1" "$P2" "$P3" "$P4")
    SHORT=("the SCRUBLOTION bottle (blue band, first from the left)" "the KERATHOR 50 PLUS bottle (violet band, second from the left, standing between the SCRUBLOTION bottle and the frosted jar)" "the frosted glass jar HIDRORRENOVADORA (third from the left)" "the pink glass dropper bottle GLACÉE (last on the right)")
    # Хват зависит от формы: за корпус, никогда за пипетку или крышку-помпу.
    GRIPS=("holding the tall bottle by its white body just below the silver cap: thumb on the near side, index and middle fingers on the far side, ring finger and pinky relaxed and slightly lifted"
           "holding the tall bottle by its white body just below the silver cap: thumb on the near side, index and middle fingers on the far side, ring finger and pinky relaxed and slightly lifted"
           "holding the short jar by the sides of its frosted glass body (not by the lid): thumb on the near side, two fingers on the far side, pinky slightly lifted"
           "holding the glass dropper bottle by the LOWER HALF of its glass body, around the round black label, well below the silver collar — the fingers never touch the white rubber dropper bulb and never touch the silver collar (gripping the dropper is a failure): thumb on the near side, index and middle fingers on the far side, pinky slightly lifted")
    if [ "$fmt" = desktop ]; then LIFT="3 centimeters"; UPRIGHT=""; else LIFT="2 centimeters"; UPRIGHT=" The lifted product stays PERFECTLY VERTICAL, exactly as upright as it stood on the table — absolutely no tilt, no rotation, no lean (a tilted product is a failure). The hand approaches from the right side at the product's mid-height, not from above."; fi
    HAND="one graceful feminine hand of a woman aged 25-35: soft smooth skin, slender fingers, short natural nude manicure, no rings or jewelry, relaxed elegant pose with a gentle natural curve of the wrist, entering the frame from the top right edge"
    # K0h — стартовый кадр ролика: рука уже в кадре и парит над товарами.
    if [ -z "${FRAMES:-}" ] || [[ " $FRAMES " == *" $fmt-k0h "* ]]; then
      for v in $(seq 1 "${VARIANTS:-1}"); do
      name="$fmt-k0h"; [ "${VARIANTS:-1}" -gt 1 ] && name="$fmt-k0h-v$v"
      gen_image "$name" "$AR" "Edit the image. Keep EVERYTHING pixel-identical: the same exactly four products (${NAMES[0]}; ${NAMES[1]}; ${NAMES[2]}; ${NAMES[3]}), their order, positions, sizes, labels, background, table, light, shadows, camera and framing. All four products stay standing on the table, untouched. The ONLY change: add $HAND, hovering in the air above the row of products, roughly above the first and second product from the left, fingers softly open and relaxed as if about to choose a product, palm facing down and slightly towards the camera. The hand floats clearly ABOVE the products with a visible gap of air of at least 5 centimeters between the lowest fingertip and the highest cap — no finger touches or rests on any cap or product (touching is a failure). The hand casts only a faint soft shadow. $LABELS" \
        "$OUT/$fmt-k0.png"
      done
    fi
    for i in 1 2 3 4; do
      # FRAMES="desktop-k1 mobile-k2" — перегенерировать только эти кадры;
      # VARIANTS=3 — несколько вариантов name-v1..vN для ручного выбора.
      if [ -n "${FRAMES:-}" ] && [[ " $FRAMES " != *" $fmt-k$i "* ]]; then continue; fi
      # Два шага против задвоения: сначала кадр без товара i (пустое место на
      # столе), затем рука с товаром над этим местом.
      GAP="$OUT/$fmt-gap$i.png"
      if [ ! -f "$GAP" ] || [ "$STAGE" = gaps ]; then
        gen_image "$fmt-gap$i" "$AR" "Edit the image. There are four products in a row. Remove ONLY ${SHORT[$((i-1))]} — together with its shadow, leaving its spot on the table completely empty: clean tabletop and background fill the space naturally. The other THREE products stay pixel-identical, including every line of their label text (do not erase, blur or change any text on the remaining products), their positions, sizes, background, table, light, shadows, camera and framing. Exactly three products remain. No hands. $LABELS" \
          "$OUT/$fmt-k0.png"
      fi
      [ "$STAGE" = gaps ] && continue
      LIFT="$OUT/$fmt-lift$i.png"
      for v in $(seq 1 "${VARIANTS:-1}"); do
      name="$fmt-k$i"; [ "${VARIANTS:-1}" -gt 1 ] && name="$fmt-k$i-v$v"
      if [ -f "$LIFT" ]; then
        # Товар уже поднят монтажом (lift.py) — модель дорисовывает только руку.
        gen_image "$name" "$AR" "Edit the image. One product — ${SHORT[$((i-1))]} — is already floating a few centimeters above the table, exactly where it should be. Keep EVERYTHING pixel-identical: all four products, their exact positions, SIZES, labels and text, the floating product's position and size, background, table, light, shadows, camera and framing. Do not move, resize, redraw or restyle any product. The floating product is ALREADY at its final height — do NOT lift it any higher, do NOT move it sideways, and NEVER draw a second copy of it: it must appear exactly once, exactly where it floats now, and the empty spot on the table beneath it stays empty. The ONLY change: add $HAND, ${GRIPS[$((i-1))]}, so that the hand naturally holds the floating product in place — for the dropper bottle the hand comes in from the RIGHT SIDE at the bottle's mid-height, horizontally, and the fingertips sit on the glass BELOW the silver collar, never on the white dropper bulb; blend the fingers realistically around it with soft contact shadows, and clean up any tiny jagged edge artifacts around the floating product without changing its size or position. Exactly four products, one hand. $LABELS" \
          "$LIFT"
        continue
      fi
      gen_image "$name" "$AR" "Edit the first image only. It shows three products on a table and one EMPTY SPOT where a fourth product used to stand (position number $i counting from the left). Keep EVERYTHING in it pixel-identical: the three products, their positions, sizes, labels, background, table, light, shadows, camera and framing. Do not add, remove, duplicate, replace or restyle any product. The ONLY change: add $HAND, ${GRIPS[$((i-1))]}. The hand holds the product from the second image, which is ${NAMES[$((i-1))]}, reproduced exactly (shape, color, cap, label text letter by letter). The product hangs exactly $LIFT above the empty spot, DIRECTLY ABOVE IT: same horizontal position and same depth as the neighbouring products (NOT behind them, NOT in front, NOT sideways), EXACTLY the same size as it had on the table in the reference layout — for a tall bottle its height and width equal those of the neighbouring tall bottle (never smaller, never further away, never scaled down; a smaller product is a failure), perfectly vertical, label facing the camera and crisp.$UPRIGHT Below it a small gap of empty table is visible, and its soft contact shadow lies on the table directly under the product. This product appears ONLY ONCE in the image, only in the hand — the empty spot stays empty under it. Exactly four products in total. $LABELS" \
        "$GAP" "${PRODUCTS[$((i-1))]}"
      done
    done
  fi

  if [ "$STAGE" = videos ]; then
    # CLIPS="desktop-0-1 mobile-2-3" — только эти ролики (по одному, по решению
    # Гермеса); пусто — все 8. Сегмент 0 стартует с кадра k0h (рука парит).
    for i in 1 2 3 4; do
      clip="$fmt-$((i-1))-$i"
      if [ -n "${CLIPS:-}" ] && [[ " $CLIPS " != *" $clip "* ]]; then continue; fi
      if [ "$i" = 1 ]; then first="$OUT/$fmt-k0h.png"; else first="$OUT/$fmt-k$((i-1)).png"; fi
      # Клипы одного формата идут параллельно (цена та же, время — одного клипа).
      gen_video "$clip" "$AR" "Locked static camera, no camera movement, no zoom. Premium skincare commercial, soft warm studio light, calm and slow. A graceful feminine hand (slender fingers, short nude manicure, no jewellery) moves with the unhurried elegance of the reference style: it glides in from the top right, slows down above product number $i from the left, gently sets down whatever it was holding, then takes product $i by its body: the fingers first close around it and hold for a brief moment (a real, tangible grip), and only then the hand lifts it a few centimeters straight up — slowly and deliberately, with visible weight, as if the bottle is heavier than it looks; the product never floats, jumps or jitters, the lift fills the last third of the clip and ends with a gentle settle exactly into the last frame. The fingers grip the product from its top and far side, so the FRONT LABEL with the product name stays fully visible and unobstructed at all times — never cover the label with fingers. No new specular highlights, glare or reflections appear on caps, lids or glass; lighting stays exactly as in the first frame. Every product keeps its exact position, size and label — labels stay crisp and readable at all times, nothing flickers, nothing duplicates, no extra hands. Smooth continuous motion, no cuts." \
        "$first" "$OUT/$fmt-k$i.png" &
    done
    wait
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
      [ -f "$OUT/$fmt-$((i-1))-$i.mp4" ] || continue
      # Пережимаем только клипы этого прогона — иначе параллельные прогоны
      # конфликтуют на чужих файлах и теряют результат при пуше.
      if [ -n "${CLIPS:-}" ] && [[ " $CLIPS " != *" $fmt-$((i-1))-$i "* ]]; then continue; fi
      ffmpeg -y -loglevel error -i "$OUT/$fmt-$((i-1))-$i.mp4" -an -vf "$SCALE" -c:v libx264 -preset slow -crf 26 -g 6 -pix_fmt yuv420p -movflags +faststart "$PUBV/$fmt/$((i-1))-$i.mp4"
    done
    for k in 0h 1 2 3 4; do
      [ -f "$OUT/$fmt-k$k.png" ] || continue
      [ -n "${CLIPS:-}" ] && [[ " $CLIPS " != *" $fmt-"* ]] && continue
      ffmpeg -y -loglevel error -i "$OUT/$fmt-k$k.png" -vf "$SCALE" -q:v 4 "$PUBV/$fmt/k${k/0h/0}.jpg"
    done
  done
  ls -la "$PUBV"/*
fi
ls -la "$OUT"
