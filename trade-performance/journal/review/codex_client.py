"""Journal inference via Codex CLI's existing ChatGPT subscription login.

No API-key fallback; use an isolated working directory and read-only sandbox.
"""
import json
import os
from pathlib import Path
import shutil
import subprocess
import tempfile
import time

MODEL = 'gpt-6.1-sol'
PROVIDER = 'openai-codex'


def call_codex(prompt, system, model=MODEL, images=(), timeout=900):
    start = time.monotonic()
    result = dict(ok=False, provider=PROVIDER, model=model, cost=None,
                  text='', error=None, ms=0)
    exe = shutil.which('codex')
    command = [exe] if exe else ['npx', '--offline', '--yes', '@openai/codex']
    # Do not forward exchange secrets or API keys loaded by the journal.
    env = {k: v for k, v in os.environ.items() if k in
           ('HOME', 'PATH', 'TMPDIR', 'LANG', 'LC_ALL', 'CODEX_HOME',
            'SYSTEMROOT', 'SSL_CERT_FILE', 'SSL_CERT_DIR')}
    scratch = Path.home() / '.hermes/cache/scratch'
    scratch.mkdir(parents=True, exist_ok=True)
    try:
        with tempfile.TemporaryDirectory(prefix='journal-codex-', dir=scratch) as work:
            args = command + ['exec', '--ignore-user-config', '--ephemeral',
                              '--skip-git-repo-check', '--sandbox', 'read-only',
                              '-C', work, '--model', model, '--json']
            for img in images:
                args += ['--image', str(img)]
            args += ['-']
            p = subprocess.run(args, input=system + '\n\n'
                               'Не используй инструменты, команды, сеть или файлы. '
                               'Анализируй только переданные данные и приложенные изображения.\n\n' + prompt,
                               capture_output=True, text=True, env=env,
                               cwd=work, timeout=timeout)
        done, messages, errors = False, [], []
        for line in p.stdout.splitlines():
            try:
                e = json.loads(line)
            except (ValueError, TypeError):
                continue
            if e.get('type') == 'item.completed' and e.get('item', {}).get('type') == 'agent_message':
                messages.append(e['item'].get('text', ''))
            if e.get('type') == 'turn.completed':
                done = True
                usage = e.get('usage') or {}
                result.update({'in': usage.get('input_tokens'),
                               'out': usage.get('output_tokens'),
                               'cache': usage.get('cached_input_tokens')})
            if e.get('type') in ('error', 'turn.failed'):
                errors.append(str(e.get('message') or e.get('error') or e))
        result['text'] = '\n\n'.join(messages).strip()
        result['ok'] = p.returncode == 0 and done and bool(result['text']) and not errors
        if not result['ok']:
            result['error'] = ('; '.join(errors) or p.stderr or
                               'Codex exited without a completed nonempty response')[-1600:]
    except (OSError, subprocess.TimeoutExpired) as exc:
        result['error'] = str(exc)
    result['ms'] = int((time.monotonic() - start) * 1000)
    return result
