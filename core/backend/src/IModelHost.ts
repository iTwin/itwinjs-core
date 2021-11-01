/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module IModelHost
 */

import * as os from "os";
import * as path from "path";
import * as semver from "semver";
import { IModelJsNative, NativeLibrary } from "@bentley/imodeljs-native";
import { TelemetryManager } from "@bentley/telemetry-client";
import { AccessToken, assert, BeEvent, Guid, GuidString, IModelStatus, Logger, LogLevel, Mutable, ProcessDetector } from "@itwin/core-bentley";
import { AuthorizationClient, BentleyStatus, IModelError, SessionProps } from "@itwin/core-common";
import { AliCloudStorageService } from "./AliCloudStorageService";
import { BackendHubAccess } from "./BackendHubAccess";
import { BackendLoggerCategory } from "./BackendLoggerCategory";
import { BisCoreSchema } from "./BisCoreSchema";
import { BriefcaseManager } from "./BriefcaseManager";
import { AzureBlobStorage, CloudStorageService, CloudStorageServiceCredentials, CloudStorageTileUploader } from "./CloudStorageBackend";
import { FunctionalSchema } from "./domains/FunctionalSchema";
import { GenericSchema } from "./domains/GenericSchema";
import { IModelJsFs } from "./IModelJsFs";
import { DevToolsRpcImpl } from "./rpc-impl/DevToolsRpcImpl";
import { IModelReadRpcImpl } from "./rpc-impl/IModelReadRpcImpl";
import { IModelTileRpcImpl } from "./rpc-impl/IModelTileRpcImpl";
import { SnapshotIModelRpcImpl } from "./rpc-impl/SnapshotIModelRpcImpl";
import { WipRpcImpl } from "./rpc-impl/WipRpcImpl";
import { initializeRpcBackend } from "./RpcBackend";

const loggerCategory = BackendLoggerCategory.IModelHost;

// cspell:ignore nodereport fatalerror apicall alicloud rpcs

/** @alpha */
export interface CrashReportingConfigNameValuePair {
  name: string;
  value: string;
}

/** Configuration of the crash-reporting system.
 * @alpha
 */
export interface CrashReportingConfig {
  /** The directory to which *.dmp and/or iModelJsNativeCrash*.properties.txt files are written. This directory will be created if it does not already exist. */
  crashDir: string;
  /** max # .dmp files that may exist in crashDir. The default is 50. */
  maxDumpsInDir?: number;
  /** Enable crash-dumps? If so, .dmp and .properties.txt files will be generated and written to crashDir in the event of an unhandled native-code exception. If not, only .properties.txt files will be written. The default is false. */
  enableCrashDumps?: boolean;
  /** If enableCrashDumps is true, do you want a full-memory dump? Defaults to false. */
  wantFullMemoryDumps?: boolean;
  /** Enable node-report? If so, node-report files will be generated in the event of an unhandled exception or fatal error and written to crashDir. The default is false. */
  enableNodeReport?: boolean;
  /** Additional name, value pairs to write to iModelJsNativeCrash*.properties.txt file in the event of a crash. */
  params?: CrashReportingConfigNameValuePair[];
  /** Run this .js file to process .dmp and node-report files in the event of a crash.
   * This script will be executed with a single command-line parameter: the name of the dump or node-report file.
   * In the case of a dump file, there will be a second file with the same basename and the extension ".properties.txt".
   * Since it runs in a separate process, this script will have no access to the Javascript
   * context of the exiting backend. No default.
   */
  dumpProcessorScriptFileName?: string;
  /** Upload crash dump and node-reports to Bentley's crash-reporting service? Defaults to false */
  uploadToBentley?: boolean;
}

/** Configuration of core-backend.
 * @public
 */
export class IModelHostConfiguration {

