/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
const path = require("path");
const fs = require("fs-extra");

const app = path.join(__dirname, "../imodeljs-test-app/app/src/main/assets");

if (fs.existsSync(app)) {
  fs.removeSync(app);
}

fs.mkdirSync(app);

const backend = path.join(app, "backend");
const frontend = path.join(app, "frontend");

fs.mkdirSync(backend);

fs.copySync(path.join(__dirname, "../../lib/android/main.js"), path.join(backend, "main.js"));

const mobileAssets = path.join(__dirname, "../../lib/android/assets/");
for (const asset of fs.readdirSync(mobileAssets)) {
  fs.copySync(path.join(mobileAssets, asset), path.join(backend, "Assets", asset));
}

fs.copySync(path.join(__dirname, "../../build"), frontend);
fs.copySync(path.join(frontend, "locales/en"), path.join(frontend, "locales/en-US")); //since navigator.languages=["en-US"] on Android apparently

const index_html = path.join(frontend, "index.html");
fs.writeFileSync(index_html, fs.readFileSync(index_html).toString().replace(/\/static\//g, "static/"));
