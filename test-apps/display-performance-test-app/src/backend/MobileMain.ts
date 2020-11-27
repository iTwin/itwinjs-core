/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/

import { IModelReadRpcInterface, IModelTileRpcInterface, MobileRpcManager, RpcInterfaceDefinition, SnapshotIModelRpcInterface } from "@bentley/imodeljs-common";
import DisplayPerfRpcInterface from "../common/DisplayPerfRpcInterface";
import { initializeBackend } from "./backend";

/* eslint-disable no-console */

export function getRpcInterfaces(): RpcInterfaceDefinition[] {
  return [DisplayPerfRpcInterface, IModelTileRpcInterface, SnapshotIModelRpcInterface, IModelReadRpcInterface];
}

(async () => { // eslint-disable-line @typescript-eslint/no-floating-promises
  // Initialize the backend
  await initializeBackend();
  MobileRpcManager.initializeImpl(getRpcInterfaces());
})();
