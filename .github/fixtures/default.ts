import data from './data.json' with { type: 'json' };
import type { ScriptInput } from './contract.ts';

export default async function run({ core, github, context, args }: ScriptInput) {
  core.info('Test script running!');
  return {
    success: true,
    eventName: context.eventName,
    repository: `${context.repo.owner}/${context.repo.repo}`,
    hasGitHubClient: typeof github.rest === 'object',
    input: data.value,
    args,
  };
}
