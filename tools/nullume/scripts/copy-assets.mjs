import { copyFileSync, mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const rootDir = join(__dirname, '..');

const srcFile = join(rootDir, 'src/library/dashboard/page.html');
const destDir = join(rootDir, 'dist/library/dashboard');
const destFile = join(destDir, 'page.html');

mkdirSync(destDir, { recursive: true });
copyFileSync(srcFile, destFile);

console.log(`Copied ${srcFile} to ${destFile}`);
