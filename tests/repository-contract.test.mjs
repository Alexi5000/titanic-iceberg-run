import test from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

const root = process.cwd();
const read = (path) => readFileSync(join(root, path), 'utf8');
const exists = (path) => existsSync(join(root, path));

test('repository declares an executable quality contract', () => {
  const manifest = JSON.parse(read('package.json'));
  for (const script of ['lint', 'typecheck', 'test', 'build', 'quality', 'qa:cinematic']) {
    assert.ok(manifest.scripts[script], `package script is missing: ${script}`);
  }
  assert.match(manifest.scripts.quality, /lint/);
  assert.match(manifest.scripts.quality, /typecheck/);
  assert.match(manifest.scripts.quality, /test/);
  assert.match(manifest.scripts.quality, /build/);
  assert.equal(manifest.packageManager, 'bun@1.3.3');
});

test('repository health and contribution files are present', () => {
  const required = [
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
  ];
  for (const path of required) assert.ok(exists(path), `missing repository-health file: ${path}`);
});

test('README communicates purpose, verification, support, and project origin', () => {
  const readme = read('README.md');
  for (const heading of [
    '## Alexi5000 Project Purpose',
    '## Verified Setup',
    '## Use Cases',
    '## Security and Support',
    '## Origin and Attribution',
  ]) {
    assert.match(readme, new RegExp(heading.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')));
  }
  assert.match(readme, /qa:cinematic/);
  assert.match(readme, /localStorage/);
});

test('environment template is safe and documents cinematic validation', () => {
  const environment = read('.env.example');
  assert.match(environment, /^QA_URL=http:\/\/127\.0\.0\.1:4173\/$/m);
  assert.doesNotMatch(environment, /(api[_-]?key|secret|token|password)\s*=/i);
});

test('critical game and cinematic-validation modules are available', () => {
  for (const path of [
    'src/main.ts',
    'src/core/game_state.ts',
    'src/ocean/ocean_surface.ts',
    'src/ship/ship_physics.ts',
    'src/world/iceberg_field.ts',
    'src/ui/hud.ts',
    'scripts/qa_cinematic.mjs',
  ]) {
    assert.ok(exists(path), `critical module is missing: ${path}`);
  }
  const qa = read('scripts/qa_cinematic.mjs');
  assert.match(qa, /chromium\.launch/);
  assert.match(qa, /Rendering performance/);
  assert.match(qa, /Ocean authoring controls/);
});