  /**
   * Root of the directory holding all the files that iModel.js caches
   * - If not specified at startup a platform specific default is used -
   *   - Windows: $(HOMEDIR)/AppData/Local/iModelJs/
   *   - Mac/iOS: $(HOMEDIR)/Library/Caches/iModelJs/
   *   - Linux:   $(HOMEDIR)/.cache/iModelJs/
   *   where $(HOMEDIR) is documented [here](https://nodejs.org/api/os.html#os_os_homedir)
   * - if specified, ensure it is set to a folder with read/write access.
   * - Sub-folders within this folder organize various caches -
   *   - bc/ -> Briefcases
   *   - appSettings/ -> Offline application settings (only relevant in native applications)
   *   - etc.
   * @see [[IModelHost.cacheDir]] for the value it's set to after startup
   */
  public cacheDir?: string;

  /** The directory where the app's assets are found. */
  public appAssetsDir?: string;

  /** The kind of iModel hub server to use.
   * @beta
   */
  public hubAccess?: BackendHubAccess;

  /** The credentials to use for the tile cache service. If omitted, a local cache will be used.
   * @beta
   */
  public tileCacheCredentials?: CloudStorageServiceCredentials;

  /** Whether to restrict tile cache URLs by client IP address (if available).
   * @beta
   */
  public restrictTileUrlsByClientIp?: boolean;

  /** Whether to compress cached tiles.
   * Defaults to `true`.
   */
  public compressCachedTiles?: boolean;

  /** The time, in milliseconds, for which [IModelTileRpcInterface.requestTileTreeProps]($common) should wait before returning a "pending" status.
   * @internal
   */
  public tileTreeRequestTimeout = IModelHostConfiguration.defaultTileRequestTimeout;
  /** The time, in milliseconds, for which [IModelTileRpcInterface.requestTileContent]($common) should wait before returning a "pending" status.
   * @internal
   */
  public tileContentRequestTimeout = IModelHostConfiguration.defaultTileRequestTimeout;
  /** The default time, in milliseconds, used for [[tileTreeRequestTimeout]] and [[tileContentRequestTimeout]]. To change this, override one or both of those properties.
   * @internal
   */
  public static defaultTileRequestTimeout = 20 * 1000;

  /** The default time, in seconds, used for [[logTileLoadTimeThreshold]]. To change this, override that property.
   * @internal
   */
  public static defaultLogTileLoadTimeThreshold = 40;
  /** The backend will log when a tile took longer to load than this threshold in seconds.
   * @internal
   */
  public logTileLoadTimeThreshold: number = IModelHostConfiguration.defaultLogTileLoadTimeThreshold;

  /** The default size, in bytes, used for [[logTileSizeThreshold]]. To change this, override that property.
   * @internal
   */
  public static defaultLogTileSizeThreshold = 20 * 1000000;
  /** The backend will log when a tile is loaded with a size in bytes above this threshold.
   * @internal
   */
  public logTileSizeThreshold: number = IModelHostConfiguration.defaultLogTileSizeThreshold;

  /** Crash-reporting configuration
   * @alpha
   */
  public crashReportingConfig?: CrashReportingConfig;

}

/** IModelHost initializes ($backend) and captures its configuration. A backend must call [[IModelHost.startup]] before using any backend classes.
 * See [the learning article]($docs/learning/backend/IModelHost.md)
 * @public
 */
export class IModelHost {
  private constructor() { }
  public static authorizationClient?: AuthorizationClient;

  /** @alpha */
  public static readonly telemetry = new TelemetryManager();

  public static backendVersion = "";
  private static _cacheDir = "";

  private static _platform?: typeof IModelJsNative;
  /** @internal */
  public static get platform(): typeof IModelJsNative {
    if (this._platform === undefined)
      throw new Error("IModelHost.startup must be called first");
    return this._platform;
  }

  public static configuration?: IModelHostConfiguration;
  /** Event raised just after the backend IModelHost was started */
  public static readonly onAfterStartup = new BeEvent<() => void>();

  /** Event raised just before the backend IModelHost is to be shut down */
  public static readonly onBeforeShutdown = new BeEvent<() => void>();

