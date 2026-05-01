import { execFile } from "node:child_process";
import { compactJson, getBashCommand, isGitCommitCommand, readHookInput } from "./itwinjs-core-hook-utils.mjs";

function runRushChangeVerify() {
  return new Promise((resolve, reject) => {
    execFile("rush", ["change", "--verify"], { timeout: 30_000 }, (error, stdout, stderr) => {
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
