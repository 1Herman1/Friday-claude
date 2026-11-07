#!/usr/bin/env python3
"""Codex lifecycle adapter. No network, package installation, transcript copy or Git writes."""
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
    return result.stdout.strip() if result.returncode == 0 else ''


def read(relative, limit=8000):
    path = ROOT / relative
    return path.read_text()[:limit] if path.is_file() else ''


def output_context(event, text):
    return {'hookSpecificOutput': {'hookEventName': event, 'additionalContext': text}}


def session_key(payload):
    # Never use a caller-supplied ID as a filesystem path.
    return hashlib.sha256(str(payload.get('session_id', 'local')).encode()).hexdigest()[:20]


def snapshot(payload):
    return {'head': git('rev-parse', 'HEAD'), 'branch': git('branch', '--show-current'),
            'files': [p for p in git('diff', '--name-only', '--diff-filter=ACMRT', 'HEAD').splitlines()
                      if p and not p.startswith('.codex/.runtime/')],
            'updated_at': datetime.now(timezone.utc).isoformat()}


def save_state(payload):
    path = ROOT / '.codex/.runtime' / (session_key(payload) + '.json')
    path.parent.mkdir(exist_ok=True)
    path.write_text(json.dumps(snapshot(payload), ensure_ascii=False, indent=2) + '\n')
    return path


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
        content = read(path, 6000)
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
    paths.update(git('diff', '--name-only', '--diff-filter=ACMRT', 'HEAD').splitlines())
    result = []
    for value in paths:
        path = Path(value)
        path = path.resolve() if path.is_absolute() else (ROOT / path).resolve()
        try:
            relative = path.relative_to(ROOT)
        except ValueError:
            continue
        if path.is_file() and relative.parts[0] == 'projects' and path.suffix in {'.tsx', '.jsx', '.css', '.html', '.astro'}:
            result.append((str(relative), hashlib.sha256(path.read_bytes()).hexdigest()))
    return sorted(result)


def post_edit(payload):
    cache_path = ROOT / '.codex/.runtime' / (session_key(payload) + '-lint.json')
    cache_path.parent.mkdir(exist_ok=True)
    cache = json.loads(cache_path.read_text()) if cache_path.exists() else {}
    reports = []
    for path, digest in changed_ui(payload):
        if cache.get(path) == digest:
            continue
        result = subprocess.run(['node', str(ROOT / '.codex/scripts/design-lint.mjs'), path],
                                cwd=ROOT, capture_output=True, text=True, timeout=8)
        cache[path] = digest
        report = result.stdout + result.stderr
        if result.returncode != 0 or 'Проблем не обнаружено' not in report:
            reports.append(path + ':\n' + report[:3000])
    cache_path.write_text(json.dumps(cache, ensure_ascii=False) + '\n')
    if reports:
        return output_context('PostToolUse', 'Результат design-lint; исправь применимые находки:\n' + '\n'.join(reports)[:7000])
    return {}


def archive(payload, flush=False):
    state = save_state(payload)
    if not flush:
        return {}
    data = json.loads(state.read_text())
    # Store only verified Git metadata, never assistant/user messages or tool arguments.
    if not data['files']:
        return {}
    folder = ROOT / '.codex/sessions'
    folder.mkdir(exist_ok=True)
    target = folder / (data['updated_at'][:10] + '--' + session_key(payload) + '.md')
    lines = ['---', 'status: raw', '---', '# Факты сессии Codex', '',
             'Обновлено (UTC): ' + data['updated_at'], 'Ветка: `' + data['branch'] + '`',
             'HEAD: `' + data['head'] + '`', '', 'Файлы с изменениями относительно HEAD:']
    lines.extend('- `' + p.replace('`', '') + '`' for p in data['files'])
    lines += ['', 'Результат, проверки, блокеры и следующий шаг дополняет агент по фактам задачи.',
              'Этот хук не запускал тесты и не создавал коммит.']
    target.write_text('\n'.join(lines) + '\n')
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
