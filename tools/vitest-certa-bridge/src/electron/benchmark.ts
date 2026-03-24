/*---------------------------------------------------------------------------------------------
 * Copyright (c) Bentley Systems, Incorporated. All rights reserved.
 * See LICENSE.md in the project root for license terms and full copyright notice.
 *--------------------------------------------------------------------------------------------*/

// Benchmark runner: executes the Electron test suite at multiple shard counts,
// collects timing and memory metrics, and produces a structured report.

import * as os from "os";
import * as fs from "fs";
import * as path from "path";
import { runElectronTests } from "./runner.js";
import type { BenchmarkReport, BenchmarkRunResult, ElectronTestRunnerOptions } from "./types.js";

export interface BenchmarkElectronOptions extends Omit<ElectronTestRunnerOptions, "shardCount" | "benchmarkMode"> {
  /**
   * Shard counts to test in sequence (default: [1, 2, 4]).
   * Each value triggers a full run of the test suite.
   */
  shardCounts?: number[];
  /** Path to write the JSON report (optional). */
  reportOutputPath?: string;
  /** Log progress to stdout (default: true). */
  verbose?: boolean;
}

function fmtMs(ms: number): string {
  return ms >= 60_000
    ? `${(ms / 60_000).toFixed(1)}m`
    : `${(ms / 1000).toFixed(1)}s`;
}

function fmtMb(kb: number): string {
  return `${(kb / 1024).toFixed(0)} MB`;
}

function buildWarnings(report: BenchmarkReport): string[] {
  const warnings: string[] = [];
  const availableMb = report.availableRamBytes / 1024 / 1024;

  for (const run of report.runs) {
    const concurrentRssMb = run.totalPeakRssKb / 1024;

    if (concurrentRssMb > availableMb * 0.8) {
      warnings.push(
        `⚠️  ${run.shardCount} shards: estimated concurrent RSS ~${concurrentRssMb.toFixed(0)} MB ` +
        `exceeds 80% of available RAM (${availableMb.toFixed(0)} MB). Risk of memory pressure.`,
      );
    }

    if (run.shardCount > report.cpuCores) {
      warnings.push(
        `⚠️  ${run.shardCount} shards on ${report.cpuCores}-core machine: ` +
        `more shards than cores may cause CPU starvation. Check that per-shard duration scales sub-linearly.`,
      );
    }

    if (run.failed > 0) {
      warnings.push(
        `⚠️  ${run.shardCount} shards: ${run.failed} shard(s) failed — ` +
        `possible resource starvation or test isolation issue.`,
      );
    }

    // If slowest shard takes > 2× the median, flag potential imbalance or starvation
    const durations = run.shards.map((s) => s.durationMs).sort((a, b) => a - b);
    const median = durations[Math.floor(durations.length / 2)];
    const max = durations[durations.length - 1];
    if (max > median * 2.5) {
      warnings.push(
        `⚠️  ${run.shardCount} shards: shard imbalance detected — slowest shard (${fmtMs(max)}) ` +
        `is >2.5× the median (${fmtMs(median)}). Consider re-distributing test files or reducing shard count.`,
      );
    }
  }

  return warnings;
}

function printMarkdownTable(report: BenchmarkReport): void {
  const baselineRun = report.runs.find((r) => r.shardCount === 1);

  console.log("\n## Electron Test Benchmark Results\n");
  console.log(`Platform: ${report.platform} | CPUs: ${report.cpuCores} | RAM: ${fmtMb(report.availableRamBytes / 1024)} available of ${fmtMb(report.totalRamBytes / 1024)} total\n`);

  console.log("| Shards | Total Time | Speedup | Max Shard RSS | Concurrent RSS est. | Status |");
  console.log("|--------|-----------|---------|--------------|---------------------|--------|");

  for (const run of report.runs) {
    const speedup = baselineRun
      ? `${(baselineRun.totalDurationMs / run.totalDurationMs).toFixed(2)}×`
      : "—";
    const maxShardRss = Math.max(...run.shards.map((s) => s.peakRssKb));
    const status = run.failed === 0 ? "✅ pass" : `❌ ${run.failed} failed`;

    console.log(
      `| ${run.shardCount} | ${fmtMs(run.totalDurationMs)} | ${speedup} | ${fmtMb(maxShardRss)} | ${fmtMb(run.totalPeakRssKb)} | ${status} |`,
    );
  }

  if (report.warnings.length > 0) {
    console.log("\n### Warnings\n");
    for (const w of report.warnings)
      console.log(w);
  }

  // Per-shard detail table for the highest-shard-count run
  const detailRun = report.runs[report.runs.length - 1];
  if (detailRun.shards.length > 1) {
    console.log(`\n### Per-shard detail (${detailRun.shardCount} shards)\n`);
    console.log("| Shard | Files | Duration | Peak RSS | Status |");
    console.log("|-------|-------|----------|----------|--------|");
    for (const s of detailRun.shards) {
      const status = s.exitCode === 0 ? "✅" : "❌";
      console.log(`| ${s.shardIndex} | ${s.testFileCount} | ${fmtMs(s.durationMs)} | ${fmtMb(s.peakRssKb)} | ${status} |`);
    }
  }
}

