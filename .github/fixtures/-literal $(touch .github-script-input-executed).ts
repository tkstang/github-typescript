import type { ScriptInput } from './contract.ts';

export async function run({ args }: ScriptInput) {
  return args.message;
}
