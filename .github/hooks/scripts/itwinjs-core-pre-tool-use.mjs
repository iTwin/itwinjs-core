import { execFile } from "node:child_process";
import { readFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { compactJson, getBashCommand, isGitCommitCommand, readHookInput } from "./itwinjs-core-hook-utils.mjs";

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), "../../..");
const rushLauncherPath = resolve(repoRoot, "common/scripts/install-run-rush.js");
const targetBranch = "origin/master";

function runCommand(command, args, timeout = 30_000) {
  return new Promise((resolve, reject) => {
    execFile(command, args, { cwd: repoRoot, timeout }, (error, stdout, stderr) => {
      if (error) {
        reject(new Error(stderr || stdout || error.message));
        return;
      }
      resolve(stdout.trim());
    });
  });
}

function runRushChangeVerify() {
  return runCommand(process.execPath, [rushLauncherPath, "change", "--verify"]);
}

async function loadPublishedProjects() {
  const rushConfig = JSON.parse(await readFile(resolve(repoRoot, "rush.json"), "utf8"));
  return rushConfig.projects
    .filter((project) => project.shouldPublish !== false)
    .map((project) => ({
      packageName: project.packageName,
      projectFolder: String(project.projectFolder).replace(/\\/g, "/"),
    }));
}

function collectChangedProjects(changedPaths, projects) {
  const normalizedPaths = changedPaths.map((path) => path.replace(/\\/g, "/"));
  return projects.filter((project) =>
    normalizedPaths.some((path) => path === project.projectFolder || path.startsWith(`${project.projectFolder}/`)));
}

function collectPackageNamesFromChangeFile(changeFile) {
  const packageNames = new Set();
  if (typeof changeFile.packageName === "string")
    packageNames.add(changeFile.packageName);

  if (Array.isArray(changeFile.changes)) {
    for (const entry of changeFile.changes) {
      if (typeof entry?.packageName === "string")
        packageNames.add(entry.packageName);
    }
  }

  return packageNames;
}

async function getStagedChangeDescriptionCoverage() {
  const baseCommit = await runCommand("git", ["merge-base", "HEAD", targetBranch]);
  const stagedTree = await runCommand("git", ["write-tree"]);
  const changedPathsOutput = await runCommand("git", ["diff", "--name-only", baseCommit, stagedTree]);
  const changedPaths = changedPathsOutput ? changedPathsOutput.split("\n").filter(Boolean) : [];
  const changedProjects = collectChangedProjects(changedPaths, await loadPublishedProjects());
  if (changedProjects.length === 0)
    return { ok: false, reason: "No published Rush project changes detected in the staged tree." };

  const stagedChangeFilesOutput = await runCommand("git", [
    "diff",
    "--name-only",
    "--diff-filter=AM",
    baseCommit,
    stagedTree,
    "--",
    "common/changes",
  ]);
  const stagedChangeFiles = stagedChangeFilesOutput
    ? stagedChangeFilesOutput.split("\n").filter((path) => path.endsWith(".json"))
    : [];

  const coveredPackages = new Set();
  for (const changeFilePath of stagedChangeFiles) {
    const raw = await runCommand("git", ["show", `${stagedTree}:${changeFilePath}`]);
    try {
      const parsed = JSON.parse(raw);
      for (const packageName of collectPackageNamesFromChangeFile(parsed))
        coveredPackages.add(packageName);
    } catch {
      return { ok: false, reason: `Unable to parse staged change file: ${changeFilePath}` };
    }
  }

  const missingProjects = changedProjects.filter((project) => !coveredPackages.has(project.packageName));
  if (missingProjects.length > 0) {
    return {
      ok: false,
      reason: `Missing staged change descriptions for: ${missingProjects.map((project) => project.packageName).join(", ")}`,
    };
  }

  return { ok: true };
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
  try {
    const stagedCoverage = await getStagedChangeDescriptionCoverage();
    if (stagedCoverage.ok) {
      process.exit(0);
    }

    process.stdout.write(
      compactJson({
        permissionDecision: "deny",
        permissionDecisionReason: `rush change --verify failed before git commit: ${
          error instanceof Error ? error.message.trim() : String(error)
        }\nStaged-tree fallback check: ${stagedCoverage.reason}`,
      }),
    );
  } catch (fallbackError) {
    process.stdout.write(
      compactJson({
        permissionDecision: "deny",
        permissionDecisionReason: `rush change --verify failed before git commit: ${
          error instanceof Error ? error.message.trim() : String(error)
        }\nStaged-tree fallback check also failed: ${fallbackError instanceof Error ? fallbackError.message.trim() : String(fallbackError)}`,
      }),
    );
  }
}