  /** @internal */
  public static readonly session: Mutable<SessionProps> = { applicationId: "2686", applicationVersion: "1.0.0", sessionId: "" };

  /** A uniqueId for this session */
  public static get sessionId() { return this.session.sessionId; }
  public static set sessionId(id: GuidString) { this.session.sessionId = id; }

  /** The Id of this application - needs to be set only if it is an agent application. The applicationId will otherwise originate at the frontend. */
  public static get applicationId() { return this.session.applicationId; }
  public static set applicationId(id: string) { this.session.applicationId = id; }

  /** The version of this application - needs to be set if is an agent application. The applicationVersion will otherwise originate at the frontend. */
  public static get applicationVersion() { return this.session.applicationVersion; }
  public static set applicationVersion(version: string) { this.session.applicationVersion = version; }

  /** Root of the directory holding all the files that iModel.js caches */
  public static get cacheDir(): string { return this._cacheDir; }

  /** The optional [[FileNameResolver]] that resolves keys and partial file names for snapshot iModels. */
  public static snapshotFileNameResolver?: FileNameResolver;

  /** Get the current access token for this IModelHost, or a blank string if none is available.
   * @note for web backends, this will *always* return a blank string because the backend itself has no token (but never needs one either.)
   * For all IpcHosts, where this backend is servicing a single frontend, this will be the user's token. For ElectronHost, the backend
   * obtains the token and forwards it to the frontend.
   * @note accessTokens expire periodically and are automatically refreshed, if possible. Therefore tokens should not be saved, and the value
   * returned by this method may change over time throughout the course of a session.
   */
  public static async getAccessToken(): Promise<AccessToken> {
    try {
      return (await this.authorizationClient?.getAccessToken()) ?? "";
    } catch (e) {
      return "";
    }
  }

  /** @internal */
  public static flushLog() {
    return this.platform.DgnDb.flushLog();
  }
  /** @internal */
  public static loadNative(): void {
    const platform = Platform.load();
    this.registerPlatform(platform);
  }

  private static registerPlatform(platform: typeof IModelJsNative): void {
    this._platform = platform;
    if (undefined === platform)
      return;

    if (!ProcessDetector.isMobileAppBackend)
      this.validateNativePlatformVersion();

    platform.logger = Logger;
  }

  private static validateNativePlatformVersion(): void {
    const requiredVersion = require("../../package.json").dependencies["@bentley/imodeljs-native"]; // eslint-disable-line @typescript-eslint/no-var-requires
    const thisVersion = this.platform.version;
    if (semver.satisfies(thisVersion, requiredVersion))
      return;
    if (IModelJsFs.existsSync(path.join(__dirname, "DevBuild.txt"))) {
      console.log("Bypassing version checks for development build"); // eslint-disable-line no-console
      return;
    }
    this._platform = undefined;
    throw new IModelError(IModelStatus.BadRequest, `imodeljs-native version is (${thisVersion}). core-backend requires version (${requiredVersion})`);
  }

  /**
   * @beta
   * @note A reference implementation is set by default for [AzureBlobStorage]. To supply a different implementation for any service provider (such as AWS),
   *       set this property with a custom [CloudStorageService] and also set [IModelHostConfiguration.tileCacheCredentials] using "external" for the service name.
   *       Note that the account and access key members of [CloudStorageServiceCredentials] may have blank values unless the custom service implementation uses them.
   */
  public static tileCacheService: CloudStorageService;

  /** @internal */
  public static tileUploader: CloudStorageTileUploader;

  private static _hubAccess: BackendHubAccess;
  /** @internal */
  public static setHubAccess(hubAccess: BackendHubAccess) { this._hubAccess = hubAccess; }

  /** Provides access to the IModelHub for this IModelHost
   * @beta
   */
  public static get hubAccess(): BackendHubAccess { return this._hubAccess; }

