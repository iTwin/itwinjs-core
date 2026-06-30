/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module NativeApp
 */

import { IModelJsNative } from "@bentley/imodeljs-native";
import { assert, IModelStatus, JsonUtils, Logger, LogLevel, OpenMode, PickAsyncMethods } from "@itwin/core-bentley";
import {
  BriefcaseConnectionProps,
  ChangesetIndex, ChangesetIndexAndId, EditingScopeNotifications, getPullChangesIpcChannel, IModelConnectionProps, IModelError, IModelNotFoundResponse, IModelRpcProps,
  ipcAppChannels, IpcAppFunctions, IpcAppNotifications, IpcInvokeReturn, IpcListener, IpcSocketBackend, iTwinChannel,
  OpenBriefcaseProps, OpenCheckpointArgs, PullChangesOptions, rebuildIpcError, ReinstateTxnArgs, RemoveFunction, ReverseTxnArgs, serializeIpcError, SnapshotOpenOptions,
  StandaloneOpenOptions, TileTreeContentIds, TxnNotifications,
} from "@itwin/core-common";
import { ProgressFunction, ProgressStatus } from "./CheckpointManager";
import { BriefcaseDb, IModelDb, SnapshotDb, StandaloneDb } from "./IModelDb";
import { IModelHost, IModelHostOptions } from "./IModelHost";
import { IModelNative } from "./internal/NativePlatform";
import { _implicitTxn, _nativeDb } from "./internal/Symbols";
import { cancelTileContentRequests } from "./rpc-impl/IModelTileRpcImpl";

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

  private static _nextInvokeId = 0;
  private static _pendingInvokes = new Map<number, () => void>();

  /**
   * The number of milliseconds [[invoke]] waits for the frontend to respond before rejecting. When `undefined`
   * (the default), invokes wait indefinitely. Set a value to guard against a frontend that never responds.
   * @alpha
   */
  public static invokeTimeout?: number;

  /**
   * Send a message to the frontend via `channel` and expect a result asynchronously. The handler must be established on the frontend via [[IpcApp.handle]]
   * @param channel The name of the channel for the method.
   * @see Electron [ipcRenderer.send](https://www.electronjs.org/docs/api/ipc-renderer) documentation for details.
   * Note that this interface may be implemented via Electron for desktop apps, or via
   * [WebSockets](https://developer.mozilla.org/en-US/docs/Web/API/WebSockets_API) for mobile or web-based
   * Ipc connections. In either case, the Electron documentation provides the specifications for how it works.
   * @note `args` are serialized with the [Structured Clone Algorithm](https://developer.mozilla.org/en-US/docs/Web/API/Web_Workers_API/Structured_clone_algorithm), so only
   * primitive types and `ArrayBuffers` are allowed.
   * @note The returned Promise rejects if [[shutdown]] is called or [[invokeTimeout]] elapses before the frontend responds.
   * @alpha
   */
  public static async invoke(channel: string, ...args: any[]): Promise<any> {
    // Electron has no main->renderer `invoke` (see https://www.electronjs.org/docs/latest/tutorial/ipc#pattern-3-main-to-renderer),
    // so we synthesize request/response from the universally-available `send`/`addListener` primitives: push the request via
    // `send` together with a unique per-request response channel, and resolve when the frontend handler replies on that channel.
    // This works across all transports (Electron, mobile, web sockets) without changing any `@public` IpcSocket interface.
    const requestId = ++this._nextInvokeId % Number.MAX_SAFE_INTEGER;
    const responseChannel = iTwinChannel(`${channel}-invoke_response-${requestId}`);

    return new Promise((resolve, reject) => {
      let removeListener: RemoveFunction = () => { };
      let timer: ReturnType<typeof setTimeout> | undefined;
      const cleanup = () => {
        removeListener();
        this._pendingInvokes.delete(requestId);
        if (timer !== undefined)
          clearTimeout(timer);
      };

      removeListener = this.ipc.addListener(responseChannel, (_evt: Event, result: any) => {
        cleanup();
        resolve(result);
      });

      // allow [[shutdown]] to reject any in-flight invoke rather than leaking its listener forever.
      this._pendingInvokes.set(requestId, () => {
        cleanup();
        reject(new Error(`IpcHost was shut down before the frontend responded on channel "${channel}"`));
      });

      if (undefined !== this.invokeTimeout) {
        timer = setTimeout(() => {
          cleanup();
          reject(new Error(`IpcHost.invoke timed out after ${this.invokeTimeout}ms on channel "${channel}"`));
        }, this.invokeTimeout);
      }

      this.send(channel, responseChannel, ...args);
    });
  }

  /**
   * Call a method on the frontend through an Ipc channel.
   * @param channelName the channel registered by the frontend handler.
   * @param methodName the name of a method implemented by the frontend handler.
   * @param args arguments to `methodName`
   * @returns a Promise with the return value from `methodName`
   */
  private static async callIpcChannel(channelName: string, methodName: string, ...args: any[]): Promise<any> {
    const retVal = await this.invoke(channelName, methodName, ...args) as IpcInvokeReturn;

    if (retVal.error === undefined) return retVal.result;

    // frontend threw an exception, rethrow one on backend
    const err = retVal.error;
    if (!JsonUtils.isObject(err)) {
      // Exception wasn't an object?
      throw retVal.error; // eslint-disable-line @typescript-eslint/only-throw-error
    }

    throw rebuildIpcError(err);
  }

  /**
   * Create a type safe Proxy object to make IPC calls to a registered frontend interface.
   * @param channelName the channel registered by the frontend handler.
   * @alpha
   */
  public static makeIpcProxy<K, C extends string = string>(channelName: C): PickAsyncMethods<K> {
    return new Proxy({} as PickAsyncMethods<K>, {
      get(_target, methodName: string) {
        return async (...invokeArgs: any[]) =>
          IpcHost.callIpcChannel(channelName, methodName, ...invokeArgs);
      },
    });
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

    // reject any in-flight invokes so their callers don't hang forever after the socket is gone.
    const pending = [...this._pendingInvokes.values()];
    this._pendingInvokes.clear();
    for (const rejectPending of pending)
      rejectPending();

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
      } catch (err: unknown) {
        return serializeIpcError(err, !IpcHost.noStack);
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
  public async openBriefcase(args: OpenBriefcaseProps): Promise<BriefcaseConnectionProps> {
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
    IModelDb.findByKey(key)[_implicitTxn].saveChanges(description);
  }
  public async abandonChanges(key: string): Promise<void> {
    IModelDb.findByKey(key)[_implicitTxn].abandonChanges();
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
    return IModelDb.findByKey(key)[_nativeDb].getRedoString();
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
    return BriefcaseDb.findByKey(key).txns.reverseTxns(numOperations);
  }

  public async reverseTxnsAsync(key: string, numOperations: number, args?: ReverseTxnArgs): Promise<void> {
    return BriefcaseDb.findByKey(key).txns.reverseTxnsAsync(numOperations, args);
  }

  public async reverseAllTxn(key: string): Promise<IModelStatus> {
    return BriefcaseDb.findByKey(key).txns.reverseAll();
  }

  public async reverseAllTxnsAsync(key: string, args?: ReverseTxnArgs): Promise<void> {
    return BriefcaseDb.findByKey(key).txns.reverseAllTxnsAsync(args);
  }

  public async reinstateTxn(key: string): Promise<IModelStatus> {
    return BriefcaseDb.findByKey(key).txns.reinstateTxn();
  }

  public async reinstateTxnAsync(key: string, args?: ReinstateTxnArgs): Promise<void> {
    return BriefcaseDb.findByKey(key).txns.reinstateTxnAsync(args);
  }

  public async restartTxnSession(key: string): Promise<void> {
    return IModelDb.findByKey(key).restartTxnSession();
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
