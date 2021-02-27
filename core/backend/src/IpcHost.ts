/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module NativeApp
 */

import { ClientRequestContext, IModelStatus, Logger, LogLevel, OpenMode } from "@bentley/bentleyjs-core";
import {
  BriefcasePushAndPullNotifications, IModelChangeNotifications, IModelConnectionProps, IModelError, IModelRpcProps, IpcAppChannel, IpcAppFunctions,
  IpcInvokeReturn, IpcListener, IpcSocketBackend, iTwinChannel, OpenBriefcaseProps, RemoveFunction, StandaloneOpenOptions, TileTreeContentIds,
} from "@bentley/imodeljs-common";
import { IModelJsNative } from "@bentley/imodeljs-native";
import { AuthorizedClientRequestContext } from "@bentley/itwin-client";
import { BriefcaseDb, IModelDb, StandaloneDb } from "./IModelDb";
import { IModelHost, IModelHostConfiguration } from "./IModelHost";
import { cancelTileContentRequests } from "./rpc-impl/IModelTileRpcImpl";

/**
 * Options for [[IpcHost.startup]]
 * @beta
 */
export interface IpcHostOptions {
  /** The Ipc socket to use for communications with frontend. Allows undefined only for headless tests. */
  socket?: IpcSocketBackend;
}

/**
 * Used by applications that have a dedicated backend. IpcHosts may send messages to their corresponding IpcApp.
 * @note if either end terminates, the other must too.
 * @beta
*/
export class IpcHost {
  private static _ipc: IpcSocketBackend | undefined;
  /** Get the implementation of the [IpcSocketBackend]($common) interface. */
  private static get ipc(): IpcSocketBackend { return this._ipc!; }
  /** Determine whether Ipc is available for this backend. This will only be true if [[startup]] has been called on this class. */
  public static get isValid(): boolean { return undefined !== this._ipc; }

  /**
   * Send a message to the frontend over an Ipc channel.
   * @param channel the name of the channel matching the name registered with [[IpcApp.addListener]].
   * @param data The content of the message.
   */
  public static send(channel: string, ...data: any[]): void {
    this.ipc.send(iTwinChannel(channel), ...data);
  }

  /**
   * Establish a handler for an Ipc channel to receive [[Frontend.invoke]] calls
   * @param channel The name of the channel for this handler.
   * @param handler A function that supplies the implementation for `channel`
   * @note returns A function to call to remove the handler.
   */
  public static handle(channel: string, handler: (...args: any[]) => Promise<any>): RemoveFunction {
    return this.ipc.handle(iTwinChannel(channel), handler);
  }
  /**
   * Establish a handler to receive messages sent via [[IpcApp.send]].
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
  }

  private static notify(channel: string, briefcase: BriefcaseDb | StandaloneDb, methodName: string, ...args: any[]) {
    if (this.isValid)
      return this.send(`${channel}:${briefcase.key}`, methodName, ...args);
  }

  /** @internal */
  public static notifyIModelChanges<T extends keyof IModelChangeNotifications>(briefcase: BriefcaseDb | StandaloneDb, methodName: T, ...args: Parameters<IModelChangeNotifications[T]>) {
    this.notify(IpcAppChannel.IModelChanges, briefcase, methodName, ...args);
  }

  /** @internal */
  public static notifyPushAndPull<T extends keyof BriefcasePushAndPullNotifications>(briefcase: BriefcaseDb | StandaloneDb, methodName: T, ...args: Parameters<BriefcasePushAndPullNotifications[T]>) {
    this.notify(IpcAppChannel.PushPull, briefcase, methodName, ...args);
  }

  public static async startup(opt?: { ipcHost?: IpcHostOptions, iModelHost?: IModelHostConfiguration }): Promise<void> {
    this._ipc = opt?.ipcHost?.socket;
    if (this.isValid) // for tests, we use IpcHost but don't have a frontend
      IpcAppHandler.register();
    await IModelHost.startup(opt?.iModelHost);
  }

  public static async shutdown(): Promise<void> {
    this._ipc = undefined;
    await IModelHost.shutdown();
  }
}

