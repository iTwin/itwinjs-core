/*---------------------------------------------------------------------------------------------
 * Copyright (c) Bentley Systems, Incorporated. All rights reserved.
 * See LICENSE.md in the project root for license terms and full copyright notice.
 *--------------------------------------------------------------------------------------------*/

const cpx = require("cpx2");
const fs = require("fs");
const path = require("path");

const libDir = "./lib";

// set up directory for test caches
const cacheDir = path.join(libDir, ".cache");
fs.mkdirSync(cacheDir, { recursive: true });

// set up assets
cpx.copySync(`assets/**/*`, path.join(libDir, "assets"));
cpx.copySync(`public/**/*`, path.join(libDir, "public"));
copyITwinBackendAssets(path.join(libDir, "assets"));
copyITwinFrontendAssets(path.join(libDir, "public"));

function copyITwinBackendAssets(outputDir) {
  const iTwinPackagesPath = "node_modules/@itwin";
  fs.readdirSync(iTwinPackagesPath)
    .map((packageName) => {
      const packagePath = path.resolve(iTwinPackagesPath, packageName);
      return path.join(packagePath, "lib", "cjs", "assets");
    })
    .filter((assetsPath) => {
      return fs.existsSync(assetsPath);
    })
    .forEach((src) => {
      cpx.copySync(`${src}/**/*`, outputDir);
    });
}

function copyITwinFrontendAssets(outputDir) {
  const iTwinPackagesPath = "node_modules/@itwin";
  fs.readdirSync(iTwinPackagesPath)
    .map((packageName) => {
      const packagePath = path.resolve(iTwinPackagesPath, packageName);
      return path.join(packagePath, "lib", "public");
    })
    .filter((assetsPath) => {
      return fs.existsSync(assetsPath);
    })
    .forEach((src) => {
      cpx.copySync(`${src}/**/*`, outputDir);
    });
}