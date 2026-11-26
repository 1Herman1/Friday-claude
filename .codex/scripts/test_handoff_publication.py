"""Offline publication closure, not provider/vision/rights or IDE acceptance."""
import ast
import copy
import json
import os
from pathlib import Path
import shutil
import subprocess
import sys
import tempfile
import unittest

ROOT = Path(__file__).resolve().parents[2]
CONTRACT = 'docs/core/media-reference-handoff.md'
TEMPLATE = 'docs/core/templates/media-handoff.json'
VALIDATOR = '.codex/scripts/validate_media_handoff.py'
DEPENDENCIES = (CONTRACT, TEMPLATE, VALIDATOR, '.codex/scripts/test_media_handoff.py')


class HandoffPublicationTests(unittest.TestCase):
    def require_files(self, *paths):
        for relative in paths:
            self.assertTrue((ROOT / relative).is_file(),
                            'mandatory published dependency missing: ' + relative)

    def test_mandatory_consumers_resolve_contract(self):
        for relative in ('.codex/CODEX.md', '.codex/agents/design/taste-curator.md',
                         'docs/core/design-surface-workflow.md'):
            text = (ROOT / relative).read_text()
            self.assertIn('reference-handoff', text, relative)
        self.require_files(*DEPENDENCIES)
        policy = (ROOT / CONTRACT).read_text()
        for relative in (TEMPLATE, VALIDATOR, '.codex/config.toml'):
            self.assertIn(relative, policy)
            self.require_files(relative)
        self.require_files('.codex/skills/nullume/SKILL.md')

    def test_media_selector_metadata_matches_conditional_execution_route(self):
        import tomllib
        config = tomllib.loads((ROOT / '.codex/config.toml').read_text())
        description = config['agents']['media-generator']['description']
        native_path = config['agents']['media-generator']['config_file']
        native = tomllib.loads((ROOT / '.codex' / native_path).read_text())
        self.assertEqual(native['description'], description)
        self.assertNotIn('через Artlist', description,
                         'Selector metadata must not advertise the historical provider as the current route')

    def test_validator_and_adopted_tests_have_stdlib_import_closure(self):
        self.require_files(VALIDATOR, '.codex/scripts/test_media_handoff.py')
        for relative in (VALIDATOR, '.codex/scripts/test_media_handoff.py'):
            tree = ast.parse((ROOT / relative).read_text())
            for node in ast.walk(tree):
                if isinstance(node, ast.Import):
                    names = [alias.name for alias in node.names]
                elif isinstance(node, ast.ImportFrom):
                    self.assertEqual(node.level, 0, relative)
                    names = [node.module or '']
                else:
                    continue
                for name in names:
                    self.assertIn(name.split('.')[0], sys.stdlib_module_names, relative)

    def run_fixture(self, *, dry_run, mutate=None):
        self.require_files(VALIDATOR, TEMPLATE)
        data = copy.deepcopy(json.loads((ROOT / TEMPLATE).read_text()))
        if mutate:
            mutate(data)
        with tempfile.TemporaryDirectory(prefix='handoff-publication-') as folder:
            scratch = Path(folder)
            script = scratch / 'validate_media_handoff.py'
            shutil.copyfile(ROOT / VALIDATOR, script)
            manifest = scratch / 'handoff.json'
            # Keep even the fixture=False negative probe inside this disposable tree.
            encoded = json.dumps(data).replace('/fixture/', str(scratch / 'missing') + '/')
            manifest.write_text(encoded)
            # -I plus a disposable cwd prevents worktree/PYTHONPATH dependency leakage.
            result = subprocess.run(
                [sys.executable, '-I', str(script), str(manifest),
                 *(['--dry-run'] if dry_run else [])],
                cwd=scratch, env={**os.environ, 'PYTHONDONTWRITEBYTECODE': '1'},
                capture_output=True, text=True, timeout=30)
        self.assertEqual(result.stderr, '')
        payload = json.loads(result.stdout)
        self.assertIs(payload['generation_executed'], False)
        return result.returncode, payload

    def test_published_template_dry_run_is_offline_and_valid(self):
        status, payload = self.run_fixture(dry_run=True)
        self.assertEqual((status, payload['valid'], payload['errors']), (0, True, []))

    def test_synthetic_template_is_rejected_as_real_handoff(self):
        status, payload = self.run_fixture(dry_run=False)
        self.assertEqual(status, 1)
        self.assertIs(payload['valid'], False)
        self.assertIn('synthetic fixture requires --dry-run', payload['errors'])

    def test_fixture_false_cannot_bypass_real_checks_even_with_dry_run(self):
        status, payload = self.run_fixture(
            dry_run=True, mutate=lambda data: data.update(fixture=False))
        self.assertEqual(status, 1)
        self.assertIs(payload['valid'], False)
        self.assertIn('scene-01: synthetic provenance in real manifest', payload['errors'])
        self.assertIn('scene-01: missing absolute original_path', payload['errors'])

    def test_offline_fixture_still_enforces_rights_pilot_and_publication_gates(self):
        cases = (
            ('scene-01: no clear AI permission',
             lambda data: data['refs'][0]['rights'].update(ai_permission=False)),
            ('pilot owner/budget approval required',
             lambda data: data['generation'].update(owner_approval=None)),
            ('one pilot before scaling',
             lambda data: data['generation'].update(pilot_only=False)),
            ('production requires native verification and owner approval',
             lambda data: data['publication'].update(approved=True)),
        )
        for error, mutate in cases:
            with self.subTest(error=error):
                status, payload = self.run_fixture(dry_run=True, mutate=mutate)
                self.assertEqual(status, 1)
                self.assertIs(payload['valid'], False)
                self.assertIn(error, payload['errors'])


if __name__ == '__main__':
    unittest.main()
