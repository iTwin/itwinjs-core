/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module IpcSocket
 */

import { IpcInterface, IpcInvokeReturn, IpcSocketBackend, RemoveFunction } from "@bentley/imodeljs-common";

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
    return BackendIpc.ipc.handle(impl.channelName, async (_evt: any, funcName: string, ...args: any[]): Promise<IpcInvokeReturn> => {
      const func = impl[funcName];
      if (typeof func !== "function")
        return { error: `Method Not Found ${funcName}` };

      try {
        return { result: await func.call(impl, ...args) };
      } catch (err) {
        return { error: { name: err.name, message: err.message, errorNumber: err.errorNumber } };
      }
    });
  }
}
