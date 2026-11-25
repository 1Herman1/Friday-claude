# Stage04 — createDraggable contract/template pilot

## Outcome / scope

Typed wrapper added to `docs/core/templates/motion.ts`; existing exports, constants,
`animate`, spring, scroll and doctrine retained. `docs/core/motion-engine.md` now
explains actual lifecycle, reduced drag semantics and keyboard/a11y boundaries.
New runner: `.codex/scripts/test-motion-template.mjs`; only textual fixtures and
receipts in this directory. No client edits, shared dependency/config changes,
Git writes, binary assets or browser installs. Parent owns independent review.
This is technical pilot PASS, not product accessibility/design acceptance.

## Engine research (installed public package, not invented API)

- Registry command: `npm view animejs version dist.integrity dist.tarball`:
  **4.5.0**, `https://registry.npmjs.org/animejs/-/animejs-4.5.0.tgz`, integrity
  `sha512-NQimYX+lz8WaXonGS9zVVoviCIAjONeJayxacUditaivYLqyXgGjFKjuyl0aUUhFKm5MriX9ty1TGovNzoJQWA==`.
- Read real `dist/modules/draggable/draggable.d.ts` in full: exported factory
  at line 209; `stop`, `handleUp`, `revert`, native callbacks and options exist.
- Read relevant installed `draggable.js`: `stop()` 748–759 pauses tickers and
  release animations without resetting coordinates; `handleDown()` stops old
  motion before a new grab. Native release calls `onRelease` at 1087 **after**
  scheduling animations, enabling cancellation. No fake inertia simulation.
- `handleMove` 952–954 installs touch preventers even on mouse drag; native
  `disable/revert` does not remove those callbacks on an active drag. `handleUp`
  removes them at 1089–1091. This was reproduced as a real failing cleanup test,
  then fixed by teardown through handleUp with semantic callbacks muted before
  native revert. No engine source modification.
- `stop` cancels release settling/snap instead of teleporting to destinations.
  Wrapper preserves direct manipulation in reduce mode, not decorative motion.
  Native engine is mouse/touch document-tracked, not a pointer-capture widget.

## Environment / dependency isolation

Observed: macOS **15.6 / 24G84**, arm64, Node **v24.21.0**, npm **11.19.0**.
Packages: animejs **4.5.0**, TypeScript **5.9.3**, esbuild **0.28.2**,
playwright-core **1.65.1**. Browser: existing Chromium headless shell revision
1255, browser version **159.0.8154.6**. Always `headless: true`; no headed fallback.

Original install command (succeeded, 5 packages added; no lifecycle scripts):

```sh
npm install --prefix "$HOME/.hermes/cache/scratch/motion-stage04" \
  --ignore-scripts --no-audit --no-fund \
  --cache "$HOME/.hermes/cache/scratch/npm-cache" \
  animejs@4.5.0 esbuild@0.28.2 playwright-core@1.65.1 typescript@5.9.3
```

Actual lock saved as `dependencies.lock.json`; SHA-256
`125f97d0c2e6c6eef0e4196b4c31781d8a16d80854fb5ba9e0a491169c2ad457`.
`dependencies.package.json` is the actual generated manifest (caret ranges),
not a claim of exact manifest pins; **npm ci against the saved lock** pins replay.
All package tarball integrity values are preserved in the lock. Root animejs
is deliberately still unresolved; local editor diagnostics therefore are not
integration failures. No root `node_modules` or lockfile installation was used.

## Replay from repo root

```sh
PILOT=docs/research/design-agent-upgrade/rollout/motion-pilot
DEPS="$HOME/.hermes/cache/scratch/motion-stage04-replay"
mkdir -p "$DEPS"
cp "$PILOT/dependencies.package.json" "$DEPS/package.json"
cp "$PILOT/dependencies.lock.json" "$DEPS/package-lock.json"
npm ci --prefix "$DEPS" --ignore-scripts --no-audit --no-fund \
  --cache "$HOME/.hermes/cache/scratch/npm-cache"

# This executable already existed on this host; use an existing compatible
# Chromium executable on another host. Do not install into shared browser cache.
export MOTION_BROWSER="$HOME/Library/Caches/ms-playwright/chromium_headless_shell-1255/chrome-headless-shell-mac-arm64/chrome-headless-shell"
MOTION_DEPS="$DEPS" node .codex/scripts/test-motion-template.mjs --integration

# Dependency-free export smoke ONLY (not browser verification):
node .codex/scripts/test-motion-template.mjs
```

Full runner uses TypeScript compiler API with `strict: true`, `noEmit: true`,
`skipLibCheck: false`, ES2022 + DOM, bundler resolution to actual installed anime
`.d.ts` files; it compiles the **whole unchanged foundation + new wrapper + fixture**.
The direct tsc CLI attempt was blocked by the gateway scanner because `_tsc.js`
exceeds its 1 MiB scan cap. Compiler API execution succeeded with zero diagnostics;
this is not transpile-only. No new `as any` / `as never` escapes were added.
Existing foundation casts were left untouched rather than broadening the task.

Runner bundles actual anime for SSR and browser with esbuild, starts a random
loopback HTTP port, launches the explicit existing executable, drives real mouse
input via Playwright, captures actual DOM rectangles + engine state, and saves
PNG/JSON in a fresh Hermes scratch directory. It closes browser/server even on
browser-launch/test failure. No downloads or paid services are used.

## RED → GREEN receipts and iteration honesty

