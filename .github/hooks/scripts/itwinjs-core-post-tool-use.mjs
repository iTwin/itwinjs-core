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
const changedPathText = getChangedPathText(input);
const changedPaths = getChangedPaths(input);
const command = getBashCommand(input);

if (isWriteLikeTool(input.toolName) && changedPaths.some(isPackageJsonPath)) {
  messages.push("[itwinjs] package.json changed - run rush update to sync pnpm-lock.yaml before committing.");
}

if (isWriteLikeTool(input.toolName) && (changedPaths.some((path) => path.includes("tsconfig")) || /tsconfig/i.test(changedPathText))) {
  messages.push("[itwinjs] tsconfig changed - run rushx clean && rushx build, not just build, to avoid stale lib/ artifacts.");
}

if (String(input.toolName ?? "").toLowerCase() === "bash" && isGitCommitCommand(command)) {
  messages.push(
    "[itwinjs] Commit checklist: (1) any .ts files staged? -> rushx lint; (2) any @public/@beta symbol or TSDoc comment changed? -> rush extract-api + commit .api.md; (3) package.json dep changed? -> rush update committed; (4) changed a package with dependents? -> run downstream tests.",
  );
}

if (messages.length > 0) {
  process.stderr.write(`${messages.join("\n")}\n`);
}
