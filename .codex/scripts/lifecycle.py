#!/usr/bin/env python3
"""Codex lifecycle adapter. No network, package installation, transcript copy or Git writes."""
import fcntl
import os
import tempfile
import time
from contextlib import contextmanager
import hashlib
import json
import re
import subprocess
import sys
from datetime import datetime, timezone
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]


def git(*args):
    result = subprocess.run(['git', '-C', str(ROOT), *args], capture_output=True,
                            text=True, timeout=5)
    return (result.stdout if '-z' in args else result.stdout.strip()) if result.returncode == 0 else ''


def read(relative, limit=None):
    path = ROOT / relative
    return path.read_text()[:limit] if path.is_file() else ''


def output_context(event, text):
    return {'hookSpecificOutput': {'hookEventName': event, 'additionalContext': text}}


def session_key(payload):
    # Never use a caller-supplied ID as a filesystem path.
    return hashlib.sha256(str(payload.get('session_id', 'local')).encode()).hexdigest()[:20]


def changed_files():
    # Include tracked deletions and shell-created files, wherever they live in the repo.
    paths = set(git('diff', '--cached', '--name-only', '-z').split('\0'))
    paths.update(git('diff', '--name-only', '-z').split('\0'))
    paths.update(git('ls-files', '--others', '--exclude-standard', '-z').split('\0'))
    return sorted(p for p in paths if p and not p.startswith('.codex/.runtime/'))


def snapshot(payload):
    return {'head': git('rev-parse', 'HEAD'), 'branch': git('branch', '--show-current'),
            'files': changed_files(), 'updated_at': datetime.now(timezone.utc).isoformat()}


def atomic_write(path, text):
    path.parent.mkdir(parents=True, exist_ok=True)
    fd, temporary = tempfile.mkstemp(dir=path.parent, prefix='.' + path.name)
    try:
        with os.fdopen(fd, 'w') as stream:
            stream.write(text)
        os.replace(temporary, path)
    finally:
        if os.path.exists(temporary):
            os.unlink(temporary)


@contextmanager
def session_lock(payload):
    folder = ROOT / '.codex/.runtime'
    folder.mkdir(parents=True, exist_ok=True)
    with (folder / (session_key(payload) + '.lock')).open('a') as stream:
        fcntl.flock(stream, fcntl.LOCK_EX)
        yield


def _save_state(payload):
    path = ROOT / '.codex/.runtime' / (session_key(payload) + '.json')
    previous = json.loads(path.read_text()) if path.exists() else {}
    current = snapshot(payload)
    baseline = previous['start_head'] if 'start_head' in previous else current.get('head', '')
    files = set(previous.get('files', [])) | set(current.get('files', []))
    # Recover committed work even when the intermediate edit hook was not called.
    if current.get('head') and current.get('head') != baseline:
        compare = baseline or git('hash-object', '-t', 'tree', '/dev/null')
        files.update(git('diff', '--name-only', '-z', compare, 'HEAD').split('\0'))
    current['start_head'] = baseline
    current['files'] = sorted(p for p in files if p and not p.startswith('.codex/.runtime/'))
    current['commits'] = git('log', '--format=%H %s', baseline + '..HEAD' if baseline else 'HEAD').splitlines() if current.get('head') else []
    atomic_write(path, json.dumps(current, ensure_ascii=False, indent=2) + '\n')
    return path


def save_state(payload):
    with session_lock(payload):
        return _save_state(payload)


def startup(payload):
    registry = read('docs/projects/README.md')
    match = re.search(r'Рабочая ветка:\s*`([^`]+)`', registry)
    expected = match.group(1) if match else '(проверь реестр)'
    current = git('branch', '--show-current') or '(не определена)'
    active = read('docs/projects/.active', 100).strip()
    # The config instruction makes reading CODEX.md mandatory; the hook adds current context.
    text = ('Friday / Codex. Пользователь — только Гермес.\n'
            'Полностью прочитай .codex/CODEX.md перед работой.\n'
            'Специалисты: .codex/agents/*.toml; автоматически выбирай подходящих.\n'
            f'Рабочая ветка: {expected}; текущая: {current}; активный проект: {active or "не задан"}.\n')
    if current != expected:
        text += 'Перед правками проверь ветку и незавершённую работу; хук ничего не переключал.\n'
    for label, path in [('Память Codex', '.codex/context.md'),
                        ('История Friday (только чтение)', 'docs/archive/CONTEXT.md')]:
        content = read(path)
        if content:
            text += '\n' + label + ':\n' + content + '\n'
    state = save_state(payload)
    return output_context(payload.get('hook_event_name', 'SessionStart'), text)


