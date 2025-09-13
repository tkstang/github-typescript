// @ts-nocheck - This is an example file, package would be installed by users
/**
 * Example using github-typescript-utils
 * This demonstrates how to use the utility package with github-typescript
 */
import {
  createStickyComment,
  getRepoInfo,
  getCurrentPullRequestNumber,
  isPullRequestContext,
  type GitHubContext,
} from "github-typescript-utils";

type Args = {
  message: string;
  identifier?: string;
};

export default async function run(ctx: GitHubContext & { args: Args }) {
  const { core, github, context, args } = ctx;
  const { message, identifier = "example-comment" } = args;

  const repo = getRepoInfo(ctx);
  const isPR = isPullRequestContext(ctx);

  core.info(`Repository: ${repo.owner}/${repo.repo}`);
  core.info(`Is Pull Request: ${isPR}`);

  if (isPR) {
    const prNumber = getCurrentPullRequestNumber(ctx);
    if (prNumber) {
      core.info(`Pull Request #${prNumber}`);

      // Create or update sticky comment
      const comment = await createStickyComment({
        ctx,
        repo,
        issueNumber: prNumber,
        options: {
          identifier,
          body: `## 🤖 Bot Update\n\n${message}\n\n_Updated at: ${new Date().toISOString()}_`,
        },
      });

      core.info(`Comment created/updated: ${comment.html_url}`);

      return {
        success: true,
        commentId: comment.id,
        commentUrl: comment.html_url,
        pullRequestNumber: prNumber,
        message,
      };
    }
  }

  core.info("Not running on a pull request, skipping comment creation");
  return {
    success: true,
    skipped: true,
    reason: "Not a pull request context",
  };
}