  private static _isValid = false;
  /** Returns true if IModelHost is started.  */
  public static get isValid() { return this._isValid; }
  /** This method must be called before any iModel.js services are used.
   * @param configuration Host configuration data.
   * Raises [[onAfterStartup]].
   * @see [[shutdown]].
   */
  public static async startup(configuration: IModelHostConfiguration = new IModelHostConfiguration()): Promise<void> {
    if (this._isValid)
      return; // we're already initialized
    this._isValid = true;

    if (IModelHost.sessionId === "")
      IModelHost.sessionId = Guid.createValue();

    this.logStartup();

    this.backendVersion = require("../../package.json").version; // eslint-disable-line @typescript-eslint/no-var-requires
    initializeRpcBackend();

    if (this._platform === undefined) {
      try {
        this.loadNative();
      } catch (error) {
        Logger.logError(loggerCategory, "Error registering/loading the native platform API", () => (configuration));
        throw error;
      }
    }

    if (configuration.crashReportingConfig && configuration.crashReportingConfig.crashDir && !ProcessDetector.isElectronAppBackend && !ProcessDetector.isMobileAppBackend) {
      this.platform.setCrashReporting(configuration.crashReportingConfig);

      Logger.logTrace(loggerCategory, "Configured crash reporting", () => ({
        enableCrashDumps: configuration.crashReportingConfig?.enableCrashDumps,
        wantFullMemoryDumps: configuration.crashReportingConfig?.wantFullMemoryDumps,
        enableNodeReport: configuration.crashReportingConfig?.enableNodeReport,
        uploadToBentley: configuration.crashReportingConfig?.uploadToBentley,
      }));

      if (configuration.crashReportingConfig.enableNodeReport) {
        try {
          // node-report reports on V8 fatal errors and unhandled exceptions/Promise rejections.
          const nodereport = require("node-report/api"); // eslint-disable-line @typescript-eslint/no-var-requires
          nodereport.setEvents("exception+fatalerror+apicall");
          nodereport.setDirectory(configuration.crashReportingConfig.crashDir);
          nodereport.setVerbose("yes");
          Logger.logTrace(loggerCategory, "Configured native crash reporting (node-report)");
        } catch (err) {
          Logger.logWarning(loggerCategory, "node-report is not installed.");
        }
      }
    }

    this.setupCacheDirs(configuration);
    BriefcaseManager.initialize(this._briefcaseCacheDir);

    [
      IModelReadRpcImpl,
      IModelTileRpcImpl,
      SnapshotIModelRpcImpl,
      WipRpcImpl,
      DevToolsRpcImpl,
    ].forEach((rpc) => rpc.register()); // register all of the RPC implementations

    [
      BisCoreSchema,
      GenericSchema,
      FunctionalSchema,
    ].forEach((schema) => schema.registerSchema()); // register all of the schemas

    if (undefined !== configuration.hubAccess)
      IModelHost._hubAccess = configuration.hubAccess;
    IModelHost.configuration = configuration;
    IModelHost.setupTileCache();

    this.platform.setUseTileCache(configuration.tileCacheCredentials ? false : true);

    process.once("beforeExit", IModelHost.shutdown);
    IModelHost.onAfterStartup.raiseEvent();
  }

  private static _briefcaseCacheDir: string;

  private static logStartup() {
    if (!Logger.isEnabled(loggerCategory, LogLevel.Trace))
      return;

    // Extract the iModel details from environment - note this is very specific to Bentley hosted backends, but is quite useful for tracing
    let startupInfo: any = {};
    const serviceName = process.env.FABRIC_SERVICE_NAME;
    if (serviceName) {
      // e.g., fabric:/iModelWebViewer3.0/iModelJSGuest/1/08daaeb3-b56f-480b-9051-7efc834d18ae/512d971d-b641-4735-bb1c-c07ab3e44ce7/c1315fcce125ca40b2d405bb7809214daf8b4c85
      const serviceNameComponents = serviceName.split("/");
      if (serviceNameComponents.length === 7) {
        startupInfo = {
          ...startupInfo,
          iTwinId: serviceNameComponents[4],
          iModelId: serviceNameComponents[5],
          changesetId: serviceNameComponents[6],
        };
      }
    }

    Logger.logTrace(loggerCategory, "IModelHost.startup", () => startupInfo);
  }

