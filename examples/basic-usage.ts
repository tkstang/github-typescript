/**
 * Basic usage example for github-typescript
 * This script demonstrates the minimal setup needed for a TypeScript script
 */

type Args = {
  message?: string;
};

export default async function run({
  core,
  github,
  context,
  args,
}: {
  core: typeof import("@actions/core");
  github: ReturnType<typeof import("@actions/github").getOctokit>;
  context: typeof import("@actions/github").context;
  args: Args;
}) {
  const message = args.message || "Hello from TypeScript!";

  core.info(`Running script with message: ${message}`);
  core.info(`Repository: ${context.repo.owner}/${context.repo.repo}`);
  core.info(`Event: ${context.eventName}`);
  core.info(`Actor: ${context.actor}`);

  return {
    success: true,
    message,
    repository: `${context.repo.owner}/${context.repo.repo}`,
    eventName: context.eventName,
    timestamp: new Date().toISOString(),
  };
}
