// Cherry-picks changelogs from a just-released branch onto the next target branch
// (the latest release branch, or master), then pushes the result.
//
// Uses only Node built-ins and the Rush version pinned in rush.json. This runs with
// credentials that can push to protected branches, so it must not fetch and execute
// arbitrary code at run time.
//
/****************************************************************
* To run manually:
* 1. git checkout <target branch> (master, or the newest release branch); git pull
* 2. git checkout release/X.X.x; git pull   (the branch that was just released)
* 3. Uncomment both lines in the MANUAL RUN BLOCK at the bottom of this file and
*    replace X.X.X in each with the released version. Uncommenting only the checkout
*    leaves the final push aimed at the protected target branch.
* 4. node .github/workflows/automation-scripts/update-changelogs.mjs
* 5. Open a PR from finalize-release-X.X.X into the target branch.
*****************************************************************/

import { execFileSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";

const repoRoot = process.cwd();
const targetPath = "temp-target-changelogs";
const incomingPath = "temp-incoming-changelogs";

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

function rush(...args) {
  run(process.execPath, [path.join("common", "scripts", "install-run-rush.js"), ...args], {
    stdio: "inherit",
  });
}

function readJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, "utf8"));
}

function writeJson(filePath, value) {
  fs.writeFileSync(filePath, `${JSON.stringify(value, null, 2)}\n`, "utf8");
}

function editFileInPlaceSynchronously(filePath, stringToSearch, stringToReplace) {
  try {
    const contentRead = fs.readFileSync(filePath, { encoding: "utf-8" });
    const contentToWrite = contentRead.replace(stringToSearch, stringToReplace);
    fs.writeFileSync(filePath, contentToWrite, { encoding: "utf-8" });
  } catch (err) {
    console.log(`Error while reading or writing to "${filePath}": ${err}`);
  }
}

function findChangelogs(dir = repoRoot, found = []) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (entry.isDirectory()) {
      if (entry.name === "node_modules" || entry.name === ".git" ||
          entry.name === targetPath || entry.name === incomingPath)
        continue;
      findChangelogs(path.join(dir, entry.name), found);
    } else if (entry.isFile() && entry.name === "CHANGELOG.json") {
      found.push(path.relative(repoRoot, path.join(dir, entry.name)));
    }
  }
  return found;
}

// Flattens each changelog into `destDir` and returns flattened name -> real path.
// The map is required because the flattened name is lossy: a package directory
// containing an underscore cannot be reversed back into a path.
function collectChangelogs(destDir) {
  fs.mkdirSync(destDir, { recursive: true });
  const map = new Map();
  for (const relPath of findChangelogs()) {
    const flatName = relPath.split(path.sep).join("_");
    fs.copyFileSync(path.join(repoRoot, relPath), path.join(destDir, flatName));
    map.set(flatName, relPath);
  }
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

function fixChangeLogs(files) {
  for (const file of files) {
    const currentJson = readJson(path.join(targetPath, file));
    const incomingJson = readJson(path.join(incomingPath, file));
    // Map drops duplicate versions, keeping the incoming entry.
    const combinedEntries = [...currentJson.entries, ...incomingJson.entries].map((obj) => [obj.version, obj]);
    currentJson.entries = sortByVersion(Array.from(new Map(combinedEntries).values()));
    writeJson(path.join(targetPath, file), currentJson);
  }
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

const incomingMap = collectChangelogs(incomingPath);

// Major or minor release: repoint gather-docs.yaml at the release branch. Must happen
// before the target branch is checked out.
if (commitMessage.endsWith(".0")) {
  const docsYamlPath = "common/config/azure-pipelines/templates/gather-docs.yaml";
  editFileInPlaceSynchronously(docsYamlPath, /master/g, currentBranch);
  editFileInPlaceSynchronously(docsYamlPath, /release\/\d+\.\d+\.\w+/g, currentBranch);
  git("add", docsYamlPath);
  git("commit", "-m", "Update gather-docs.yaml's branch name to the release branch");
  git("push", "origin", `HEAD:${currentBranch}`);
}

targetBranch = targetBranch.replace("origin/", "");
git("checkout", targetBranch);

const targetMap = collectChangelogs(targetPath);

// Packages added after the release branch was cut have no incoming counterpart.
const filesToMerge = [...targetMap.keys()].filter((file) => {
  if (incomingMap.has(file))
    return true;
  console.log(`${file} is not a package in ${currentBranch}. Skipping this package.`);
  return false;
});

fixChangeLogs(filesToMerge);

for (const file of filesToMerge)
  fs.copyFileSync(path.join(targetPath, file), path.join(repoRoot, targetMap.get(file)));

fs.rmSync(targetPath, { recursive: true, force: true });
fs.rmSync(incomingPath, { recursive: true, force: true });

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
git("push", "origin", `HEAD:${targetBranch}`);
