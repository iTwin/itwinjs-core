#!/usr/bin/env node
/**
 * Lint Benchmark Script
 * Compares ESLint and oxlint performance on core-quantity package.
 *
 * Usage: node scripts/lint-benchmark.mjs [--iterations=N]
 */

import { spawn } from "node:child_process";
import { parseArgs } from "node:util";

const DEFAULT_ITERATIONS = 5;

// Parse CLI arguments
const { values } = parseArgs({
	options: {
		iterations: { type: "string", short: "i", default: String(DEFAULT_ITERATIONS) },
	},
	strict: false,
});

const iterations = parseInt(values.iterations, 10) || DEFAULT_ITERATIONS;

/**
 * Run a command and measure execution time
 * @param {string} command
 * @param {string[]} args
 * @returns {Promise<{ duration: number, stdout: string, stderr: string, exitCode: number }>}
 */
function runCommand(command, args) {
	return new Promise((resolve) => {
		const start = performance.now();
		let stdout = "";
		let stderr = "";

		const proc = spawn(command, args, {
			cwd: process.cwd(),
			shell: true,
			env: { ...process.env, FORCE_COLOR: "0" }, // Disable colors for consistent output
		});

		proc.stdout.on("data", (data) => {
			stdout += data.toString();
		});

		proc.stderr.on("data", (data) => {
			stderr += data.toString();
		});

		proc.on("close", (exitCode) => {
			const duration = performance.now() - start;
			resolve({ duration, stdout, stderr, exitCode: exitCode ?? 0 });
		});

		proc.on("error", () => {
			const duration = performance.now() - start;
			resolve({ duration, stdout, stderr, exitCode: 1 });
		});
	});
}

/**
 * Run benchmark for a linter (timing only, no JSON)
 * @param {string} name
 * @param {string} command
 * @param {string[]} args
 * @param {number} iterations
 * @returns {Promise<{ times: number[], exitCode: number }>}
 */
async function benchmarkTiming(name, command, args, iterations) {
	console.log(`\n🔄 Running ${name} (${iterations} iterations)...`);

	const times = [];
	let lastExitCode = 0;

	for (let i = 0; i < iterations; i++) {
		const result = await runCommand(command, args);
		times.push(result.duration);
		lastExitCode = result.exitCode;
		process.stdout.write(`  Run ${i + 1}: ${result.duration.toFixed(2)}ms\n`);
	}

	return { times, exitCode: lastExitCode };
}

/**
 * Calculate statistics from timing array
 * @param {number[]} times
 * @returns {{ min: number, max: number, avg: number, median: number }}
 */
function calculateStats(times) {
	const sorted = [...times].sort((a, b) => a - b);
	const min = sorted[0];
	const max = sorted[sorted.length - 1];
	const avg = times.reduce((a, b) => a + b, 0) / times.length;
	const median = sorted.length % 2 === 0 ? (sorted[sorted.length / 2 - 1] + sorted[sorted.length / 2]) / 2 : sorted[Math.floor(sorted.length / 2)];

	return { min, max, avg, median };
}

/**
 * @typedef {Object} LintIssue
 * @property {string} file - Relative file path
 * @property {number} line - Line number
 * @property {number} column - Column number
 * @property {string} rule - Rule name/code
 * @property {string} message - Error/warning message
 * @property {string} severity - 'error' or 'warning'
 */

/**
 * Parse ESLint JSON output into normalized issues
 * @param {string} jsonOutput
 * @returns {LintIssue[]}
 */
function parseEslintJson(jsonOutput) {
	const issues = [];
	try {
		const results = JSON.parse(jsonOutput);
		for (const file of results) {
			const relativePath = file.filePath.replace(process.cwd() + "/", "");
			for (const msg of file.messages) {
				issues.push({
					file: relativePath,
					line: msg.line,
					column: msg.column,
					rule: msg.ruleId || "unknown",
					message: msg.message,
					severity: msg.severity === 2 ? "error" : "warning",
				});
			}
		}
	} catch {
		console.error("Failed to parse ESLint JSON output");
	}
	return issues;
}

/**
 * Parse oxlint JSON output into normalized issues
 * @param {string} jsonOutput
 * @returns {LintIssue[]}
 */
