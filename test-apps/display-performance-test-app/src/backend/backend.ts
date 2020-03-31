/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import { IModelHost, IModelHostConfiguration } from "@bentley/imodeljs-backend";
import { IModelTileRpcInterface, SnapshotIModelRpcInterface, IModelReadRpcInterface } from "@bentley/imodeljs-common";
import { Config } from "@bentley/imodeljs-clients";
import { IModelJsConfig } from "@bentley/config-loader/lib/IModelJsConfig";
import "./DisplayPerfRpcImpl"; // just to get the RPC implementation registered
import DisplayPerfRpcInterface from "../common/DisplayPerfRpcInterface";

IModelJsConfig.init(true /* suppress exception */, true /* suppress error message */, Config.App);
process.env.NODE_TLS_REJECT_UNAUTHORIZED = "0"; // (needed temporarily to use self-signed cert to communicate with iModelBank via https)

export function getRpcInterfaces() {
  return [DisplayPerfRpcInterface, IModelTileRpcInterface, SnapshotIModelRpcInterface, IModelReadRpcInterface];
}

export function initializeBackend() {
  const hostConfig = new IModelHostConfiguration();
  IModelHost.startup(hostConfig);
}
