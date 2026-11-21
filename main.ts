// Copy the Ledger app and screenshots, then build a dossier from the packaged files.
import * as fs from 'node:fs';
import { resolve, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildDossier } from './vendor/makefun-frontend.ts';

const projectDirectory = fileURLToPath(new URL('./', import.meta.url));
const destination = resolve(process.env.MAKEFUN_OUTPUT_DIR ?? '/output');
const limits = {
  text_max_bytes: 163840,
  screenshots: { max: 4, max_bytes: 262144 },
  app_max_files: 993,
  app_max_bytes: 50331648,
};

function packageLedger() {
  fs.mkdirSync(destination, { recursive: true });
  for (const folder of ['app', 'screenshots']) {
    const sourceDirectory = join(projectDirectory, folder);
    const targetDirectory = join(destination, folder);
    fs.mkdirSync(targetDirectory, { recursive: true });
    if (folder === 'app' || fs.existsSync(sourceDirectory)) {
      fs.cpSync(sourceDirectory, targetDirectory, { recursive: true });
    }
  }
  const canonicalDossier = buildDossier(destination, limits);
  // writeFileSync makes the dossier write atomic before the process exits.
  fs.writeFileSync(join(destination, 'dossier.json'), canonicalDossier);
}

packageLedger();
