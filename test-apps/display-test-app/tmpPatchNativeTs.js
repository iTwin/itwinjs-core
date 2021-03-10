/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
const path = require("path");
const fs = require("fs-extra");

const installedNative = path.join(__dirname, "node_modules/@bentley/imodeljs-backend/node_modules/@bentley/imodeljs-native/");
const builtNative = path.join(process.env.OutRoot, "AndroidARM64/static/BuildContexts/iModelJsNodeAddon/Delivery/lib/");

const replace = ["NativeLibrary.js"];
for (const file of replace) {
  fs.copyFileSync(path.join(builtNative, file), path.join(installedNative, file));
}
