import {
  getBashCommand,
  getChangedPaths,
  getChangedPathText,
  isGitCommitCommand,
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

if (String(input.toolName ?? "").toLowerCase() === "bash") {
  const command = getBashCommand(input);
  if (isGitCommitCommand(command)) {
    messages.push(
      "[itwinjs] Commit checklist: (1) any .ts files staged? -> rush lint from the repo root, or rushx lint from the affected package; (2) any @public/@beta symbol or TSDoc comment changed? -> rush extract-api + commit .api.md; (3) package.json dep changed? -> rush update committed; (4) changed a package with dependents? -> run downstream tests.",
    );
  }
}

if (messages.length > 0) {
  process.stderr.write(`${messages.join("\n")}\n`);
}