/**
 * Base class for all implementations of an Ipc interface.
 *
 * Create a subclass to implement your Ipc interface. Your class should be declared like this:
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
    return IpcHost.handle(impl.channelName, async (_evt: Event, funcName: string, ...args: any[]): Promise<IpcInvokeReturn> => {
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

/**
 * Implementation  of IpcAppFunctions
 */
class IpcAppHandler extends IpcHandler implements IpcAppFunctions {
  public get channelName() { return IpcAppChannel.Functions; }
  public async log(_timestamp: number, level: LogLevel, category: string, message: string, metaData?: any): Promise<void> {
    Logger.logRaw(level, category, message, () => metaData);
  }
  public async cancelTileContentRequests(tokenProps: IModelRpcProps, contentIds: TileTreeContentIds[]): Promise<void> {
    return cancelTileContentRequests(tokenProps, contentIds);
  }
  public async cancelElementGraphicsRequests(key: string, requestIds: string[]): Promise<void> {
    const iModel = IModelDb.findByKey(key);
    return iModel.nativeDb.cancelElementGraphicsRequests(requestIds);
  }
  public async openBriefcase(args: OpenBriefcaseProps): Promise<IModelConnectionProps> {
    const requestContext = ClientRequestContext.current;
    const db = await BriefcaseDb.open(requestContext, args);
    requestContext.enter();
    return db.toJSON();
  }
  public async openStandalone(filePath: string, openMode: OpenMode, opts?: StandaloneOpenOptions): Promise<IModelConnectionProps> {
    return StandaloneDb.openFile(filePath, openMode, opts).getConnectionProps();
  }
  public async closeIModel(key: string): Promise<void> {
    IModelDb.findByKey(key).close();
  }
  public async saveChanges(key: string, description?: string): Promise<void> {
    IModelDb.findByKey(key).saveChanges(description);
  }
  public async hasPendingTxns(key: string): Promise<boolean> {
    return IModelDb.findByKey(key).nativeDb.hasPendingTxns();
  }
  public async pullAndMergeChanges(key: string): Promise<IModelConnectionProps> {
    const iModelDb = BriefcaseDb.findByKey(key);
    const requestContext = ClientRequestContext.current as AuthorizedClientRequestContext;
    await iModelDb.pullAndMergeChanges(requestContext);
    return iModelDb.getConnectionProps();
  }
  public async pushChanges(key: string, description: string): Promise<IModelConnectionProps> {
    const iModelDb = BriefcaseDb.findByKey(key);
    const requestContext = ClientRequestContext.current as AuthorizedClientRequestContext;
    await iModelDb.pushChanges(requestContext, description);
    return iModelDb.getConnectionProps();
  }
  public async toggleInteractiveEditingSession(key: string, startSession: boolean): Promise<boolean> {
    const imodel = IModelDb.findByKey(key);
    const val: IModelJsNative.ErrorStatusOrResult<any, boolean> = imodel.nativeDb.setGeometricModelTrackingEnabled(startSession);
    if (val.error)
      throw new IModelError(val.error.status, "Failed to toggle interactive editing session");

    return val.result!;
  }
  public async isInteractiveEditingSupported(key: string): Promise<boolean> {
    const imodel = IModelDb.findByKey(key);
    return imodel.nativeDb.isGeometricModelTrackingSupported();
  }
  public async reverseSingleTxn(key: string): Promise<IModelStatus> {
    const imodel = IModelDb.findByKey(key);
    return imodel.nativeDb.reverseTxns(1);
  }
  public async reverseAllTxn(key: string): Promise<IModelStatus> {
    const imodel = IModelDb.findByKey(key);
    return imodel.nativeDb.reverseAll();
  }
  public async reinstateTxn(key: string): Promise<IModelStatus> {
    const imodel = IModelDb.findByKey(key);
    return imodel.nativeDb.reinstateTxn();
  }

  public async queryConcurrency(pool: "io" | "cpu"): Promise<number> {
    return IModelJsNative.queryConcurrency(pool);
  }
}

