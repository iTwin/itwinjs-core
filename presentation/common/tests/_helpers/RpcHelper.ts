/*---------------------------------------------------------------------------------------------
|  $Copyright: (c) 2018 Bentley Systems, Incorporated. All rights reserved. $
 *--------------------------------------------------------------------------------------------*/
import { RpcManager, RpcInterfaceDefinition } from "@bentley/imodeljs-common";

// MUST be called to use Presentation RPC interface but AFTER Presentation.initialize(),
// otherwise does nothing
export const initializeRpcInterface = (rpcInterface: RpcInterfaceDefinition) => {
  // calling it more than once throws, so we have to wrap it with try/catch.
  try {
    RpcManager.initializeInterface(rpcInterface);
  } catch (_e) {
  }
};
