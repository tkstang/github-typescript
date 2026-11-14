import assert from 'node:assert/strict';
import { execFileSync, spawnSync } from 'node:child_process';
import { chmodSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import test from 'node:test';

const script = fileURLToPath(new URL('./release.ts', import.meta.url));
const env = { PATH: process.env.PATH, GIT_CONFIG_NOSYSTEM: '1', GIT_CONFIG_GLOBAL: '/dev/null', GIT_TERMINAL_PROMPT: '0' };
function fixture(version = '1.0.5', annotated = false) {
  const root = mkdtempSync(join(tmpdir(), 'github-typescript-release-'));
  const repo = join(root, 'repo');
  const remote = join(root, 'remote.git');
  const git = (...args: string[]) => execFileSync('git', args, { cwd: repo, env, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }).trim();
  execFileSync('git', ['init', '--bare', '--template=', remote], { env, stdio: 'ignore' });
  execFileSync('git', ['init', '--initial-branch=main', '--template=', repo], { env, stdio: 'ignore' });
  git('config', 'user.name', 'Release test');
  git('config', 'user.email', 'release@example.invalid');
  git('config', 'commit.gpgsign', 'false');
  git('config', 'tag.gpgsign', 'false');
  git('remote', 'add', 'origin', remote);
  writeFileSync(join(repo, 'package.json'), '{"version":"1.0.4"}\n');
  git('add', 'package.json');
  git('commit', '-qm', 'initial');
  const previous = git('rev-parse', 'HEAD');
  git('tag', 'v1');
  git('push', 'origin', 'refs/tags/v1');
  writeFileSync(join(repo, 'package.json'), JSON.stringify({ version }) + '\n');
  git('commit', '-qam', 'candidate');
  const commit = git('rev-parse', 'HEAD');
  const tag = `v${version}`;
  git('tag', ...(annotated ? ['-a', tag, '-m', 'candidate'] : [tag]));
  git('push', 'origin', `refs/tags/${tag}`);
  const invoke = (command: string, releaseTag = tag, sha = commit) => spawnSync(process.execPath, [script, command], {
    cwd: repo, env: { ...env, RELEASE_TAG: releaseTag, RELEASE_SHA: sha, GITHUB_OUTPUT: join(root, 'outputs') }, encoding: 'utf8',
  });
  const major = () => git('ls-remote', 'origin', 'refs/tags/v1').split('\t')[0];
  return { root, repo, remote, git, previous, commit, tag, invoke, major };
}

test('stable annotated tag validates the exact commit and updates the major ref', (t) => {
  const f = fixture('1.0.5', true); t.after(() => rmSync(f.root, { recursive: true, force: true }));
  const validated = f.invoke('validate', f.tag, f.git('rev-parse', f.tag));
  assert.equal(validated.status, 0, validated.stderr);
  assert.deepEqual(JSON.parse(validated.stdout), { tag: 'v1.0.5', major: 'v1', prerelease: false, commit: f.commit });
  const outputs = Object.fromEntries(readFileSync(join(f.root, 'outputs'), 'utf8')
    .trim().split('\n').map((line) => line.split('=')));
  assert.deepEqual(outputs, { tag: 'v1.0.5', major: 'v1', prerelease: 'false', commit: f.commit });
  const updated = f.invoke('update-major');
  assert.equal(updated.status, 0, updated.stderr);
  assert.equal(f.major(), f.commit);
});

test('prereleases validate without moving the stable major', (t) => {
  const f = fixture('1.0.5-rc.1'); t.after(() => rmSync(f.root, { recursive: true, force: true }));
  const validated = f.invoke('validate');
  assert.equal(validated.status, 0, validated.stderr);
  assert.deepEqual(JSON.parse(validated.stdout), { tag: 'v1.0.5-rc.1', major: 'v1', prerelease: true, commit: f.commit });
  const updated = f.invoke('update-major');
  assert.equal(updated.status, 0, updated.stderr);
  assert.equal(f.major(), f.previous);
});

test('floating, malformed and mismatched-version tags cannot reach a write', (t) => {
  const f = fixture(); t.after(() => rmSync(f.root, { recursive: true, force: true }));
  for (const tag of ['v1', 'v1.0', '1.0.5', 'v01.0.5', 'v1.0.5-01', 'v1.0.5-rc..1', 'v1.0.5+build']) {
    const result = f.invoke('update-major', tag);
    assert.notEqual(result.status, 0, tag);
    assert.match(result.stderr, /Release tag must be vX.Y.Z/);
  }
  const mismatch = f.invoke('update-major', 'v1.0.6');
  assert.notEqual(mismatch.status, 0);
  assert.match(mismatch.stderr, /must match package.json version/);
  writeFileSync(join(f.repo, 'package.json'), '{"version":"1.0.6"}\n');
  f.git('tag', 'v1.0.6');
  f.git('push', 'origin', 'refs/tags/v1.0.6');
  const uncommittedVersion = f.invoke('update-major', 'v1.0.6');
  assert.notEqual(uncommittedVersion.status, 0);
  assert.match(uncommittedVersion.stderr, /must match package.json version/);
  assert.equal(f.major(), f.previous);
});

test('checkout, local tag and remote tag must all match the checked revision', (t) => {
  const f = fixture(); t.after(() => rmSync(f.root, { recursive: true, force: true }));
  const abbreviated = f.invoke('update-major', f.tag, f.commit.slice(0, 8));
  assert.notEqual(abbreviated.status, 0); assert.match(abbreviated.stderr, /Expected revision must be a full Git SHA/);
  let result = f.invoke('update-major', f.tag, f.previous);
  assert.notEqual(result.status, 0); assert.match(result.stderr, /Checkout does not match/);
  f.git('tag', '-f', f.tag, f.previous);
  result = f.invoke('update-major');
  assert.notEqual(result.status, 0); assert.match(result.stderr, /Local release tag does not match/);
  f.git('push', '--force', 'origin', `refs/tags/${f.tag}`);
  f.git('tag', '-f', f.tag, f.commit);
  result = f.invoke('update-major');
  assert.notEqual(result.status, 0); assert.match(result.stderr, /Remote release tag does not match/);
  assert.equal(f.major(), f.previous);
});

test('a rejected major-ref update preserves the existing remote ref', (t) => {
  const f = fixture(); t.after(() => rmSync(f.root, { recursive: true, force: true }));
  const hook = join(f.remote, 'hooks/update');
  mkdirSync(join(f.remote, 'hooks'));
  writeFileSync(hook, '#!/bin/sh\nif [ "$1" = refs/tags/v1 ] && [ "$3" != 0000000000000000000000000000000000000000 ]; then exit 1; fi\n');
  chmodSync(hook, 0o755);
  const result = f.invoke('update-major');
  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /hook declined|remote rejected/);
  assert.equal(f.major(), f.previous);
});
