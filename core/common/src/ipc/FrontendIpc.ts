/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module IpcSocket
 */

import { BackendError } from "../IModelError";
import { IpcInvokeReturn, IpcSocketFrontend, iTwinChannel, RemoveFunction } from "./IpcSocket";

/**
 * This class provides frontend support for Ipc operations. It must be initialized with a platform-specific
 * implementation of the [[IpcSocketFrontend]] interface at startup, before calling [IModelApp.startup]($frontend).
 * @beta
 */
export class FrontendIpc {
  private static _ipc: IpcSocketFrontend | undefined;
  /** Get the implementation of the [[IpcSocketFrontend]] interface. */
  public static get ipc(): IpcSocketFrontend { return this._ipc!; }
  /** initialize the FrontendIpc system with a platform-specific implementation of the [[IpcSocketFrontend]] interface.
   * @param ipc the platform-specific implementation of the [IpcSocketFrontend]($common) interface
   * @note This method must be called before calling [[IModelApp.startup]]
   */
  public static initialize(ipc: IpcSocketFrontend) { this._ipc = ipc; }
  /** Determine whether Ipc is available for this frontend. This will only be true if [[initialize]] has been called on this class. */
  public static get isValid(): boolean { return undefined !== this._ipc; }

  /**
   * Establish a message handler function for the supplied channel over Ipc. The handler will be called when messages are sent for
   * the channel via  [BackendIpc.send]($common).
   * @param channel the name of the channel
   * @param handler the message handler
   * @returns A function to remove the handler
   * @note Ipc is only supported if [[isValid]] is true.
   */
  public static handleMessage(channel: string, handler: (...data: any[]) => void): RemoveFunction {
    return this._ipc!.receive(iTwinChannel(channel), (_evt: any, ...data: any[]) => handler(...data));
  }

  /**
   * Call a method on the backend through an [[IpcInterface]].
   * @param channelName the channel registered by the backend handler.
   * @param methodName  the name of a method implemented by the backend handler.
   * @param args arguments to `methodName`
   * @return a Promise with the return value from `methodName`
   * @note If the backend implementation throws an exception, this method will throw a [[BackendError]] exception
   * with the `errorNumber` and `message` from the backend.
   * @note Ipc is only supported if [[isValid]] is true.
   */
  public static async callBackend(channelName: string, methodName: string, ...args: any[]): Promise<any> {
    const retVal = (await this._ipc!.invoke(iTwinChannel(channelName), methodName, ...args)) as IpcInvokeReturn;
    if (undefined !== retVal.error)
      throw new BackendError(retVal.error.errorNumber, retVal.error.name, retVal.error.message);
    return retVal.result;
  }

}
