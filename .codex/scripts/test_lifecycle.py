import importlib.util
import json
import multiprocessing
import subprocess
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


class GitLifecycleTests(unittest.TestCase):
    """Real Git fixtures: avoid mocks that conceal committed/untracked/deleted files."""
    def setUp(self):
        self.tmp = tempfile.TemporaryDirectory()
        self.root = Path(self.tmp.name)
        (self.root / '.codex').mkdir()
        self.root_patch = patch.object(mod, 'ROOT', self.root)
        self.root_patch.start()
        self.git('init', '-q')
        self.git('config', 'user.name', 'Fixture')
        self.git('config', 'user.email', 'fixture@example.invalid')
        self.git('commit', '--allow-empty', '-qm', 'baseline')
        self.payload = {'session_id': 'parent-session'}

    def tearDown(self):
        self.root_patch.stop()
        self.tmp.cleanup()

    def git(self, *args):
        return subprocess.run(['git', '-C', str(self.root), *args], check=True,
                              capture_output=True, text=True).stdout

    def file(self, name, content='export const Page = () => <div/>'):
        path = self.root / name
        path.parent.mkdir(parents=True, exist_ok=True)
        path.write_text(content)
        return path

    def note(self):
        return next((self.root / '.codex/sessions').glob('*.md'))

    def test_shell_created_ui_and_journal_are_detected(self):
        names = ['projects/demo/new.tsx', 'trade-performance/journal/web/src/app/page.tsx']
        for name in names:
            self.file(name)
        found = dict(mod.changed_ui({'tool_input': {'cmd': 'shell creates files'}}))
        self.assertTrue(set(names) <= found.keys())

    def test_committed_work_survives_without_intermediate_stop(self):
        mod.startup(self.payload)
        name = 'projects/demo/code.ts'
        self.file(name)
        self.git('add', name)
        self.git('commit', '-qm', 'finished work')
        mod.archive(self.payload, flush=True)
        text = self.note().read_text()
        self.assertIn(name, text)
        self.assertIn('finished work', text)

    def test_deleted_and_untracked_paths_are_remembered(self):
        removed = self.file('old.ts')
        self.git('add', 'old.ts')
        self.git('commit', '-qm', 'baseline file')
        mod.startup(self.payload)
        removed.unlink()
        self.file('new.ts')
        mod.archive(self.payload, flush=False)
        self.git('add', 'old.ts', 'new.ts')
        self.git('commit', '-qm', 'replace file')
        mod.archive(self.payload, flush=True)
        text = self.note().read_text()
        self.assertIn('old.ts', text)
        self.assertIn('new.ts', text)

    def test_repeated_flush_preserves_agent_notes_and_deduplicates_facts(self):
        self.file('new.ts')
        mod.archive(self.payload, flush=True)
        note = self.note()
        note.write_text(note.read_text().replace('status: raw', 'status: digested') +
                        '\nDecision: preserve customer prices.\n')
        mod.archive(self.payload, flush=True)
        mod.archive(self.payload, flush=True)
        text = note.read_text()
        self.assertIn('preserve customer prices', text)
        self.assertIn('status: raw', text)
        self.assertEqual(text.count('<!-- codex-git-facts:start -->'), 1)

    def test_startup_preserves_context_tail(self):
        self.file('.codex/context.md', 'context ' * 1500 + 'TAIL_DECISION')
        self.file('docs/archive/CONTEXT.md', 'history ' * 1500 + 'TAIL_HISTORY')
        text = mod.startup(self.payload)['hookSpecificOutput']['additionalContext']
        self.assertIn('TAIL_DECISION', text)
        self.assertIn('TAIL_HISTORY', text)

    def test_parallel_parent_session_hooks_leave_valid_files(self):
        self.file('new.ts')
        # Fork inherits the temporary fixture ROOT; no real checkout is touched.
        context = multiprocessing.get_context('fork')
        workers = [context.Process(target=mod.archive, args=(self.payload, True)) for _ in range(8)]
        for worker in workers:
            worker.start()
        for worker in workers:
            worker.join(10)
            self.assertFalse(worker.is_alive())
            self.assertEqual(worker.exitcode, 0)
        state = self.root / '.codex/.runtime' / (mod.session_key(self.payload) + '.json')
        self.assertIn('new.ts', json.loads(state.read_text())['files'])
        self.assertEqual(self.note().read_text().count('<!-- codex-git-facts:start -->'), 1)

    def test_failed_lint_is_retried(self):
        self.file('new.tsx')
        original = mod.subprocess.run
        calls = []
        def run(args, **kwargs):
            if args[0] == 'node':
                calls.append(args)
                return subprocess.CompletedProcess(args, 1, '', 'synthetic lint failure')
            return original(args, **kwargs)
        with patch.object(mod.subprocess, 'run', side_effect=run):
            mod.post_edit(self.payload)
            mod.post_edit(self.payload)
        self.assertEqual(len(calls), 2)

    def test_unicode_spaces_and_newline_paths_are_not_quoted_or_dropped(self):
        names = ['projects/demo/Карточка.tsx', 'projects/demo/two words.tsx',
                 'projects/demo/line\nbreak.tsx', ' leading.tsx', '\nfirst.tsx']
        for name in names:
            self.file(name)
        self.assertTrue(set(names) <= set(mod.changed_files()))
        self.assertEqual(set(names), {p for p, _ in mod.changed_ui({})})
        mod.startup(self.payload)
        self.git('add', '--', *names)
        self.git('commit', '-qm', 'non ASCII file names')
        mod.archive(self.payload, flush=True)
        state = self.root / '.codex/.runtime' / (mod.session_key(self.payload) + '.json')
        self.assertTrue(set(names) <= set(json.loads(state.read_text())['files']))

    def test_first_commit_of_unborn_repository_survives(self):
        with tempfile.TemporaryDirectory() as temp:
            root = Path(temp)
            subprocess.run(['git', '-C', temp, 'init', '-q'], check=True)
            (root / '.codex').mkdir()
            with patch.object(mod, 'ROOT', root):
                mod.startup(self.payload)
                (root / 'first.ts').write_text('export const x = 1')
                subprocess.run(['git', '-C', temp, 'add', 'first.ts'], check=True)
                subprocess.run(['git', '-C', temp, '-c', 'user.name=Fixture', '-c',
                                'user.email=fixture@example.invalid', 'commit', '-qm', 'first'], check=True)
                mod.archive(self.payload, flush=True)
                note = next((root / '.codex/sessions').glob('*.md'))
                self.assertIn('first.ts', note.read_text())


if __name__ == '__main__':
    unittest.main()
