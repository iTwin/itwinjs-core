/*---------------------------------------------------------------------------------------------
 * Copyright (c) Bentley Systems, Incorporated. All rights reserved.
 * See LICENSE.md in the project root for license terms and full copyright notice.
 *--------------------------------------------------------------------------------------------*/

export { runElectronTests } from "./runner.js";
export { benchmarkElectronTests, formatReportAsGitHubSummary } from "./benchmark.js";
export type { ElectronTestRunnerOptions, ElectronTestResults, RendererTestResults, ShardMetrics, ShardResult, BenchmarkReport, BenchmarkRunResult } from "./types.js";
