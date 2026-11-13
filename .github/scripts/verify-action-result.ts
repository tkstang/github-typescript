import assert from 'node:assert/strict';
import { existsSync } from 'node:fs';

const expectedArgs = { message: 'Hello from test! $(touch .github-script-args-executed)' };
assert.deepEqual(JSON.parse(process.env.DEFAULT_RESULT ?? ''), {
  success: true,
  eventName: process.env.EXPECTED_EVENT,
  repository: process.env.EXPECTED_REPOSITORY,
  hasGitHubClient: true,
  input: 'external-json',
  args: expectedArgs,
});
assert.equal(process.env.NAMED_RESULT, 'literal string result');
for (const name of ['BUILD_OUTCOME', 'EXPORT_OUTCOME', 'ARGS_OUTCOME', 'SCRIPT_OUTCOME']) {
  assert.equal(process.env[name], 'failure', `${name} must propagate failure`);
}
assert.equal(existsSync('.github/fixtures/.github-script-input-executed'), false);
assert.equal(existsSync('.github-script-args-executed'), false);
