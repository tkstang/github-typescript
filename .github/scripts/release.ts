import { execFileSync } from 'node:child_process';
import { appendFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

function git(args: string[]): string {
  return execFileSync('git', args, {
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe'],
  }).trim();
}

function releasePlan(tag: string, packageVersion: string) {
  const match = /^v(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)(?:-([0-9A-Za-z-]+(?:\.[0-9A-Za-z-]+)*))?$/.exec(tag);
  if (!match || match[4]?.split('.').some((part) => /^\d+$/.test(part) && part.length > 1 && part.startsWith('0'))) {
    throw new Error('Release tag must be vX.Y.Z or vX.Y.Z-prerelease with valid SemVer identifiers');
  }
  if (tag.slice(1) !== packageVersion) {
    throw new Error('Release tag must match package.json version');
  }
  return { tag, major: `v${match[1]}`, prerelease: match[4] !== undefined };
}

function validate(tag: string, expectedSha: string) {
  if (!/^[0-9a-f]{40}$/i.test(expectedSha)) throw new Error('Expected revision must be a full Git SHA');
  const commit = git(['rev-parse', '--verify', `${expectedSha}^{commit}`]);
  if (git(['rev-parse', '--verify', 'HEAD^{commit}']) !== commit) {
    throw new Error('Checkout does not match the checked release revision');
  }
  const manifest: { version: string } = JSON.parse(git(['show', `${commit}:package.json`]));
  const plan = releasePlan(tag, manifest.version);
  if (git(['rev-parse', '--verify', `refs/tags/${tag}^{commit}`]) !== commit) {
    throw new Error('Local release tag does not match the checked release revision');
  }
  const remoteTags = git([
    'ls-remote', '--exit-code', '--tags', 'origin',
    `refs/tags/${tag}`, `refs/tags/${tag}^{}`,
  ]);
  const refs = new Map(remoteTags.split('\n').map((line) => {
    const [sha, ref] = line.split('\t');
    return [ref, sha] as const;
  }));
  if ((refs.get(`refs/tags/${tag}^{}`) ?? refs.get(`refs/tags/${tag}`)) !== commit) {
    throw new Error('Remote release tag does not match the checked release revision');
  }
  return { ...plan, commit };
}

function main() {
  const command = process.argv[2];
  if (command !== 'validate' && command !== 'update-major') throw new Error('Usage: release.ts validate|update-major');
  const plan = validate(process.env.RELEASE_TAG ?? '', process.env.RELEASE_SHA ?? '');
  if (command === 'update-major' && !plan.prerelease) {
    // One ref update preserves the old ref if the server rejects the push.
    git(['push', '--force', 'origin', `${plan.commit}:refs/tags/${plan.major}`]);
  }
  if (command === 'validate' && process.env.GITHUB_OUTPUT) {
    const outputs = Object.entries(plan)
      .map(([key, value]) => `${key}=${value}\n`).join('');
    appendFileSync(process.env.GITHUB_OUTPUT, outputs);
  }
  console.log(JSON.stringify(plan));
}

if (process.argv[1] && fileURLToPath(import.meta.url) === resolve(process.argv[1])) {
  try {
    main();
  } catch (error) {
    console.error(error instanceof Error ? error.message : String(error));
    process.exitCode = 1;
  }
}
