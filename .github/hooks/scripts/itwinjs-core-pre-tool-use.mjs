import { execFile } from "node:child_process";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { compactJson, getBashCommand, isGitCommitCommand, readHookInput } from "./itwinjs-core-hook-utils.mjs";

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), "../../..");
const rushLauncherPath = resolve(repoRoot, "common/scripts/install-run-rush.js");

function runRushChangeVerify() {
  return new Promise((resolve, reject) => {
    execFile(process.execPath, [rushLauncherPath, "change", "--verify"], { cwd: repoRoot, timeout: 30_000 }, (error, stdout, stderr) => {
      if (error) {
        reject(new Error(stderr || stdout || error.message));
        return;
      }
      resolve();
    });
  });
}

const input = await readHookInput();

if (String(input.toolName ?? "").toLowerCase() !== "bash") {
  process.exit(0);
}

const command = getBashCommand(input);
if (!isGitCommitCommand(command)) {
  process.exit(0);
}

try {
  await runRushChangeVerify();
  process.exit(0);
} catch (error) {
  process.stdout.write(
    compactJson({
      permissionDecision: "deny",
      permissionDecisionReason: `rush change --verify failed before git commit: ${
        error instanceof Error ? error.message.trim() : String(error)
      }`,
    }),
  );
}
