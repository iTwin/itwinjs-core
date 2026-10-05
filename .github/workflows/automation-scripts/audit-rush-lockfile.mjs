// Runs `npm audit` against the pinned Rush bootstrap lockfile in ./rush-lockfile.
// No package.json is committed next to the lockfile, so one is reconstructed from its
// root dependencies in a temp dir and audited there.
//
// Fails on "high"/"critical" advisories by default, matching `rush audit`'s
// --audit-level high. Set AUDIT_LEVEL=low|moderate|critical to change that.
// npm audit also exits nonzero when the registry can't be reached, so that fails closed too.

import { execFileSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { pathToFileURL } from "node:url";

const lockfileRelPath = path.join(".github", "workflows", "automation-scripts", "rush-lockfile", "package-lock.json");

export function assertRushLockfileAuditClean(repoRoot = process.cwd()) {
  const auditLevel = (process.env.AUDIT_LEVEL ?? "high").toLowerCase();
  if (!["low", "moderate", "high", "critical"].includes(auditLevel))
    throw new Error(`AUDIT_LEVEL must be one of low, moderate, high, critical, got "${auditLevel}".`);

  const lockfilePath = path.join(repoRoot, lockfileRelPath);
  const lockfile = JSON.parse(fs.readFileSync(lockfilePath, "utf8"));
  const rootDependencies = lockfile.packages?.[""]?.dependencies ?? {};

  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "rush-lockfile-audit-"));
  try {
    fs.copyFileSync(lockfilePath, path.join(tempDir, "package-lock.json"));
    fs.writeFileSync(
      path.join(tempDir, "package.json"),
      `${JSON.stringify({ name: "ci-rush", version: "0.0.0", private: true, dependencies: rootDependencies }, null, 2)}\n`,
      "utf8",
    );

    try {
      execFileSync("npm", ["audit", `--audit-level=${auditLevel}`], { cwd: tempDir, stdio: "inherit" });
    } catch {
      throw new Error(
        `npm audit failed for the Rush bootstrap lockfile (advisory at or above "${auditLevel}" severity, or the audit could not run).\n` +
        "For an advisory, bump rush.json's rushVersion (or wait for an upstream fix),\n" +
        "regenerate rush-lockfile/package-lock.json, and re-run.",
      );
    }
  } finally {
    fs.rmSync(tempDir, { recursive: true, force: true });
  }
}

// if the script file is executed directly
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  assertRushLockfileAuditClean();
}
