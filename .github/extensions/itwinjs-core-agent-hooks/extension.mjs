import { execFile } from "node:child_process";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { joinSession } from "@github/copilot-sdk/extension";

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..", "..", "..");

function errorMessage(error) {
  return error instanceof Error ? error.message : String(error);
}

function run(command, args, options = {}) {
  return new Promise((resolve, reject) => {
    execFile(command, args, { cwd: repoRoot, timeout: 30_000, ...options }, (error, stdout, stderr) => {
      if (error) {
        reject(new Error(stderr || stdout || error.message));
        return;
      }
      resolve(stdout.trim());
    });
  });
}

function parseToolArgs(toolArgs) {
  if (!toolArgs) {
    return {};
  }
  if (typeof toolArgs === "object") {
    return toolArgs;
  }
  if (typeof toolArgs === "string") {
    try {
      return JSON.parse(toolArgs);
    } catch {
      return { raw: toolArgs };
    }
  }
  return {};
}

function getBashCommand(toolArgs) {
  const parsed = parseToolArgs(toolArgs);
  return typeof parsed.command === "string" ? parsed.command : "";
}

function isGitCommitCommand(command) {
  return /\bgit\s+(?:-[^\s]+\s+)*commit\b/.test(command);
}

function getChangedPathText(input) {
  const parsed = parseToolArgs(input.toolArgs);
  const directPath = parsed.file_path ?? parsed.path ?? "";
  return `${directPath}\n${JSON.stringify(parsed)}`;
}

function getChangedPaths(input) {
  const parsed = parseToolArgs(input.toolArgs);
  return [parsed.file_path, parsed.path].filter((path) => typeof path === "string" && path.length > 0);
}

function isPackageJsonPath(path) {
  return String(path).split(/[\\/]/).pop() === "package.json";
}

const session = await joinSession({
  hooks: {
    onPreToolUse: async (input) => {
      if (input.toolName !== "bash" || !isGitCommitCommand(getBashCommand(input.toolArgs))) {
        return;
      }

      try {
        await run("rush", ["change", "--verify"]);
      } catch (error) {
        return {
          permissionDecision: "deny",
          permissionDecisionReason: `rush change --verify failed before git commit: ${errorMessage(error).trim()}`,
        };
      }
    },
    onPostToolUse: async (input) => {
      const messages = [];
      const changedPathText = getChangedPathText(input);
      const changedPaths = getChangedPaths(input);
      const command = getBashCommand(input.toolArgs);
      const isWriteLikeTool = /^(edit|create|write|apply_patch)$/i.test(input.toolName);

      if (isWriteLikeTool && changedPaths.some(isPackageJsonPath)) {
        messages.push("[itwinjs] package.json changed - run rush update to sync pnpm-lock.yaml before committing.");
      }

      if (isWriteLikeTool && (changedPaths.some((path) => path.includes("tsconfig")) || /tsconfig/i.test(changedPathText))) {
        messages.push("[itwinjs] tsconfig changed - run rushx clean && rushx build, not just build, to avoid stale lib/ artifacts.");
      }

      if (input.toolName === "bash" && isGitCommitCommand(command)) {
        messages.push("[itwinjs] Commit checklist: (1) any .ts files staged? -> rushx lint; (2) any @public/@beta symbol or TSDoc comment changed? -> rush extract-api + commit .api.md; (3) package.json dep changed? -> rush update committed; (4) changed a package with dependents? -> run downstream tests.");
      }

      if (messages.length > 0) {
        const message = messages.join("\n");
        await session.log(message, { level: "warning" });
        return { additionalContext: message };
      }
    },
  },
  tools: [],
});
