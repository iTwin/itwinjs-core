/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
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
  startIpcTest = "startIpcTest",
  startMockMobileTest = "startMockMobileTest",
  sendIpcMessage = "sendIpcMessage"
}
