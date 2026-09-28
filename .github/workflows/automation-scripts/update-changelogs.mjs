// Cherry-picks changelogs from a just-released branch onto the next target branch
// (the latest release branch, or master), then commits the result.
//
// Uses only Node built-ins and the Rush version pinned in rush.json (via ./rush-lockfile,
// so `npm ci` runs; see check-rush-lockfile.yaml). Never pushes or receives the admin
// push token — only commits locally and prints/emits the refspecs still needing a push.
//
/****************************************************************
* To run manually:
* 1. git checkout <target branch> (master, or the newest release branch); git pull
* 2. git checkout release/X.X.x; git pull   (the branch that was just released)
* 3. Uncomment both lines in the MANUAL RUN BLOCK at the bottom of this file and
*    replace X.X.X in each with the released version. Uncommenting only the checkout
*    leaves the final push aimed at the protected target branch.
* 4. node .github/workflows/automation-scripts/update-changelogs.mjs
* 5. Run the `git push --atomic origin ...` command it prints.
* 6. Open a PR from finalize-release-X.X.X into the target branch.
*****************************************************************/

import { execFileSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { assertRushLockfileMatches } from "./check-rush-lockfile.mjs";

const repoRoot = process.cwd();
const rushLockfilePath = path.join(repoRoot, ".github", "workflows", "automation-scripts", "rush-lockfile", "package-lock.json");

// No shell is spawned, so arguments are not subject to word splitting or expansion.
function run(command, args, options = {}) {
  return execFileSync(command, args, {
    cwd: repoRoot,
    encoding: "utf8",
    stdio: ["ignore", "pipe", "inherit"],
    ...options,
  });
}

function git(...args) {
  return run("git", args).trim();
}

const pendingPushRefs = [];

function pushRef(refspec) {
  pendingPushRefs.push(refspec);
}

function rush(...args) {
  assertRushLockfileMatches(repoRoot);
  run(process.execPath, [path.join("common", "scripts", "install-run-rush.js"), ...args], {
    stdio: "inherit",
    env: { ...process.env, INSTALL_RUN_RUSH_LOCKFILE_PATH: rushLockfilePath },
  });
}

function readJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, "utf8"));
}

function writeJson(filePath, value) {
  fs.writeFileSync(filePath, `${JSON.stringify(value, null, 2)}\n`, "utf8");
}

function editFileInPlaceSynchronously(filePath, stringToSearch, stringToReplace) {
  const contentRead = fs.readFileSync(filePath, { encoding: "utf-8" });
  // A matched replacement can equal the original text, so check via match(), not equality.
  if (!contentRead.match(stringToSearch))
    throw new Error(`${stringToSearch} was not found in "${filePath}"; nothing to replace.`);
  fs.writeFileSync(filePath, contentRead.replace(stringToSearch, stringToReplace), { encoding: "utf-8" });
}

function findChangelogs(dir = repoRoot, found = []) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (entry.isDirectory()) {
      if (entry.name === "node_modules" || entry.name === ".git")
        continue;
      findChangelogs(path.join(dir, entry.name), found);
    } else if (entry.isFile() && entry.name === "CHANGELOG.json") {
      found.push(path.relative(repoRoot, path.join(dir, entry.name)));
    }
  }
  return found;
}

// Reads every CHANGELOG.json into memory, keyed by path relative to repoRoot.
function collectChangelogs() {
  const map = new Map();
  for (const relPath of findChangelogs())
    map.set(relPath, readJson(path.join(repoRoot, relPath)));
  return map;
}

// Newest first, by major.minor.patch.
function sortByVersion(entries) {
  return entries.sort((a, b) => {
    const versionA = a.version.split(".").map(Number);
    const versionB = b.version.split(".").map(Number);

    for (let i = 0; i < 3; i++) {
      if (versionA[i] < versionB[i]) return 1;
      if (versionA[i] > versionB[i]) return -1;
    }

    return 0;
  });
}

// Expects versions formatted "major.minor.x".
function findLargestVersion(versions) {
  return versions.reduce((largest, current) => {
    const [largestMajor, largestMinor] = largest.split(".").map(Number);
    const [currentMajor, currentMinor] = current.split(".").map(Number);

    if (currentMajor > largestMajor || (currentMajor === largestMajor && currentMinor > largestMinor))
      return current;

    return largest;
  });
}

// Newest first, dropping duplicate versions in favor of the incoming entry.
function mergeChangelogEntries(targetJson, incomingJson) {
  const combinedEntries = [...targetJson.entries, ...incomingJson.entries].map((obj) => [obj.version, obj]);
  targetJson.entries = sortByVersion(Array.from(new Map(combinedEntries).values()));
  return targetJson;
}

