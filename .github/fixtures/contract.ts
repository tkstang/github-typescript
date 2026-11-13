export interface ScriptInput {
  core: { info(message: string): void };
  github: { rest: object };
  context: { eventName: string; repo: { owner: string; repo: string } };
  args: { message: string };
}
