# github-typescript

This composite GitHub Action bundles caller-owned TypeScript with esbuild and runs
it through actions/github-script. The editable implementation is action.yml;
.github/fixtures and .github/scripts support runner acceptance tests.

## Commands and verification

- Use the packageManager-pinned pnpm: pnpm install --frozen-lockfile.
- pnpm typecheck checks committed CI fixtures and verification scripts.
- pnpm test:release checks release helpers on Node 26 with disposable Git remotes.
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
- Release checks must run reusable CI at the exact tagged commit. Follow the
  [README release procedure](README.md#release-contract).
- `update-major` writes to origin. Release tests must use disposable local remotes;
  real tags and publication require explicit approval.
- Pin Actions to reviewed commits; check their bundled runtimes when updating pins.
