/*---------------------------------------------------------------------------------------------
* Copyright (c) 2019 Bentley Systems, Incorporated. All rights reserved.
* Licensed under the MIT License. See LICENSE.md in the project root for license terms.
*--------------------------------------------------------------------------------------------*/
import * as path from "path";

import { assert } from "@bentley/bentleyjs-core";
import { RpcInterfaceDefinition, ElectronRpcManager } from "@bentley/imodeljs-common";
import { IModelJsElectronManager } from "@bentley/electron-manager";
/**
 * Initializes Electron backend
 */

const autoOpenDevTools = false;

export default function initialize(rpcs: RpcInterfaceDefinition[]) {
  (async () => { // tslint:disable-line:no-floating-promises
    const manager = new IModelJsElectronManager(path.join(__dirname, "..", "..", "webresources"));

    await manager.initialize({
      width: 800,
      height: 650,
      autoHideMenuBar: true,
      show: true,
      webPreferences: {
        nodeIntegration: true,
        preload: path.join(__dirname, "preload.js"),
      },
    });

    // tell ElectronRpcManager which RPC interfaces to handle
    ElectronRpcManager.initializeImpl({}, rpcs);

    const mainWindow = manager.mainWindow!;
    assert(!!mainWindow);

    if (autoOpenDevTools)
      mainWindow.webContents.toggleDevTools();
  })();
}
