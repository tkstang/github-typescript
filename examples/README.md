# Examples

This directory contains example TypeScript scripts that demonstrate how to use the `github-typescript` action.

## Basic Usage

[`basic-usage.ts`](./basic-usage.ts) - Minimal example showing the basic script structure and available context.

**Usage:**

```yaml
- uses: tkstang/github-typescript@v1
  with:
    ts-file: examples/basic-usage.ts
    args: ${{ toJson({ message: 'Hello World!' }) }}
```

## With Utilities

[`with-utils.ts`](./with-utils.ts) - Example using the `github-typescript-utils` package for common GitHub operations.

**Setup:**
First, install the utils package in your repository:

```bash
pnpm add github-typescript-utils
```

**Usage:**

```yaml
- uses: tkstang/github-typescript@v1
  with:
    ts-file: examples/with-utils.ts
    args: ${{ toJson({ message: 'Build completed successfully!' }) }}
```

## Running Examples

To test these examples in your repository:

1. Copy the example files to your `.github/scripts/` directory
2. Install any required dependencies (`github-typescript-utils` if using the second example)
3. Create a workflow that uses the action with the example script
4. Trigger the workflow and check the results

## Example Workflow

```yaml
name: Test Examples

on:
  workflow_dispatch:
    inputs:
      example:
        description: 'Which example to run'
        required: true
        default: 'basic-usage'
        type: choice
        options:
          - 'basic-usage'
          - 'with-utils'

jobs:
  run-example:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4

      - uses: pnpm/action-setup@v4
        with:
          version: 10

      - uses: actions/setup-node@v4
        with:
          node-version: 22
          cache: pnpm

      - name: Install dependencies (if needed)
        if: github.event.inputs.example == 'with-utils'
        run: pnpm add github-typescript-utils

      - name: Run example
        uses: tkstang/github-typescript@v1
        with:
          ts-file: examples/${{ github.event.inputs.example }}.ts
          args: ${{ toJson({ message: 'Running from workflow dispatch!' }) }}
```
