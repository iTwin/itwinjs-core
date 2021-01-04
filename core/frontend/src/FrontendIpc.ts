/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module IpcSocket
 */

import { BackendError, IpcInvokeReturn, IpcSocketFrontend, iTwinChannel, RemoveFunction } from "@bentley/imodeljs-common";

export class FrontendIpc {
  private static _ipc: IpcSocketFrontend | undefined;
  public static get ipc(): IpcSocketFrontend { return this._ipc!; }
  public static initialize(ipc: IpcSocketFrontend) { this._ipc = ipc; }
  public static get isValid(): boolean { return undefined !== this._ipc; }

  public static handleMessage(channel: string, handler: (...data: any[]) => void): RemoveFunction {
    return this._ipc!.receive(iTwinChannel(channel), (_evt: any, ...data: any[]) => handler(...data));
  }

  public static async callBackend(channelName: string, methodName: string, ...args: any[]): Promise<any> {
    const retVal = (await FrontendIpc.ipc.invoke(iTwinChannel(channelName), methodName, ...args)) as IpcInvokeReturn;
    if (undefined !== retVal.error)
      throw new BackendError(retVal.error.errorNumber, retVal.error.name, retVal.error.message);
    return retVal.result;
  }

}
