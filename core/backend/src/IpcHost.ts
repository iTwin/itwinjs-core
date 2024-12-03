/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module NativeApp
 */

import { IModelJsNative } from "@bentley/imodeljs-native";
import { assert, BentleyError, IModelStatus, Logger, LogLevel, OpenMode } from "@itwin/core-bentley";
import {
  ChangesetIndex, ChangesetIndexAndId, EditingScopeNotifications, getPullChangesIpcChannel, IModelConnectionProps, IModelError, IModelNotFoundResponse, IModelRpcProps,
  ipcAppChannels, IpcAppFunctions, IpcAppNotifications, IpcInvokeReturn, IpcListener, IpcSocketBackend, iTwinChannel,
  ITwinError,
  OpenBriefcaseProps, OpenCheckpointArgs, PullChangesOptions, RemoveFunction, SnapshotOpenOptions, StandaloneOpenOptions, TileTreeContentIds, TxnNotifications,
} from "@itwin/core-common";
import { ProgressFunction, ProgressStatus } from "./CheckpointManager";
import { BriefcaseDb, IModelDb, SnapshotDb, StandaloneDb } from "./IModelDb";
import { IModelHost, IModelHostOptions } from "./IModelHost";
import { cancelTileContentRequests } from "./rpc-impl/IModelTileRpcImpl";
import { IModelNative } from "./internal/NativePlatform";
import { _nativeDb } from "./internal/Symbols";

/**
  * Options for [[IpcHost.startup]]
  * @public
  */
export interface IpcHostOpts {
  iModelHost?: IModelHostOptions;
  ipcHost?: {
    /** The Ipc socket to use for communications with frontend. Allows undefined only for headless tests. */
    socket?: IpcSocketBackend;

    /** don't send stack information on exceptions */
    exceptions?: {
      noStack?: boolean;
    };
  };
}

/**
 * Used by applications that have a dedicated backend. IpcHosts may send messages to their corresponding IpcApp.
 * @note if either end terminates, the other must too.
 * @public
 */
export class IpcHost {
  public static noStack = false;
  private static _ipc: IpcSocketBackend | undefined;
  /** Get the implementation of the [IpcSocketBackend]($common) interface. */
  private static get ipc(): IpcSocketBackend { return this._ipc!; } // eslint-disable-line @typescript-eslint/no-non-null-assertion
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
      return this.send(`${channel}/${briefcase.key}`, methodName, ...args);
  }

  /** @internal */
  public static notifyIpcFrontend<T extends keyof IpcAppNotifications>(methodName: T, ...args: Parameters<IpcAppNotifications[T]>) {
    return IpcHost.send(ipcAppChannels.appNotify, methodName, ...args);
  }

  /** @internal */
  public static notifyTxns<T extends keyof TxnNotifications>(briefcase: BriefcaseDb | StandaloneDb, methodName: T, ...args: Parameters<TxnNotifications[T]>) {
    this.notify(ipcAppChannels.txns, briefcase, methodName, ...args);
  }

  /** @internal */
  public static notifyEditingScope<T extends keyof EditingScopeNotifications>(briefcase: BriefcaseDb | StandaloneDb, methodName: T, ...args: Parameters<EditingScopeNotifications[T]>) {
    this.notify(ipcAppChannels.editingScope, briefcase, methodName, ...args);
  }

  /**
   * Start the backend of an Ipc app.
   * @param opt
   * @note this method calls [[IModelHost.startup]] internally.
   */
  public static async startup(opt?: IpcHostOpts): Promise<void> {
    this._ipc = opt?.ipcHost?.socket;
    if (opt?.ipcHost?.exceptions?.noStack)
      this.noStack = true;

    if (this.isValid) { // for tests, we use IpcHost but don't have a frontend
      IpcAppHandler.register();
    }

    await IModelHost.startup(opt?.iModelHost);
  }

  /** Shutdown IpcHost backend. Also calls [[IModelHost.shutdown]] */
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
 * @public
 */
export abstract class IpcHandler {
  /**
   * All subclasses *must* implement this method to specify their channel name.
   *
   * Channel names are the key that connects Handlers and senders. The channel name of IpcHandlers must exactly match the name used by senders.
   * By convention, channel names should be prefixed by a *namespace* (e.g. `${appName}/`)
   * unique enough to disambiguate them from channels for other apps that may be running in the same processes.
   */
  public abstract get channelName(): string;

