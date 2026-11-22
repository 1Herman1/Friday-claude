# Fixed Seedance 2 Mini motion-transfer adapter — review required

## Scope and public evidence

Exact API model **`bytedance/seedance-2-mini`**, NOT Kling and NOT Seedance fast.
The archived provider OpenAPI explicitly permits **multimodal image + video references**
(up to9 images,3 videos); first/last-frame fields must not be combined with references.
This case sends exactly7 image URLs +1 motion URL, duration **integer10**, `720p`,
`adaptive`, `generate_audio:false`. No first/last frame, callback, web search or audio refs.
Motion:1080x720,10s,300 frames,30fps,no audio; total777600 pixels fits409600–927408.

Eight archived complete price pages contain709/709 rows. Exact anchor
`https://kie.ai/seedance-2-0-mini`, description
`bytedance/seedance-2-mini, 720P with video`, ByteDance/video,5 credits per second,
USD0.025 per second. Documented billing includes reference + output:
**5 × (10+10) =100 credits =USD0.50**. **`providerBillingCap:false`**;
this is a quote/check, not a provider-enforced spending ceiling or reservation.
The adapter requires the complete live feed and exact unique price both before uploads
and immediately before create. Full live docs byte drift fails closed for parent review.

Source docs and controlled motion are preserved unchanged under the local
`docs/projects/perfect-skin/media-review/serum-cover-final-preflight/`.
The candidate binder was read and all8 frozen hashes match it. No old rejected motion is used.

## Asset privacy / exact disclosure

Repository is PUBLIC. To avoid publishing original packshots unnecessarily, the eight
owner-authorized job inputs are committed ONLY as one AES-256-GCM encrypted bundle
(`authorized-assets.aesgcm`, fresh32-byte key,12-byte nonce,16-byte tag).
No plaintext photo, label, motion MP4, source absolute home path or sealing key is committed.
Frozen public metadata lists file names, sizes, dimensions and hashes only.
The decoded final owner-attached frame is **appearance-only**, never choreography.
The three original products and three label crops retain their distinct roles; cartons
are evidence only and must not become additional objects. Model risk: exact three-body
motion, stable identity, typography and closures are NONDETERMINISTIC, not locked by API.
Owner full-timeline and label/brand acceptance remains mandatory before any integration.

Authorized plaintext paths inside this case bundle (relative to original preflight):

| Path | Bytes | SHA256 |
|---|---:|---|
| `assets/1-original.jpg` | 48899 | `ba4c4ec6eac98d73b5a843b4872a89f65938e64e49616aaa3ec978c15e2876f3` |
| `assets/2-original.jpg` | 29332 | `cb222a0bd1698306d8590c3680640ec51b9e24f5a9cb31a3c1c7faf01bf69469` |
| `assets/3-original.jpg` | 29271 | `98ecedf72cb72e3a08e6538b70cdd6abeea77ce981675272310f697bca3f22b1` |
| `assets/1-label-padded.png` | 66864 | `f815c4d4738f881df081463ea82de0232dacb27d5234a978cf404c979cc7481b` |
| `assets/2-label-padded.png` | 27853 | `a7ffeaa0236cf57c7394487e30ce2e42810bd6ce5f46d224e3a45ee4a9af91a8` |
| `assets/3-label-padded.png` | 34454 | `4c8afac499545c4c2e97fb68ea61c5dea48fef157c0434312afa290899b0d97d` |
| `assets/appearance-only-last-attached-frame.png` | 712424 | `9e8f33f19ae5a538ee6f2e1fb8b61d8c141c2cd540808f1af4d7804439f4000f` |
| `MOTION-REFERENCE-1080x720-10S.mp4` | 155621 | `402a2779ec7332ca838d4c5fc641397dc3a5dbb2eb5b7f9082fb09c70e3a7ca8` |

Total8 inputs, 1104718 original bytes. Bundle contains exactly these8 entries; no other source frames,
Downloads video, scene render sequence, contacts, credentials or hidden metadata files.
Original bytes are preserved, including whatever image metadata they already carry;
no claim of EXIF scrubbing. Only these approved originals are disclosed to KIE after the gate.

- Freeze SHA256: `e6730865da14af848a320ca87d4bf2988f2e22bf9d36410721ed07e8406a3b50`
- Encrypted bundle SHA256: `c45019d0ea87605efa23e39dbf9522ea1874715883296dbf3f92e47f8274e0a0`
- Frozen public schema SHA256: `faee51ee448c785f9d60cebf868c853bf6e955a0d764edd90eb0cae0bef55a64`

## Security mechanics

New fixed-case scripts in `tools/nullume/scripts/serum-motion-*.mjs`; existing Kling
runner/workflow are NOT modified or dispatched. No third-party runtime dependencies.
The adapter lives in Nullume and directly uses its documented KIE jobs contract, rather
than making its general CLI an unsafe arbitrary-model runner. Reviewed low-level HTTPS
and decoder mechanics are extracted into a separate NEW module, not generalized in place.

- Actions pinned by SHA, read-only contents permission, persisted checkout token disabled.
- Push runs only offline tests/dry-run; no secrets/provider calls. No paid PR trigger.
- Existing protected `serum3-pilot` environment reused **unchanged**, new independent
  `SERUM_MOTION_*` arming variables; old Kling arming can never authorize this case.
