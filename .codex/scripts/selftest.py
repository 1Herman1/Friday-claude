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
    assert source_agents, 'Source agent discovery returned zero files'
    assert source_agents <= native.keys(), 'Not all source roles were ported'
    assert len(native) == 46 and 'codex-docs' in native
    for name, role in native.items():
        assert role['name'] == name
        assert role['description'] and len(role['developer_instructions']) > 300
        assert 'model' not in role, 'Models should inherit, not use Claude model names'
        entry = config['agents'][name]
        assert (BASE / entry['config_file']).is_file()
        assert entry['description'] == role['description']
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
        assert (BASE / 'skills' / p.stem / 'SKILL.md').is_file()
    hooks = json.loads((BASE / 'hooks.json').read_text())['hooks']
    assert set(hooks) == {'SessionStart', 'PostToolUse', 'PreCompact', 'Stop', 'SessionEnd'}
    for event, entries in hooks.items():
        assert entries and entries[0]['hooks']
        for h in entries[0]['hooks']:
            assert '.codex/scripts/lifecycle.py' in h['command']
    assert len(config['mcp_servers']) == 3
    assert all(not m.get('required', False) for m in config['mcp_servers'].values())
    stale = []
    for item in manifest['files']:
        src = ROOT / item['source']
        assert (BASE / item['target']).is_file(), item['target']
        if src.exists() and hashlib.sha256(src.read_bytes()).hexdigest() != item['source_sha256']:
            stale.append(item['source'])
    assert not stale, 'Source files changed; review and sync: ' + ', '.join(stale)
    for p in (BASE / 'scripts').rglob('*.mjs'):
        result = subprocess.run(['node', '--check', str(p)], capture_output=True, text=True)
        assert result.returncode == 0, str(p) + ': ' + result.stderr
    for p in (BASE / 'scripts').rglob('*.py'):
        compile(p.read_text(), str(p), 'exec')
    print(f'PASS: {len(source_agents)} original roles + codex-docs; 22 skills; 5 lifecycle events; 3 MCP configs')
    print(f'PASS: {len(manifest["files"])} source mappings, source freshness, TOML/JSON and script syntax')


if __name__ == '__main__':
    check()
