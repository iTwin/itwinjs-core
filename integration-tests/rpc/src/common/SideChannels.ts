/*---------------------------------------------------------------------------------------------
* Copyright (c) 2019 Bentley Systems, Incorporated. All rights reserved.
* Licensed under the MIT License. See LICENSE.md in the project root for license terms.
*--------------------------------------------------------------------------------------------*/
export enum BackendTestCallbacks {
  registerTestRpcImpl2Class = "registerTestRpcImpl2Class",
  replaceTestRpcImpl2Instance = "replaceTestRpcImpl2Instance",
  unregisterTestRpcImpl2Class = "unregisterTestRpcImpl2Class",
  setIncompatibleInterfaceVersion = "setIncompatibleInterfaceVersion",
  restoreIncompatibleInterfaceVersion = "restoreIncompatibleInterfaceVersion",
  resetOp8Initializer = "resetOp8Initializer",
  getEnvironment = "getEnvironment",
  setChunkThreshold = "setChunkThreshold", // Only registered for electron!
}
