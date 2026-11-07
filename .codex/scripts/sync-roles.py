#!/usr/bin/env python3
"""Sync native role prompts after editing their Markdown. No Claude files are written."""
import json
import sys
import tomllib
from pathlib import Path

base = Path(__file__).resolve().parents[1]
apply = '--apply' in sys.argv
changed = []
for native in sorted((base / 'agents').glob('*.toml')):
    role = tomllib.loads(native.read_text())
    matches = [p for p in (base / 'agents').rglob(role['name'] + '.md') if p.name != 'README.md']
    if len(matches) != 1:
        raise SystemExit('Expected exactly one Markdown role: ' + role['name'])
    body = matches[0].read_text().split('\n', 1)[1].strip()
    if role['developer_instructions'].strip() == body:
        continue
    changed.append(role['name'])
    if apply:
        native.write_text('name = ' + json.dumps(role['name'], ensure_ascii=False) + '\n' +
                          'description = ' + json.dumps(role['description'], ensure_ascii=False) + '\n' +
                          'developer_instructions = ' + json.dumps(body, ensure_ascii=False) + '\n')
print(('Updated: ' if apply else 'Drift: ') + (', '.join(changed) or 'none'))
raise SystemExit(0 if apply or not changed else 1)
