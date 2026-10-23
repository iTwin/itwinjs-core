// Runs `npm audit` against the pinned Rush bootstrap lockfile in ./rush-lockfile.
// No package.json is committed next to the lockfile, so one is reconstructed from its
// root dependencies in a temp dir and audited there.
//
// Fails on "high"/"critical" advisories by default, matching `rush audit`'s
// --audit-level high. Set AUDIT_LEVEL=low|moderate|critical to change that.
// Advisories listed in rush-lockfile/audit-exceptions.json are tolerated until their expiry date.
// An unreadable report or registry failure fails closed.

import { execSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { pathToFileURL } from "node:url";

const lockfileDir = path.join(".github", "workflows", "automation-scripts", "rush-lockfile");
const severityRank = { low: 0, moderate: 1, high: 2, critical: 3 };

function readExceptions(repoRoot) {
  const exceptionsPath = path.join(repoRoot, lockfileDir, "audit-exceptions.json");
  if (!fs.existsSync(exceptionsPath))
    return [];

  const exceptions = JSON.parse(fs.readFileSync(exceptionsPath, "utf8"));
  for (const entry of exceptions) {
    if (!entry.id || !entry.reason || !/^\d{4}-\d{2}-\d{2}$/.test(entry.expires ?? ""))
      throw new Error(`Invalid entry in audit-exceptions.json, each needs "id", "reason" and an "expires" date (YYYY-MM-DD): ${JSON.stringify(entry)}`);
  }
  return exceptions;
}

function auditUnavailable(details, cause) {
  const hint = "This usually means the npm registry or network was temporarily unavailable (or npm is not on PATH), "
    + "not that the lockfile has a vulnerability. Re-run the job; if it keeps failing, check https://status.npmjs.org/.";
  console.error(`::error::npm audit could not run. ${hint}`);
  return new Error(`npm audit could not run: ${details}\n${hint}`, cause ? { cause } : undefined);
}

function runNpmAudit(repoRoot) {
  const lockfilePath = path.join(repoRoot, lockfileDir, "package-lock.json");
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

    // npm audit exits nonzero on any finding, so read the report from stdout instead.
    // A fixed command string through the shell, so Windows can resolve npm.cmd.
    let stdout;
    try {
      stdout = execSync("npm audit --json", { cwd: tempDir, encoding: "utf8" });
    } catch (error) {
      stdout = error.stdout;
      if (!stdout)
        throw auditUnavailable(error.message, error);
    }

    let report;
    try {
      report = JSON.parse(stdout);
    } catch (error) {
      throw auditUnavailable(`unreadable report: ${stdout}`, error);
    }
    if (report.error || !report.vulnerabilities)
      throw auditUnavailable(JSON.stringify(report.error ?? report));
    return report;
  } finally {
    fs.rmSync(tempDir, { recursive: true, force: true });
  }
}

export function assertRushLockfileAuditClean(repoRoot = process.cwd()) {
  const auditLevel = (process.env.AUDIT_LEVEL ?? "high").toLowerCase();
  if (!(auditLevel in severityRank))
    throw new Error(`AUDIT_LEVEL must be one of ${Object.keys(severityRank).join(", ")}, got "${auditLevel}".`);

  const exceptions = readExceptions(repoRoot);
  const report = runNpmAudit(repoRoot);

  // Dependents of a vulnerable package only reference it by name, so the advisories live on the root entries.
  const advisories = new Map();
  for (const vulnerability of Object.values(report.vulnerabilities)) {
    for (const via of vulnerability.via) {
      if (typeof via !== "string" && severityRank[via.severity] >= severityRank[auditLevel])
        advisories.set(via.url.split("/").pop(), via);
    }
  }

  const today = new Date().toISOString().slice(0, 10);
  const failing = [];
  for (const [id, advisory] of advisories) {
    const exception = exceptions.find((e) => e.id === id);
    const description = `${advisory.name} (${advisory.severity}): ${advisory.title} - ${advisory.url}`;
    if (exception && exception.expires >= today) {
      console.warn(`::warning::npm audit exception until ${exception.expires}: ${description} (reason: ${exception.reason})`);
    } else {
      console.error(`::error::npm audit${exception ? ` (exception expired ${exception.expires})` : ""}: ${description}`);
      failing.push(id);
    }
  }

  for (const exception of exceptions) {
    if (!advisories.has(exception.id))
      console.warn(`::warning::${exception.id} is in audit-exceptions.json but no longer reported, remove it.`);
  }

  if (failing.length > 0) {
    console.error("Bump rush.json's rushVersion (or wait for an upstream fix) and regenerate rush-lockfile/package-lock.json,");
    console.error("or add a time-boxed entry to rush-lockfile/audit-exceptions.json.");
    throw new Error(
      `npm audit found ${failing.length} advisor${failing.length === 1 ? "y" : "ies"} at or above "${auditLevel}" severity in the Rush bootstrap lockfile.`,
    );
  }

  console.log(`npm audit: no unexcepted advisories at or above "${auditLevel}" severity in the Rush bootstrap lockfile.`);
}

// if the script file is executed directly
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  assertRushLockfileAuditClean();
}
