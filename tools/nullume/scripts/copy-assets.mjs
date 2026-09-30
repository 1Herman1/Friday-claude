import { copyFileSync, mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const rootDir = join(__dirname, '..');

// Copy HTML
const srcHtml = join(rootDir, 'src/library/dashboard/page.html');
const destDirHtml = join(rootDir, 'dist/library/dashboard');
const destFileHtml = join(destDirHtml, 'page.html');

mkdirSync(destDirHtml, { recursive: true });
copyFileSync(srcHtml, destFileHtml);

console.log(`Copied ${srcHtml} to ${destFileHtml}`);

// Copy data JSON files
const dataFiles = ['presets.json', 'recipes.json', 'higgsfield-catalog.json', 'higgsfield-styles.json'];
const destDirData = join(rootDir, 'dist/data');

mkdirSync(destDirData, { recursive: true });

for (const file of dataFiles) {
  const src = join(rootDir, `data/${file}`);
  const dest = join(destDirData, file);
  copyFileSync(src, dest);
  console.log(`Copied ${src} to ${dest}`);
}
