/*---------------------------------------------------------------------------------------------
* Copyright (c) 2019 Bentley Systems, Incorporated. All rights reserved.
* Licensed under the MIT License. See LICENSE.md in the project root for license terms.
*--------------------------------------------------------------------------------------------*/

import { IModelTileRpcInterface, StandaloneIModelRpcInterface, IModelReadRpcInterface } from "@bentley/imodeljs-common";
import { initializeBackend } from "./backend";
import { MobileRpcManager } from "@bentley/imodeljs-common/lib/rpc/mobile/MobileRpcManager";
import DisplayPerfRpcInterface from "../common/DisplayPerfRpcInterface";

// tslint:disable:no-console

export function getRpcInterfaces() {
  return [DisplayPerfRpcInterface, IModelTileRpcInterface, StandaloneIModelRpcInterface, IModelReadRpcInterface];
}

// Initialize the backend
initializeBackend();
MobileRpcManager.initializeImpl(getRpcInterfaces());
