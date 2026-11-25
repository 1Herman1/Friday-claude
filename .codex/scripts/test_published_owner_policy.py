"""Published owner policy only: no parity ledger, media handoff, or untracked imports."""
from pathlib import Path
import types
import tomllib
import unittest
from unittest.mock import patch

ROOT = Path(__file__).resolve().parents[2]

def read_text(relative):
    return (ROOT / relative).read_text()

POLICY = [
    'Пользователь — Гермес', 'Привет, Гермес!',
    'В обычной беседе обращаться «Гермес»',
    'при объяснении сложной задачи — «сэр»',
    'Держать тон собранным и уважительным',
    'говорить по делу и инициативно предлагать следующий шаг.',
]

class PublishedOwnerPolicyTests(unittest.TestCase):
    def assert_policy(self, text):
        for phrase in POLICY:
            with self.subTest(phrase=phrase):
                self.assertIn(phrase, text)
        self.assertNotIn('после приветствия обращение «сэр»', text)

    def test_published_config_has_complete_owner_policy(self):
        config = tomllib.loads(read_text('.codex/config.toml'))
        self.assert_policy(config['developer_instructions'])
        self.assertIn('.codex/CODEX.md', config['developer_instructions'])

    def test_startup_emits_complete_policy_and_keeps_context_contract(self):
        mod = types.ModuleType('published_lifecycle')
        mod.__file__ = str(ROOT / '.codex/scripts/lifecycle.py')
        exec(compile(read_text('.codex/scripts/lifecycle.py'), mod.__file__, 'exec'), mod.__dict__)
        self.assertEqual(mod.ROOT, ROOT.resolve())
        files = {'docs/projects/README.md': 'Рабочая ветка: `published-fixture`',
                 'docs/projects/.active': 'fixture', '.codex/context.md': 'memory-marker'}
        def read(relative, limit=None):
            return files.get(relative, '')[:limit]
        with patch.object(mod, 'read', side_effect=read), \
             patch.object(mod, 'git', return_value='published-fixture'), \
             patch.object(mod, 'save_state', return_value=None) as save:
            out = mod.startup({'session_id': 'scope-regression'})
        save.assert_called_once_with({'session_id': 'scope-regression'})
        self.assertEqual(out['hookSpecificOutput']['hookEventName'], 'SessionStart')
        text = out['hookSpecificOutput']['additionalContext']
        self.assert_policy(text)
        self.assertIn('Полностью прочитай .codex/CODEX.md перед работой.', text)
        self.assertIn('memory-marker', text)
        self.assertIn('published-fixture', text)
        self.assertIn('fixture', text)

    def test_published_codex_remains_authoritative_for_conditional_address(self):
        text = ' '.join(read_text('.codex/CODEX.md').split())
        for phrase in ['Пользователь — **Гермес**', 'Привет, Гермес!',
                       'В обычной беседе обращаться «Гермес»',
                       'при объяснении сложной задачи — «сэр»',
                       'Держать тон собранным и уважительным, говорить по делу и инициативно предлагать следующий шаг.']:
            self.assertIn(phrase, text)

if __name__ == '__main__':
    unittest.main()
