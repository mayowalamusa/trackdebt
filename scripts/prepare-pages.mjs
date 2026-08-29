import { copyFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';

const outDir = join(process.cwd(), 'dist', 'web');

// Disable Jekyll so GitHub Pages serves Vite's underscored asset paths exactly
// as emitted, and duplicate index.html as 404.html for direct client routes.
await writeFile(join(outDir, '.nojekyll'), '');
await copyFile(join(outDir, 'index.html'), join(outDir, '404.html'));
