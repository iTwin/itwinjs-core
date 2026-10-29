// Fails if the Rush bootstrap lockfile's @microsoft/rush version doesn't match rush.json.
// Shared by update-changelogs.mjs (release time) and the "Check Rush lockfile" CI job (PR time).

import fs from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";

export function assertRushLockfileMatches(repoRoot) {
  const lockfilePath = path.join(repoRoot, ".github", "workflows", "automation-scripts", "rush-lockfile", "package-lock.json");
  const { rushVersion } = JSON.parse(fs.readFileSync(path.join(repoRoot, "rush.json"), "utf8"));
  const lockedVersion = JSON.parse(fs.readFileSync(lockfilePath, "utf8")).packages?.[""]?.dependencies?.["@microsoft/rush"];

  if (lockedVersion !== rushVersion) {
    throw new Error(
      `Rush bootstrap lockfile is out of date: rush.json pins ${rushVersion}, but ` +
      `${path.relative(repoRoot, lockfilePath)} pins ${lockedVersion}. Regenerate it ` +
      "(see the README next to it).",
    );
  }
}

// if the script file is executed directly
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  assertRushLockfileMatches(process.cwd());
  console.log("Rush bootstrap lockfile matches rush.json.");
}
