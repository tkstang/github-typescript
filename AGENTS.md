# github-typescript

This composite GitHub Action bundles caller-owned TypeScript with esbuild and runs
it through actions/github-script. The editable implementation is action.yml;
.github/fixtures and .github/scripts support runner acceptance tests.

## Commands and verification

- Use the packageManager-pinned pnpm: pnpm install --frozen-lockfile.
- pnpm typecheck checks committed CI fixtures and verification scripts.
- pnpm test:release runs the native TypeScript release-helper tests on Node 26.
  Git writes in these tests target disposable local bare remotes only.
- actionlint checks workflows and requires a separately installed binary.
- The Test Action CI job is the actual composite-action acceptance test. Local
  typechecking does not prove GitHub runner behavior.

Maintenance CI uses Node 26. The public node-version input is an esbuild syntax
target, default 22; it does not select the shell or github-script runtime. Preserve
existing support floors and public input/output contracts unless deliberately changed.

## Ownership and scope

- Never commit generated .github-script-build output or dependencies.
- Pass dynamic Action inputs as quoted environment data in shell steps.
- Keep executable-selection inputs in trusted workflow configuration; normalize
  leading-dash entry filenames before passing them to esbuild.
- Keep fixtures and substantive verification logic in external typed files.
- Preserve default/named run exports, injected core/github/context/args and failure
  propagation. Use fixed expected outputs rather than recomputing results.
- CI is reusable through workflow_call. Release checks must select the validated
  tagged commit; main/PR checks alone cannot authorize a release.
- Release tags must be full vX.Y.Z or SemVer prerelease tags matching the package
  version committed at that revision. Build metadata and floating major tags are
  unsupported. The helper checks checkout, local tag and remote tag identity.
- The release helper's update-major command writes to origin. Do not execute it
  against the real repository, publish releases or move tags without explicit
  authorization. Preparation tests must use local bare Git fixtures.
- Keep third-party Actions pinned to reviewed commits. Revalidate their bundled
  runtimes separately from the shell's Node version when changing pins.
