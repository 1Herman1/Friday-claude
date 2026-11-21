# Serum3 pilot — implementation / parent security handoff

## Status and real blocker

Capability implemented; **NOT generation-ready**. No upload or paid request occurred. Native Codex made one real call with all seven required original/label/scene references; the tool rejected it before generation: `referenced_image_paths must contain at most 5 paths`. Independently parsed native session contains one call, one rejection, zero completed images. No final frame exists, so `frames.json` is deliberately `ready:false` with null hashes. No reference was dropped, merged or substituted. Parent must decide the permitted <=5-reference strategy before another native call; the one-completed-image allowance remains unused. No source photos or synthetic decoder-test media are committed here.

`source-originals.json` records actual SHA-256 for three originals, their three label crops and approved style. `native-call-evidence.json` preserves actual call/rejection; `native-frame-prompt.txt` records the requested composition. Exact packaging, safe area and final frame cannot be accepted without a real output.

## Exact quote

`verified-quote.json`: public live exact model `kling/v2-5-turbo-image-to-video-pro`, string duration `10`, **one job = 126 credits / USD 0.63**. Official schema supports `image_url` and `tail_image_url`; it does not support the old 12-second proposal. No sound field is sent; this model always includes audio. The runner rechecks the complete paginated public price feed, exact model anchor and `Turbo Pro-10.0s` record, rejecting ranges, duplicates or changed prices. This is a pre-submission check, not a provider-enforced price reservation. Actual provider billing/model success remains unverified.

## Security boundaries

- Existing repository `KIE_API_KEY` stays in GitHub; no local key extraction, replacement or connection setup needed. Only the final submission step receives it. Builds/tests and public probes run without it; npm uses `ci --ignore-scripts --omit=optional`. Ordinary built Nullume modules are reused, not a new loader or unsafe generic CLI.
- Pinned checkout/setup-node/upload-artifact commits were verified through authenticated `gh api`; checkout does not persist credentials. Permissions are `contents:read`; finite timeouts and seven-day artifact retention.
- Dedicated branch push runs only tests and a real credential-free public schema/quote probe. **It is not the full frame dry run.** Paid path is strictly workflow_dispatch, fixed branch/scenario/model/duration/cap, first run attempt, explicit confirmation, protected environment approval, arming variable and exact approved run-ID binding. Fresh dispatch cannot reuse a previous run's authorization; reruns are denied. No create retry, even on ambiguous response/timeout.
- Fixed balance/create/status/upload endpoints only. Native HTTPS does not automatically replay POSTs or follow redirects; public IPv4 DNS pinning, normal hostname TLS checks, bounded streamed responses. CDN URLs are allowlisted, queries/fragments/credentials/private IPs rejected. Downloads receive no provider credential. Unexpected provider shape/host fails closed, never silently broadens allowlists.
- Sanitized task ID/numeric credits only, no raw provider messages/URLs/headers/env dumps. A successful create is immediately recorded to logs, summary and best-effort metadata; summary-write failure does not stop polling. Artifact preservation runs even if a later step fails. JSON distinguishes media validation status.
- CLI dry run fully decodes both verified PNG byte buffers with ffmpeg before upload could occur. Downloaded video is saved first as `unverified.mp4` and fully decoded, requires video frames and <=10 seconds, then atomically renamed to `result.mp4` and marked validated. Failed/over-duration media remains explicitly unverified in a review-only artifact, never under the validated result filename. Header-only media is rejected. Subprocesses receive only PATH, fixed arguments, pipe-only protocol access, bounded output and 30-second timeout. Physical motion, label fidelity and whole playback still require independent visual review after a real job.

## Parent activation — do NOT execute paid dispatch while blocked

1. Resolve reference-limit choice and prepare/review real native tail. Create a plain white matching first frame; review exact package identities, FLUVIX/BLOCKMELAN/4D left-to-right resting order, left 40% safe area and complete silhouettes. Put only these necessary scenario frames at `first.png`/`tail.png`, hash them, and update `frames.json` after independent review.
2. Review exact workflow/script diff and hashes again. Register workflow on default branch through scoped PR; do not merge dirty shared work or change deployment branches. Full `dry-run` must pass. Configure `serum3-pilot` environment required reviewers, prevent self-review, restrict to pilot branch and disable administrative bypass where available. Existing repository secret is inherited; do not attempt to copy/retrieve it.
3. After parent approval, dispatch once:

```bash
~/.local/bin/gh workflow run serum3-pilot.yml --repo 1Herman1/Friday-claude --ref ci/serum3-bounded-pilot -f mode=generate-one -f confirmation=confirm-serum3-one-126
```

4. While that exact run waits for environment approval, set environment vars `SERUM3_PILOT_ARMED=confirm-serum3-one-126` and `SERUM3_APPROVED_RUN_ID=<that numeric run ID>` via authenticated GitHub controls, then approve that run. Parent must read back environment protections/variables before claiming armed. Do not rebind to another run without new authorization. Remove arming after reconciliation. An ambiguous submission must be reconciled by recorded task ID, never retried blindly.
5. Save artifact durably before seven-day expiry, add actual run/task/credits/hash/acceptance entry to project history, watch full playback/contact/recoil/rest and compare source labels. No publication or site deploy is authorized by this workflow.

Credential-free manual dispatch after registration:

```bash
~/.local/bin/gh workflow run serum3-pilot.yml --repo 1Herman1/Friday-claude --ref ci/serum3-bounded-pilot -f mode=dry-run -f confirmation=none
```

## Verification performed

- `npm ci --ignore-scripts --omit=optional && npm run build`: passed.
- `npm run typecheck`: passed.
- Pilot regression suite: 13 tests passed, including documented task IDs, price pagination/strict matching, no retry, cross-run binding, metadata-write failure, hostile responses, secret echoes, redirect/SSRF filtering and incomplete-media rejection. RED failures were reproduced before fixes.
- Actual public-network runner probe returned model, string duration `10`, 126 credits, USD 0.63. It exposed and then verified a fixed DNS-address bug that mocks had missed.
- Actual ffmpeg full decode passed on explicitly synthetic small PNG/one-second MP4 test fixtures kept only in scratch; these are NOT pilot media.
- Full existing Nullume suite initially could not start because omit-optional removes esbuild's platform binary. After a local no-save/no-lock helper install, 760 tests passed. No package/lock edits are part of this task. CI's exact locked minimal build and new pilot tests are the shipping validation route.
- Initial locked npm audit reports 36 existing dependency vulnerabilities (31 high, 5 moderate); no dependency-upgrade scope was silently added. Parent security review must assess these existing dependencies before paid activation.
- Full real dry-run correctly exits 1: `Local frame manifest is unready or invalid.` This is a blocker, not a passed dry run.
- Independent read-only review found documented-ID, metadata-preservation, cross-dispatch and media-validation defects; these were corrected and regression-tested. Parent security review of final exact revision is still mandatory.

No website, public assets, .claude, shared dirty checkout or deployment branch changed. Model upscale, another image output, another paid job and publication are not authorized here.
