/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module NativeApp
 */

import { BeEvent, ClientRequestContext, IModelStatus, Logger, LogLevel, OpenMode, SessionProps } from "@bentley/bentleyjs-core";
import {
  AuthorizationConfiguration, BriefcasePushAndPullNotifications, IModelChangeNotifications, IModelConnectionProps, IModelError, IModelRpcProps,
  IModelVersion, IModelVersionProps, IpcAppChannel, IpcAppFunctions, IpcAppNotifications, IpcInvokeReturn, IpcListener, IpcSocketBackend, iTwinChannel, OpenBriefcaseProps,
  RemoveFunction, StandaloneOpenOptions, TileTreeContentIds,
} from "@bentley/imodeljs-common";
import { IModelJsNative } from "@bentley/imodeljs-native";
import { AccessToken, AuthorizedClientRequestContext, ImsAuthorizationClient } from "@bentley/itwin-client";
import { BriefcaseDb, IModelDb, StandaloneDb } from "./IModelDb";
import { IModelHost, IModelHostConfiguration } from "./IModelHost";
import { cancelTileContentRequests } from "./rpc-impl/IModelTileRpcImpl";

/** @internal */
export abstract class AuthorizationBackend extends ImsAuthorizationClient {
  protected _accessToken?: AccessToken;
  protected _expireSafety = 60 * 10; // seconds to expire before real expiration time
  protected _config?: AuthorizationConfiguration;
  public get config(): AuthorizationConfiguration { return this._config!; }
  public abstract signIn(): Promise<void>;
  public abstract signOut(): Promise<void>;
  public abstract refreshToken(): Promise<AccessToken>;

  public get isAuthorized(): boolean {
    return undefined !== this._accessToken && !this._accessToken.isExpired(this._expireSafety * 1000);
  }

  public setAccessToken(token?: AccessToken) {
    this._accessToken = token;
    IpcHost.onUserStateChanged.raiseEvent(this._accessToken);
  }
  public async getAccessToken(): Promise<AccessToken> {
    if (!this.isAuthorized)
      this.setAccessToken(await this.refreshToken());
    return this._accessToken!;
  }

  public getClientRequestContext() { return ClientRequestContext.fromJSON(IModelHost.session); }
  public async getAuthorizedContext() {
    return new AuthorizedClientRequestContext(await this.getAccessToken(), undefined, IModelHost.applicationId, IModelHost.applicationVersion, IModelHost.sessionId);
  }
  public async initialize(props: SessionProps, config: AuthorizationConfiguration): Promise<void> {
    this._config = config;
    if (config.expiryBuffer)
      this._expireSafety = config.expiryBuffer;
    IModelHost.session.applicationId = props.applicationId;
    IModelHost.applicationVersion = props.applicationVersion;
    IModelHost.sessionId = props.sessionId;
  }
}

/**
  * Options for [[IpcHost.startup]]
  * @beta
  */
export interface IpcHostOpts {
  iModelHost?: IModelHostConfiguration;
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
  * @beta
 */
export class IpcHost {
  public static noStack = false;
  private static _ipc: IpcSocketBackend | undefined;
  /** Get the implementation of the [IpcSocketBackend]($common) interface. */
  private static get ipc(): IpcSocketBackend { return this._ipc!; }
  /** Determine whether Ipc is available for this backend. This will only be true if [[startup]] has been called on this class. */
  public static get isValid(): boolean { return undefined !== this._ipc; }

  /** @internal */
  public static get authorization(): AuthorizationBackend { return IModelHost.authorizationClient as AuthorizationBackend; }

  /** Event called when the user's sign-in state changes - this may be due to calls to signIn(), signOut() or simply because the token expired */
  public static readonly onUserStateChanged = new BeEvent<(token?: AccessToken) => void>();

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
  public static notifyIpcFrontend<T extends keyof IpcAppNotifications>(methodName: T, ...args: Parameters<IpcAppNotifications[T]>) {
    return IpcHost.send(IpcAppChannel.AppNotify, methodName, ...args);
  }

