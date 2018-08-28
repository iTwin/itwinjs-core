/*---------------------------------------------------------------------------------------------
|  $Copyright: (c) 2018 Bentley Systems, Incorporated. All rights reserved. $
 *--------------------------------------------------------------------------------------------*/
/** @module IModelHost */

import { BeEvent } from "@bentley/bentleyjs-core";
import { DeploymentEnv } from "@bentley/imodeljs-clients";
import { BentleyStatus, IModelError, FeatureGates, RpcInvocation, RpcInterface } from "@bentley/imodeljs-common";
import * as path from "path";
import { IModelReadRpcImpl } from "./rpc-impl/IModelReadRpcImpl";
import { IModelTileRpcImpl } from "./rpc-impl/IModelTileRpcImpl";
import { IModelWriteRpcImpl } from "./rpc-impl/IModelWriteRpcImpl";
import { StandaloneIModelRpcImpl } from "./rpc-impl/StandaloneIModelRpcImpl";
import { IModelUnitTestRpcImpl } from "./rpc-impl/IModelUnitTestRpcImpl";
import { KnownLocations } from "./Platform";
import { BisCore } from "./BisCore";
import { NativePlatformRegistry } from "./NativePlatformRegistry";

/**
 * Configuration of imodeljs-backend.
 */
export class IModelHostConfiguration {
  /** The deployment environment of Connect and iModelHub Services - this identifies up the location used to find Projects and iModels */
  public hubDeploymentEnv: DeploymentEnv = "QA";

  /** The native platform to use -- normally, the app should leave this undefined. [[IModelHost.startup]] will set it to the appropriate nativePlatform automatically. */
  public nativePlatform?: any;

  private _briefcaseCacheDir: string = path.normalize(path.join(KnownLocations.tmpdir, "Bentley/IModelJs/cache/"));

  /** The path where the cache of briefcases are stored. Defaults to `path.join(KnownLocations.tmpdir, "Bentley/IModelJs/cache/iModels/")` */
  public get briefcaseCacheDir(): string {
    return this._briefcaseCacheDir;
  }
  public set briefcaseCacheDir(cacheDir: string) {
    this._briefcaseCacheDir = path.normalize(cacheDir.replace(/\/?$/, path.sep));
  }

  /** The directory where the app's assets are found */
  public appAssetsDir?: string;
}

/**
 * IModelHost initializes ($backend) and captures its configuration. A backend must call [[IModelHost.startup]] before using any backend classes.
 */
export class IModelHost {
  public static configuration?: IModelHostConfiguration;
  /** Event raised just after the backend IModelHost was started up */
  public static readonly onAfterStartup = new BeEvent<() => void>();

  /** Event raised just before the backend IModelHost is to be shut down */
  public static readonly onBeforeShutdown = new BeEvent<() => void>();

  /** Configured FeatureGates for this IModelHost. */
  public static readonly features = new FeatureGates();

  /** This method must be called before any iModelJs services are used.
   * @param configuration Host configuration data.
   * Raises [[onAfterStartup]].
   * @see [[shutdown]].
   */
  public static startup(configuration: IModelHostConfiguration = new IModelHostConfiguration()) {
    if (IModelHost.configuration)
      throw new IModelError(BentleyStatus.ERROR, "startup may only be called once");

    if (!NativePlatformRegistry.isNativePlatformLoaded) {
      if (configuration.nativePlatform !== undefined)
        NativePlatformRegistry.register(configuration.nativePlatform);
      else
        NativePlatformRegistry.loadAndRegisterStandardNativePlatform();
    }

    IModelReadRpcImpl.register();
    IModelTileRpcImpl.register();
    IModelWriteRpcImpl.register();
    StandaloneIModelRpcImpl.register();
    IModelUnitTestRpcImpl.register();

    BisCore.registerSchema();

    IModelHost.configuration = configuration;
    IModelHost.onAfterStartup.raiseEvent();
  }

