# Nullume — CLI for media generation via kie.ai

Generate images, videos, audio, and music through kie.ai with full price control. Instead of paying intermediaries, generate directly and save 3–10x on costs.

## Quick Start

```bash
# 1. Install
npm install -g nullume@latest
# or use globally without install:
npx nullume

# 2. Initialize in your project
nullume init

# 3. Set KIE_API_KEY in .env
echo "KIE_API_KEY=sk_live_..." >> .env

# 4. Generate an image
nullume generate create nano-banana-2-lite \
  --prompt "a cat in a red sweater" \
  --wait --json
```

## What's in the Package

Full inventory of files, directory structure, recipient requirements, and data locations — see `MANIFEST.md`.

## Installation

### Global (recommended)

```bash
npm install -g nullume@latest
nullume --help
```

### Local in project

```bash
npm install nullume --save-dev
npx nullume --help
```

### From source (development)

```bash
git clone https://github.com/1Herman1/Friday-claude.git
cd Friday-claude/tools/nullume
npm install
npm run build
npm link  # make available as 'nullume' command
```

## Five Main Commands

### 1. Check balance

```bash
nullume balance --json
# {"total": 5000, "used": 2543}
```

### 2. Find a model

```bash
# Images from text
nullume models list --category image --search text-to-image --json

# Video from image
nullume models list --category video --search image-to-video --json

# Music
nullume models list --category audio --search music --json
```

### 3. Get model details

```bash
nullume models get nano-banana-2-lite --json
```

Shows required fields, defaults, and exact pricing.

### 4. Estimate cost

```bash
nullume generate cost nano-banana-2-lite --set width=512 --set height=512 --json
```

Always estimate before generating.

### 5. Generate media

```bash
nullume generate create nano-banana-2-lite \
  --prompt "a minimalist logo" \
  --set width=1024 --set height=1024 \
  --wait --json
```

**Key flags:**
- `--prompt "..."` — description (required)
- `--image file.jpg` — source image for image-to-video, upscaling, etc.
- `--set k=v` — override parameter (width, height, aspect_ratio)
- `--wait` — wait for completion (always use this)
- `--json` — JSON output
- `--out ./folder` — save results to folder

## Pricing Examples

| Model | Price | Notes |
|-------|-------|-------|
| nano-banana-2-lite | $0.02 | cheapest image |
| ideogram-2-turbo | $0.08–0.16 | high quality |
| seedance-2-mini | $0.15–0.40 | video, fast |
| veo-3.1 | $1.28 | video, premium |
| suno-v5 | $0.50–1.00 | music (30s) |
| elevenlabs-tts | $0.02–0.10 | voiceover |

**Sample budget for MVP:**
- 10 draft images: $0.20
- 3 final images: $0.48
- 1 video: $0.40
- Music: $0.75
- Voiceover (5 phrases): $0.25
- **Total: ~$2.10**

(Compare to Artlist: $15–25 for the same)

## Integration with Claude Code

Initialize Nullume in your Claude Code project:

```bash
nullume init

# MCP tools appear automatically in Claude:
# mcp__nullume__list_models
# mcp__nullume__generate
# mcp__nullume__estimate_cost
# etc.
```

The skill (`SKILL.md`) is copied to `.claude/skills/nullume/` and provides detailed instructions for AI agents.

## Set Up Custom Skill (optional)

If you want to modify the skill instructions for your project:

```bash
# After init, edit:
.claude/skills/nullume/SKILL.md
```

The skill controls how Claude's agents use Nullume tools.

## Connect CI (optional)

Enable GitHub Actions workflows for automated testing and catalog audits:

```bash
# Copy GitHub Actions workflows to your project
mkdir -p .github/workflows
cp node_modules/nullume/templates/github/*.yml .github/workflows/
# or from source:
# cp ~/Friday-claude/tools/nullume/templates/github/*.yml .github/workflows/
```

This runs typecheck, tests, and weekly model catalog audits.

## Common Issues

### Error: "fetch failed" or "403 Forbidden"

**Cause:** Network firewall or proxy blocking access to api.kie.ai

**Solution:**
1. Check your proxy: `echo $HTTPS_PROXY`
2. If you're behind a corporate firewall, contact your IT team
3. Try on a different network (personal WiFi, home connection)

### Model not found

**Solution:** Always search for models first:
```bash
nullume models list --category image --search text-to-image --json
# Copy the exact id from results
nullume models get <exact_id> --json
```

### Balance shows zero

Either:
1. You've used all credits
2. API key is wrong: `nullume setup --key sk_live_...`
3. API is unreachable

## Taste Library (Sprint 2)

Organize design references into style families with automatic clustering and description filling. Use approved styles for branded content generation via `--style <slug>`.

**Workflow:** Import references → Embed → Cluster → Propose (Claude) → Approve (Dashboard) → Generate with style

**Sources:** Eagle, Raindrop, Pinterest v5, Unsplash, Pexels, Pixabay, Are.na, Civitai, RSS, shot.cafe (clean); Pinterest cookies, Dribbble, X (local-only with gate).

```bash
nullume lib init
nullume lib import eagle --limit 50
nullume lib embed
nullume lib cluster
nullume lib propose
nullume lib dashboard
# Approve styles in browser, then:
nullume generate create flux-pro --prompt "..." --style editorial-warm-minimal --wait
```

See `.claude/agents/design/taste-curator.md` for curator methodology and `docs/decisions/ADR-007-reference-sources-policy.md` for source policies.

## File Locations

```
~/.nullume/
├── config.json            # API key & settings (private, never commit)
├── cache/                 # Model catalog cache (24h TTL)
├── jobs/                  # Generation history
├── downloads/             # Downloaded results
├── library/               # Taste library database (Sprint 2)
├── models/                # CLIP embeddings cache
└── sessions/              # Pinterest/Dribbble/X tokens (600)
```

## License

MIT © 2026 Hermes

Includes ideas from [VelsVisual](https://github.com/nick-vels/VelsVisual) (MIT © 2026 Nick Vels).

## Next Steps

- Read detailed instructions in your project: `.claude/skills/nullume/SKILL.md`
- Browse available models: `nullume models list --json | less`
- Join the community: GitHub Issues or Discussions
