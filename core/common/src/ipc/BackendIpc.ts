/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module IpcSocket
 */

import { IModelError, IModelStatus } from "../IModelError";
import { IpcInvokeReturn, IpcListener, IpcSocketBackend, iTwinChannel, RemoveFunction } from "./IpcSocket";

/**
 * This class provides backend support for Ipc operations. It must be initialized with a platform-specific
 * implementation of the [IpcSocketBackend]($common) interface at startup, before calling [IModelHost.startup]($backend).
 * @beta
 */
export class BackendIpc {
  private static _ipc: IpcSocketBackend | undefined;
  /** Get the implementation of the [IpcSocketBackend]($common) interface. */
  private static get ipc(): IpcSocketBackend { return this._ipc!; }
  /**
   * initialize backend support for Ipc
   * @param ipc The platform-specific implementation of the [[IpcSocketBackend]] interface
   */
  public static initialize(ipc: IpcSocketBackend) { this._ipc = ipc; }
  /** Determine whether Ipc is available for this backend. This will only be true if [[initialize]] has been called on this class. */
  public static get isValid(): boolean { return undefined !== this._ipc; }

  /**
   * Send a message to the frontend over an Ipc channel.
   * @param channel the name of the channel matching the name registered with [[FrontendIpc.addListener]].
   * @param data The content of the message.
   */
  public static send(channel: string, ...data: any[]): void {
    this.ipc.send(iTwinChannel(channel), ...data);
  }

  /**
   * Establish a backend implementation of an [[IpcInterface]] for a channel.
   * @param channel The name of the channel for this handler.
   * @param handler A function that supplies the implementation for methods invoked over `channel` via [[FrontendIpc.invoke]]
   * @note returns A function to call to remove the handler.
   */
  public static handle(channel: string, handler: (...args: any[]) => Promise<any>): RemoveFunction {
    return this.ipc.handle(iTwinChannel(channel), handler);
  }
  /**
   * Establish a handler to receive messages for a channel through a socket.
   * @param channel The name of the channel for the messages.
   * @param listener A function called when messages are sent over `channel`
   * @note returns A function to call to remove the listener.
   */
  public static addListener(channel: string, listener: IpcListener): RemoveFunction {
    return this.ipc.addListener(iTwinChannel(channel), listener);
  }
  /**
   * Remove a previously registered listener
   * @param channel The name of the channel for the listener previously registered with [[addListener]]
   * @param listener The function passed to [[addListener]]
   */
  public static removeListener(channel: string, listener: IpcListener): void {
    this.ipc.removeListener(iTwinChannel(channel), listener);
  };
}

/**
 * Base class for all implementations of [[IpcInterface]].
 *
 * Create a subclass to implement your IpcInterface. Your class should be declared like this:
 * ```ts
 * class MyHandler extends IpcHandler implements MyInterface
 * ```
 * to ensure all methods and signatures are correct.
 *
 * Then, call `MyClass.register` at startup to connect your class to your channel.
 * @beta
 */
export abstract class IpcHandler {
  /** All subclasses must implement this method to specify their channel name. */
  public abstract get channelName(): string;

  /**
   * Register this class as the handler for methods on its channel. This static method creates a new instance
   * that becomes the handler and is `this` when its methods are called.
   * @returns A function that can be called to remove the handler.
   * @note this method should only be called once per channel. If it is called multiple times, subsequent calls replace the previous ones.
   */
  public static register(): RemoveFunction {
    const impl = new (this as any)() as IpcHandler; // create an instance of subclass. "as any" is necessary because base class is abstract
    return BackendIpc.handle(impl.channelName, async (_evt: Event, funcName: string, ...args: any[]): Promise<IpcInvokeReturn> => {
      try {
        const func = (impl as any)[funcName];
        if (typeof func !== "function")
          throw new IModelError(IModelStatus.FunctionNotFound, `Method "${impl.constructor.name}.${funcName}" not found on IpcHandler registered for channel: ${impl.channelName}`);

        return { result: await func.call(impl, ...args) };
      } catch (err) {
        return { error: { name: err.constructor.name, message: err.message ?? "", errorNumber: err.errorNumber ?? 0 } };
      }
    });
  }
}
