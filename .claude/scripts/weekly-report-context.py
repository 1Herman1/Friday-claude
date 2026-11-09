#!/usr/bin/env python3
"""Read-only, deterministic evidence bundle for the weekly studio report."""
import json
from pathlib import Path
import subprocess

ROOT = Path(__file__).resolve().parents[2]

def git(*args):
    result = subprocess.run(['git', '-C', str(ROOT), *args], capture_output=True, text=True, timeout=30)
    if result.returncode:
        return 'ERROR: ' + result.stderr.strip()
    return result.stdout.strip()

def main():
    print('# Weekly evidence (local checkout, no pull/rebase, last 7 days)')
    print('## Checkout\n' + git('status', '-sb'))
    raw = git('log', '--since=7 days ago', '--format=%H')
    commits = raw.splitlines() if raw and not raw.startswith('ERROR:') else []
    print(f'## Commit count: {len(commits)}')
    print('## Changes\n' + git('log', '--since=7 days ago', '--date=iso-strict', '--format=%h | %ad | %an | %s', '--name-only'))
    for rel in ['STATUS.md', 'docs/archive/CONTEXT.md', 'docs/projects/README.md']:
        path = ROOT / rel
        print(f'## {rel}\n' + (path.read_text() if path.exists() else 'MISSING'))
    print('## Project-specific status files (discover, do not assume fixed roster)')
    for path in sorted((ROOT / 'docs/projects').glob('*/status.md')):
        print(str(path.relative_to(ROOT)))
    home = Path.home() / '.hermes'
    import os
    home = Path(os.environ.get('HERMES_HOME') or home)
    try:
        data = json.loads((home / 'cron/jobs.json').read_text())
        jobs = data if isinstance(data, list) else data.get('jobs', [])
        if isinstance(jobs, dict):
            jobs = list(jobs.values())
        print('## Scheduled jobs (allowlisted fields only)')
        for job in jobs:
            print(json.dumps({key: job.get(key) for key in ['id', 'name', 'enabled', 'model', 'provider', 'no_agent', 'last_run_at', 'last_status', 'next_run_at']}, ensure_ascii=False))
    except (OSError, ValueError, TypeError) as exc:
        print('Cron status unavailable: ' + type(exc).__name__)
    print('## Limits\nA commit is not proof of deployment. Cron ok may mean monitor skipped LLM. No agent heartbeat means current activity is unknown. Stale STATUS is not proof of a paused project.')

if __name__ == '__main__':
    main()
