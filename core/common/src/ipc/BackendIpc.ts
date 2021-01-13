/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module IpcSocket
 */

import { IModelError, IModelStatus } from "../IModelError";
import { IpcInterface, IpcInvokeReturn, IpcSocketBackend, iTwinChannel, RemoveFunction } from "./IpcSocket";

/**
 * This class provides backend support for Ipc operations. It must be initialized with a platform-specific
 * implementation of the [IpcSocketBackend]($common) interface at startup, before calling [IModelHost.startup]($backend).
 * @internal
 */
export class BackendIpc {
  private static _ipc: IpcSocketBackend | undefined;
  /** Get the implementation of the [IpcSocketBackend]($common) interface. */
  public static get ipc(): IpcSocketBackend { return this._ipc!; }
  /**
   * initialize backend support for Ipc
   * @param ipc The platform-specific implementation of the [IpcSocketBackend]($common) interface
   */
  public static initialize(ipc: IpcSocketBackend) { this._ipc = ipc; }
  /** Determine whether Ipc is available for this backend. This will only be true if [[initialize]] has been called on this class. */
  public static get isValid(): boolean { return undefined !== this._ipc; }

  /**
   * Send a message to the frontend over an Ipc channel.
   * @param channel the name of the channel matching the name registered with [FrontendIpc.handleMessage]($frontend).
   * @param data The content of the message.
   */
  public static sendMessage(channel: string, ...data: any[]) {
    return this._ipc!.send(iTwinChannel(channel), ...data);
  }
}

/**
 * Base class for all implementations of [IpcInterface]($frontend).
 *
 * Create a subclass to implement your IpcInterface. Your class should be declared like this:
 * ```ts
 * class MyHandler extends IpcHandler implements MyInterface
 * ```
 * to ensure all methods and signatures are correct.
 *
 * Then, call `MyClass.register` at startup to connect your class to your channel.
 * @alpha
 */
export abstract class IpcHandler implements IpcInterface {
  /** All subclasses must implement this method to specify their channel name. */
  public abstract get channelName(): string;
  /** All subclasses must implement this method to return a version string that can be compared on the frontend. */
  public abstract getVersion(): Promise<string>;

  /**
   * Register this class as the handler for methods on its channel. This static method creates a new instance
   * that becomes the handler and is `this` when its methods are called.
   * @returns A function that can be called to remove the handler.
   * @note this method should only be called once per channel. If it is called multiple times, subsequent calls replace the previous ones.
   */
  public static register(): RemoveFunction {
    const impl = new (this as any)(); // create an instance of subclass. "as any" is necessary because base class is abstract
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
