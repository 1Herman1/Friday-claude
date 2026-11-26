"""Offline synthetic fixtures only; no visual research or provider calls."""
import copy
import importlib.util
import json
from pathlib import Path
import unittest

ROOT = Path(__file__).resolve().parents[2]
SCRIPT = ROOT / '.codex/scripts/validate_media_handoff.py'
TEMPLATE = ROOT / 'docs/core/templates/media-handoff.json'


class HandoffTests(unittest.TestCase):
    def validate(self, data, dry_run=True):
        self.assertTrue(SCRIPT.is_file(), 'validator is not implemented')
        spec = importlib.util.spec_from_file_location('handoff', SCRIPT)
        assert spec is not None and spec.loader is not None
        module = importlib.util.module_from_spec(spec)
        spec.loader.exec_module(module)
        return module.validate(data, dry_run=dry_run)

    def fixture(self):
        return copy.deepcopy(json.loads(TEMPLATE.read_text()))

    def test_positive_synthetic_dry_run(self):
        self.assertEqual(self.validate(self.fixture()), [])


    def test_null_sku_uses_verified_stable_identity(self):
        for field, value in (('product_id', 'fixture-product-id'), ('slug', 'fixture-product-slug')):
            with self.subTest(field=field):
                data = self.fixture()
                for ref in data['refs'][1:]:
                    ref.update(sku=None, **{field: value}, identity_verified=True,
                               identity_evidence='fixture://catalog-record')
                self.assertEqual(self.validate(data), [])
                data['refs'][2][field] = 'different-product'
                self.assertTrue(self.validate(data))
                data['refs'][2][field] = value
                data['refs'][1]['identity_verified'] = False
                self.assertTrue(self.validate(data))
                data['refs'][1]['identity_verified'] = True
                data['refs'][1]['identity_evidence'] = None
                self.assertTrue(self.validate(data))

    def test_null_sku_requires_matching_identifier_type_and_value(self):
        data = self.fixture()
        for ref in data['refs'][1:]:
            ref.update(sku=None, product_id=None, slug=None,
                       identity_verified=True, identity_evidence='fixture://catalog-record')
        self.assertTrue(self.validate(data))
        data['refs'][1]['product_id'] = 'fixture-123'
        data['refs'][2]['slug'] = 'fixture-123'
        self.assertTrue(self.validate(data))
        data['refs'][2]['product_id'] = 'fixture-123'
        self.assertEqual(self.validate(data), [])
        data['refs'][1]['sku'] = ''
        self.assertTrue(self.validate(data))

    def test_codex_config_loads_synchronized_design_roles(self):
        import tomllib
        base = ROOT / '.codex'
        config = tomllib.loads((base / 'config.toml').read_text())
        self.assertIn('.codex/CODEX.md', config['developer_instructions'])
        self.assertIn('docs/core/media-reference-handoff.md', config['developer_instructions'])
        for name in ('taste-curator', 'design-department', 'media-generator', 'brand-guard', 'design-reviewer'):
            with self.subTest(role=name):
                entry = config['agents'][name]
                native = tomllib.loads((base / entry['config_file']).read_text())
                body = (base / 'agents/design' / (name + '.md')).read_text().split('\n', 1)[1].strip()
                self.assertEqual(native['developer_instructions'].strip(), body)
                self.assertEqual(native['description'], entry['description'])
                self.assertIn('docs/core/media-reference-handoff.md', body)
                self.assertIn('Codex IDE', body)
                self.assertNotIn('через Artlist', body)
        for rel in ('docs/core/media-reference-handoff.md', 'docs/core/templates/media-handoff.json',
                    '.codex/scripts/validate_media_handoff.py', '.codex/skills/nullume/SKILL.md'):
            self.assertTrue((ROOT / rel).is_file(), rel)

    def test_required_roles_and_rights(self):
        for role in ('scene', 'product', 'label'):
            with self.subTest(missing=role):
                data = self.fixture()
                data['refs'] = [r for r in data['refs'] if r['role'] != role]
                self.assertTrue(self.validate(data))
        for field in ('ai_permission', 'ai_evidence', 'basis'):
            with self.subTest(missing=field):
                data = self.fixture()
                del data['refs'][0]['rights'][field]
                self.assertTrue(self.validate(data))

    def test_dropped_native_ref_and_transfer(self):
        data = self.fixture()
        data['generation']['native_call']['referenced_image_paths'].pop()
        self.assertTrue(self.validate(data))
        data = self.fixture()
        data['transfer']['ref_ids'].pop()
        self.assertTrue(self.validate(data))

    def test_fixture_cannot_pass_real_mode(self):
        self.assertTrue(self.validate(self.fixture(), dry_run=False))

    def test_reference_only_research_has_no_ai_transfer(self):
        data = self.fixture()
        data['stage'] = 'research'
        data['transfer'] = None
        data['generation'] = None
        for ref in data['refs']:
            ref['rights']['classification'] = 'reference-only'
            ref['rights']['ai_permission'] = False
            ref['rights']['ai_evidence'] = None
            ref['vision'] = {'loaded': False, 'evidence': None}
        self.assertEqual(self.validate(data), [])
        data['transfer'] = self.fixture()['transfer']
        self.assertTrue(self.validate(data))

    def test_gate_failures(self):
        cases = [
            ('vision', lambda d: d['refs'][0]['vision'].update(loaded=False)),
            ('duplicate role file', lambda d: d['refs'][1].update(original_path=d['refs'][0]['original_path'])),
            ('label SKU mismatch', lambda d: d['refs'][2].update(sku='other')),
            ('unknown rights', lambda d: d['refs'][0]['rights'].update(ai_permission=False)),
            ('production', lambda d: d['publication'].update(approved=True)),
            ('no pilot approval', lambda d: d['generation'].update(owner_approval=None)),
            ('batch', lambda d: d['generation'].update(pilot_only=False)),
            ('missing mobile', lambda d: d['layout'].pop('mobile')),
            ('missing rejection', lambda d: d['comparison'].update(rejections=[])),
            ('missing scene', lambda d: d.pop('scene')),
            ('missing original', lambda d: d['refs'][0].pop('original_path')),
            ('invalid role type', lambda d: d['refs'][0].update(role=[])),
        ]
        for name, mutate in cases:
            with self.subTest(name=name):
                data = self.fixture()
                mutate(data)
                self.assertTrue(self.validate(data))

    def test_ready_before_native_call(self):
        data = self.fixture()
        data['stage'] = 'ready'
        data['generation']['native_call'] = None
        self.assertEqual(self.validate(data), [])

    def test_cli_fixture_requires_explicit_dry_run(self):
        import subprocess
        import sys
        for flags, status in ((['--dry-run'], 0), ([], 1)):
            result = subprocess.run([sys.executable, str(SCRIPT), str(TEMPLATE), *flags], capture_output=True, text=True)
            self.assertEqual(result.returncode, status)
            self.assertFalse(json.loads(result.stdout)['generation_executed'])

    def test_invalid_structure(self):
        for data in ([], {}, None, {'refs': 'not a list'}):
            with self.subTest(data=data):
                self.assertTrue(self.validate(data))


if __name__ == '__main__':
    unittest.main()