def changed_ui(payload):
    paths = set()
    tool_input = payload.get('tool_input', {})
    if isinstance(tool_input, dict):
        value = tool_input.get('file_path') or tool_input.get('path')
        if isinstance(value, str):
            paths.add(value)
        patch = tool_input.get('patch') or tool_input.get('input') or ''
    else:
        patch = tool_input if isinstance(tool_input, str) else ''
    paths.update(re.findall(r'^\*\*\* (?:Add|Update) File: (.+)$', patch, re.M))
    paths.update(changed_files())
    result = []
    for value in paths:
        path = Path(value)
        path = path.resolve() if path.is_absolute() else (ROOT / path).resolve()
        try:
            relative = path.relative_to(ROOT)
        except ValueError:
            continue
        if path.is_file() and not any(part in {'node_modules', '.git', '.runtime'} for part in relative.parts) and path.suffix in {'.tsx', '.jsx', '.css', '.html', '.astro'}:
            result.append((str(relative), hashlib.sha256(path.read_bytes()).hexdigest()))
    return sorted(result)


def post_edit(payload):
    with session_lock(payload):
        _save_state(payload)
        cache_path = ROOT / '.codex/.runtime' / (session_key(payload) + '-lint.json')
        cache = json.loads(cache_path.read_text()) if cache_path.exists() else {}
        reports = []
        deadline = time.monotonic() + 9
        for path, digest in changed_ui(payload):
            if cache.get(path) == digest:
                continue
            remaining = deadline - time.monotonic()
            if remaining < 0.2:
                reports.append('Часть файлов ожидает design-lint на следующем вызове инструмента.')
                break
            try:
                result = subprocess.run(['node', str(ROOT / '.codex/scripts/design-lint.mjs'), path],
                                        cwd=ROOT, capture_output=True, text=True, timeout=min(3, remaining))
            except subprocess.TimeoutExpired:
                reports.append(path + ': design-lint timeout; проверка будет повторена.')
                continue
            report = result.stdout + result.stderr
            if result.returncode == 0:
                cache[path] = digest
            if result.returncode != 0 or 'Проблем не обнаружено' not in report:
                reports.append(path + ':\n' + report[:3000])
        atomic_write(cache_path, json.dumps(cache, ensure_ascii=False) + '\n')
        if reports:
            return output_context('PostToolUse', 'Результат design-lint; исправь применимые находки:\n' + '\n'.join(reports)[:7000])
        return {}


def archive(payload, flush=False):
    with session_lock(payload):
        state = _save_state(payload)
        if not flush:
            return {}
        data = json.loads(state.read_text())
        if not data['files'] and not data.get('commits'):
            return {}
        folder = ROOT / '.codex/sessions'
        target = folder / (data['updated_at'][:10] + '--' + session_key(payload) + '.md')
        begin, end = '<!-- codex-git-facts:start -->', '<!-- codex-git-facts:end -->'
        lines = [begin, '## Проверенные Git-факты', '',
                 'Обновлено (UTC): ' + data['updated_at'], 'Ветка: `' + data['branch'] + '`',
                 'HEAD: `' + data['head'] + '`', '', 'Файлы, замеченные за сессию (включая удаления):']
        lines.extend('- `' + p.replace('`', '').replace('\n', '\\n').replace('\r', '\\r') + '`' for p in data['files'])
        lines += ['', 'Коммиты после начала наблюдения:']
        lines.extend('- ' + commit for commit in data.get('commits', []))
        lines += ['', 'Этот хук не запускал тесты и не создавал коммит.', end]
        block = '\n'.join(lines)
        if target.exists():
            text = target.read_text()
            if begin in text and end in text:
                before, tail = text.split(begin, 1)
                _, after = tail.split(end, 1)
                text = before + block + after
            else:
                text += '\n' + block + '\n'
            # New facts should be digested again; preserve all agent-authored explanations.
            text = text.replace('status: digested', 'status: raw', 1)
        else:
            text = ('---\nstatus: raw\n---\n# Факты сессии Codex\n\n' + block +
                    '\n\nРезультат, проверки, блокеры и следующий шаг дополняет агент по фактам задачи.\n')
        atomic_write(target, text)
        return {}


def main():
    try:
        payload = json.load(sys.stdin)
    except (ValueError, OSError):
        payload = {}
    action = sys.argv[1] if len(sys.argv) > 1 else 'startup'
    try:
        if action == 'startup':
            result = startup(payload)
        elif action == 'post-edit':
            result = post_edit(payload)
        elif action in {'stop', 'archive'}:
            result = archive(payload, flush=action == 'archive')
        else:
            raise ValueError('Unknown lifecycle action: ' + action)
    except (OSError, ValueError, subprocess.SubprocessError) as exc:
        # Make failures visible without exposing arguments, tokens or a transcript.
        result = {'systemMessage': 'Codex hook ' + action + ' failed: ' + type(exc).__name__}
    print(json.dumps(result, ensure_ascii=False))


if __name__ == '__main__':
    main()