  private static setupCacheDirs(configuration: IModelHostConfiguration) {
    this._cacheDir = configuration.cacheDir ? path.normalize(configuration.cacheDir) : NativeLibrary.defaultCacheDir;
    IModelJsFs.recursiveMkDirSync(this._cacheDir); // make sure the directory for cacheDir exists.
    this._briefcaseCacheDir = path.join(this._cacheDir, "imodels");
  }

  /** This method must be called when an iModel.js services is shut down. Raises [[onBeforeShutdown]] */
  public static async shutdown(): Promise<void> {
    // NB: This method is set as a node listener where `this` is unbound
    if (!IModelHost._isValid)
      return;

    IModelHost._isValid = false;
    IModelHost.onBeforeShutdown.raiseEvent();
    IModelHost.configuration = undefined;
    process.removeListener("beforeExit", IModelHost.shutdown);
  }

  /**
   * Add or update a property that should be included in a crash report.
   * @param name The name of the property
   * @param value The value of the property
   * @alpha
   */
  public static setCrashReportProperty(name: string, value: string): void {
    assert(undefined !== this._platform);
    this._platform.setCrashReportProperty(name, value);
  }

  /**
   * Remove a previously defined property so that will not be included in a crash report.
   * @param name The name of the property
   * @alpha
   */
  public static removeCrashReportProperty(name: string): void {
    assert(undefined !== this._platform);
    this._platform.setCrashReportProperty(name, undefined);
  }

  /**
   * Get all properties that will be included in a crash report.
   * @alpha
   */
  public static getCrashReportProperties(): CrashReportingConfigNameValuePair[] {
    assert(undefined !== this._platform);
    return this._platform.getCrashReportProperties();
  }

  /** The directory where application assets may be found */
  public static get appAssetsDir(): string | undefined { return undefined !== IModelHost.configuration ? IModelHost.configuration.appAssetsDir : undefined; }

  /** The time, in milliseconds, for which [IModelTileRpcInterface.requestTileTreeProps]($common) should wait before returning a "pending" status.
   * @internal
   */
  public static get tileTreeRequestTimeout(): number {
    return undefined !== IModelHost.configuration ? IModelHost.configuration.tileTreeRequestTimeout : IModelHostConfiguration.defaultTileRequestTimeout;
  }
  /** The time, in milliseconds, for which [IModelTileRpcInterface.requestTileContent]($common) should wait before returning a "pending" status.
   * @internal
   */
  public static get tileContentRequestTimeout(): number {
    return undefined !== IModelHost.configuration ? IModelHost.configuration.tileContentRequestTimeout : IModelHostConfiguration.defaultTileRequestTimeout;
  }

  /** The backend will log when a tile took longer to load than this threshold in seconds. */
  public static get logTileLoadTimeThreshold(): number { return undefined !== IModelHost.configuration ? IModelHost.configuration.logTileLoadTimeThreshold : IModelHostConfiguration.defaultLogTileLoadTimeThreshold; }
  /** The backend will log when a tile is loaded with a size in bytes above this threshold. */
  public static get logTileSizeThreshold(): number { return undefined !== IModelHost.configuration ? IModelHost.configuration.logTileSizeThreshold : IModelHostConfiguration.defaultLogTileSizeThreshold; }

  /** Whether external tile caching is active.
   * @internal
   */
  public static get usingExternalTileCache(): boolean {
    return undefined !== IModelHost.configuration?.tileCacheCredentials;
  }

