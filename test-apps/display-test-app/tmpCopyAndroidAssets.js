/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
const path = require("path");
const fs = require("fs-extra");

const app = path.join(process.env.SrcRoot, "imodel02/iModelJsMobile/nonport/android/HelloNode/app/src/main/assets");
const backend = path.join(app, "backend")
const frontend = path.join(app, "frontend")

fs.copySync(path.join(__dirname, "lib/ios/main.js"), path.join(backend, "main.js"))

const mobileAssets = path.join(__dirname, "lib/ios/assets/");
for (const asset of fs.readdirSync(mobileAssets)) {
  fs.copySync(path.join(mobileAssets, asset), path.join(backend, "Assets", asset));
}

fs.copySync(path.join(__dirname, "build"), frontend);
fs.copySync(path.join(frontend, "locales/en"), path.join(frontend, "locales/en-US")); //since navigator.languages=["en-US"] on Android apparently
