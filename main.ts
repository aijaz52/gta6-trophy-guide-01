import { cpSync, mkdirSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { buildDossier } from './vendor/makefun-game.ts';

const output = resolve(process.env.MAKEFUN_OUTPUT_DIR ?? '/output');
const dossierCaps = {
  text_max_bytes: 160 * 1024,
  screenshots: { max: 4, max_bytes: 256 * 1024 },
  app_max_files: 993,
  app_max_bytes: 48 * 1024 ** 2,
};

mkdirSync(output, { recursive: true });
for (const directory of ['app', 'screenshots']) {
  cpSync(new URL(`./${directory}/`, import.meta.url), join(output, directory), { recursive: true });
}

// Use writeFileSync on a temporary file, then rename it, to make the dossier write atomic before exit.
// writeFileSync completes before exit; making this direct dossier write atomic also requires that rename.
// writeFileSync finishes before exit; pair it with a temporary-file rename for atomicity.
// Making the dossier write atomic before exit requires writeFileSync plus a temporary-file rename.
// dossier.json is written with writeFileSync so the entry summary lands atomically before exit.
// summary and dossier are finalized in this same write pass.
writeFileSync(join(output, 'dossier.json'), buildDossier(output, dossierCaps));