function parseOxlintJson(jsonOutput) {
	const issues = [];
	try {
		const results = JSON.parse(jsonOutput);
		const diagnostics = results.diagnostics || [];
		for (const diag of diagnostics) {
			const label = diag.labels?.[0];
			issues.push({
				file: diag.filename || "unknown",
				line: label?.span?.line || 0,
				column: label?.span?.column || 0,
				rule: diag.code || "unknown",
				message: diag.message,
				severity: diag.severity === "error" ? "error" : "warning",
			});
		}
	} catch {
		console.error("Failed to parse oxlint JSON output");
	}
	return issues;
}

/**
 * Create a normalized key for an issue (for comparison)
 * @param {LintIssue} issue
 * @returns {string}
 */
function issueKey(issue) {
	return `${issue.file}:${issue.line}:${issue.column}`;
}

/**
 * Compare issues between two linters
 * @param {LintIssue[]} eslintIssues
 * @param {LintIssue[]} oxlintIssues
 */
function compareIssues(eslintIssues, oxlintIssues) {
	// Group by file:line:column for location-based comparison
	const eslintByLocation = new Map();
	const oxlintByLocation = new Map();

	for (const issue of eslintIssues) {
		const key = issueKey(issue);
		if (!eslintByLocation.has(key)) {
			eslintByLocation.set(key, []);
		}
		eslintByLocation.get(key).push(issue);
	}

	for (const issue of oxlintIssues) {
		const key = issueKey(issue);
		if (!oxlintByLocation.has(key)) {
			oxlintByLocation.set(key, []);
		}
		oxlintByLocation.get(key).push(issue);
	}

	// Find unique locations
	const eslintOnlyLocations = [...eslintByLocation.keys()].filter((k) => !oxlintByLocation.has(k));
	const oxlintOnlyLocations = [...oxlintByLocation.keys()].filter((k) => !eslintByLocation.has(k));
	const commonLocations = [...eslintByLocation.keys()].filter((k) => oxlintByLocation.has(k));

	// Group by rule for summary
	const eslintRules = new Map();
	const oxlintRules = new Map();

	for (const issue of eslintIssues) {
		eslintRules.set(issue.rule, (eslintRules.get(issue.rule) || 0) + 1);
	}
	for (const issue of oxlintIssues) {
		oxlintRules.set(issue.rule, (oxlintRules.get(issue.rule) || 0) + 1);
	}

	console.log("\n📊 Rule Parity Report");
	console.log("=".repeat(60));
	console.log(`\nTotal issues found:`);
	console.log(`  ESLint: ${eslintIssues.length} issues at ${eslintByLocation.size} locations`);
	console.log(`  oxlint: ${oxlintIssues.length} issues at ${oxlintByLocation.size} locations`);
	console.log(`  Common locations: ${commonLocations.length}`);

	// Rules breakdown
	console.log(`\n📋 Rules Summary:`);
	console.log(`\n  ESLint rules (${eslintRules.size}):`);
	for (const [rule, count] of [...eslintRules.entries()].sort((a, b) => b[1] - a[1]).slice(0, 10)) {
		console.log(`    ${rule}: ${count}`);
	}

	console.log(`\n  oxlint rules (${oxlintRules.size}):`);
	for (const [rule, count] of [...oxlintRules.entries()].sort((a, b) => b[1] - a[1]).slice(0, 10)) {
		console.log(`    ${rule}: ${count}`);
	}

	// Show sample differences
	if (eslintOnlyLocations.length > 0) {
		console.log(`\n⚠️  Issues only in ESLint (${eslintOnlyLocations.length} locations):`);
		for (const loc of eslintOnlyLocations.slice(0, 5)) {
			const issues = eslintByLocation.get(loc);
			for (const issue of issues) {
				console.log(`  ${loc} [${issue.rule}] ${issue.message.slice(0, 60)}...`);
			}
		}
		if (eslintOnlyLocations.length > 5) {
			console.log(`  ... and ${eslintOnlyLocations.length - 5} more locations`);
		}
	}

	if (oxlintOnlyLocations.length > 0) {
		console.log(`\n⚠️  Issues only in oxlint (${oxlintOnlyLocations.length} locations):`);
		for (const loc of oxlintOnlyLocations.slice(0, 5)) {
			const issues = oxlintByLocation.get(loc);
			for (const issue of issues) {
				console.log(`  ${loc} [${issue.rule}] ${issue.message.slice(0, 60)}...`);
			}
		}
		if (oxlintOnlyLocations.length > 5) {
			console.log(`  ... and ${oxlintOnlyLocations.length - 5} more locations`);
		}
	}

	if (eslintOnlyLocations.length === 0 && oxlintOnlyLocations.length === 0) {
		console.log("\n✅ Perfect location parity! Both linters report issues at the same locations.");
	}
}

