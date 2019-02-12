/*---------------------------------------------------------------------------------------------
* Copyright (c) 2019 Bentley Systems, Incorporated. All rights reserved.
* Licensed under the MIT License. See LICENSE.md in the project root for license terms.
*--------------------------------------------------------------------------------------------*/
/** @module IModelHost */

import { BeEvent, Logger, IModelStatus } from "@bentley/bentleyjs-core";
import { Config, IModelClient, UrlDiscoveryClient } from "@bentley/imodeljs-clients";
import { BentleyStatus, IModelError } from "@bentley/imodeljs-common";
import * as path from "path";
import { BisCore } from "./BisCore";
import { BriefcaseManager } from "./BriefcaseManager";
import { Functional } from "./domains/Functional";
import { Generic } from "./domains/Generic";
import { IModelJsFs } from "./IModelJsFs";
import { IModelJsNative } from "./IModelJsNative";
import { IModelReadRpcImpl } from "./rpc-impl/IModelReadRpcImpl";
import { IModelTileRpcImpl } from "./rpc-impl/IModelTileRpcImpl";
import { IModelWriteRpcImpl } from "./rpc-impl/IModelWriteRpcImpl";
import { StandaloneIModelRpcImpl } from "./rpc-impl/StandaloneIModelRpcImpl";
import { WipRpcImpl } from "./rpc-impl/WipRpcImpl";
import { initializeRpcBackend } from "./RpcBackend";
import * as os from "os";
import * as semver from "semver";

/** @hidden */
const loggingCategory = "imodeljs-backend.IModelHost";

/**
 * Configuration of imodeljs-backend.
 */
export class IModelHostConfiguration {
  /** The native platform to use -- normally, the app should leave this undefined. [[IModelHost.startup]] will set it to the appropriate nativePlatform automatically. */
  public nativePlatform?: any;

  private _briefcaseCacheDir = path.normalize(path.join(KnownLocations.tmpdir, "Bentley/IModelJs/cache/"));

  /** The path where the cache of briefcases are stored. Defaults to `path.join(KnownLocations.tmpdir, "Bentley/IModelJs/cache/iModels/")` */
  public get briefcaseCacheDir(): string { return this._briefcaseCacheDir; }
  public set briefcaseCacheDir(cacheDir: string) { this._briefcaseCacheDir = path.normalize(cacheDir.replace(/\/?$/, path.sep)); }

  /** The directory where the app's assets are found. */
  public appAssetsDir?: string;

  /** The kind of iModel server to use. Defaults to iModelHubClient */
  public imodelClient?: IModelClient;
}

/**
 * IModelHost initializes ($backend) and captures its configuration. A backend must call [[IModelHost.startup]] before using any backend classes.
 * See [the learning article]($docs/learning/backend/IModelHost.md)
 */
export class IModelHost {
  public static backendVersion = "";
  private static _platform?: typeof IModelJsNative;
  public static get platform(): typeof IModelJsNative { return this._platform!; }

  public static configuration?: IModelHostConfiguration;
  /** Event raised just after the backend IModelHost was started up */
  public static readonly onAfterStartup = new BeEvent<() => void>();

  /** Event raised just before the backend IModelHost is to be shut down */
  public static readonly onBeforeShutdown = new BeEvent<() => void>();

  private static get _isNativePlatformLoaded(): boolean { return this._platform !== undefined; }

  private static registerPlatform(platform: typeof IModelJsNative, region: number): void {
    this._platform = platform;
    if (!platform)
      return;

    if (!Platform.isMobile)
      this.validateNativePlatformVersion();

    platform.logger = Logger;
    platform.initializeRegion(region);
  }

  private static validateNativePlatformVersion(): void {
    const requiredVersion = require("../package.json").dependencies["@bentley/imodeljs-native"];
    const thisVersion = this.platform.version;
    if (semver.satisfies(thisVersion, requiredVersion))
      return;
    if (IModelJsFs.existsSync(path.join(__dirname, "DevBuild.txt"))) {
      console.log("Bypassing version checks for development build"); // tslint:disable-line:no-console
      return;
    }
    this._platform = undefined;
    throw new IModelError(IModelStatus.BadRequest, "imodeljs-native version is (" + thisVersion + "). imodeljs-backend requires version (" + requiredVersion + ")");
  }

  private static validateNodeJsVersion(): void {
    const requiredVersion = require("../package.json").engines.node;
    if (!semver.satisfies(process.version, requiredVersion)) {
      throw new IModelError(IModelStatus.BadRequest, `Node.js version ${process.version} is not within the range acceptable to imodeljs-backend: (${requiredVersion})`);
    }
    return;
  }

