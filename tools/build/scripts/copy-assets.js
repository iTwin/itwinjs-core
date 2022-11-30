#! /usr/bin/env node

/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/

"use strict"

const argv = require("yargs").argv;
const fs = require("fs-extra");
const path = require("path");

// example usage
// betools copy-assets --nodeModulesDir=../../../../

const packageJsonDir = (argv.packageJsonDir === undefined) ? "." : argv.packageJsonDir;
const nodeModulesDir = (argv.nodeModulesDir === undefined) ? "." : argv.nodeModulesDir;
const destinationDir = (argv.destinationDir === undefined) ? "./lib/assets" : argv.destinationDir;

// find all dependencies that should have their assets copied from
// currently this logic will find only packages with the @itwin or @bentley scope
const getBentleyPackageDeps = () => {
	const packageJsonPath = `${packageJsonDir}/package.json`;
	const packageJsonRaw = fs.readFileSync(packageJsonPath);
	const packageJson = JSON.parse(packageJsonRaw);
	const deps = new Set();

	for (const packageName in packageJson.dependencies) {
		if (packageName.includes("@itwin") || packageName.includes("@bentley")) {
			deps.add(packageName);
		}
	}

	return Array.from(deps);
}

const copySync = (fromPath, toPath) => {
	if (fs.existsSync(fromPath)) {
		try {
			fs.copySync(fromPath, toPath);
			console.log(`successfully copied from ${fromPath} to ${toPath}`)
		} catch (ex) {
			console.error(`failed to copy from ${fromPath} to ${toPath}`, ex);
		}
	}
}

// finds all applicable dependences with assets and copies them into the destination folder
const copyBentleyPackageDepAssets = () => {
	if (!fs.existsSync(destinationDir)) {
		fs.mkdirSync(destinationDir);
	}

	// check for assets found in lib as well as lib/cjs
	for (const target of getBentleyPackageDeps()) {
		copySync(path.join(nodeModulesDir, "node_modules", target, "lib/assets"), destinationDir);
		copySync(path.join(nodeModulesDir, "node_modules", target, "lib/cjs/assets"), destinationDir);
	}
}

copyBentleyPackageDepAssets();
console.log("finished copying assets");
