"""Offline workflow contract; not a YAML parser or proof of Actions execution."""
from pathlib import Path
import re
import unittest


PILOT = 'docs/research/design-agent-upgrade/rollout/motion-pilot'
ACTIONS = (
    'actions/checkout@3d3c42e5aac5ba805825da76410c181273ba90b1',
    'actions/setup-node@949feb2413d6458794dcd2491c4babbbce0c15c1',
    'actions/setup-python@6d4fd22b20465ccc0f7354476588e8df7c9ca0e0',
)
COMMANDS = (
    'mkdir -p "$TMPDIR" "$HOME/.hermes/cache/scratch"',
    'python .codex/scripts/selftest.py',
    'python .codex/scripts/sync-roles.py',
    "python -m unittest discover -s .codex/scripts -p 'test_*.py' -v",
    'node --test .codex/scripts/test-design-lint.mjs .codex/scripts/test-design-library.mjs .codex/scripts/test-motion-dependency-isolation.mjs .codex/scripts/test-motion-observation.mjs',
    'mkdir -p "$MOTION_DEPS"',
    f'cp {PILOT}/dependencies.package.json "$MOTION_DEPS/package.json"',
    f'cp {PILOT}/dependencies.lock.json "$MOTION_DEPS/package-lock.json"',
    'npm ci --prefix "$MOTION_DEPS" --ignore-scripts --no-audit --no-fund',
    'node "$MOTION_DEPS/node_modules/playwright-core/cli.js" install --with-deps chromium',
    'test -x "$MOTION_BROWSER"',
    'printf \'MOTION_BROWSER=%s\\n\' "$MOTION_BROWSER" >> "$GITHUB_ENV"',
    'node .codex/scripts/test-motion-template.mjs --integration',
)


def contract_errors(text):
    """Text guards only, not YAML or Actions expression/runtime validation."""
    errors = []
    for forbidden in (
        r'(?i)secrets\s*[.\[]', r'continue-on-error\s*:', r'(?m)^\s*if\s*:',
        r'\|\|', r'pull_request', r'(?m)^\s*(?:environment|inputs|token)\s*:',
        r'--apply', r'upload-artifact', r'write-all',
    ):
        if re.search(forbidden, text):
            errors.append('forbidden construct: ' + forbidden)
    permissions = re.findall(r'(?m)^[ \t]*permissions\s*:.*$', text)
    block = re.search(r'(?m)^permissions:\n((?:  [^\n]*\n)+)', text)
    if permissions != ['permissions:']:
        errors.append('exactly one top-level permission block required')
    if not block or block.group(1) != '  contents: read\n':
        errors.append('only contents: read is allowed')
    actions = re.findall(r'(?m)^[ \t]*(?:- )?uses: (\S+)', text)
    if tuple(actions) != ACTIONS:
        errors.append('official reviewed action pins required')
    for fragment in (
        "    branches: ['claude/greeting-nnz368']\n", '  workflow_dispatch:\n',
        "      - '.github/workflows/design-regression.yml'\n",
        "      - '.codex/**'\n", "      - '.claude/**'\n", "      - 'docs/core/**'\n",
        "      - 'docs/research/design-agent-upgrade/**'\n",
        '    runs-on: ubuntu-latest\n', '    timeout-minutes: 20\n',
        '          persist-credentials: false\n', "          node-version: '24'\n",
        '          package-manager-cache: false\n', "          python-version: '3.12'\n",
        '      TMPDIR: ${{ runner.temp }}/design-ci-owned\n',
        '      MOTION_DEPS: ${{ runner.temp }}/design-ci-owned/motion-deps\n',
        '      PLAYWRIGHT_BROWSERS_PATH: ${{ runner.temp }}/design-ci-owned/browsers\n',
        'process.stdout.write(req("playwright-core").chromium.executablePath())',
    ):
        if fragment not in text:
            errors.append('missing contract fragment: ' + fragment.strip())
    # Match only active run lines at this workflow's reviewed indentation.
    commands = []
    in_script = False
    for line in text.splitlines():
        if line.startswith('        run: '):
            value = line[len('        run: '):]
            in_script = value == '|'
            if not in_script:
                commands.append(value)
        elif in_script and line.startswith('          '):
            commands.append(line[10:])
        elif line.strip():
            in_script = False
    for command in COMMANDS:
        if commands.count(command) != 1:
            errors.append('required executable command: ' + command)
    return errors


