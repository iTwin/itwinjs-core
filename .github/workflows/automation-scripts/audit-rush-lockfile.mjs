// Runs `npm audit` against the pinned Rush bootstrap lockfile in ./rush-lockfile.
// No package.json is committed next to the lockfile, so one is reconstructed from its
// root dependencies in a temp dir and audited there.
//
// Fails on "high"/"critical" advisories by default, matching `rush audit`'s
// --audit-level high. Set AUDIT_LEVEL=moderate|critical to change that.

import { execFileSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

const repoRoot = process.cwd();
const lockfileDir = path.join(repoRoot, ".github", "workflows", "automation-scripts", "rush-lockfile");
const lockfilePath = path.join(lockfileDir, "package-lock.json");

const severityRank = { low: 0, moderate: 1, high: 2, critical: 3 };
const failLevel = (process.env.AUDIT_LEVEL ?? "high").toLowerCase();
if (!(failLevel in severityRank))
  throw new Error(`AUDIT_LEVEL must be one of ${Object.keys(severityRank).join(", ")}, got "${failLevel}".`);

function readJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, "utf8"));
}

function auditLockfile() {
  const lockfile = readJson(lockfilePath);
  const rootDependencies = lockfile.packages?.[""]?.dependencies ?? {};

  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "rush-lockfile-audit-"));
  try {
    fs.copyFileSync(lockfilePath, path.join(tempDir, "package-lock.json"));
    fs.writeFileSync(
      path.join(tempDir, "package.json"),
      `${JSON.stringify({ name: "ci-rush", version: "0.0.0", private: true, dependencies: rootDependencies }, null, 2)}\n`,
      "utf8",
    );

    // Read report from stdout, not exit code: npm audit exits 1 on any finding.
    let stdout;
    try {
      stdout = execFileSync("npm", ["audit", "--json"], { cwd: tempDir, encoding: "utf8" });
    } catch (error) {
      stdout = error.stdout;
      if (!stdout)
        throw error;
    }

    const report = JSON.parse(stdout);
    // Fail closed on registry/API failures instead of reporting a clean audit.
    if (report.error) {
      throw new Error(
        `npm audit could not run: ${report.error.summary ?? report.error.code ?? JSON.stringify(report.error)}`,
      );
    }
    return report;
  } finally {
    fs.rmSync(tempDir, { recursive: true, force: true });
  }
}

export function assertRushLockfileAuditClean() {
  const report = auditLockfile();
  const vulnerabilities = Object.values(report.vulnerabilities ?? {});

  if (vulnerabilities.length === 0) {
    console.log("npm audit: no known vulnerabilities in the Rush bootstrap lockfile.");
    return;
  }

  const failing = vulnerabilities.filter((v) => severityRank[v.severity] >= severityRank[failLevel]);
  const warning = vulnerabilities.filter((v) => severityRank[v.severity] < severityRank[failLevel]);

  for (const v of warning)
    console.warn(`::warning::npm audit (${v.severity}): ${v.name} — ${v.via.map((x) => (typeof x === "string" ? x : x.title)).join(", ")}`);

  for (const v of failing)
    console.error(`::error::npm audit (${v.severity}): ${v.name} — ${v.via.map((x) => (typeof x === "string" ? x : x.title)).join(", ")}`);

  if (failing.length > 0) {
    throw new Error(
      `npm audit found ${failing.length} advisor${failing.length === 1 ? "y" : "ies"} at or above "${failLevel}" severity ` +
      `in the Rush bootstrap lockfile. Bump rush.json's rushVersion (or wait for an upstream fix), regenerate ` +
      "rush-lockfile/package-lock.json, and re-run.",
    );
  }

  console.log(
    `npm audit: ${warning.length} advisor${warning.length === 1 ? "y" : "ies"} below "${failLevel}" severity, none blocking.`,
  );
}

// if the script file is executed directly
if (import.meta.url === `file://${process.argv[1]}`) {
  assertRushLockfileAuditClean();
}
