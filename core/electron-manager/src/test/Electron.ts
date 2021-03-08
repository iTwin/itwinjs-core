/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/

import { ElectronBackend, ElectronBackendOptions } from "../ElectronBackend";
import * as electron from "electron";

let options: ElectronBackendOptions;

switch (process.env.startupOptions) {
  case "":
    break;
  default:
    options = {}
}

const init = async () => {
  const manager = ElectronBackend.initialize(options);
  await manager.openMainWindow({ height: 800, width: 1200, show: false, title: "test startup" });
  electron.app.quit();
}

init();
