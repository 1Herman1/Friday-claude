"""Main entrypoint -> invoked workflow/role -> concrete per-surface policy."""
from pathlib import Path
import tomllib
import unittest

ROOT = Path(__file__).resolve().parents[2]
POLICY = 'docs/core/design-surface-workflow.md'
CONSUMERS = ['.codex/CODEX.md', '.codex/commands/design-system.md',
             '.codex/skills/design-system/SKILL.md',
             '.codex/agents/design/taste-curator.md']


class SurfaceRoutingTests(unittest.TestCase):
    def test_actual_consumers_read_policy_before_style_choice(self):
        self.assertTrue((ROOT / POLICY).is_file())
        for relative in CONSUMERS:
            text = (ROOT / relative).read_text()
            with self.subTest(path=relative):
                for marker in [POLICY, 'Persuade', 'Operate', 'Read', 'Experience',
                               'identity/refinement lock']:
                    self.assertIn(marker, text)

    def test_registered_role_has_exact_markdown_body_and_policy_route(self):
        md = (ROOT / '.codex/agents/design/taste-curator.md').read_text()
        config = tomllib.loads((ROOT / '.codex/agents/taste-curator.toml').read_text())
        self.assertEqual(config['developer_instructions'].strip(), md.split('\n', 1)[1].strip())
        self.assertIn(POLICY, config['developer_instructions'])

    def test_policy_not_misrepresented_as_new_commands_or_runtime(self):
        text = (ROOT / POLICY).read_text()
        self.assertIn('не являются установленными командами', text)
        for marker in ['.codex/CODEX.md', '.codex/commands/design-system.md',
                       '.codex/skills/design-system/SKILL.md', 'temporal packet']:
            self.assertIn(marker, text)


if __name__ == '__main__':
    unittest.main()
