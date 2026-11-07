import importlib.util
import json
from pathlib import Path
import tempfile
import unittest
from unittest.mock import patch

spec = importlib.util.spec_from_file_location('lifecycle', Path(__file__).with_name('lifecycle.py'))
mod = importlib.util.module_from_spec(spec)
spec.loader.exec_module(mod)


class LifecycleTests(unittest.TestCase):
    def setUp(self):
        self.tmp = tempfile.TemporaryDirectory()
        self.root = Path(self.tmp.name)
        (self.root / '.codex').mkdir()
        (self.root / 'docs/projects').mkdir(parents=True)
        (self.root / 'docs/projects/README.md').write_text('**Рабочая ветка: `working`.**')
        (self.root / 'docs/projects/.active').write_text('test')
        self.root_patch = patch.object(mod, 'ROOT', self.root)
        self.root_patch.start()
        self.git_patch = patch.object(mod, 'git', side_effect=self.fake_git)
        self.git_patch.start()

    def tearDown(self):
        self.git_patch.stop()
        self.root_patch.stop()
        self.tmp.cleanup()

    def fake_git(self, *args):
        if args[0] == 'branch':
            return 'working'
        if args[0] == 'rev-parse':
            return 'a' * 40
        return 'projects/test/src/page.tsx'

    def test_startup_loads_context_and_name(self):
        (self.root / '.codex/context.md').write_text('remember this decision')
        out = mod.startup({'session_id': 'test'})
        text = out['hookSpecificOutput']['additionalContext']
        self.assertIn('Гермес', text)
        self.assertIn('remember this decision', text)
        self.assertIn('working', text)

    def test_archive_never_copies_messages_or_secrets(self):
        mod.archive({'session_id': 'test', 'last_assistant_message': 'SECRET-DO-NOT-COPY',
                     'tool_input': {'command': 'API_KEY=SECRET'}}, flush=True)
        files = list((self.root / '.codex/sessions').glob('*.md'))
        self.assertEqual(len(files), 1)
        text = files[0].read_text()
        self.assertIn('projects/test/src/page.tsx', text)
        self.assertNotIn('SECRET', text)
        self.assertNotIn('API_KEY', text)

    def test_session_id_cannot_escape_runtime_folder(self):
        p = mod.save_state({'session_id': '../../outside'})
        self.assertEqual(p.parent, self.root / '.codex/.runtime')

    def test_external_file_is_not_linted(self):
        self.assertEqual(mod.changed_ui({'tool_input': {'file_path': '/etc/passwd'}}), [])

    def test_apply_patch_detects_ui_file_and_hash(self):
        p = self.root / 'projects/test/src/page.tsx'
        p.parent.mkdir(parents=True)
        p.write_text('export const Page = () => <div/>')
        found = mod.changed_ui({'tool_input': '*** Update File: projects/test/src/page.tsx\n'})
        self.assertEqual(found[0][0], 'projects/test/src/page.tsx')
        self.assertEqual(len(found[0][1]), 64)

    def test_stop_does_not_dirty_tracked_session_notes(self):
        mod.archive({'session_id': 'test'}, flush=False)
        self.assertFalse((self.root / '.codex/sessions').exists())

    def test_branch_warning_is_visible(self):
        (self.root / 'docs/projects/README.md').write_text('Рабочая ветка: `different`')
        text = mod.startup({})['hookSpecificOutput']['additionalContext']
        self.assertIn('хук ничего не переключал', text)

    def test_empty_change_list_creates_no_archive(self):
        with patch.object(mod, 'snapshot', return_value={'files': []}):
            mod.archive({}, flush=True)
        self.assertFalse((self.root / '.codex/sessions').exists())


if __name__ == '__main__':
    unittest.main()
