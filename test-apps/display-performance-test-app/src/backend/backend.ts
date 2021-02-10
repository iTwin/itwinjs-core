/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import "./DisplayPerfRpcImpl"; // just to get the RPC implementation registered
import * as path from "path";
import { loadEnv } from "@bentley/config-loader";
import { IModelHost, IModelHostConfiguration } from "@bentley/imodeljs-backend";
import { IModelReadRpcInterface, IModelTileRpcInterface, SnapshotIModelRpcInterface } from "@bentley/imodeljs-common";
import DisplayPerfRpcInterface from "../common/DisplayPerfRpcInterface";

export function getRpcInterfaces() {
  return [DisplayPerfRpcInterface, IModelTileRpcInterface, SnapshotIModelRpcInterface, IModelReadRpcInterface];
}

export async function initializeBackend() {
  loadEnv(path.join(__dirname, "..", "..", ".env"));
  process.env.NODE_TLS_REJECT_UNAUTHORIZED = "0"; // (needed temporarily to use self-signed cert to communicate with iModelBank via https)

  const hostConfig = new IModelHostConfiguration();
  await IModelHost.startup(hostConfig);
}
