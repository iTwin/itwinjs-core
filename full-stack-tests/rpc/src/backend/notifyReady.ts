/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/

/** @internal */
export const rpcBackendIdentityHeader = "x-vitest-rpc-backend-id";

/** @internal */
export interface RpcBackendReadyMessage {
  type: "rpc-browser-ready";
  backendId: string;
  environment: "http" | "websocket";
  pid: number;
}

/** Notify the owning Vitest process only after all backend initialization has completed.
 * @internal
 */
export function notifyReady(environment: RpcBackendReadyMessage["environment"]): void {
  const backendId = process.env.VITEST_RPC_BACKEND_ID;
  if (backendId && process.send) {
    const message: RpcBackendReadyMessage = { type: "rpc-browser-ready", backendId, environment, pid: process.pid };
    process.send(message);
  }
}