  /** This method must be called when an iModelJs services is shut down. Raises [[onBeforeShutdown]] */
  public static shutdown() {
    if (!IModelHost.configuration)
      return;
    IModelHost.onBeforeShutdown.raiseEvent();
    IModelHost.configuration = undefined;
  }

  /** The directory where the app's assets may be found */
  public static get appAssetsDir(): string | undefined {
    return (IModelHost.configuration === undefined) ? undefined : IModelHost.configuration.appAssetsDir;
  }

  /** The current iModel activity context for logging and correlation (if available). */
  public static get currentActivityContext(): IModelActivityContext | undefined {
    return IModelActivityContext.current;
  }
}

enum ContextEvent { None, Enter, Suspend, Resume, Exit }

/** An activity context for logging and correlation of iModel backend requests. */
export class IModelActivityContext {
  /** The current activity context (if available). */
  public static get current() { return IModelActivityContext._current; }
  private static _current: IModelActivityContext | undefined;

  /**
   * Creates an activity context for the current RPC request.
   * @note The return value of this function is only reliable in an RPC impl class member function where program control was received from the RpcInvocation constructor function.
   */
  public static createForCurrentRpcRequest(rpcImpl: RpcInterface): IModelActivityContext {
    const invocation = RpcInvocation.current(rpcImpl);
    return new IModelActivityContext(invocation.request.id);
  }

  /** The activity id for this context. */
  public readonly activityId: string;

  private _entry: ContextEvent[];

  /**
   * Constructs an activity context.
   * @note Only one activity context should be created per backend request. Consumers should create and enter a context in their RPC backend impl function and then pass it to all awaited function calls.
   * @note Most consumers should use IModelActivityContext.createForCurrentRpcRequest to obtain a context with the correct activity id instead of calling the constructor directly.
   * @note Consumers must call enter before using an activity context.
   */
  public constructor(activityId: string) {
    this.activityId = activityId;
    this._entry = [];
  }

  /**
   * Enters the activity context.
   * @note Consumers of imodeljs-backend must call this at the beginning of every async function.
   */
  public enter(): this {
    if (this._state !== ContextEvent.None && this._state !== ContextEvent.Suspend) {
      throw new IModelError(BentleyStatus.ERROR, "Cannot enter iModel activity context that is already entered.");
    }

    this._entry.push(ContextEvent.Enter);
    IModelActivityContext._current = this;
    return this;
  }

  /**
   * Suspends the activity context.
   * @note Consumers of imodeljs-backend must call this before awaiting an async function call.
   */
  public suspend(): this {
    if (this._state !== ContextEvent.Enter) {
      throw new IModelError(BentleyStatus.ERROR, "Cannot suspend iModel activity context that is not entered.");
    }

    this._entry.push(ContextEvent.Suspend);
    IModelActivityContext._current = undefined;
    return this;
  }

  /**
   * Resumes the activity context.
   * @note Consumers of imodeljs-backend must call this when program control is received again after an awaited function call.
   */
  public resume(): this {
    if (this._state !== ContextEvent.Suspend) {
      throw new IModelError(BentleyStatus.ERROR, "Cannot resume iModel activity context that is not suspended.");
    }

    this._entry.pop();
    IModelActivityContext._current = this;
    return this;
  }

  /**
   * Exits the activity context.
   * @note Consumers of imodeljs-backend must call this before returning from an async function.
   */
  public exit(): this {
    if (this._state !== ContextEvent.Enter) {
      throw new IModelError(BentleyStatus.ERROR, "Cannot exit iModel activity context that is not entered.");
    }

    this._entry.pop();
    IModelActivityContext._current = undefined;
    return this;
  }

  private get _state(): ContextEvent {
    const entry = this._entry.length;
    if (entry) {
      return this._entry[entry - 1];
    }

    return ContextEvent.None;
  }
}
