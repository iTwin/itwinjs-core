/*---------------------------------------------------------------------------------------------
 * Copyright (c) Bentley Systems, Incorporated. All rights reserved.
 * See LICENSE.md in the project root for license terms and full copyright notice.
 *--------------------------------------------------------------------------------------------*/

// Benchmark driver for full-stack-tests/core Electron renderer tests.
// Runs the suite at 1, 2, and 4 shards (sequentially) and emits a
// markdown + JSON report comparing timing and memory across configurations.
//
// Usage:
//   rushx benchmark:electron
//
// Optional env vars:
//   BENCHMARK_SHARDS   — comma-separated shard counts (default: "1,2,4")
//   BENCHMARK_OUTPUT   — path for JSON report (default: lib/benchmark-report.json)
//   GITHUB_STEP_SUMMARY — set by GHA to append step summary markdown

import { benchmarkElectronTests, formatReportAsGitHubSummary } from "@itwin/vitest-certa-bridge/electron";
import * as path from "path";
import * as fs from "fs";

const shardCounts = (process.env.BENCHMARK_SHARDS ?? "1,2,4")
  .split(",")
  .map((n) => parseInt(n.trim(), 10))
  .filter((n) => !isNaN(n) && n > 0);

const reportOutputPath = process.env.BENCHMARK_OUTPUT
  ?? path.resolve(process.cwd(), "lib", "benchmark-report.json");

const grepPattern = process.env.VITEST_ELECTRON_GREP ?? "#integration|#performance";
const invertGrep = process.env.VITEST_ELECTRON_INVERT !== "false";

async function main() {
  const report = await benchmarkElectronTests({
    backendInitModule: path.resolve(process.cwd(), "lib/backend/backend"),
    setupFile: path.resolve(process.cwd(), "lib/frontend/vitest.setup.js"),
    testDir: path.resolve(process.cwd(), "lib/frontend"),
    envFile: path.resolve(process.cwd(), ".env"),
    grepPattern,
    invertGrep,
    shardCounts,
    reportOutputPath,
    env: {
      // eslint-disable-next-line @typescript-eslint/naming-convention
      IMODELJS_CORE_DIRNAME: path.resolve(process.cwd(), "../.."),
    },
  });

  // Write GitHub Actions step summary if running in CI
  if (process.env.GITHUB_STEP_SUMMARY) {
    const summary = formatReportAsGitHubSummary(report);
    fs.appendFileSync(process.env.GITHUB_STEP_SUMMARY, `\n${summary}\n`);
  }

  // Only fail if the highest shard count (production config) has failures.
  // Lower shard counts (e.g., 1-shard baseline) may legitimately fail due to
  // timeout or resource starvation on CI — that's informational, not blocking.
  const productionRun = report.runs[report.runs.length - 1];
  process.exit(productionRun.failed > 0 ? 1 : 0);
}

main().catch((err) => {
  process.stderr.write(`${String(err)}\n`);
  process.exit(1);
});
