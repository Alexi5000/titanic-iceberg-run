import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';

const root = process.cwd();
const failures = [];
const sourceRoot = join(root, 'src');
const requiredPaths = [
  'README.md',
  'LICENSE',
  '.env.example',
  'CONTRIBUTING.md',
  'CODE_OF_CONDUCT.md',
  'SECURITY.md',
  'SUPPORT.md',
  'FORK_POLICY.md',
  '.github/CODEOWNERS',
  '.github/ISSUE_TEMPLATE/bug-report.yml',
  '.github/ISSUE_TEMPLATE/feature-request.yml',
  '.github/pull_request_template.md',
  '.github/workflows/quality.yml',
  'src/main.ts',
  'tests/repository-contract.test.mjs',
];

function collectFiles(directory, extensions) {
  const files = [];
  for (const entry of readdirSync(directory)) {
    if (entry === 'node_modules' || entry === 'dist' || entry === '.git') continue;
    const absolutePath = join(directory, entry);
    const stats = statSync(absolutePath);
    if (stats.isDirectory()) {
      files.push(...collectFiles(absolutePath, extensions));
    } else if (extensions.some((extension) => entry.endsWith(extension))) {
      files.push(absolutePath);
    }
  }
  return files;
}

for (const path of requiredPaths) {
  if (!existsSync(join(root, path))) failures.push(`required repository file is missing: ${path}`);
}

if (!existsSync(sourceRoot)) {
  failures.push('source directory is missing: src');
} else {
  const sourceFiles = collectFiles(sourceRoot, ['.ts']);
  if (sourceFiles.length < 10) failures.push('expected at least ten TypeScript source modules');
}

const scanRoots = ['src', 'scripts', 'tests'];
for (const scanRoot of scanRoots) {
  const absoluteRoot = join(root, scanRoot);
  if (!existsSync(absoluteRoot)) continue;
  for (const file of collectFiles(absoluteRoot, ['.ts', '.mjs'])) {
    const content = readFileSync(file, 'utf8');
    const displayPath = relative(root, file);
    if (/^(<<<<<<<|=======|>>>>>>>)/m.test(content)) {
      failures.push(`unresolved merge marker found in ${displayPath}`);
    }
    if (/\bconsole\.(log|debug|warn)\s*\(/.test(content)) {
      failures.push(`unexpected console logging found in ${displayPath}`);
    }
  }
}

if (failures.length > 0) {
  for (const failure of failures) process.stderr.write(`FAIL ${failure}\n`);
  process.exitCode = 1;
} else {
  process.stdout.write('PASS repository style and structure checks\n');
}
