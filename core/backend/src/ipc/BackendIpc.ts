/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module IpcSocket
 */

import { IModelError, IModelStatus, IpcInterface, IpcInvokeReturn, IpcSocketBackend, iTwinChannel, RemoveFunction } from "@bentley/imodeljs-common";

export class BackendIpc {
  private static _ipc: IpcSocketBackend | undefined;
  public static get ipc(): IpcSocketBackend { return this._ipc!; }
  public static initialize(ipc: IpcSocketBackend) { this._ipc = ipc; }
  public static get isValid(): boolean { return undefined !== this._ipc; }

  public static sendMessage(channel: string, ...data: any[]) {
    return this._ipc!.send(iTwinChannel(channel), ...data);
  }
}

export abstract class IpcHandler implements IpcInterface {
  public abstract get channelName(): string;
  public abstract getVersion(): Promise<string>;

  public static register(): RemoveFunction {

    const impl = new (this as any)();
    return BackendIpc.ipc.handle(iTwinChannel(impl.channelName), async (_evt: any, funcName: string, ...args: any[]): Promise<IpcInvokeReturn> => {
      try {
        const func = impl[funcName];
        if (typeof func !== "function")
          throw new IModelError(IModelStatus.FunctionNotFound, `Method Not Found ${funcName}`);

        return { result: await func.call(impl, ...args) };
      } catch (err) {
        return { error: { name: err.constructor.name, message: err.message ?? "", errorNumber: err.errorNumber ?? 0 } };
      }
    });
  }
}