/**
 * Run the Electron test suite at multiple shard counts and produce a benchmark report.
 *
 * @example
 * ```ts
 * const report = await benchmarkElectronTests({
 *   backendInitModule: path.resolve(__dirname, "../backend/backend"),
 *   setupFile: path.resolve(__dirname, "../frontend/vitest.setup.js"),
 *   testDir: path.resolve(__dirname, "../frontend"),
 *   shardCounts: [1, 2, 4],
 *   reportOutputPath: "benchmark-report.json",
 * });
 * ```
 */
export async function benchmarkElectronTests(options: BenchmarkElectronOptions): Promise<BenchmarkReport> {
  const {
    shardCounts = [1, 2, 4],
    reportOutputPath,
    verbose = true,
    ...runnerOptions
  } = options;

  const report: BenchmarkReport = {
    timestamp: new Date().toISOString(),
    platform: `${process.platform} ${os.arch()}`,
    totalRamBytes: os.totalmem(),
    availableRamBytes: os.freemem(),
    cpuCores: os.cpus().length,
    runs: [],
    warnings: [],
  };

  for (const shardCount of shardCounts) {
    if (verbose)
      console.log(`\n▶ Running with ${shardCount} shard(s)...`);

    const wallStart = Date.now();
    const result = await runElectronTests({
      ...runnerOptions,
      shardCount,
      benchmarkMode: true,
    });
    const totalDurationMs = Date.now() - wallStart;

    const run: BenchmarkRunResult = {
      shardCount,
      totalDurationMs,
      passed: result.passed,
      failed: result.failed,
      shards: result.metrics ?? [],
      totalPeakRssKb: (result.metrics ?? []).reduce((sum, s) => sum + s.peakRssKb, 0),
    };

    report.runs.push(run);

    if (verbose)
      console.log(`  Done: ${result.passed}/${result.shardCount} shards passed in ${fmtMs(totalDurationMs)}`);
  }

  report.warnings = buildWarnings(report);

  if (verbose)
    printMarkdownTable(report);

  if (reportOutputPath) {
    const dir = path.dirname(reportOutputPath);
    if (!fs.existsSync(dir))
      fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(reportOutputPath, JSON.stringify(report, null, 2), "utf8");
    if (verbose)
      console.log(`\nReport saved to: ${reportOutputPath}`);
  }

  return report;
}

/** Format a BenchmarkReport as a GitHub step summary (markdown). */
export function formatReportAsGitHubSummary(report: BenchmarkReport): string {
  const lines: string[] = [];
  const baselineRun = report.runs.find((r) => r.shardCount === 1);

  lines.push("## 🔬 Electron Test Benchmark");
  lines.push("");
  lines.push(`**${report.timestamp}** | ${report.platform} | ${report.cpuCores} CPUs | ${fmtMb(report.availableRamBytes / 1024)} free RAM`);
  lines.push("");
  lines.push("| Shards | Total Time | Speedup | Max Shard RSS | Concurrent RSS | Status |");
  lines.push("|:------:|:----------:|:-------:|:-------------:|:--------------:|:------:|");

  for (const run of report.runs) {
    const speedup = baselineRun
      ? `**${(baselineRun.totalDurationMs / run.totalDurationMs).toFixed(2)}×**`
      : "—";
    const maxShardRss = Math.max(...run.shards.map((s) => s.peakRssKb));
    const status = run.failed === 0 ? "✅" : `❌ ${run.failed} failed`;
    lines.push(
      `| ${run.shardCount} | ${fmtMs(run.totalDurationMs)} | ${speedup} | ${fmtMb(maxShardRss)} | ${fmtMb(run.totalPeakRssKb)} | ${status} |`,
    );
  }

  if (report.warnings.length > 0) {
    lines.push("");
    lines.push("### ⚠️ Warnings");
    lines.push("");
    for (const w of report.warnings)
      lines.push(`- ${w}`);
  }

  return lines.join("\n");
}