ROOT = Path(__file__).resolve().parents[2]
WORKFLOW = ROOT / '.github/workflows/design-regression.yml'


class DesignCIContractTests(unittest.TestCase):
    def test_workflow_exists(self):
        self.assertTrue(WORKFLOW.is_file(), 'design regression workflow is missing')

    def test_isolated_install_precedes_node_dependency_test(self):
        text = WORKFLOW.read_text()
        self.assertLess(text.index('npm ci --prefix'), text.index('run: node --test'))
        self.assertLess(text.index('install --with-deps chromium'), text.index('run: node --test'))
        self.assertIn('mkdir -p "$TMPDIR" "$HOME/.hermes/cache/scratch"', text)

    def test_workflow_contract(self):
        self.assertEqual(contract_errors(WORKFLOW.read_text()), [])

    def test_rejects_unsafe_mutations(self):
        text = WORKFLOW.read_text()
        mutations = {
            'write permission': text.replace('contents: read', 'contents: write'),
            'extra permission': text.replace('contents: read', 'contents: read\n  actions: write'),
            'job override': text.replace('    runs-on:', '    permissions: write-all\n    runs-on:'),
            'persisted credentials': text.replace('persist-credentials: false', 'persist-credentials: true'),
            'implicit credentials': text.replace('          persist-credentials: false\n', ''),
            'ignored failure': text.replace('    timeout-minutes:', '    continue-on-error: true\n    timeout-minutes:'),
            'secret reference': text + '\n# ${{ secrets.EXAMPLE }}\n',
            'failure mask': text.replace('python .codex/scripts/selftest.py', 'python .codex/scripts/selftest.py || true'),
            'conditional gate': text.replace('    timeout-minutes:', '    if: failure()\n    timeout-minutes:'),
            'unpinned action': text.replace('3d3c42e5aac5ba805825da76410c181273ba90b1', 'v7'),
            'untrusted event': text.replace('  workflow_dispatch:', '  pull_request_target:\n  workflow_dispatch:'),
            'missing isolated lock': text.replace('          cp docs/research/design-agent-upgrade/rollout/motion-pilot/dependencies.lock.json "$MOTION_DEPS/package-lock.json"\n', ''),
            'root install': text.replace('npm ci --prefix "$MOTION_DEPS"', 'npm ci'),
            'missing browser env': text.replace('          printf \'MOTION_BROWSER=%s\\n\' "$MOTION_BROWSER" >> "$GITHUB_ENV"\n', ''),
        }
        for name, mutant in mutations.items():
            with self.subTest(mutation=name):
                self.assertNotEqual(mutant, text, 'mutation must actually change source')
                self.assertTrue(contract_errors(mutant), name)

    def test_rejects_missing_essential_commands(self):
        text = WORKFLOW.read_text()
        for command in (
            'python .codex/scripts/selftest.py',
            'python .codex/scripts/sync-roles.py',
            "python -m unittest discover -s .codex/scripts -p 'test_*.py' -v",
            'node --test .codex/scripts/test-design-lint.mjs .codex/scripts/test-design-library.mjs .codex/scripts/test-motion-dependency-isolation.mjs .codex/scripts/test-motion-observation.mjs',
            'node .codex/scripts/test-motion-template.mjs --integration',
            'node "$MOTION_DEPS/node_modules/playwright-core/cli.js" install --with-deps chromium',
        ):
            with self.subTest(command=command):
                self.assertIn(command, text)
                self.assertTrue(contract_errors(text.replace(command, ':')))


if __name__ == '__main__':
    unittest.main()
