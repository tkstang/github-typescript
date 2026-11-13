# github-typescript

**Build TypeScript scripts and run them via [`actions/github-script`](https://github.com/actions/github-script).**
This composite action bundles your external `.ts` files with **esbuild** into a single ESM module and then executes them through `github-script`, returning the result as a step output.

- ✅ Write CI logic in **TypeScript** (great editor DX).
- ✅ Bundle supported dependencies such as [`github-typescript-utils`](https://www.npmjs.com/package/github-typescript-utils) after your workflow installs them.
- ✅ Rebuilds the bundle with **esbuild on every invocation**.
- ✅ Mirrors key **`github-script` inputs** like `github-token`, `result-encoding`, `retries`, etc.
- ✅ Lets you choose the JavaScript syntax target for bundling.
- 🧰 **No hidden setup**: You manage `setup-node` and dependency installs in your workflow (documented patterns below).

---

## Quick start

```yaml
name: demo

on: { workflow_dispatch: {} }

jobs:
  run-ts-script:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4

      # Install deps at repo root (or see "Isolate CI deps" below)
      - uses: actions/setup-node@v4
        with:
          node-version: 22
          cache: pnpm
      - run: pnpm install

      - name: Run TS via wrapper
        id: run
        uses: tkstang/github-typescript@v1
        with:
          ts-file: .github/scripts/fetch-status.ts
          node-version: '22'
          args: |
            {
              "url": "https://example.com/health"
            }

      - name: Show result
        env:
          RESULT: ${{ steps.run.outputs.result }}
        run: printf '%s\n' "$RESULT"
```

> Export a default function or a named `run` function. The default export takes
> precedence when present. Both receive `{ core, github, context, args }`.

---

## Inputs

### Core

| Name                | Required |    Default | Description                                                                                  |
| ------------------- | -------- | ---------: | -------------------------------------------------------------------------------------------- |
| `ts-file`           | ✅       |          — | Path to your TypeScript entry file (relative to `working-directory`).                        |
| `args`              |          |     `"{}"` | JSON string passed as `args` to your script function. Use multiline YAML format for complex objects. |
| `working-directory` |          |      `"."` | Directory where bundling and imports resolve; bundle outputs go to `./.github-script-build`. |
| `node-version`      |          |     `"22"` | Node target for bundling (affects `esbuild --target=nodeXX`).                                |
| `esbuild-version`   |          | `"0.24.0"` | esbuild version used to bundle.                                                              |

### Pass‑through to `actions/github-script`

| Name                        | Required |                        Default | Description                                                                            |
| --------------------------- | -------- | -----------------------------: | -------------------------------------------------------------------------------------- |
| `github-token`              |          |        _`${{ github.token }}`_ | Token used by Octokit. Provide a PAT/installation token if you need extra scopes.      |
| `debug`                     |          | _`${{ runner.debug == '1' }}`_ | Whether to log GitHub client request details. Defaults to runner debug mode.           |
| `user-agent`                |          |      `"actions/github-script"` | Optional user-agent string for GitHub API requests.                                    |
| `result-encoding`           |          |                       `"json"` | `"json"` or `"string"`. Controls how the return value is encoded into the step output. |
| `retries`                   |          |                          `"0"` | The number of times to retry a request.                                                |
| `retry-exempt-status-codes` |          |        `"400,401,403,404,422"` | Comma‑separated HTTP status codes that will **not** be retried.                        |
| `previews`                  |          |                           `""` | Comma‑separated GraphQL API preview names to enable.                                   |
| `base-url`                  |          |                           `""` | Optional GitHub REST API URL for GitHub Enterprise Server instances.                   |

---

## Outputs

| Name     | Description                                                                                 |
| -------- | ------------------------------------------------------------------------------------------- |
| `result` | The value returned by your script function, encoded according to `result-encoding`. |

Example in a step:

```yaml
- name: Show result
  env:
    RESULT: ${{ steps.run.outputs.result }}
  run: printf '%s\n' "$RESULT"
```

---

## Authoring scripts

**Type signature you get:**

```ts
type Context = {
  core: typeof import("@actions/core");
  github: ReturnType<typeof import("@actions/github").getOctokit>;
  context: typeof import("@actions/github").context;
  args: unknown; // whatever you pass via `with.args`
};
export default async function run({ core, github, context, args }: Context) {
  // ...
  return { ok: true };
}
```

**Example:**

```ts
// .github/scripts/fetch-status.ts
import axios from "axios";

type Args = { url: string };
export default async function run({ core, args }: { core: any; args: Args }) {
  if (!args?.url) throw new Error("args.url is required");
  const res = await axios.get(args.url, { timeout: 5000 });
  core.info(`GET ${args.url} -> ${res.status}`);
  return { status: res.status, ok: res.status >= 200 && res.status < 300 };
}
```

---

## Dependency management (pick one)

### A) **Root package.json** (simplest)

```
repo-root/
  package.json         # axios etc.
  node_modules/
  .github/scripts/
    fetch-status.ts
```

Workflow:

```yaml
- uses: actions/setup-node@v4
  with:
    node-version: 22
    cache: pnpm
- run: pnpm install
```

### B) **Sub‑package under `.github/scripts`** (isolate CI‑only deps)

```
repo-root/
  .github/scripts/
    package.json
    pnpm-lock.yaml
    node_modules/
    fetch-status.ts
```

Workflow:

```yaml
- uses: actions/checkout@v4
- uses: pnpm/action-setup@v4
  with: { version: 10 }
- uses: actions/setup-node@v4
  with:
    node-version: 22
    cache: pnpm
    cache-dependency-path: .github/scripts/pnpm-lock.yaml
- run: pnpm install
  working-directory: .github/scripts

- uses: tkstang/github-typescript@v1
  with:
    working-directory: .github/scripts
    ts-file: fetch-status.ts
    node-version: "22"
```

### C) **pnpm** in sub‑package

```yaml
- uses: pnpm/action-setup@v4
  with: { version: 10 }
- uses: actions/setup-node@v4
  with:
    node-version: 22
    cache: pnpm
    cache-dependency-path: .github/scripts/pnpm-lock.yaml
- run: pnpm install --frozen-lockfile
  working-directory: .github/scripts
```

> The wrapper sets `NODE_PATH` to `${{ inputs.working-directory }}/node_modules` so esbuild resolves your deps from that location when bundling.

---

## Builds and runtimes

The action rebuilds `${working-directory}/.github-script-build/out.mjs` on every
invocation. It does not restore or save a compiled-bundle cache. A previous cache
key did not include every effective input, such as imported JSON or JavaScript and
configuration files. Rebuilding avoids reusing that stale output. Your workflow
may still cache its package-manager download store independently.

`node-version` selects esbuild's JavaScript syntax target. It does not install Node
or change the runtime that executes the bundle. You configure the shell's Node and
install dependencies before using this action. The nested `actions/github-script@v8`
executes with its own Node 24 runtime and requires a compatible Actions runner,
currently 2.327.1 or newer. A lower syntax target does not polyfill newer Node APIs.

Bundling removes TypeScript syntax; it does not typecheck your script. Run the
owning package's checker separately. Dependencies must be installed before bundling;
only bundled modules are included in the resulting file.

---

## Usage patterns

**Pass static arguments:**

```yaml
- uses: tkstang/github-typescript@v1
  with:
    ts-file: .github/scripts/my-task.ts
    args: |
      {
        "environment": "production",
        "retries": 3,
        "endpoints": ["api1", "api2"]
      }
```

**Pass dynamic arguments from step outputs:**

```yaml
- name: Get deployment info
  id: deploy
  run: |
    echo "version=1.2.3" >> $GITHUB_OUTPUT
    echo "region=us-east-1" >> $GITHUB_OUTPUT
    echo "config={\"database\":\"prod\",\"replicas\":3}" >> $GITHUB_OUTPUT

- uses: tkstang/github-typescript@v1
  with:
    ts-file: .github/scripts/deploy.ts
    args: '${{ toJson(steps.deploy.outputs) }}'
```

**Return JSON result:**

```yaml
- uses: tkstang/github-typescript@v1
  id: mystep
  with:
    ts-file: .github/scripts/my-task.ts
    result-encoding: json
- env:
    RESULT: ${{ steps.mystep.outputs.result }}
  run: printf '%s\n' "$RESULT"
```

**Return string result:**

```yaml
- uses: tkstang/github-typescript@v1
  id: mystep
  with:
    ts-file: .github/scripts/my-task.ts
    result-encoding: string
```

**Control retries & token:**

```yaml
- uses: tkstang/github-typescript@v1
  with:
    ts-file: .github/scripts/triage.ts
    github-token: ${{ secrets.GH_PAT_WITH_SCOPES }}
    retries: 3
    retry-exempt-status-codes: "400,401"
```

---

## Security & hardening

- Pin upstream actions (e.g., `actions/checkout`, `actions/setup-node`) by **commit SHA** in sensitive workflows.
- Use least‑privilege `permissions:` blocks. Example:
  ```yaml
  permissions:
    contents: read
    pull-requests: write # only if your script needs it
    actions: write # only if touching Actions API
  ```
- Validate any untrusted input used by your scripts before shelling out.
- Prefer returning small results; for large payloads, write files and upload artifacts.

---

## Versioning & pins

- Tag majors (`v1`) and keep them backwards compatible.
- For maximum supply‑chain control, consumers can pin to a commit SHA.
- Keep `esbuild-version` current for best ESM/TS support.

---

## Troubleshooting

- **Cannot find module 'axios'** → ensure you installed deps where `working-directory` can see them and that the wrapper's build step sets `NODE_PATH` accordingly.
- **Missing callable export** → export a default function or a named `run` function. A present default export takes precedence.
- **YAML parsing errors with `args`** → for static objects, use multiline YAML format:
  ```yaml
  args: |
    {
      "key": "value",
      "array": ["item1", "item2"]
    }
  ```
  For dynamic values from step outputs or variables, use quoted `toJson()`:
  ```yaml
  # Pass all step outputs as an object
  args: '${{ toJson(steps.previous.outputs) }}'

  # Pass workflow variables
  args: '${{ toJson(vars) }}'

  # If you need to parse a JSON string first, use fromJson() (but not with toJson())
  # Example: steps.data.outputs.config = '{"key": "value"}'
  - run: echo "Key is ${{ fromJson(steps.data.outputs.config).key }}"
  ```
- **Output too large** → use artifacts instead of step outputs, or switch `result-encoding` to `string` if you only need a short message.

---

## FAQ

**Q: Do I need `node_modules` at runtime?**
A: Bundled modules are included in `out.mjs`; built-ins remain runtime-provided. A dependency that loads external files, native modules or dynamic imports may need additional runtime resources. Test the package you actually use.

**Q: Can I share common helpers across repos?**
A: Yes—publish a small ESM utils package (e.g., [`github-typescript-utils`](https://www.npmjs.com/package/github-typescript-utils) for GitHub Actions workflow utilities) and install it in the repo/sub‑package. The wrapper will bundle it.

**Q: Does this replace `actions/github-script`?**
A: No. It wraps it, so you keep Octokit/context ergonomics and its features (retries, result encoding, etc.).

---

## Related Projects

### 📦 github-typescript-utils
**[NPM](https://www.npmjs.com/package/github-typescript-utils) | [GitHub](https://github.com/tkstang/github-typescript-utils)**

A companion TypeScript utilities package for GitHub Actions workflows. Provides REST API helpers, context utilities, and common workflow functions.

```typescript
// Example: .github/scripts/pr-manager.ts
import { getRepoInfo, createStickyComment } from 'github-typescript-utils';

export default async function run({ core, github, context, args }) {
  const ctx = { core, github, context };
  const repo = getRepoInfo(ctx);

  await createStickyComment({
    ctx, repo,
    issueNumber: context.issue.number,
    identifier: 'welcome',
    body: `Welcome! This PR is for ${repo.owner}/${repo.repo}`
  });
}
```

See the [utils README](https://github.com/tkstang/github-typescript-utils#readme) for full usage and installation.

---

## License

MIT


## Maintenance checks

Install the pinned maintenance tools and check the committed fixture/script types:

```bash
pnpm install --frozen-lockfile
pnpm typecheck
actionlint
```

`actionlint` must be installed separately. Maintenance CI uses Node 26; this does
not change the package's declared Node support floor or the action's default syntax
target. The checker retains TypeScript 5.8 and Node 22 declarations as a small
maintenance dependency set.

The `Test Action` CI job executes the local composite action on a GitHub-hosted
runner. Its checked-in fixtures cover default and named exports, injected context,
JSON/string outputs, literal shell-looking input and distinct failure boundaries.
The verification script runs directly with Node after typechecking. It makes no
GitHub API writes. Local typechecking and workflow linting do not replace this
runner acceptance test.