  /**
   * Register this class as the handler for methods on its channel. This static method creates a new instance
   * that becomes the handler and is `this` when its methods are called.
   * @returns A function that can be called to remove the handler.
   * @note this method should only be called once per channel. If it is called multiple times, subsequent calls replace the previous ones.
   */
  public static register(): RemoveFunction {
    const impl = new (this as any)() as IpcHandler; // create an instance of subclass. "as any" is necessary because base class is abstract
    const prohibitedFunctions = Object.getOwnPropertyNames(Object.getPrototypeOf({}));

    return IpcHost.handle(impl.channelName, async (_evt: Event, funcName: string, ...args: any[]): Promise<IpcInvokeReturn> => {
      try {
        if (prohibitedFunctions.includes(funcName))
          throw new Error(`Method "${funcName}" not available for channel: ${impl.channelName}`);

        const func = (impl as any)[funcName];
        if (typeof func !== "function")
          throw new IModelError(IModelStatus.FunctionNotFound, `Method "${impl.constructor.name}.${funcName}" not found on IpcHandler registered for channel: ${impl.channelName}`);

        return { result: await func.call(impl, ...args) };
      } catch (err: any) {
        let ret: IpcInvokeReturn;
        if (ITwinError.isITwinError(err)) {
          // TODO: Should metadata be left out? It is left out in the original error implementation..
          // eslint-disable-next-line @typescript-eslint/no-unused-vars
          const { namespace, errorKey, message, stack, metadata, ...rest } = err;
          ret = {
            iTwinError:
            {
              namespace,
              errorKey,
              message,
              ...rest,
            },
          };
          if (!IpcHost.noStack)
            ret.iTwinError.stack = stack;
        } else {
          ret = {
            error:
            {
              name: err.hasOwnProperty("name") ? err.name : err.constructor?.name ?? "Unknown Error",
              message: err.message ?? BentleyError.getErrorMessage(err),
              errorNumber: err.errorNumber ?? 0,
            },
          };
          if (!IpcHost.noStack)
            ret.error.stack = BentleyError.getErrorStack(err);
        }
        return ret;
      }
    });
  }
}

/**
 * Implementation  of IpcAppFunctions
 */
class IpcAppHandler extends IpcHandler implements IpcAppFunctions {
  public get channelName() { return ipcAppChannels.functions; }

  private _iModelKeyToPullStatus = new Map<string, ProgressStatus>();

  public async log(_timestamp: number, level: LogLevel, category: string, message: string, metaData?: any): Promise<void> {
    switch (level) {
      case LogLevel.Error:
        Logger.logError(category, message, metaData);
        break;
      case LogLevel.Info:
        Logger.logInfo(category, message, metaData);
        break;
      case LogLevel.Trace:
        Logger.logTrace(category, message, metaData);
        break;
      case LogLevel.Warning:
        Logger.logWarning(category, message, metaData);
        break;
    }
  }

  public async cancelTileContentRequests(tokenProps: IModelRpcProps, contentIds: TileTreeContentIds[]): Promise<void> {
    return cancelTileContentRequests(tokenProps, contentIds);
  }
  public async cancelElementGraphicsRequests(key: string, requestIds: string[]): Promise<void> {
    return IModelDb.findByKey(key)[_nativeDb].cancelElementGraphicsRequests(requestIds);
  }
  public async openBriefcase(args: OpenBriefcaseProps): Promise<IModelConnectionProps> {
    const db = await BriefcaseDb.open(args);
    return db.toJSON();
  }
  public async openCheckpoint(checkpoint: OpenCheckpointArgs): Promise<IModelConnectionProps> {
    return (await SnapshotDb.openCheckpoint(checkpoint)).getConnectionProps();
  }
  public async openStandalone(filePath: string, openMode: OpenMode, opts?: StandaloneOpenOptions): Promise<IModelConnectionProps> {
    return StandaloneDb.openFile(filePath, openMode, opts).getConnectionProps();
  }
  public async openSnapshot(filePath: string, opts?: SnapshotOpenOptions): Promise<IModelConnectionProps> {
    let resolvedFileName: string | undefined = filePath;
    if (IModelHost.snapshotFileNameResolver) { // eslint-disable-line @typescript-eslint/no-deprecated
      resolvedFileName = IModelHost.snapshotFileNameResolver.tryResolveFileName(filePath); // eslint-disable-line @typescript-eslint/no-deprecated
      if (!resolvedFileName)
        throw new IModelNotFoundResponse(); // eslint-disable-line @typescript-eslint/only-throw-error
    }
    return SnapshotDb.openFile(resolvedFileName, opts).getConnectionProps();
  }
  public async closeIModel(key: string): Promise<void> {
    IModelDb.findByKey(key).close();
  }
  public async saveChanges(key: string, description?: string): Promise<void> {
    IModelDb.findByKey(key).saveChanges(description);
  }
  public async hasPendingTxns(key: string): Promise<boolean> {
    return IModelDb.findByKey(key)[_nativeDb].hasPendingTxns();
  }

