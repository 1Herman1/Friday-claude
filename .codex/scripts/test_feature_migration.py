"""Offline semantic contract: follow the invoked feature route, not orphan markers."""
import hashlib
import json
from pathlib import Path
import shutil
import tempfile
import unittest

ROOT = Path(__file__).resolve().parents[2]
SKILL = '.codex/skills/feature/SKILL.md'
WORKFLOW = '.codex/workflows/new-feature.md'
LOOP = '.codex/workflows/review-loop.md'
SOURCE = '.claude/commands/feature.md'


def routed(root, origin, target):
    text = (root / origin).read_text()
    directive = f'Следуй `{target}`'
    if directive not in text:
        raise AssertionError(f'{origin}: missing executable workflow route: {directive}')
    return (root / target).read_text()


def check_semantics(root):
    workflow = routed(root, SKILL, WORKFLOW)
    loop = routed(root, WORKFLOW, LOOP)
    requirements = [
        'planner', 'файлы и риски', 'критерии готовности',
        'researcher', 'похожую логику и точки интеграции', 'лимит 15 файлов',
        'не ограничивает полный scope ревью', 'явный исчерпывающий аудит',
        'architect', 'если трогаем БД/API', 'схема и контракт роута',
        'docs/projects/<проект>/project.md', 'coder', 'стиле и стеке проекта',
        'docs/core/rules/', 'минимально необходимый код',
        'Ревьюеры по типу файла', 'параллельно', 'code-reviewer',
        'typescript-reviewer', 'react-reviewer', 'database-reviewer',
        'security-secrets-scanner', 'silent-failure-hunter',
        'qa-engineer', 'деньгами, доступом или инвариантами',
        'сток, идемпотентность', 'ручной проверки сценария',
        'Проверь сборку', 'ключевой E2E-сценарий',
        'все критерии ТЗ', 'текущей revision', 'нет открытых дефектов',
        'task_gate.py complete', 'смысловую память Codex',
        'рабочую ветку', 'docs/projects/README.md', 'только после завершения и проверки',
        'Явный запрет на commit/push/deploy', 'бюджет', 'права', 'owner acceptance',
        'Внешний блокер', 'Не путать неизвестный результат с pass',
    ]
    for rule in requirements:
        if rule not in workflow:
            raise AssertionError('Missing feature obligation: ' + rule)
    positions = [workflow.index(f'`{role}`') for role in ['planner', 'researcher', 'architect', 'coder']]
    if positions != sorted(positions):
        raise AssertionError('planner → researcher → conditional architect → coder order')
    for rule in ['staged, unstaged, untracked', '--base', 'независимое',
                 'security', 'revision', 'task_gate.py', 'После публикации']:
        if rule not in loop:
            raise AssertionError('Missing shared review contract: ' + rule)
    skill = (root / SKILL).read_text()
    if '$ARGUMENTS' in skill or 'описание фичи из запроса пользователя' not in skill:
        raise AssertionError('Use native user brief, not Claude substitution syntax')
    for path in [WORKFLOW, LOOP, '.codex/scripts/task_gate.py', '.codex/scripts/changes.py',
                 'docs/projects/README.md', 'docs/core/rules']:
        if not (root / path).exists():
            raise AssertionError('Unresolved dependency: ' + path)


def check_receipt(root, manifest=None):
    if manifest is None:
        manifest = json.loads((root / '.codex/migration-manifest.json').read_text())
    entries = [item for item in manifest['files'] if item['source'] == SOURCE]
    assert len(entries) == 1, 'Expected exactly one feature mapping'
    assert entries[0]['target'] == 'skills/feature/SKILL.md'
    assert entries[0]['source_sha256'] == hashlib.sha256((root / SOURCE).read_bytes()).hexdigest(), 'Stale feature receipt'


class FeatureMigrationTests(unittest.TestCase):
    def test_invoked_feature_preserves_source_obligations(self):
        check_semantics(ROOT)

    def test_feature_receipt_matches_frozen_source(self):
        check_receipt(ROOT)

    def test_deletions_and_unreachable_markers_are_rejected(self):
        # Fixtures are real on-disk dependency trees; no ambient repository fallback.
        mutations = [
            (WORKFLOW, 'Проверь сборку'),
            (WORKFLOW, 'ключевой E2E-сценарий'),
            (WORKFLOW, 'если трогаем БД/API'),
            (WORKFLOW, 'silent-failure-hunter'),
            (WORKFLOW, 'task_gate.py complete'),
            (WORKFLOW, 'Явный запрет на commit/push/deploy'),
            (WORKFLOW, 'owner acceptance'),
            (WORKFLOW, 'security-secrets-scanner'),
            (SKILL, f'Следуй `{WORKFLOW}`'),
            (WORKFLOW, f'Следуй `{LOOP}`'),
            (LOOP, 'После публикации'),
        ]
        with tempfile.TemporaryDirectory() as tmp:
            root = Path(tmp)
            for path in [SKILL, WORKFLOW, LOOP, '.codex/scripts/task_gate.py',
                         '.codex/scripts/changes.py', 'docs/projects/README.md']:
                target = root / path
                target.parent.mkdir(parents=True, exist_ok=True)
                shutil.copyfile(ROOT / path, target)
            (root / 'docs/core/rules').mkdir(parents=True)
            check_semantics(root)
            for path, token in mutations:
                with self.subTest(deleted=token):
                    file = root / path
                    original = file.read_text()
                    self.assertIn(token, original)
                    file.write_text(original.replace(token, 'REMOVED'))
                    with self.assertRaises(AssertionError):
                        check_semantics(root)
                    file.write_text(original)
            for path in [WORKFLOW, LOOP, '.codex/scripts/task_gate.py',
                         '.codex/scripts/changes.py', 'docs/projects/README.md']:
                with self.subTest(missing_dependency=path):
                    file = root / path
                    original = file.read_bytes()
                    file.unlink()
                    with self.assertRaises((AssertionError, FileNotFoundError)):
                        check_semantics(root)
                    file.write_bytes(original)

    def test_hash_mutation_is_detected(self):
        manifest = json.loads((ROOT / '.codex/migration-manifest.json').read_text())
        entry = next(item for item in manifest['files'] if item['source'] == SOURCE)
        check_receipt(ROOT, manifest)
        entry['source_sha256'] = hashlib.sha256(b'').hexdigest()
        with self.assertRaisesRegex(AssertionError, 'Stale feature receipt'):
            check_receipt(ROOT, manifest)


if __name__ == '__main__':
    unittest.main()
