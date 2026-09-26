import { execSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const projectRoot = join(__dirname, '..');
const repoRoot = join(projectRoot, '../../');

const steps = [
  {
    name: 'TypeScript check',
    cmd: 'tsc -p tsconfig.build.json --noEmit',
    required: true,
  },
  {
    name: 'Tests',
    cmd: 'npm test',
    required: true,
  },
  {
    name: 'Build',
    cmd: 'npm run build',
    required: true,
  },
  {
    name: 'Portability check',
    cmd: `(cd "${repoRoot}" && bash .claude/scripts/portability-check.sh)`,
    required: false,
    condition: () => existsSync(join(repoRoot, '.claude/scripts/portability-check.sh')),
  },
];

let failed = false;

for (const step of steps) {
  if (step.condition && !step.condition()) {
    console.log(`⊘ ${step.name} (skipped — not in Friday repo)\n`);
    continue;
  }

  try {
    console.log(`▸ ${step.name}…`);
    execSync(step.cmd, { cwd: projectRoot, stdio: 'inherit' });
    console.log(`✓ ${step.name}\n`);
  } catch (error) {
    console.error(`✗ ${step.name}\n`);
    if (step.required) {
      failed = true;
      break;
    }
  }
}

if (failed) {
  process.exit(1);
}
