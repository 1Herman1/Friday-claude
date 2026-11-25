"""Verify additive design-library discovery in effective Friday instructions."""
from pathlib import Path
import tomllib
import unittest

ROOT = Path(__file__).resolve().parents[2]
INDEX = 'docs/core/design-library/INDEX.md'
CLI = '.codex/scripts/design-library.mjs'


class DesignRoutingTests(unittest.TestCase):
    def test_main_entrypoint_exposes_full_catalogues_and_readonly_lookup(self):
        text = (ROOT / '.codex/CODEX.md').read_text()
        for requirement in [INDEX, CLI, '64 палитры', '39 типографических записей',
                            '11 семейств hero', '27 пресетов диаграмм']:
            with self.subTest(requirement=requirement):
                self.assertTrue(requirement in text, f'Missing route or guard: {requirement}')

    def test_taste_role_and_registered_payload_route_to_same_library(self):
        markdown = (ROOT / '.codex/agents/design/taste-curator.md').read_text()
        payload = tomllib.loads((ROOT / '.codex/agents/taste-curator.toml').read_text())
        self.assertEqual(payload['developer_instructions'].strip(), markdown.split('\n', 1)[1].strip())
        for text in [markdown, payload['developer_instructions']]:
            self.assertIn(INDEX, text)
            self.assertIn(CLI, text)

    def test_design_system_command_and_invoked_skill_discover_catalogue(self):
        for relative in ['.codex/commands/design-system.md', '.codex/skills/design-system/SKILL.md']:
            text = (ROOT / relative).read_text()
            with self.subTest(path=relative):
                self.assertIn(INDEX, text)
                self.assertIn(CLI, text)
                self.assertIn('Обязательно проверить поддержку кириллицы', text)
                self.assertIn('Если файл уже существует — не перезаписывать', text)

    def test_core_authority_and_existing_reference_contract_remain_present(self):
        text = (ROOT / '.codex/CODEX.md').read_text()
        for requirement in ['MASTER.md', 'reference-handoff',
                            'Утверждённые brand/MASTER', 'page overrides приоритетнее библиотеки',
                            'Нельзя завершать с открытыми подтверждёнными',
                            'Новых веток не создавать никогда']:
            with self.subTest(requirement=requirement):
                self.assertTrue(requirement in text, f'Missing route or guard: {requirement}')


if __name__ == '__main__':
    unittest.main()
