import {
  getChangedPaths,
  getChangedPathText,
  isPackageJsonPath,
  isWriteLikeTool,
  readHookInput,
} from "./itwinjs-core-hook-utils.mjs";

const input = await readHookInput();
const messages = [];
const isWriteLike = isWriteLikeTool(input.toolName);

if (isWriteLike) {
  const changedPaths = getChangedPaths(input);

  if (changedPaths.some(isPackageJsonPath)) {
    messages.push("[itwinjs] package.json changed - run rush update to sync pnpm-lock.yaml before committing.");
  }

  if (changedPaths.some((path) => path.includes("tsconfig")) || /tsconfig/i.test(getChangedPathText(input))) {
    messages.push(
      "[itwinjs] tsconfig changed - clean and rebuild to avoid stale lib/ artifacts: from the affected package directory run rushx clean && rushx build, or from the repo root use rush clean && rush build.",
    );
  }
}

if (messages.length > 0) {
  process.stderr.write(`${messages.join("\n")}\n`);
}