1. Before production edit: `node .codex/scripts/test-motion-template.mjs` exited 1:
   `AssertionError: template must export createDraggable (stage04 contract)`.
   Same command after the export addition exited 0:
   `PASS createDraggable export contract`.
2. The first implementation included more lifecycle behavior than the minimum
   export tracer. It was then pared back to native delegation for behavioral
   REDs; this history is not presented as perfect per-method test-first coverage.
3. Native-only wrapper: full integration exited 1 with
   `reduced-release moved 89.03750610351562px` (`red-reduced.json`).
   Release cancellation then made that slice pass.
4. Without live preference subscription: real integration exited 1 at dynamic
   cancellation (`Timeout 200ms exceeded`, `red-preference.json`). Added the
   media query subscription with a grabbed guard and destroy deregistration.
5. Stronger active-drag cleanup test exited 1:
   `destroy must remove engine touch-prevention listeners during a live drag`,
   `true !== false` (`red-touch-cleanup.json`). Added handleUp teardown described
   above. Full integration subsequently passed.
6. Fixed-delay 80/85/60ms probes had transient failures before RAF advanced
   (`o4VVBq`, `kgXKU0`, `3tkilA`). These were test observation assumptions, not
   grounds to claim false PASS. Tests now wait on actual observed displacement
   (800ms upper bound), then test the temporal state. Dynamic cancellation has
   a separate 200ms bound and must interrupt **already observed** motion.
7. `execution-ledger.json` lists all integration runs and actual result/error /
   template hash, including failures and the initial broad implementation.
   `green-1.json`, `green-2.json` preserve repeated passing runs of the final
   wrapper; `green-final.json` is the tightened final runner's actual PASS.
   The literal integration command is in the ledger. No PASS was synthesized.
8. Final `git diff --check -- docs/core/templates/motion.ts docs/core/motion-engine.md
   .codex/scripts/test-motion-template.mjs docs/research/design-agent-upgrade/rollout/motion-pilot`
   returned exit 0 (no output).

## What the final real run checked

Final scratch: `/Users/germanbryzgalov/.hermes/cache/scratch/motion-run-umESKy`.
Template SHA-256: `a803bcfaf1d2e66eea7bddb9d56707e94e66b22d98b4a95145534b499b8b0bb3`.
Other final source/runner/fixture hashes: `source-hashes.json`.

- SSR actual engine bundle imports without window/document; preference is false,
  subscription cleanup is callable, factory returns null without touching target.
- Normal: DOM x=40 before, x=150 at release, x=173.2115936279297 during inertia.
  Before/mid screenshots are real. Re-grab interrupts at current visual position;
  held interval is sampled via RAF and stays still. Grab uses an off-center
  pointer offset and asserts <1px immediate jump.
- Duplicate release does not increment callback count; next drag/release does.
  Subsequent **natural** release settles at x=384.7052917480469, with stable RAF
  samples and `repeat-settled.png`. `settled.png` is the earlier interrupted
  gesture, not falsely labelled as its unmodified natural endpoint.
- Initial reduce: direct drag reaches x=150 and all RAF samples across release
  remain x=150; no inertia. Consumer release callback fires once.
- Dynamic reduce: x=150 at release → already moving x=158.31399536132812 before
  preference change → x=158.31399536132812 throughout the stopped interval.
  Restore preference does not replay old inertia; next drag resumes native inertia.
- Preference switch while held preserves real pointer-follow; release then stops.
- Idempotent destroy during live moved drag: native enabled false, media listener
  adds/removes 1/1, no semantic release, no later callbacks or coordinate drift;
  cancelable touchstart is **not prevented** after cleanup (the reproduced bug).
- Destroy during active release inertia likewise cancels it and leaves no later
  updates. Cleanup restores baseline x=40; this restoration is intended unmount
  behavior, not an inertial continuity claim. No page errors in the final run.
- RAF traces are in `green-final.json`, not merely selected screenshots. Before,
  mid and naturally settled PNGs from a repeated final-wrapper run were also
  inspected: rendered title/tile, readable copy, no clipping or failed resources.

## Bundle measurement

Same minified ESM whole-wrapper build, all exported API retained, same real
animejs/esbuild versions; baseline is the preserved foundation without the new
import/export block. Before **53,304 bytes / 20,541 gzip**; after **76,780 bytes /
27,077 gzip**; measured delta **23,476 raw / 6,536 gzip bytes**. This is a standalone
wrapper/export surface comparison, NOT an application production bundle claim;
consumer tree-shaking and previous module usage affect actual application cost.

## Limits / remaining gates

- Mouse + headless Chromium only; no physical touch/pen, Safari/Firefox, screen
  reader, device latency, GPU performance or production app integration claimed.
  Cancelable synthetic touchstart checks listener cleanup, not a touch gesture.
- Fixture deliberately is not a keyboard widget; no tabindex/ARIA patch pretends
  otherwise. Product must provide a non-dragging alternative, chosen APG pattern,
  focus/keyboard semantics and business state. See core docs for native snap /
  onSettle / escape-hatch limitations. Boundary/snap combinations are not an
  exhaustive matrix in this pilot.
- Existing animate reduced keyframe parsing, dynamic animate preferences and
  scroll/other wrapper semantics are not rewritten or certified by drag tests.
- Scratch PNGs are ephemeral (Hermes may prune them). Replay regenerates them;
  durable text receipts, package lock and fixtures live here. No binary committed.
- Leaf self-verification is not independent review. Parent must run its review
  gate and record the actual reviewer; no fictional reviewer identity is supplied.
