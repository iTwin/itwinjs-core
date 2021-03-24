/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/

console.log("in electron.ts");

import { ElectronHost, ElectronHostOptions } from "../ElectronBackend";
import * as electron from "electron";
import { IModelHostConfiguration } from "@bentley/imodeljs-backend";
import { ClipMaskXYZRangePlanes } from "../../../common/node_modules/@bentley/geometry-core/lib/geometry-core";

let opts: { electronHost?: ElectronHostOptions, iModelConfig?: IModelHostConfiguration }
opts = {}
switch (process.env.startupOptions) {
  case "defaultOptions":
    opts.electronHost = {
      developmentServer: false,
      frontendPort: 3000,
      webResourcesPath: "",
    }
  default:
    opts.electronHost = {}
}
const init = async () => {
  await ElectronHost.startup();
  await ElectronHost.openMainWindow({ height: 800, width: 1200, show: false, title: "test startup" });
  electron.app.quit();
}

init();
