/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module IpcSocket
 */

import { BackendError } from "../IModelError";
import { IpcInvokeReturn, IpcListener, IpcSocketFrontend, iTwinChannel, RemoveFunction } from "./IpcSocket";

/**
 * This class provides frontend support for Ipc operations. It must be initialized with a platform-specific
 * implementation of the [[IpcSocketFrontend]] interface at startup, before calling [IModelApp.startup]($frontend).
 * @beta
 */
export class FrontendIpc {
  private static _ipc: IpcSocketFrontend | undefined;
  /** Get the implementation of the [[IpcSocketFrontend]] interface. */
  private static get ipc(): IpcSocketFrontend { return this._ipc!; }
  /** initialize the FrontendIpc system with a platform-specific implementation of the [[IpcSocketFrontend]] interface.
   * @param ipc the platform-specific implementation of the [IpcSocketFrontend]($common) interface
   * @note This method must be called before calling [[IModelApp.startup]]
   */
  public static initialize(ipc: IpcSocketFrontend) { this._ipc = ipc; }
  /** Determine whether Ipc is available for this frontend. This will only be true if [[initialize]] has been called on this class. */
  public static get isValid(): boolean { return undefined !== this._ipc; }

  /**
   * Establish a message handler function for the supplied channel over Ipc. The handler will be called when messages are sent for
   * the channel via  [BackendIpc.sendMessage]($common).
   * @param channel the name of the channel
   * @param handler the message handler
   * @returns A function to remove the handler
   * @note Ipc is only supported if [[isValid]] is true.
   */
  public static addListener(channel: string, handler: IpcListener): RemoveFunction {
    return this.ipc.addListener(iTwinChannel(channel), handler);
  }

  /**
   * Remove a previously registered listener
   * @param channel The name of the channel for the listener previously registered with [[addListener]]
   * @param listener The function passed to [[addListener]]
   */
  public static removeListener(channel: string, listener: IpcListener) {
    this.ipc.removeListener(iTwinChannel(channel), listener);
  }

  /**
   * Send a message to the backend via `channel` and expect a result asynchronously.
   * @param channel The name of the channel for the method.
   * @see Electron [ipcRenderer.invoke](https://www.electronjs.org/docs/api/ipc-renderer) documentation for details.
   * Note that this interface *may* be implemented via Electron for desktop apps, or via
   * [WebSockets](https://developer.mozilla.org/en-US/docs/Web/API/WebSockets_API) for mobile or web-based
   * Ipc connections. In either case, the Electron documentation provides the specifications for how it works.
   * @note `args` are serialized with the [Structured Clone Algorithm](https://developer.mozilla.org/en-US/docs/Web/API/Web_Workers_API/Structured_clone_algorithm), so only
   * primitive types and `ArrayBuffers` are allowed.
   */
  public static async invoke(channel: string, ...args: any[]): Promise<any> {
    return this.ipc.invoke(iTwinChannel(channel), ...args);
  }

  /**
   * Send a message over the socket.
   * @param channel The name of the channel for the message.
   * @param data The optional data of the message.
   * @note `data` is serialized with the [Structured Clone Algorithm](https://developer.mozilla.org/en-US/docs/Web/API/Web_Workers_API/Structured_clone_algorithm), so only
   * primitive types and `ArrayBuffers` are allowed.
   */
  public static send(channel: string, ...data: any[]) {
    return this.ipc.send(iTwinChannel(channel), ...data);
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