  public async isUndoPossible(key: string): Promise<boolean> {
    return IModelDb.findByKey(key)[_nativeDb].isUndoPossible();
  }
  public async isRedoPossible(key: string): Promise<boolean> {
    return IModelDb.findByKey(key)[_nativeDb].isRedoPossible();
  }
  public async getUndoString(key: string): Promise<string> {
    return IModelDb.findByKey(key)[_nativeDb].getUndoString();
  }
  public async getRedoString(key: string): Promise<string> {
    return IModelDb.findByKey(key)[_nativeDb].getUndoString();
  }

  public async pullChanges(key: string, toIndex?: ChangesetIndex, options?: PullChangesOptions): Promise<ChangesetIndexAndId> {
    const iModelDb = BriefcaseDb.findByKey(key);

    this._iModelKeyToPullStatus.set(key, ProgressStatus.Continue);
    const checkAbort = () => this._iModelKeyToPullStatus.get(key) ?? ProgressStatus.Continue;

    let onProgress: ProgressFunction | undefined;
    if (options?.reportProgress) {
      const progressCallback: ProgressFunction = (loaded, total) => {
        IpcHost.send(getPullChangesIpcChannel(iModelDb.iModelId), { loaded, total });
        return checkAbort();
      };
      onProgress = throttleProgressCallback(progressCallback, checkAbort, options?.progressInterval);
    } else if (options?.enableCancellation) {
      onProgress = checkAbort;
    }

    try {
      await iModelDb.pullChanges({ toIndex, onProgress });
    } finally {
      this._iModelKeyToPullStatus.delete(key);
    }

    return iModelDb.changeset as ChangesetIndexAndId;
  }
  public async cancelPullChangesRequest(key: string): Promise<void> {
    this._iModelKeyToPullStatus.set(key, ProgressStatus.Abort);
  }

  public async pushChanges(key: string, description: string): Promise<ChangesetIndexAndId> {
    const iModelDb = BriefcaseDb.findByKey(key);
    await iModelDb.pushChanges({ description });
    return iModelDb.changeset as ChangesetIndexAndId;
  }

  public async toggleGraphicalEditingScope(key: string, startSession: boolean): Promise<boolean> {
    const val: IModelJsNative.ErrorStatusOrResult<any, boolean> = IModelDb.findByKey(key)[_nativeDb].setGeometricModelTrackingEnabled(startSession);
    if (val.error)
      throw new IModelError(val.error.status, "Failed to toggle graphical editing scope");
    assert(undefined !== val.result);
    return val.result;
  }
  public async isGraphicalEditingSupported(key: string): Promise<boolean> {
    return IModelDb.findByKey(key)[_nativeDb].isGeometricModelTrackingSupported();
  }

  public async reverseTxns(key: string, numOperations: number): Promise<IModelStatus> {
    return IModelDb.findByKey(key)[_nativeDb].reverseTxns(numOperations);
  }
  public async reverseAllTxn(key: string): Promise<IModelStatus> {
    return IModelDb.findByKey(key)[_nativeDb].reverseAll();
  }
  public async reinstateTxn(key: string): Promise<IModelStatus> {
    return IModelDb.findByKey(key)[_nativeDb].reinstateTxn();
  }
  public async restartTxnSession(key: string): Promise<void> {
    return IModelDb.findByKey(key)[_nativeDb].restartTxnSession();
  }

  public async queryConcurrency(pool: "io" | "cpu"): Promise<number> {
    return IModelNative.platform.queryConcurrency(pool);
  }
}

/**
 * Prevents progress callback being called more frequently when provided interval.
 * @internal
 */
export function throttleProgressCallback(func: ProgressFunction, checkAbort: () => ProgressStatus, progressInterval?: number): ProgressFunction {
  const interval = progressInterval ?? 250; // by default, only send progress events every 250 milliseconds
  let nextTime = Date.now() + interval;
  const progressCallback: ProgressFunction = (loaded, total) => {
    const now = Date.now();
    if (loaded >= total || now >= nextTime) {
      nextTime = now + interval;
      return func(loaded, total);
    }
    return checkAbort();
  };

  return progressCallback;
}