  /** @hidden */
  public static loadNative(region: number, dir?: string): void { this.registerPlatform(Platform.load(dir), region); }

  /** This method must be called before any iModel.js services are used.
   * @param configuration Host configuration data.
   * Raises [[onAfterStartup]].
   * @see [[shutdown]].
   */
  public static startup(configuration: IModelHostConfiguration = new IModelHostConfiguration()) {
    if (IModelHost.configuration)
      throw new IModelError(BentleyStatus.ERROR, "startup may only be called once", Logger.logError, loggingCategory, () => (configuration));

    this.validateNodeJsVersion();

    this.backendVersion = require("../package.json").version;
    initializeRpcBackend();

    const region: number = Config.App.getNumber(UrlDiscoveryClient.configResolveUrlUsingRegion, 0);
    if (!this._isNativePlatformLoaded) {
      try {
        if (configuration.nativePlatform !== undefined)
          this.registerPlatform(configuration.nativePlatform, region);
        else
          this.loadNative(region);
      } catch (error) {
        Logger.logError(loggingCategory, "Error registering/loading the native platform API", () => (configuration));
        throw error;
      }
    }

    if (configuration.imodelClient)
      BriefcaseManager.imodelClient = configuration.imodelClient;

    IModelReadRpcImpl.register();
    IModelTileRpcImpl.register();
    IModelWriteRpcImpl.register();
    StandaloneIModelRpcImpl.register();
    WipRpcImpl.register();

    BisCore.registerSchema();
    Generic.registerSchema();
    Functional.registerSchema();

    IModelHost.configuration = configuration;
    IModelHost.onAfterStartup.raiseEvent();
  }

  /** This method must be called when an iModel.js services is shut down. Raises [[onBeforeShutdown]] */
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
}

/** Information about the platform on which the app is running. Also see [[KnownLocations]] and [[IModelJsFs]]. */
export class Platform {
  /** The imodeljs mobile info object, if this is running in the imodeljs mobile platform. */
  public static get imodeljsMobile(): any { return (typeof (self) !== "undefined") ? (self as any).imodeljsMobile : undefined; }

  /** Get the name of the platform. Possible return values are: "win32", "linux", "darwin", "ios", "android", or "uwp". */
  public static get platformName(): string {

    if (Platform.isMobile) {
      // TBD: Platform.imodeljsMobile.platform should indicate which mobile platform this is.
      return "iOS";
    }
    // This is node or electron. See what underlying OS we are on:
    return process.platform;
  }

  /** The Electron info object, if this is running in Electron. */
  public static get electron(): any { return ((typeof (process) !== "undefined") && ("electron" in process.versions)) ? require("electron") : undefined; }

  /** Query if this is a desktop configuration */
  public static get isDesktop(): boolean { return Platform.electron !== undefined; }

  /** Query if this is a mobile configuration */
  public static get isMobile(): boolean { return Platform.imodeljsMobile !== undefined; }

  /** Query if this is running in Node.js  */
  public static get isNodeJs(): boolean { return !Platform.isMobile; } // currently we use nodejs for all non-mobile backend apps

  public static load(dir?: string): typeof IModelJsNative {
    return this.isMobile ? this.imodeljsMobile.imodeljsNative : // we are running on a mobile platform
      require("@bentley/imodeljs-native/loadNativePlatform.js").loadNativePlatform(dir); // We are running in node or electron.
  }
}

/** Well known directories that may be used by the app. Also see [[Platform]] */
export class KnownLocations {

  /** The directory where the imodeljs-native assets are stored. */
  public static get nativeAssetsDir(): string { return IModelHost.platform.DgnDb.getAssetsDir(); }

  /** The directory where the imodeljs-backend assets are stored. */
  public static get packageAssetsDir(): string {
    const imodeljsMobile = Platform.imodeljsMobile;
    if (imodeljsMobile !== undefined) {
      return path.join(imodeljsMobile.knownLocations.packageAssetsDir, "imodeljs-backend");
    }

    // Assume that we are running in nodejs
    return path.join(__dirname, "assets");
  }

  /** The temp directory. */
  public static get tmpdir(): string {
    const imodeljsMobile = Platform.imodeljsMobile;
    if (imodeljsMobile !== undefined) {
      return imodeljsMobile.knownLocations.tempDir;
    }

    // Assume that we are running in nodejs
    return os.tmpdir();
  }
}
