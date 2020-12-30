/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module IpcSocket
 */

import { IpcInterface, IpcSocketBackend, RemoveFunction } from "@bentley/imodeljs-common";

export class BackendIpc {
  private static _ipc: IpcSocketBackend | undefined;
  public static get ipc(): IpcSocketBackend { return this._ipc!; }
  public static initialize(ipc: IpcSocketBackend) { this._ipc = ipc; }
  public static get isValid(): boolean { return undefined !== this._ipc; }
}

export abstract class IpcHandler implements IpcInterface {
  public abstract get channelName(): string;
  public abstract getVersion(): Promise<string>;

  public static register(): RemoveFunction {
    const impl = new (this as any)();
    return BackendIpc.ipc.handle(impl.channelName, async (funcName: string, ...args: any[]) => {
      const func = impl[funcName];
      if (typeof func !== "function")
        throw new Error(`Method Not Found ${funcName}`);

      return func.call(impl, ...args);
    });
  }
}