- Exact dedicated branch, workflow_dispatch, attempt1, approved run ID AND approved source SHA.
- Installation/tests before credential injection; secrets only in the consuming step.
- Fixed API endpoints/methods, fixed CDNs, strict raw URL paths, public-only IPv4 socket
  DNS lookup, TLS hostname validation, no redirects, bounded body/time, sanitized errors.
- Eight exact file hashes and sizes validated before any network; all decode before upload.
  Uploads one each/no retry; unauthenticated CDN readback must exactly match the frozen
  bytes before create. No provider token ever sent to a CDN. Payload assembled internally.
- One create, no POST retry; exclusive runner directory blocks duplicate same-job process.
  Attempt2 is refused. A timeout can mean submission happened: never create again to recover.
- `task-receipt.json` exclusively written/fsynced and uploaded as a90-day artifact BEFORE
  any poll; failed artifact upload blocks polling. Sanitized ID also goes to Actions output/summary.
- Recovery process structurally permits only GET of the one approved model/task and fixed
  result CDN; no balance, schema/pricing, upload or create.65 polls max,3 GET attempts per poll.
  Returned taskId AND model must match. Video preserved before decode/charge checks.
- Numeric provider billing above100 marks a violation, retains output, fails for reconciliation.
  Missing provider charge is not invented. Artifacts expire: parent must archive accepted output.

## Parent approval / one paid run procedure (NOT performed)

No environment/protection, variables or provider secrets have been changed. No authenticated
KIE calls, input uploads, paid creates or environment approvals have been performed.
Only credential-free public docs/pricing transport was exercised during development;
it returned709 rows and the100-credit exact quote. Offline mock calls are tests, not jobs.

1. Independently security-review actual PR commit and the encrypted assets freeze; review
   the plaintext source originals locally if needed. No budget/model question is being
   handed back to the owner; this is the delegated parent security gate.
2. After approval, provision **new environment secret `SERUM_MOTION_ASSET_KEY`** from
   the private local file (not printed or committed):
   `/Users/germanbryzgalov/.hermes/cache/scratch/serum-motion-assets-key`.
   Example control-plane command (NOT executed by this implementation):
   `gh secret set SERUM_MOTION_ASSET_KEY --env serum3-pilot < /Users/germanbryzgalov/.hermes/cache/scratch/serum-motion-assets-key`
   This is a newly created asset sealing key, NOT the KIE key. Existing `KIE_API_KEY`
   stays GitHub-only. Seal-key provisioning is the privacy-preserving prerequisite.
3. **Discovered blocker:** existing `serum3-pilot` environment currently allowlists ONLY
   `ci/serum3-bounded-pilot`, so the new dedicated branch is intentionally blocked.
   Parent must review first and explicitly authorize adding the new branch to the protected
   environment policy (without removing reviewers), or choose a reviewed allowed execution route.
   No branch policy was changed by this implementation.
   A NEW manual workflow generally needs default-branch registration before dispatch.
   Merge/register only the independently reviewed workflow through the authorized route;
   no website changes or dirty checkout pushes. Keep paid checkout on the exact reviewed
   dedicated branch, not default. Do NOT dispatch old `serum3-pilot.yml`.
4. Set environment `SERUM_MOTION_APPROVED_SHA` to reviewed branch SHA. Dispatch
   `serum-motion-transfer.yml` on `ci/serum-seedance-mini-singlejob`, mode `generate-one`,
   confirmation `confirm-serum-motion-one-100`. It waits at the unchanged protected environment.
5. Read this NEW run ID, set environment `SERUM_MOTION_APPROVED_RUN_ID` to it and
   `SERUM_MOTION_ARMED=confirm-serum-motion-one-100`, then parent approves that one
   pending environment deployment. Do not reconfigure protections or reuse old run approval.
6. Follow receipt, then GET-only retrieval within the same run. If recovery needed,
   choose `recover-existing-task`, bind new approved run/SHA plus
   `SERUM_MOTION_RECOVERY_TASK_ID` / `SERUM_MOTION_RECOVERY_SOURCE_RUN_ID` to receipt
   and matching workflow inputs. Never repeat create, including ambiguous create failures.
7. Disarm after completion, archive output, review all10 seconds/threeobjects/labels/shadows,
   obtain required brand/design and owner acceptance. No website or publication permission inferred.

## Verification

Local full offline suite uses real frozen plaintext assets plus mocked provider transport;
remote public-branch CI deliberately cannot decrypt source assets without approval.
Run locally (no provider credential):

```sh
SERUM_MOTION_LOCAL_DRY_ASSETS=/Users/germanbryzgalov/Friday-claude/docs/projects/perfect-skin/media-review/serum-cover-final-preflight node --test tools/nullume/scripts/serum-motion-transfer.test.mjs
SERUM_MOTION_LOCAL_DRY_ASSETS=/Users/germanbryzgalov/Friday-claude/docs/projects/perfect-skin/media-review/serum-cover-final-preflight node tools/nullume/scripts/serum-motion-transfer.mjs dry-run
```

Without the local path, CI tests the schema/price/freeze/encrypted bundle, hostile URLs,
run/SHA/recovery authorization, duplicate create after ambiguous error, bounded GET errors,
model/task mismatches, sanitized exclusive receipt and response size/redirect protections;
the plaintext8-asset integration test is explicitly skipped rather than fabricated.
Local full decode dry-run passed on all8 actual files. Local test suite12/12 passed.
Security approval is pending; tests are not independent approval or model quality proof.
