/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module RpcInterface
 */
import { SerializedRpcActivity } from "./RpcInvocation";
import { RpcRequest } from "./RpcRequest";

/** Interface to enable passing application-specific context with each RPC request.
 * @internal
 */
export interface RpcRequestContext {
  /** Used to get the id of the request at the frontend */
  getId: (request: RpcRequest) => string;

  /** Used at frontend to serialize client specified context */
  serialize: (request: RpcRequest) => Promise<SerializedRpcActivity>;
}
