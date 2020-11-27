/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import "./DisplayPerfRpcImpl"; // just to get the RPC implementation registered
import { Config } from "@bentley/bentleyjs-core";
import { IModelJsConfig } from "@bentley/config-loader/lib/IModelJsConfig";
import { IModelHost, IModelHostConfiguration } from "@bentley/imodeljs-backend";
import { IModelReadRpcInterface, IModelTileRpcInterface, RpcInterfaceDefinition, SnapshotIModelRpcInterface } from "@bentley/imodeljs-common";
import DisplayPerfRpcInterface from "../common/DisplayPerfRpcInterface";

export function getRpcInterfaces(): RpcInterfaceDefinition[] {
  return [DisplayPerfRpcInterface, IModelTileRpcInterface, SnapshotIModelRpcInterface, IModelReadRpcInterface];
}

export async function initializeBackend(): Promise<void> {
  IModelJsConfig.init(true /* suppress exception */, true /* suppress error message */, Config.App);
  process.env.NODE_TLS_REJECT_UNAUTHORIZED = "0"; // (needed temporarily to use self-signed cert to communicate with iModelBank via https)

  const hostConfig = new IModelHostConfiguration();
  await IModelHost.startup(hostConfig);
}
