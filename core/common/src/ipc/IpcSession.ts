/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module IpcSocket
 */

/** @internal */
export const rpcOverIpcStrings = {
  channelName: "itwinjs-core/rpc-over-ipc",
} as const;

/** @internal */
export interface InterceptedRpcRequest {
  definition: { interfaceName: string, interfaceVersion: string };
  operation: string;
  parameters: any[];
  context: { [index: string]: string };
}

/** @internal */
export abstract class IpcSession {
  private static _active?: IpcSession;
  public static get active(): IpcSession | undefined { return this._active; }

  public static start(session: IpcSession) {
    if (this._active)
      return;

    this._active = session;
  }

  public static stop() {
    this._active = undefined;
  }

  public abstract handleRpc(info: InterceptedRpcRequest): Promise<any>;
}