  /** Whether to restrict tile cache URLs by client IP address.
   * @internal
   */
  public static get restrictTileUrlsByClientIp(): boolean { return undefined !== IModelHost.configuration && (IModelHost.configuration.restrictTileUrlsByClientIp ? true : false); }

  /** Whether to compress cached tiles.
   * @internal
   */
  public static get compressCachedTiles(): boolean { return false !== IModelHost.configuration?.compressCachedTiles; }

  private static setupTileCache() {
    const config = IModelHost.configuration!;
    const credentials = config.tileCacheCredentials;
    if (undefined === credentials)
      return;

    IModelHost.tileUploader = new CloudStorageTileUploader();

    if (credentials.service === "azure" && !IModelHost.tileCacheService) {
      IModelHost.tileCacheService = new AzureBlobStorage(credentials);
    } else if (credentials.service === "alicloud") {
      IModelHost.tileCacheService = new AliCloudStorageService(credentials);
    } else if (credentials.service !== "external") {
      throw new IModelError(BentleyStatus.ERROR, "Unsupported cloud service credentials for tile cache.");
    }
  }
}

/** Information about the platform on which the app is running. Also see [[KnownLocations]] and [[IModelJsFs]].
 * @public
 */
export class Platform {
  /** Get the name of the platform. */
  public static get platformName(): "win32" | "linux" | "darwin" | "ios" | "android" | "uwp" {
    return process.platform as any;
  }

  /** @internal */
  public static load(): typeof IModelJsNative {
    return ProcessDetector.isMobileAppBackend ? (process as any)._linkedBinding("iModelJsNative") : NativeLibrary.load();
  }
}

/** Well known directories that may be used by the application. Also see [[Platform]]
 * @public
 */
export class KnownLocations {

  /** The directory where the imodeljs-native assets are stored. */
  public static get nativeAssetsDir(): string { return IModelHost.platform.DgnDb.getAssetsDir(); }

  /** The directory where the core-backend assets are stored. */
  public static get packageAssetsDir(): string {
    return path.join(__dirname, "assets");
  }

  /** The temporary directory. */
  public static get tmpdir(): string {
    return os.tmpdir();
  }
}

/** Extend this class to provide custom file name resolution behavior.
 * @note Only `tryResolveKey` and/or `tryResolveFileName` need to be overridden as the implementations of `resolveKey` and `resolveFileName` work for most purposes.
 * @see [[IModelHost.snapshotFileNameResolver]]
 * @public
 */
export abstract class FileNameResolver {
  /** Resolve a file name from the specified key.
   * @param _fileKey The key that identifies the file name in a `Map` or other similar data structure.
   * @returns The resolved file name or `undefined` if not found.
   */
  public tryResolveKey(_fileKey: string): string | undefined { return undefined; }
  /** Resolve a file name from the specified key.
   * @param fileKey The key that identifies the file name in a `Map` or other similar data structure.
   * @returns The resolved file name.
   * @throws [[IModelError]] if not found.
   */
  public resolveKey(fileKey: string): string {
    const resolvedFileName: string | undefined = this.tryResolveKey(fileKey);
    if (undefined === resolvedFileName) {
      throw new IModelError(IModelStatus.NotFound, `${fileKey} not resolved`);
    }
    return resolvedFileName;
  }
  /** Resolve the input file name, which may be a partial name, into a full path file name.
   * @param inFileName The partial file name.
   * @returns The resolved full path file name or `undefined` if not found.
   */
  public tryResolveFileName(inFileName: string): string | undefined { return inFileName; }
  /** Resolve the input file name, which may be a partial name, into a full path file name.
   * @param inFileName The partial file name.
   * @returns The resolved full path file name.
   * @throws [[IModelError]] if not found.
   */
  public resolveFileName(inFileName: string): string {
    const resolvedFileName: string | undefined = this.tryResolveFileName(inFileName);
    if (undefined === resolvedFileName) {
      throw new IModelError(IModelStatus.NotFound, `${inFileName} not resolved`);
    }
    return resolvedFileName;
  }
}
