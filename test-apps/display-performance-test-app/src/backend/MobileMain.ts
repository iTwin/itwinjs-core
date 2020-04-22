/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/

import { IModelTileRpcInterface, SnapshotIModelRpcInterface, IModelReadRpcInterface } from "@bentley/imodeljs-common";
import { initializeBackend } from "./backend";
import { MobileRpcManager } from "@bentley/imodeljs-common/lib/rpc/mobile/MobileRpcManager";
import DisplayPerfRpcInterface from "../common/DisplayPerfRpcInterface";

// tslint:disable:no-console

export function getRpcInterfaces() {
  return [DisplayPerfRpcInterface, IModelTileRpcInterface, SnapshotIModelRpcInterface, IModelReadRpcInterface];
}

(async () => {
  // Initialize the backend
  await initializeBackend();
  MobileRpcManager.initializeImpl(getRpcInterfaces());
})(); // tslint:disable-line:no-floating-promises
