"""Offline standalone regressions for the private client pilot (stdlib only)."""
import importlib.util
import os
import sys
import shutil
import json
from hashlib import sha256
from pathlib import Path
import re
import subprocess
import tempfile
import unittest
from unittest.mock import patch

ROOT = Path(__file__).resolve().parents[2]
RECIPE = ROOT / 'docs/research/design-agent-upgrade/rollout/client-pilot-stroymat/recipe.py'
SOURCE = 'projects/stroymat/obnovlenie-assortimenta.html'


class ClientPilotTests(unittest.TestCase):
    def setUp(self):
        self.assertTrue(RECIPE.is_file(), 'private recipe is not implemented')
        spec = importlib.util.spec_from_file_location('client_pilot_recipe', RECIPE)
        assert spec is not None and spec.loader is not None
        self.recipe = importlib.util.module_from_spec(spec)
        spec.loader.exec_module(self.recipe)
        self.baseline = self.recipe.source_bytes(SOURCE).decode()

    def test_render_checks_entire_original_source_before_generation(self):
        with tempfile.TemporaryDirectory() as temp:
            temp = Path(temp).resolve()
            shutil.copytree(ROOT / 'projects/stroymat', temp / 'projects/stroymat')
            media = temp / 'projects/stroymat/assets/hero.jpg'
            media.write_bytes(media.read_bytes() + b'changed')
            with patch.object(self.recipe, 'ROOT', temp), self.assertRaises(ValueError):
                self.recipe.render(self.baseline, 'A')

    def test_source_lock_tampering_and_traversal_fail_closed(self):
        with tempfile.TemporaryDirectory() as temp:
            temp = Path(temp).resolve()
            lock = json.loads(RECIPE.with_name('source-lock.json').read_bytes())
            lock['files']['../outside'] = next(iter(lock['files'].values()))
            payload = json.dumps(lock).encode()
            (temp / 'source-lock.json').write_bytes(payload)
            with patch.object(self.recipe, '__file__', str(temp / 'recipe.py')):
                with self.assertRaisesRegex(ValueError, 'lock hash'):
                    self.recipe.checked_sources()
                with patch.object(self.recipe, 'LOCK_SHA', sha256(payload).hexdigest()):
                    with self.assertRaisesRegex(ValueError, 'Unsafe source path'):
                        self.recipe.checked_sources()

    def test_changed_missing_extra_and_symlink_source_fail_closed(self):
        with tempfile.TemporaryDirectory() as temp:
            temp = Path(temp).resolve()
            shutil.copytree(ROOT / 'projects/stroymat', temp / 'projects/stroymat')
            source = temp / SOURCE
            original = source.read_bytes()
            for kind in ('hash', 'missing', 'extra', 'symlink'):
                with self.subTest(kind=kind):
                    extra = source.with_name('remote.js')
                    if kind == 'hash': source.write_bytes(original + b'changed')
                    if kind == 'missing': source.unlink()
                    if kind == 'extra': extra.write_text('https://example.invalid/remote.js')
                    if kind == 'symlink':
                        source.unlink()
                        source.symlink_to(ROOT / SOURCE)
                    with self.assertRaises(ValueError):
                        self.recipe.checked_sources(temp)
                    if extra.exists(): extra.unlink()
                    if source.is_symlink(): source.unlink()
                    source.write_bytes(original)

    def test_output_symlink_and_existing_paths_fail_closed(self):
        with tempfile.TemporaryDirectory() as temp:
            temp = Path(temp).resolve()
            link = temp / 'link'
            link.symlink_to(temp, target_is_directory=True)
            with self.assertRaisesRegex(ValueError, 'Symlink output'):
                self.recipe.generate(link / 'new')
            with self.assertRaises(ValueError):
                self.recipe.generate(temp)
            with self.assertRaises(ValueError):
                self.recipe.source_bytes('../outside')

    def test_source_content_media_identity(self):
        original = self.recipe.inventory(self.baseline)
        self.assertEqual(len(original['cards']), 8)
        for variant in ('A', 'B'):
            result = self.recipe.render(self.baseline, variant)
            self.assertEqual(self.recipe.inventory(result), original)
            self.assertEqual(re.findall(r'data:[^\s"\)]+', result), re.findall(r'data:[^\s"\)]+', self.baseline))
            self.assertIn('data-pilot="' + variant + '"', result)
            self.assertIn('font-variant-numeric:tabular-nums', result)
            for token in ('#F7F5F2', '#16181C', '#C08B45', '#8A5A22', '#101215', 'Manrope', 'Golos Text'):
                self.assertIn(token, result)
            self.assertNotRegex(result, r'(?:https?:)?//[^\s<]+(?:\.js|\.css)')
        self.assertNotEqual(self.recipe.render(self.baseline, 'A'), self.recipe.render(self.baseline, 'B'))

    def test_negative_inputs_fail_closed(self):
        with self.assertRaises(ValueError):
            self.recipe.render(self.baseline, 'C')
        with self.assertRaises(ValueError):
            self.recipe.render(self.baseline.replace('1250 × 2500', 'FAKE'), 'A')
        with self.assertRaises(ValueError):
            self.recipe.render(self.baseline.replace('</head>', '<script src="https://example.invalid/a.js"></script></head>'), 'B')

    def test_all_original_prose_is_accounted_for(self):
        changed = self.baseline.replace('Наличие и сроки уточняйте при запросе.', 'Наличие гарантировано.')
        self.assertNotEqual(self.recipe.inventory(changed), self.recipe.inventory(self.baseline))

    def test_css_rejects_remote_media_and_identity_drift(self):
        css = RECIPE.with_name('layouts.css').read_text()
        self.recipe.validate_css(css)
        for bad in ('body[data-pilot]{background:url(https://example.invalid/image.jpg)}',
                    'body[data-pilot]{color:#FF0000}', '@font-face{font-family:Other}',
                    'body{font-family:Other}', 'body[data-pilot]{display:none}'):
            with self.subTest(css=bad), self.assertRaises(ValueError):
                self.recipe.validate_css(bad)

    def test_output_cannot_touch_repository_or_baseline(self):
        with self.assertRaises(ValueError):
            self.recipe.generate(ROOT / 'projects/stroymat')
        with tempfile.TemporaryDirectory() as temp:
            with self.assertRaises(ValueError):
                self.recipe.generate(Path(temp))
        self.assertEqual(self.baseline.encode(), self.recipe.source_bytes(SOURCE))


