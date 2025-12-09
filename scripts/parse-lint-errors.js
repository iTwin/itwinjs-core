#!/usr/bin/env node

/**
 * Script to parse rush lint output and categorize errors by package and rule name
 *
 * Usage:
 *   rush lint > lint-output.txt 2>&1
 *   node scripts/parse-lint-errors.js lint-output.txt [output-report.md]
 *
 * Arguments:
 *   lint-output.txt    - Input file containing rush lint output (default: /tmp/rush_lint_complete.txt)
 *   output-report.md   - Output markdown file (default: lint-report.md in workspace root)
 *
 * Or with default paths:
 *   node scripts/parse-lint-errors.js
 */

const fs = require("fs");
const path = require("path");

// Get the lint output file from command line args or use default
const inputFile = process.argv[2] || "/tmp/rush_lint_complete.txt";
const outputFileArg = process.argv[3];

if (!fs.existsSync(inputFile)) {
	console.error(`Error: Input file not found: ${inputFile}`);
	console.error("Usage: node scripts/parse-lint-errors.js <lint-output-file> [output-report.md]");
	process.exit(1);
}

// Read the lint output file
const lintOutput = fs.readFileSync(inputFile, "utf8");

// Detect workspace root from the lint output (look for the first file path)
const workspaceMatch = lintOutput.match(/^(\/[^\s]+itwinjs-core)\//m);
const workspaceRoot = workspaceMatch ? workspaceMatch[1] : "/Users/hoangnamle/Documents/core-copies/itwinjs-core";

// Data structures to collect results
const errorsByPackage = {};
const ruleStats = {};

// Parse package name from file path
function getPackageName(filePath) {
	const relativePath = filePath.replace(workspaceRoot + "/", "");

	// Map directory patterns to package names
	const mappings = [
		{ pattern: /^core\/backend\//, name: "@itwin/core-backend" },
		{ pattern: /^core\/bentley\//, name: "@itwin/core-bentley" },
		{ pattern: /^core\/common\//, name: "@itwin/core-common" },
		{ pattern: /^core\/ecschema-editing\//, name: "@itwin/ecschema-editing" },
		{ pattern: /^core\/ecschema-locaters\//, name: "@itwin/ecschema-locaters" },
		{ pattern: /^core\/ecschema-metadata\//, name: "@itwin/ecschema-metadata" },
		{ pattern: /^core\/ecschema-rpc\//, name: "@itwin/ecschema-rpc" },
		{ pattern: /^core\/ecsql\/common\//, name: "@itwin/ecsql-common" },
		{ pattern: /^core\/electron\//, name: "@itwin/core-electron" },
		{ pattern: /^core\/express-server\//, name: "@itwin/express-server" },
		{ pattern: /^core\/extension\//, name: "@itwin/core-extension" },
		{ pattern: /^core\/frontend-devtools\//, name: "@itwin/frontend-devtools" },
		{ pattern: /^core\/frontend\//, name: "@itwin/core-frontend" },
		{ pattern: /^core\/geometry\//, name: "@itwin/core-geometry" },
		{ pattern: /^core\/hypermodeling\//, name: "@itwin/hypermodeling-frontend" },
		{ pattern: /^core\/i18n\//, name: "@itwin/core-i18n" },
		{ pattern: /^core\/markup\//, name: "@itwin/core-markup" },
		{ pattern: /^core\/mobile\//, name: "@itwin/core-mobile" },
		{ pattern: /^core\/orbitgt\//, name: "@itwin/core-orbitgt" },
		{ pattern: /^core\/quantity\//, name: "@itwin/core-quantity" },
		{ pattern: /^core\/webgl-compatibility\//, name: "@itwin/webgl-compatibility" },
		{ pattern: /^domains\/analytical\//, name: "@itwin/analytical-backend" },
		{ pattern: /^domains\/linear-referencing\/backend\//, name: "@itwin/linear-referencing-backend" },
		{ pattern: /^domains\/linear-referencing\/common\//, name: "@itwin/linear-referencing-common" },
		{ pattern: /^domains\/physical-material\//, name: "@itwin/physical-material-backend" },
		{ pattern: /^editor\/backend\//, name: "@itwin/editor-backend" },
		{ pattern: /^editor\/common\//, name: "@itwin/editor-common" },
		{ pattern: /^editor\/frontend\//, name: "@itwin/editor-frontend" },
		{ pattern: /^example-code\/app\//, name: "example-code-app" },
		{ pattern: /^example-code\/snippets\//, name: "example-code-snippets" },
		{ pattern: /^extensions\/cesium-renderer\//, name: "@itwin/cesium-renderer" },
		{ pattern: /^extensions\/frontend-tiles\//, name: "@itwin/frontend-tiles" },
		{ pattern: /^extensions\/map-layers-auth\//, name: "@itwin/map-layers-auth" },
		{ pattern: /^extensions\/map-layers-formats\//, name: "@itwin/map-layers-formats" },
		{ pattern: /^full-stack-tests\/backend\//, name: "backend-integration-tests" },
		{ pattern: /^full-stack-tests\/core\//, name: "core-full-stack-tests" },
		{ pattern: /^full-stack-tests\/ecschema-rpc-interface\//, name: "@itwin/ecschema-rpcinterface-tests" },
		{ pattern: /^full-stack-tests\/presentation\//, name: "presentation-full-stack-tests" },
		{ pattern: /^full-stack-tests\/rpc\//, name: "rpc-full-stack-tests" },
		{ pattern: /^full-stack-tests\/rpc-interface\//, name: "@itwin/rpcinterface-full-stack-tests" },
		{ pattern: /^presentation\/backend\//, name: "@itwin/presentation-backend" },
		{ pattern: /^presentation\/common\//, name: "@itwin/presentation-common" },
		{ pattern: /^presentation\/frontend\//, name: "@itwin/presentation-frontend" },
		{ pattern: /^test-apps\/display-performance-test-app\//, name: "display-performance-test-app" },
		{ pattern: /^test-apps\/display-test-app\//, name: "display-test-app" },
		{ pattern: /^test-apps\/export-gltf\//, name: "export-gltf" },
		{ pattern: /^test-apps\/imjs-importer\//, name: "imjs-importer" },
		{ pattern: /^test-apps\/imodel-from-geojson\//, name: "imodel-from-geojson" },
		{ pattern: /^test-apps\/imodel-from-orbitgt\//, name: "imodel-from-orbitgt-pointcloud" },
		{ pattern: /^test-apps\/imodel-from-reality-model\//, name: "imodel-from-reality-model" },
		{ pattern: /^tools\/build\//, name: "@itwin/build-tools" },
		{ pattern: /^tools\/certa\//, name: "@itwin/certa" },
		{ pattern: /^tools\/ecschema2ts\//, name: "@itwin/ecschema2ts" },
		{ pattern: /^tools\/perf-tools\//, name: "@itwin/perf-tools" },
		{ pattern: /^ui\/appui-abstract\//, name: "@itwin/appui-abstract" },
		{ pattern: /^utils\/workspace-editor\//, name: "@itwin/workspace-editor" },
	];

	for (const mapping of mappings) {
		if (mapping.pattern.test(relativePath)) {
			return mapping.name;
		}
	}

	return "unknown";
}

// Add an entry to the tracking structures (with deduplication)
const seenEntries = new Set();

function addEntry(packageName, severity, entry, ruleName) {
	// Create a unique key for deduplication
	const entryKey = `${packageName}|${entry.file}|${entry.line}|${entry.column}|${ruleName}`;

	// Skip if we've already seen this exact entry
	if (seenEntries.has(entryKey)) {
		return;
	}
	seenEntries.add(entryKey);

	// Initialize package entry if needed
	if (!errorsByPackage[packageName]) {
		errorsByPackage[packageName] = {
			errors: [],
			warnings: [],
			ruleBreakdown: {},
		};
	}

	if (severity === "error") {
		errorsByPackage[packageName].errors.push(entry);
	} else {
		errorsByPackage[packageName].warnings.push(entry);
	}

	// Track rule breakdown per package
	if (!errorsByPackage[packageName].ruleBreakdown[ruleName]) {
		errorsByPackage[packageName].ruleBreakdown[ruleName] = { errors: 0, warnings: 0 };
	}
	errorsByPackage[packageName].ruleBreakdown[ruleName][severity === "error" ? "errors" : "warnings"]++;

	// Track global rule stats
	if (!ruleStats[ruleName]) {
		ruleStats[ruleName] = { errors: 0, warnings: 0 };
	}
	ruleStats[ruleName][severity === "error" ? "errors" : "warnings"]++;
}

// Parse the lint output
const lines = lintOutput.split("\n");
let currentFilePath = null;
let pendingEntry = null; // For multi-line error messages

for (let i = 0; i < lines.length; i++) {
	const line = lines[i];

	// Check if this is a file path line
	if (line.startsWith("/Users/hoangnamle/Documents/core-copies/itwinjs-core/") && (line.endsWith(".ts") || line.endsWith(".tsx"))) {
		currentFilePath = line.trim();
		continue;
	}

	// Pattern 1: Single-line error with rule at end
	// e.g., "  116:51  warning  Forbidden non-null assertion  @typescript-eslint/no-non-null-assertion"
	let match = line.match(/^\s*(\d+):(\d+)\s+(error|warning)\s+(.+?)\s{2,}(@[\w\/-]+)\s*$/);

	if (match && currentFilePath) {
		const [, lineNum, colNum, severity, message, ruleName] = match;
		const packageName = getPackageName(currentFilePath);

		const entry = {
			file: currentFilePath.replace("/Users/hoangnamle/Documents/core-copies/itwinjs-core/", ""),
			line: parseInt(lineNum),
			column: parseInt(colNum),
			message: message.trim(),
			rule: ruleName,
		};

		addEntry(packageName, severity, entry, ruleName);
		continue;
	}

	// Pattern 2: Unused eslint-disable directive (check before multi-line pattern)
	match = line.match(/^\s*(\d+):(\d+)\s+(error|warning)\s+(Unused eslint-disable directive.*)/);
	if (match && currentFilePath) {
		const [, lineNum, colNum, severity, message] = match;
		const packageName = getPackageName(currentFilePath);
		const ruleName = "eslint-directive-unused";

		const entry = {
			file: currentFilePath.replace("/Users/hoangnamle/Documents/core-copies/itwinjs-core/", ""),
			line: parseInt(lineNum),
			column: parseInt(colNum),
			message: message.trim(),
			rule: ruleName,
		};

		addEntry(packageName, severity, entry, ruleName);
		continue;
	}

	// Pattern 3: Start of multi-line error (no rule at end, message continues on next line)
	// e.g., "   55:3   error  `HierarchyRequestOptions` is deprecated..."
	match = line.match(/^\s*(\d+):(\d+)\s+(error|warning)\s+(.+)$/);
	if (match && currentFilePath && !line.match(/@[\w\/-]+\s*$/)) {
		const [, lineNum, colNum, severity, message] = match;
		pendingEntry = {
			file: currentFilePath.replace("/Users/hoangnamle/Documents/core-copies/itwinjs-core/", ""),
			packageName: getPackageName(currentFilePath),
			line: parseInt(lineNum),
			column: parseInt(colNum),
			severity: severity,
			message: message.trim(),
		};
		continue;
	}

	// Pattern 4: Continuation line with text AND rule name at the end
	// e.g., "ckages/hierarchies/README.md)                    package for creating hierarchies  @typescript-eslint/no-deprecated"
	if (pendingEntry) {
		// Check for a continuation line that has rule name at the end
		const ruleMatch = line.match(/.*\s{2,}(@[\w\/-]+)\s*$/);
		if (ruleMatch) {
			const ruleName = ruleMatch[1];
			const entry = {
				file: pendingEntry.file,
				line: pendingEntry.line,
				column: pendingEntry.column,
				message: pendingEntry.message,
				rule: ruleName,
			};

			addEntry(pendingEntry.packageName, pendingEntry.severity, entry, ruleName);
			pendingEntry = null;
			continue;
		}

		// Check if we're at a new error line or summary - if so, we missed the rule
		if (line.match(/^\s*\d+:\d+\s+(error|warning)/) || line.match(/^✖ \d+ problems/)) {
			pendingEntry = null;
		}
	}
}

// Generate the markdown report
let markdown = `# Rush Lint Error Report

Generated on: ${new Date().toISOString()}

## Summary

`;

// Calculate totals
let totalErrors = 0;
let totalWarnings = 0;
for (const pkg of Object.values(errorsByPackage)) {
	totalErrors += pkg.errors.length;
	totalWarnings += pkg.warnings.length;
}

markdown += `- **Total Errors:** ${totalErrors}
- **Total Warnings:** ${totalWarnings}
- **Packages with Issues:** ${Object.keys(errorsByPackage).length}
- **Unique Lint Rules Violated:** ${Object.keys(ruleStats).length}

---

## Lint Rules Summary

| Rule | Errors | Warnings | Total |
|------|--------|----------|-------|
`;

// Sort rules by total count
const sortedRules = Object.entries(ruleStats)
	.map(([rule, counts]) => ({ rule, ...counts, total: counts.errors + counts.warnings }))
	.sort((a, b) => b.total - a.total);

for (const { rule, errors, warnings, total } of sortedRules) {
	markdown += `| \`${rule}\` | ${errors} | ${warnings} | ${total} |\n`;
}

markdown += `
---

## Errors and Warnings by Package

`;

// Sort packages by total issues (errors first, then warnings)
const sortedPackages = Object.entries(errorsByPackage)
	.map(([name, data]) => ({
		name,
		...data,
		totalErrors: data.errors.length,
		totalWarnings: data.warnings.length,
		total: data.errors.length + data.warnings.length,
	}))
	.sort((a, b) => {
		// Sort by errors first, then by warnings
		if (b.totalErrors !== a.totalErrors) return b.totalErrors - a.totalErrors;
		return b.totalWarnings - a.totalWarnings;
	});

for (const pkg of sortedPackages) {
	markdown += `### ${pkg.name}

**Errors:** ${pkg.totalErrors} | **Warnings:** ${pkg.totalWarnings}

#### Rule Breakdown

| Rule | Errors | Warnings |
|------|--------|----------|
`;

	// Sort rules by count
	const pkgRules = Object.entries(pkg.ruleBreakdown)
		.map(([rule, counts]) => ({ rule, ...counts }))
		.sort((a, b) => b.errors + b.warnings - (a.errors + a.warnings));

	for (const { rule, errors, warnings } of pkgRules) {
		markdown += `| \`${rule}\` | ${errors} | ${warnings} |\n`;
	}

	// List detailed errors if there are any
	if (pkg.errors.length > 0) {
		markdown += `
#### Detailed Errors

| File | Line | Rule | Message |
|------|------|------|---------|
`;
		for (const err of pkg.errors) {
			const shortFile = err.file.split("/").slice(-2).join("/");
			const escapedMessage = err.message.replace(/\|/g, "\\|").replace(/`/g, "'").substring(0, 60);
			markdown += `| \`${shortFile}\` | ${err.line} | \`${err.rule}\` | ${escapedMessage}... |\n`;
		}
	}

	markdown += "\n---\n\n";
}

// Write the report
const outputPath = outputFileArg || path.join(workspaceRoot, "lint-report.md");
fs.writeFileSync(outputPath, markdown);

console.log(`Lint report written to: ${outputPath}`);
console.log(`\nSummary:`);
console.log(`- Total Errors: ${totalErrors}`);
console.log(`- Total Warnings: ${totalWarnings}`);
console.log(`- Packages with Issues: ${Object.keys(errorsByPackage).length}`);
console.log(`- Unique Rules: ${Object.keys(ruleStats).length}`);
