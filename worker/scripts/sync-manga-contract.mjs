import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const scriptDir = dirname(fileURLToPath(import.meta.url));
const workerRoot = resolve(scriptDir, '..');
const sourceCandidates = [
  resolve(workerRoot, '../shared/manga-contract.ts'),
  resolve(workerRoot, 'shared/manga-contract.ts'),
];
const sourcePath = sourceCandidates.find((candidate) => existsSync(candidate));

if (!sourcePath) {
  throw new Error('shared/manga-contract.ts was not found');
}

const targetPath = resolve(workerRoot, 'src/generated/manga-contract.ts');
mkdirSync(dirname(targetPath), { recursive: true });

const source = readFileSync(sourcePath, 'utf-8');
const generated = `/**
 * AUTO-GENERATED FILE.
 * Source: shared/manga-contract.ts
 * Do not edit manually.
 */

${source}`;

writeFileSync(targetPath, generated, 'utf-8');
console.log(`[sync-manga-contract] generated: ${targetPath}`);
