/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import * as path from "path";
import "./DisplayPerfRpcImpl"; // just to get the RPC implementation registered
import { Config, isElectronMain } from "@bentley/bentleyjs-core";
import { IModelJsConfig } from "@bentley/config-loader/lib/IModelJsConfig";
import { IModelHost } from "@bentley/imodeljs-backend";
import { IModelReadRpcInterface, IModelTileRpcInterface, SnapshotIModelRpcInterface } from "@bentley/imodeljs-common";
import DisplayPerfRpcInterface from "../common/DisplayPerfRpcInterface";
import { ElectronHost } from "@bentley/electron-manager/lib/ElectronBackend";

export async function initializeBackend() {
  IModelJsConfig.init(true /* suppress exception */, true /* suppress error message */, Config.App);
  process.env.NODE_TLS_REJECT_UNAUTHORIZED = "0"; // (needed temporarily to use self-signed cert to communicate with iModelBank via https)

  if (isElectronMain) {
    const rpcInterfaces = [DisplayPerfRpcInterface, IModelTileRpcInterface, SnapshotIModelRpcInterface, IModelReadRpcInterface];
    await ElectronHost.startup({ electronHost: { webResourcesPath: path.join(__dirname, "..", "..", "build"), rpcInterfaces } });
  } else
    await IModelHost.startup();
}