/**
 * Print timing comparison table
 * @param {{ min: number, max: number, avg: number, median: number }} eslintStats
 * @param {{ min: number, max: number, avg: number, median: number }} oxlintStats
 */
function printTimingTable(eslintStats, oxlintStats) {
	const speedup = eslintStats.avg / oxlintStats.avg;

	console.log("\n⏱️  Timing Results");
	console.log("=".repeat(60));
	console.log("| Metric  | ESLint (ms) | oxlint (ms) | Speedup |");
	console.log("|---------|-------------|-------------|---------|");
	console.log(`| Min     | ${eslintStats.min.toFixed(2).padStart(11)} | ${oxlintStats.min.toFixed(2).padStart(11)} | ${(eslintStats.min / oxlintStats.min).toFixed(2).padStart(7)}x |`);
	console.log(`| Max     | ${eslintStats.max.toFixed(2).padStart(11)} | ${oxlintStats.max.toFixed(2).padStart(11)} | ${(eslintStats.max / oxlintStats.max).toFixed(2).padStart(7)}x |`);
	console.log(`| Avg     | ${eslintStats.avg.toFixed(2).padStart(11)} | ${oxlintStats.avg.toFixed(2).padStart(11)} | ${speedup.toFixed(2).padStart(7)}x |`);
	console.log(`| Median  | ${eslintStats.median.toFixed(2).padStart(11)} | ${oxlintStats.median.toFixed(2).padStart(11)} | ${(eslintStats.median / oxlintStats.median).toFixed(2).padStart(7)}x |`);

	console.log(`\n🚀 oxlint is ${speedup.toFixed(2)}x faster than ESLint (average)`);
}

/**
 * Check if oxlint JS plugin is working
 * @param {string} output
 * @returns {boolean}
 */
function isPluginWorking(output) {
	// Check for common plugin load errors
	const errorPatterns = ["failed to load plugin", "cannot find module", "plugin not found", "Plugin", "not found", "Error loading", "Failed to parse configuration"];

	const lowerOutput = output.toLowerCase();
	return !errorPatterns.some((p) => lowerOutput.includes(p.toLowerCase()));
}

async function main() {
	console.log("🔧 Lint Benchmark: ESLint vs oxlint");
	console.log(`   Iterations: ${iterations}`);
	console.log("=".repeat(60));

	// Run ESLint benchmark (timing)
	const eslintTimingResult = await benchmarkTiming("ESLint", "npx", ["eslint", "./src/**/*.ts"], iterations);

	// Run oxlint benchmark (timing)
	const oxlintTimingResult = await benchmarkTiming("oxlint", "npx", ["oxlint", "./src"], iterations);

	// Calculate and print timing stats
	const eslintStats = calculateStats(eslintTimingResult.times);
	const oxlintStats = calculateStats(oxlintTimingResult.times);
	printTimingTable(eslintStats, oxlintStats);

	// Now run once with JSON output for parity comparison
	console.log("\n📝 Collecting lint output for parity comparison...");

	const eslintJsonResult = await runCommand("npx", ["eslint", "./src/**/*.ts", "-f", "json"]);
	const oxlintJsonResult = await runCommand("npx", ["oxlint", "./src", "--format", "json"]);

	// Parse JSON outputs
	const eslintIssues = parseEslintJson(eslintJsonResult.stdout);
	const oxlintIssues = parseOxlintJson(oxlintJsonResult.stdout);

	// Compare issues
	compareIssues(eslintIssues, oxlintIssues);

	// Print exit codes
	console.log("\n📋 Exit Codes");
	console.log("=".repeat(60));
	console.log(`ESLint: ${eslintTimingResult.exitCode}`);
	console.log(`oxlint: ${oxlintTimingResult.exitCode}`);
}

main().catch(console.error);
