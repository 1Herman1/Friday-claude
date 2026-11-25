"""Static policy contracts only; not proof of routing or visual/runtime quality."""
from pathlib import Path
import unittest

ROOT = Path(__file__).resolve().parents[2]
DOC = ROOT / "docs/core/design-surface-workflow.md"


def policy():
    return DOC.read_text() if DOC.exists() else ""


class SurfacePolicyTests(unittest.TestCase):
    def test_per_page_modes_and_identity_lock(self):
        text = policy()
        self.assertIn("## Surface brief и identity/refinement lock", text)
        for marker in ("Persuade", "Operate", "Read", "Experience", "per-page", "refinement", "redesign", "60–75ch", "working action", "один signature move"):
            with self.subTest(marker=marker):
                self.assertIn(marker, text)
        self.assertNotIn("Explore/Decide", text)

    def test_task_first_sequence_and_copy_intents(self):
        text = policy()
        stages = ["### 1. Intent", "### 2. Content structure", "### 3. Typography", "### 4. Functional states", "### 5. Responsive / a11y", "### 6. Evidence"]
        for stage in stages:
            self.assertIn(stage, text)
        self.assertEqual([text.index(s) for s in stages], sorted(text.index(s) for s in stages))
        for marker in ("clarify", "harden", "onboard", "typeset", "polish", "critique", "extract/refresh", "fabricated claims", "permission", "no-results", "200%", "late font load", "independent A", "deterministic B", "не подключены"):
            with self.subTest(marker=marker):
                self.assertIn(marker, text)

    def test_priority_scopes_and_protected_guard_contract(self):
        text = policy()
        for marker in ("## Приоритет и узкие scopes", "global base", "page overrides", "hero/nav/list", "не универсальные hard-fail", "44×44px", "4.5:1", "decorative bounce", "inertial spring", "no-overshoot", "loadDesignSystem", "не AST", "не вычисляет WCAG", "права", "бюджет", "owner acceptance"):
            with self.subTest(marker=marker):
                self.assertIn(marker, text)
        protected = {
            "docs/core/design-principles.md": ("from-purple-500 to-blue-500", "44×44px", "<label>", "bounce", "4.5:1"),
            "docs/core/motion.md": ("from 'animejs'", "transform", "opacity", "prefers-reduced-motion", "damping: 1.0"),
            ".codex/workflows/review-loop.md": ("Самопроверка", "независим", "revision"),
        }
        for file, markers in protected.items():
            original = (ROOT / file).read_text()
            for marker in markers:
                with self.subTest(file=file, marker=marker):
                    self.assertIn(marker, original)

    def test_temporal_evidence_is_not_static_capture(self):
        text = policy()
        for marker in ("## Temporal evidence", "before", "first", "mid", "last", "settled", "interrupt", "repeat", "reduced", "offscreen", "destroy", "не static PNG", "brightness dip", "end-paint swap", "frame-time", "не измерено"):
            with self.subTest(marker=marker):
                self.assertIn(marker, text)


if __name__ == "__main__":
    unittest.main()
