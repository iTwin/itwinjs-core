/*---------------------------------------------------------------------------------------------
* Copyright (c) 2019 Bentley Systems, Incorporated. All rights reserved.
* Licensed under the MIT License. See LICENSE.md in the project root for license terms.
*--------------------------------------------------------------------------------------------*/
declare var ___IMODELJS_CORE_DIRNAME___: any;

export const CONSTANTS = {
  get IMODELJS_CORE_DIRNAME(): string { return ___IMODELJS_CORE_DIRNAME___; },
  PENDING_RESPONSE_QUOTA_MESSAGE: "pendingResponseQuota",
  REGISTER_TEST_RPCIMPL2_CLASS_MESSAGE: "registerTestRpcImpl2Class",
  REPLACE_TEST_RPCIMPL2_INSTANCE_MESSAGE: "replaceTestRpcImpl2Instance",
  UNREGISTER_TEST_RPCIMPL2_CLASS_MESSAGE: "unregisterTestRpcImpl2Class",
  SET_INCOMPATIBLE_INTERFACE_VERSION: "setIncompatibleInterfaceVersion",
  RESTORE_COMPATIBLE_INTERFACE_VERSION: "restoreIncompatibleInterfaceVersion",
  RESTART_BACKEND: "restartBackend",
  RESET_OP8_INITIALIZER: "resetOp8Initializer",
};
