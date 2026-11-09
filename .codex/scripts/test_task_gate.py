import copy
import json
import subprocess
import tempfile
import unittest
from pathlib import Path

import changes
import task_gate as gate


class TaskGateTests(unittest.TestCase):
    def setUp(self):
        self.tmp = tempfile.TemporaryDirectory()
        self.root = Path(self.tmp.name)
        self.git('init', '-q')
        self.git('config', 'user.name', 'Fixture')
        self.git('config', 'user.email', 'fixture@example.invalid')
        (self.root / 'logic.py').write_text('result = 1\n')
        self.git('add', '.')
        self.git('commit', '-qm', 'baseline')
        self.task = gate.create(self.root, 'task', 'standard', ['expected behavior'],
                                ['regression'], 'implementer-thread', 'owner-session')

    def tearDown(self):
        self.tmp.cleanup()

    def git(self, *args):
        return subprocess.run(['git', '-C', str(self.root), *args], check=True,
                              capture_output=True, text=True).stdout

    def changed(self):
        (self.root / 'logic.py').write_text('result = 2\n')

    def complete_evidence(self):
        gate.mutate(self.root, self.task, 'criterion', 'expected behavior', 'pass', 'scenario result')
        gate.mutate(self.root, self.task, 'check', 'regression', 'pass', 'command exit 0')
        for role in changes.reviewers(changes.collect(self.root, self.task['base'])['paths']):
            gate.mutate(self.root, self.task, 'review', role, 'pass', 'independent report',
                        reviewer=role + '-thread')

    def result(self):
        return gate.evaluate(self.task, changes.collect(self.root, self.task['base']))

    def test_empty_task_cannot_pass(self):
        self.assertFalse(self.result()['ready'])

    def test_current_verified_task_passes(self):
        self.changed()
        self.complete_evidence()
        self.assertTrue(self.result()['ready'])

    def test_change_invalidates_old_evidence(self):
        self.complete_evidence()
        self.changed()
        self.assertFalse(self.result()['ready'])

    def test_commit_of_same_reviewed_content_preserves_pass(self):
        self.changed()
        self.complete_evidence()
        self.git('add', 'logic.py')
        self.git('commit', '-qm', 'reviewed implementation')
        self.assertTrue(self.result()['ready'])

    def test_skipped_required_test_is_not_success(self):
        self.complete_evidence()
        gate.mutate(self.root, self.task, 'check', 'regression', 'skip', 'no database')
        self.assertFalse(self.result()['ready'])

    def test_same_person_cannot_self_approve(self):
        with self.assertRaises(ValueError):
            gate.mutate(self.root, self.task, 'review', 'code-reviewer', 'pass', 'self report',
                        reviewer='implementer-thread')

    def test_finding_blocks_even_with_pass_label(self):
        self.complete_evidence()
        gate.mutate(self.root, self.task, 'review', 'code-reviewer', 'pass', 'report',
                    reviewer='independent', findings=['F1 open'])
        self.assertFalse(self.result()['ready'])

    def test_review_rerun_can_close_finding(self):
        self.complete_evidence()
        gate.mutate(self.root, self.task, 'review', 'code-reviewer', 'fail', 'bug reproduced',
                    reviewer='independent', findings=['F1'])
        self.assertFalse(self.result()['ready'])
        gate.mutate(self.root, self.task, 'review', 'code-reviewer', 'pass', 'fix rechecked',
                    reviewer='independent')
        self.assertTrue(self.result()['ready'])

    def test_stop_continues_incomplete_owner_task(self):
        self.assertEqual(gate.stop(self.root, {'session_id': 'owner-session'})['decision'], 'block')

    def test_stop_does_not_block_other_session_or_subagent(self):
        self.assertEqual(gate.stop(self.root, {'session_id': 'different'}), {})
        self.assertEqual(gate.stop(self.root, {'session_id': 'owner-session', 'agent_id': 'child'}), {})

    def test_explicit_external_blocker_can_be_reported(self):
        self.task['status'] = 'blocked'
        self.task['blocker'] = 'Required test database unavailable'
        gate.save(self.root / '.codex/.runtime/tasks/task.json', self.task)
        self.assertEqual(gate.stop(self.root, {'session_id': 'owner-session'}), {})
        self.assertFalse(self.result()['ready'])

    def test_complete_task_becomes_incomplete_after_new_edit(self):
        self.complete_evidence()
        self.task['status'] = 'complete'
        gate.save(self.root / '.codex/.runtime/tasks/task.json', self.task)
        self.changed()
        self.assertEqual(gate.stop(self.root, {'session_id': 'owner-session'})['decision'], 'block')

    def test_scope_includes_index_untracked_deleted_and_committed(self):
        (self.root / 'new.py').write_text('new = True')
        (self.root / 'logic.py').unlink()
        self.git('add', 'logic.py')
        scope = changes.collect(self.root, self.task['base'])
        self.assertEqual(set(scope['paths']), {'logic.py', 'new.py'})

    def test_routing_covers_python_shell_and_reviewer_of_secrets(self):
        roles = changes.reviewers(['risk.py', '.github/workflows/build.yml', 'run.sh'])
        self.assertTrue({'code-reviewer', 'security-secrets-scanner', 'devops', 'qa-engineer'} <= set(roles))

    def test_duplicate_init_does_not_erase_previous_task(self):
        with self.assertRaises(ValueError):
            gate.create(self.root, 'task', 'standard', ['other'], ['test'], 'x', 'owner-session')
        original = json.loads((self.root / '.codex/.runtime/tasks/task.json').read_text())
        self.assertEqual(original['criteria'], ['expected behavior'])

    def test_cannot_replace_active_task_with_new_task(self):
        with self.assertRaises(ValueError):
            gate.create(self.root, 'another', 'standard', ['other'], ['test'], 'x', 'owner-session')
        self.assertFalse((self.root / '.codex/.runtime/tasks/another.json').exists())

    def test_routine_label_cannot_bypass_critical_roles(self):
        roles = changes.reviewers(['server/checkout.ts'], 'routine')
        self.assertTrue({'qa-engineer', 'security-business-logic', 'silent-failure-hunter'} <= set(roles))
        self.assertEqual(changes.effective_level(['server/checkout.ts'], 'routine'), 'critical')

    def test_every_command_has_semantic_steps(self):
        folder = changes.ROOT / '.codex/commands'
        for p in folder.glob('*.md'):
            body = p.read_text().split('## Критерий завершения Codex')[0]
            self.assertGreater(len(body.strip()), 100, p.name + ' is only a heading/adapter')

    def test_native_leaf_roles_do_not_inherit_recursive_delegation(self):
        import tomllib
        for p in (changes.ROOT / '.codex/agents').glob('*.toml'):
            d = tomllib.loads(p.read_text())
            if d['name'] not in {'orchestrator', 'security-department', 'design-department', 'seo-department'}:
                self.assertIn('Ты конечный специалист', d['developer_instructions'], p.name)

    def test_react_rules_do_not_assert_false_positives(self):
        import tomllib
        d = tomllib.loads((changes.ROOT / '.codex/agents/react-reviewer.toml').read_text())
        text = d['developer_instructions']
        self.assertNotIn('без массива зависимостей — бесконечный цикл', text)
        self.assertNotIn('с объектом без spread — мутация стейта', text)

    def test_hidden_staged_version_cannot_pass(self):
        self.changed()
        self.git('add', 'logic.py')
        (self.root / 'logic.py').write_text('result = 1\n')
        self.complete_evidence()
        result = self.result()
        self.assertIn('logic.py', changes.collect(self.root)['paths'])
        self.assertFalse(result['ready'])
        self.assertTrue(any('Index and working tree' in s for s in result['reasons']))

    def test_changed_hidden_index_invalidates_revision(self):
        self.changed()
        self.git('add', 'logic.py')
        (self.root / 'logic.py').write_text('result = 1\n')
        before = changes.collect(self.root)['revision']
        (self.root / 'logic.py').write_text('result = 3\n')
        self.git('add', 'logic.py')
        (self.root / 'logic.py').write_text('result = 1\n')
        self.assertNotEqual(before, changes.collect(self.root)['revision'])

    def test_explicit_scope_excludes_independent_neighbor(self):
        self.changed()
        before = changes.collect(self.root, self.task['base'], ['logic.py'])['revision']
        (self.root / 'other-session.py').write_text('other = 1')
        scoped = changes.collect(self.root, self.task['base'], ['logic.py'])
        self.assertEqual(scoped['paths'], ['logic.py'])
        self.assertEqual(before, scoped['revision'])

    def test_blank_reviewer_identity_rejected(self):
        with self.assertRaises(ValueError):
            gate.mutate(self.root, self.task, 'review', 'code-reviewer', 'pass', 'report', reviewer=' ')

    def test_new_repository_first_commit_is_in_scope(self):
        with tempfile.TemporaryDirectory() as temp:
            root = Path(temp)
            subprocess.run(['git', '-C', temp, 'init', '-q'], check=True)
            before = changes.collect(root)
            self.assertTrue(before['head_is_unborn'])
            (root / 'new.py').write_text('x = 1')
            subprocess.run(['git', '-C', temp, 'add', '.'], check=True)
            subprocess.run(['git', '-C', temp, '-c', 'user.name=Fixture', '-c',
                            'user.email=fixture@example.invalid', 'commit', '-qm', 'first'], check=True)
            after = changes.collect(root, before['head'])
            self.assertEqual(after['paths'], ['new.py'])

    def test_executable_mode_change_invalidates_revision(self):
        path = self.root / 'run.sh'
        path.write_text('#!/bin/sh\nexit 0\n')
        path.chmod(0o644)
        before = changes.collect(self.root)['revision']
        path.chmod(0o755)
        self.assertNotEqual(before, changes.collect(self.root)['revision'])

    def test_staged_deletion_with_untracked_replacement_is_blocked(self):
        self.git('rm', 'logic.py')
        (self.root / 'logic.py').write_text('result = 1\n')
        scope = changes.collect(self.root, self.task['base'])
        self.assertIn('logic.py', scope['index_worktree_conflicts'])
        self.complete_evidence()
        self.assertFalse(self.result()['ready'])


if __name__ == '__main__':
    unittest.main()
