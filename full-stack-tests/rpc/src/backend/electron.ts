/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import { ElectronRpcManager } from "@bentley/imodeljs-common";
import { rpcInterfaces } from "../common/TestRpcInterface";
import { registerBackendCallback } from "@bentley/certa/lib/utils/CallbackUtils";
import { BackendTestCallbacks } from "../common/SideChannels";
import "./CommonBackendSetup";

registerBackendCallback(BackendTestCallbacks.getEnvironment, () => "electron");

const rpcConfig = ElectronRpcManager.initializeImpl({}, rpcInterfaces);

registerBackendCallback(BackendTestCallbacks.setChunkThreshold, (value: number) => {
  rpcConfig.protocol.transferChunkThreshold = value;
  return true;
});
