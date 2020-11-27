/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import { RpcInterfaceDefinition, RpcManager } from "@bentley/imodeljs-common";

// MUST be called to use Presentation RPC interface but AFTER Presentation.initialize(),
// otherwise does nothing
export const initializeRpcInterface = (rpcInterface: RpcInterfaceDefinition): void => {
  // calling it more than once throws, so we have to wrap it with try/catch.
  try {
    RpcManager.initializeInterface(rpcInterface);
  } catch (_e) {
  }
};