  /** @internal */
  public static notifyIModelChanges<T extends keyof IModelChangeNotifications>(briefcase: BriefcaseDb | StandaloneDb, methodName: T, ...args: Parameters<IModelChangeNotifications[T]>) {
    this.notify(IpcAppChannel.IModelChanges, briefcase, methodName, ...args);
  }

  /** @internal */
  public static notifyPushAndPull<T extends keyof BriefcasePushAndPullNotifications>(briefcase: BriefcaseDb | StandaloneDb, methodName: T, ...args: Parameters<BriefcasePushAndPullNotifications[T]>) {
    this.notify(IpcAppChannel.PushPull, briefcase, methodName, ...args);
  }

  public static async startup(opt?: IpcHostOpts): Promise<void> {
    this._ipc = opt?.ipcHost?.socket;
    if (opt?.ipcHost?.exceptions?.noStack)
      this.noStack = true;

    if (this.isValid) { // for tests, we use IpcHost but don't have a frontend
      IpcAppHandler.register();
      this.onUserStateChanged.addListener((token?: AccessToken) => IpcHost.notifyIpcFrontend("notifyUserStateChanged", token?.toJSON()));
    }

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
        const ret: IpcInvokeReturn = { error: { name: err.constructor.name, message: err.message ?? "", errorNumber: err.errorNumber ?? 0 } };
        if (!IpcHost.noStack)
          ret.error.stack = err.stack ?? "";
        return ret;
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
    return IModelDb.findByKey(key).nativeDb.cancelElementGraphicsRequests(requestIds);
  }
  public async openBriefcase(args: OpenBriefcaseProps): Promise<IModelConnectionProps> {
    const auth = IpcHost.authorization;
    const requestContext = args.readonly === true ? auth.getClientRequestContext() : await auth.getAuthorizedContext();
    const db = await BriefcaseDb.open(requestContext, args);
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
  public async pullAndMergeChanges(key: string, version?: IModelVersionProps): Promise<void> {
    const iModelDb = BriefcaseDb.findByKey(key);
    const requestContext = await IpcHost.authorization.getAuthorizedContext();
    await iModelDb.pullAndMergeChanges(requestContext, version ? IModelVersion.fromJSON(version) : undefined);
  }
  public async pushChanges(key: string, description: string): Promise<string> {
    const iModelDb = BriefcaseDb.findByKey(key);
    const requestContext = await IpcHost.authorization.getAuthorizedContext();
    await iModelDb.pushChanges(requestContext, description);
    return iModelDb.changeSetId;
  }
  public async toggleInteractiveEditingSession(key: string, startSession: boolean): Promise<boolean> {
    const val: IModelJsNative.ErrorStatusOrResult<any, boolean> = IModelDb.findByKey(key).nativeDb.setGeometricModelTrackingEnabled(startSession);
    if (val.error)
      throw new IModelError(val.error.status, "Failed to toggle interactive editing session");

    return val.result!;
  }
  public async isInteractiveEditingSupported(key: string): Promise<boolean> {
    return IModelDb.findByKey(key).nativeDb.isGeometricModelTrackingSupported();
  }
  public async reverseSingleTxn(key: string): Promise<IModelStatus> {
    return IModelDb.findByKey(key).nativeDb.reverseTxns(1);
  }
  public async reverseAllTxn(key: string): Promise<IModelStatus> {
    return IModelDb.findByKey(key).nativeDb.reverseAll();
  }
  public async reinstateTxn(key: string): Promise<IModelStatus> {
    return IModelDb.findByKey(key).nativeDb.reinstateTxn();
  }
  public async queryConcurrency(pool: "io" | "cpu"): Promise<number> {
    return IModelHost.platform.queryConcurrency(pool);
  }
}