class ArchiveIsolationTests(unittest.TestCase):
    def test_gitless_archive_and_poisoned_disposable_canary(self):
        with tempfile.TemporaryDirectory() as temp:
            temp = Path(temp).resolve()
            archive = temp / 'archive'
            pilot = RECIPE.relative_to(ROOT).parent
            for rel in [Path('.codex/scripts/test_client_design_pilot.py'),
                        *[p.relative_to(ROOT) for p in RECIPE.parent.iterdir() if p.is_file()],
                        *[p.relative_to(ROOT) for p in (ROOT / 'projects/stroymat').rglob('*') if p.is_file()]]:
                target = archive / rel
                target.parent.mkdir(parents=True, exist_ok=True)
                shutil.copy2(ROOT / rel, target)
            self.assertFalse((archive / '.git').exists())
            canary = temp / 'canary'
            metadata = canary / '.git'
            (metadata / 'objects').mkdir(parents=True)
            (metadata / 'refs/heads').mkdir(parents=True)
            (metadata / 'HEAD').write_text('ref: refs/heads/canary\n')
            (metadata / 'config').write_text('[core]\nrepositoryformatversion = 0\nbare = false\n')
            before = {str(p.relative_to(canary)): p.read_bytes() for p in canary.rglob('*') if p.is_file()}
            clean = {k:v for k,v in os.environ.items() if not k.startswith('GIT_') and k not in ('PYTHONPATH', 'NODE_PATH')}
            for poisoned in (False, True):
                child = dict(clean)
                if poisoned:
                    child.update(GIT_DIR=str(metadata), GIT_WORK_TREE=str(canary), GIT_INDEX_FILE=str(metadata / 'index'))
                output = temp / ('poisoned' if poisoned else 'clean')
                result = subprocess.run([sys.executable, str(archive / pilot / 'recipe.py'), str(output)], env=child, cwd=archive, capture_output=True, text=True)
                self.assertEqual(result.returncode, 0, result.stderr)
                tests = subprocess.run([sys.executable, str(archive / '.codex/scripts/test_client_design_pilot.py'), 'ClientPilotTests', '-v'], env=child, cwd=archive, capture_output=True, text=True)
                self.assertEqual(tests.returncode, 0, tests.stderr)
            self.assertEqual(before, {str(p.relative_to(canary)): p.read_bytes() for p in canary.rglob('*') if p.is_file()})


if __name__ == '__main__':
    unittest.main()
