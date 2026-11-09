#!/usr/bin/env python3
"""Offline checks for Codex migration coverage, native role config and hook wiring."""
import hashlib
import json
import re
import subprocess
import sys
import tomllib
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
BASE = ROOT / '.codex'


def check():
    config = tomllib.loads((BASE / 'config.toml').read_text())
    manifest = json.loads((BASE / 'migration-manifest.json').read_text())
    source_agents = {p.stem for p in (ROOT / '.claude/agents').rglob('*.md') if p.name != 'README.md'}
    native = {p.stem: tomllib.loads(p.read_text()) for p in (BASE / 'agents').glob('*.toml')}
    if not source_agents:
        print('WARNING: No Claude source roles found; native Codex roles are checked independently.', file=sys.stderr)
    missing_roles = source_agents - native.keys()
    if missing_roles:
        print('WARNING: New Claude roles need adaptation: ' + ', '.join(sorted(missing_roles)), file=sys.stderr)
    assert len(native) == 46 and 'codex-docs' in native
    for name, role in native.items():
        assert role['name'] == name
        assert role['description'] and len(role['developer_instructions']) > 300
        assert 'model' not in role, 'Models should inherit, not use Claude model names'
        entry = config['agents'][name]
        assert (BASE / entry['config_file']).is_file()
        assert entry['description'] == role['description']
        markdown = list((BASE / 'agents').rglob(name + '.md'))
        assert len(markdown) == 1, 'Expected one Markdown prompt for ' + name
        body = markdown[0].read_text().split('\n', 1)[1].strip()
        assert role['developer_instructions'].strip() == body, 'Native prompt drift: ' + name + '; run python3 .codex/scripts/sync-roles.py --apply'
    assert config['agents']['enabled'] is True and config['agents']['max_depth'] == 3
    assert '.codex/CODEX.md' in config['developer_instructions']
    assert 'Гермес' in config['developer_instructions']
    skills = list((BASE / 'skills').glob('*/SKILL.md'))
    assert len(skills) == 22
    plugin = json.loads((BASE / '.codex-plugin/plugin.json').read_text())
    marketplace = json.loads((BASE / '.agents/plugins/marketplace.json').read_text())
    assert plugin['name'] == 'friday-workflows' and plugin['skills'] == './skills/'
    assert marketplace['name'] == 'friday-local'
    assert marketplace['plugins'][0]['source']['path'] == './'
    assert config['plugins']['friday-workflows@friday-local']['enabled'] is True
    for p in (ROOT / '.claude/commands').glob('*.md'):
        if not (BASE / 'skills' / p.stem / 'SKILL.md').is_file():
            print('WARNING: New Claude command needs adaptation: ' + p.stem, file=sys.stderr)
    hooks = json.loads((BASE / 'hooks.json').read_text())['hooks']
    assert set(hooks) == {'SessionStart', 'PostToolUse', 'PreCompact', 'Stop', 'SessionEnd'}
    for event, entries in hooks.items():
        assert entries and entries[0]['hooks']
        for entry in entries:
            for h in entry['hooks']:
                assert any('.codex/scripts/' + name in h['command']
                           for name in ['lifecycle.py', 'task_gate.py'])
    for event in ['SessionStart', 'Stop']:
        assert any('task_gate.py' in h['command'] for entry in hooks[event] for h in entry['hooks'])
    assert len(config['mcp_servers']) == 3
    assert all(not m.get('required', False) for m in config['mcp_servers'].values())
    stale = []
    for item in manifest['files']:
        src = ROOT / item['source']
        assert (BASE / item['target']).is_file(), item['target']
        if not src.exists() or hashlib.sha256(src.read_bytes()).hexdigest() != item['source_sha256']:
            stale.append(item['source'])
    if stale:
        print('WARNING: Source files changed; review and sync: ' + ', '.join(stale), file=sys.stderr)
    for p in (BASE / 'scripts').rglob('*.mjs'):
        result = subprocess.run(['node', '--check', str(p)], capture_output=True, text=True)
        assert result.returncode == 0, str(p) + ': ' + result.stderr
    for p in (BASE / 'scripts').rglob('*.py'):
        compile(p.read_text(), str(p), 'exec')
    print(f'PASS: {len(source_agents)} original roles + codex-docs; 22 skills; 5 lifecycle events; 3 MCP configs')
    print(f'PASS: {len(manifest["files"])} source mappings, source freshness reviewed, native prompt sync, TOML/JSON and script syntax')


if __name__ == '__main__':
    check()