const branchVersions = git("branch", "-a", "--list", "origin/release/[0-9]*.[0-9]*.x")
  .split("\n")
  .map((line) => line.replace(/^[*+]?\s*remotes\/origin\/release\//, "").trim())
  .filter((version) => /^\d+\.\d+\.x$/.test(version));

if (branchVersions.length === 0)
  throw new Error("No origin/release/X.Y.x branches found. Was the repo cloned with fetch-depth: 0?");

let targetBranch = `origin/release/${findLargestVersion(branchVersions)}`;
const currentBranch = git("branch", "--show-current");

// Latest commit whose subject is exactly "X.X.X ...", excluding X.X.X-dev.X.
let commitMessage = git("log", "--grep=^[0-9]\\+\\.[0-9]\\+\\.[0-9]\\+[^-]*$", "-n", "1", "--pretty=format:%s");
commitMessage = commitMessage.replace(/\n/g, "").replace(" Changelogs", "");

if (!currentBranch)
  throw new Error("Detached HEAD; expected the workflow to check out a named branch.");

if (!/^release\/\d+\.\d+\.x$/.test(currentBranch))
  throw new Error(`Expected to be on a release/X.Y.x branch, but current branch is "${currentBranch}".`);

if (!/^\d+\.\d+\.\d+$/.test(commitMessage))
  throw new Error(`Could not determine the released version from git log (got "${commitMessage}").`);

console.log(`target branch: ${targetBranch}`);
console.log(`current branch: ${currentBranch}`);
console.log(`commit msg: ${commitMessage}`);

if (targetBranch === `origin/${currentBranch}`) {
  console.log("The current branch is the latest release, so the target will be master branch");
  targetBranch = "master";
} else {
  console.log(`The current branch is ${currentBranch}, so the target will be ${targetBranch} branch`);
}

const incomingMap = collectChangelogs();

// Major or minor release: repoint gather-docs.yaml at the release branch. Must happen
// before the target branch is checked out.
if (commitMessage.endsWith(".0")) {
  const docsYamlPath = "common/config/azure-pipelines/templates/gather-docs.yaml";
  // File says "master" (never released a minor) or a prior release/X.Y.z; only one matches.
  editFileInPlaceSynchronously(docsYamlPath, /master|release\/\d+\.\d+\.\w+/g, currentBranch);
  git("add", docsYamlPath);
  git("commit", "-m", "Update gather-docs.yaml's branch name to the release branch");
  pushRef(`${currentBranch}:${currentBranch}`);
}

targetBranch = targetBranch.replace("origin/", "");
git("checkout", targetBranch);

const targetMap = collectChangelogs();

// Packages added after the release branch was cut have no incoming counterpart.
const filesToMerge = [...targetMap.keys()].filter((file) => {
  if (incomingMap.has(file))
    return true;
  console.log(`${file} is not a package in ${currentBranch}. Skipping this package.`);
  return false;
});

for (const file of filesToMerge)
  writeJson(path.join(repoRoot, file), mergeChangelogEntries(targetMap.get(file), incomingMap.get(file)));

// Major or minor release: carry over the changehistory doc and link it.
if (commitMessage.endsWith(".0")) {
  git("checkout", currentBranch, `docs/changehistory/${commitMessage}.md`);

  const leftNavMdPath = "docs/changehistory/leftNav.md";
  editFileInPlaceSynchronously(
    leftNavMdPath,
    "### Versions\n",
    `### Versions\n\n- [${commitMessage}](./${commitMessage}.md)\n`,
  );
}

rush("publish", "--regenerate-changelogs");

// >>> BEGIN MANUAL RUN BLOCK — uncomment both lines, replace X.X.X with the released
// version, and do not commit this file with the block enabled. It redirects the final
// push to a scratch branch instead of writing straight to targetBranch.
// git("checkout", "-b", "finalize-release-X.X.X");
// targetBranch = "finalize-release-X.X.X";
// <<< END MANUAL RUN BLOCK

git("add", ".");
git("commit", "-m", `${commitMessage} Changelogs`);
rush("change", "--bulk", "--message", "", "--bump-type", "none");
git("add", ".");
git("commit", "--amend", "--no-edit");
pushRef(`HEAD:${targetBranch}`);

const refs = pendingPushRefs.join(" ");
if (process.env.GITHUB_OUTPUT) {
  // Hand off queued refspecs to the workflow's push step.
  fs.appendFileSync(process.env.GITHUB_OUTPUT, `refs=${refs}\n`);
} else {
  console.log(`\nRun this to push the finalized release:\n  git push --atomic origin ${refs}\n`);
}
