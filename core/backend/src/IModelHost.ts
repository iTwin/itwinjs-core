/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module IModelHost
 */

import * as os from "os";
import * as path from "path";
import { IModelJsNative, NativeLibrary } from "@bentley/imodeljs-native";
import { AccessToken, assert, BeEvent, Guid, GuidString, IModelStatus, Logger, LogLevel, Mutable, ProcessDetector } from "@itwin/core-bentley";
import { AuthorizationClient, BentleyStatus, IModelError, LocalDirName, SessionProps } from "@itwin/core-common";
import { TelemetryManager } from "@itwin/core-telemetry";
import { BackendHubAccess } from "./BackendHubAccess";
import { BackendLoggerCategory } from "./BackendLoggerCategory";
import { BisCoreSchema } from "./BisCoreSchema";
import { BriefcaseManager } from "./BriefcaseManager";
import { AzureBlobStorage, AzureBlobStorageCredentials, CloudStorageService, CloudStorageTileUploader } from "./CloudStorageBackend";
import { FunctionalSchema } from "./domains/FunctionalSchema";
import { GenericSchema } from "./domains/GenericSchema";
import { GeoCoordConfig } from "./GeoCoordConfig";
import { IModelJsFs } from "./IModelJsFs";
import { DevToolsRpcImpl } from "./rpc-impl/DevToolsRpcImpl";
import { IModelReadRpcImpl } from "./rpc-impl/IModelReadRpcImpl";
import { IModelTileRpcImpl } from "./rpc-impl/IModelTileRpcImpl";
import { SnapshotIModelRpcImpl } from "./rpc-impl/SnapshotIModelRpcImpl";
import { WipRpcImpl } from "./rpc-impl/WipRpcImpl";
import { initializeRpcBackend } from "./RpcBackend";
import { BaseSettings, SettingDictionary, SettingsPriority } from "./workspace/Settings";
import { SettingsSchemas } from "./workspace/SettingsSchemas";
import { ITwinWorkspace, Workspace, WorkspaceOpts } from "./workspace/Workspace";

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

/**
 * Options for [[IModelHost.startup]]
 * @public
 */
export interface IModelHostOptions {
  /**
   * Root of the directory holding all the files that iTwin.js caches
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
  cacheDir?: LocalDirName;

  /** The directory where application assets are found. */
  appAssetsDir?: LocalDirName;

  /**
   * Options for creating the [[Workspace]]
   * @beta
   */
  workspace?: WorkspaceOpts;

  /**
   * The kind of iModel hub server to use.
   * @beta
   */
  hubAccess?: BackendHubAccess;

  /** The Azure blob storage credentials to use for the tile cache service. If omitted and no external service implementation is provided, a local cache will be used.
   * @beta
   */
  tileCacheAzureCredentials?: AzureBlobStorageCredentials;

  /**
   * @beta
   * @note A reference implementation is set for [[AzureBlobStorage]] if [[tileCacheAzureCredentials]] property is set. To supply a different implementation for any service provider (such as AWS),
   *       set this property with a custom [[CloudStorageService]].
   */
  tileCacheService?: CloudStorageService;

  /** Whether to restrict tile cache URLs by client IP address (if available).
   * @beta
   */
  restrictTileUrlsByClientIp?: boolean;

  /**
   * Whether to enable OpenTelemetry tracing
   * @beta
   */
  enableOpenTelemetry?: boolean;

  /** Whether to compress cached tiles.
   * Defaults to `true`.
   */
  compressCachedTiles?: boolean;

  /** The time, in milliseconds, for which [IModelTileRpcInterface.requestTileTreeProps]($common) should wait before returning a "pending" status.
   * @internal
   */
  tileTreeRequestTimeout?: number;

  /** The time, in milliseconds, for which [IModelTileRpcInterface.requestTileContent]($common) should wait before returning a "pending" status.
   * @internal
   */
  tileContentRequestTimeout?: number;

  /** The backend will log when a tile took longer to load than this threshold in seconds.
   * @internal
   */
  logTileLoadTimeThreshold?: number;

  /** The backend will log when a tile is loaded with a size in bytes above this threshold.
   * @internal
   */
  logTileSizeThreshold?: number;

  /** Crash-reporting configuration
   * @alpha
   */
  crashReportingConfig?: CrashReportingConfig;

  /** The AuthorizationClient used to get accessTokens
   * @beta
   */
  authorizationClient?: AuthorizationClient;
}

/** Configuration of core-backend.
 * @public
 */
export class IModelHostConfiguration implements IModelHostOptions {
  public static defaultTileRequestTimeout = 20 * 1000;
  public static defaultLogTileLoadTimeThreshold = 40;
  public static defaultLogTileSizeThreshold = 20 * 1000000;

  public appAssetsDir?: LocalDirName;
  public cacheDir?: LocalDirName;

  /** @beta */
  public workspace?: WorkspaceOpts;
  /** @beta */
  public hubAccess?: BackendHubAccess;
  /** @beta */
  public authorizationClient?: AuthorizationClient;
  /** @beta */
  public tileCacheService?: CloudStorageService;
  /** @beta */
  public restrictTileUrlsByClientIp?: boolean;
  public compressCachedTiles?: boolean;
  /** @beta */
  public tileCacheAzureCredentials?: AzureBlobStorageCredentials;
  /** @internal */
  public tileTreeRequestTimeout = IModelHostConfiguration.defaultTileRequestTimeout;
  /** @internal */
  public tileContentRequestTimeout = IModelHostConfiguration.defaultTileRequestTimeout;
  /** @internal */
  public logTileLoadTimeThreshold = IModelHostConfiguration.defaultLogTileLoadTimeThreshold;
  /** @internal */
  public logTileSizeThreshold = IModelHostConfiguration.defaultLogTileSizeThreshold;
  /** @alpha */
  public crashReportingConfig?: CrashReportingConfig;
}

/**
 * Settings for `IModelHost.appWorkspace`.
 * @note this includes the default dictionary from the SettingsSpecRegistry
 */
class ApplicationSettings extends BaseSettings {
  private _remove?: VoidFunction;
  protected override verifyPriority(priority: SettingsPriority) {
    if (priority >= SettingsPriority.iModel) // iModel settings may not appear in ApplicationSettings
      throw new Error("Use IModelSettings");
  }
  private updateDefaults() {
    const defaults: SettingDictionary = {};
    for (const [schemaName, val] of SettingsSchemas.allSchemas) {
      if (val.default)
        defaults[schemaName] = val.default;
    }
    this.addDictionary("_default_", 0, defaults);
  }

  public constructor() {
    super();
    this._remove = SettingsSchemas.onSchemaChanged.addListener(() => this.updateDefaults());
    this.updateDefaults();
  }

  public override close() {
    if (this._remove) {
      this._remove();
      this._remove = undefined;
    }
  }
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
  private static _appWorkspace?: Workspace;

  private static _platform?: typeof IModelJsNative;
  /** @internal */
  public static get platform(): typeof IModelJsNative {
    if (this._platform === undefined)
      throw new Error("IModelHost.startup must be called first");
    return this._platform;
  }

  public static configuration?: IModelHostOptions;

  /** Event raised during startup to allow loading settings data */
  public static readonly onWorkspaceStartup = new BeEvent<() => void>();

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

  /** Root directory holding files that iTwin.js caches */
  public static get cacheDir(): LocalDirName { return this._cacheDir; }

  /** The application [[Workspace]] for this `IModelHost`
   * @note this `Workspace` only holds [[WorkspaceContainer]]s and [[Settings]] scoped to the currently loaded application(s).
   * All organization, iTwin, and iModel based containers or settings must be accessed through [[IModelDb.workspace]] and
   * attempting to add them to this Workspace will fail.
   * @beta
   */
  public static get appWorkspace(): Workspace { return this._appWorkspace!; } // eslint-disable-line @typescript-eslint/no-non-null-assertion

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
    return this.platform.flushLog();
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

    platform.logger = Logger;
  }

  /**
   * @internal
   * @note Use [[IModelHostOptions.tileCacheService]] to set the service provider.
   */
  public static tileCacheService?: CloudStorageService;

  /** @internal */
  public static tileUploader?: CloudStorageTileUploader;

  private static _hubAccess?: BackendHubAccess;
  /** @internal */
  public static setHubAccess(hubAccess: BackendHubAccess | undefined) { this._hubAccess = hubAccess; }

  /** get the current hubAccess, if present.
   * @beta
   */
  public static getHubAccess(): BackendHubAccess | undefined { return this._hubAccess; }

  /** Provides access to the IModelHub for this IModelHost
   * @beta
   * @note If [[IModelHostOptions.hubAccess]] was undefined when initializing this class, accessing this property will throw an error.
   * To determine whether one is present, use [[getHubAccess]].
   */
  public static get hubAccess(): BackendHubAccess {
    if (this._hubAccess === undefined)
      throw new IModelError(IModelStatus.BadRequest, "No BackendHubAccess supplied in IModelHostOptions");
    return this._hubAccess;
  }

  private static initializeWorkspace(configuration: IModelHostOptions) {
    const settingAssets = path.join(KnownLocations.packageAssetsDir, "Settings");
    SettingsSchemas.addDirectory(path.join(settingAssets, "Schemas"));
    this._appWorkspace = new ITwinWorkspace(new ApplicationSettings(), configuration.workspace);
    this.appWorkspace.settings.addDirectory(settingAssets, SettingsPriority.defaults);

    GeoCoordConfig.onStartup();
    // allow applications to load their default settings
    this.onWorkspaceStartup.raiseEvent();
  }

  private static _isValid = false;
  /** Returns true if IModelHost is started.  */
  public static get isValid() { return this._isValid; }
  /** This method must be called before any iTwin.js services are used.
   * @param options Host configuration data.
   * Raises [[onAfterStartup]].
   * @see [[shutdown]].
   */
  public static async startup(options?: IModelHostOptions): Promise<void> {
    if (this._isValid)
      return; // we're already initialized
    this._isValid = true;

    options = options ?? {};
    if (IModelHost.sessionId === "")
      IModelHost.sessionId = Guid.createValue();

    this.authorizationClient = options.authorizationClient;

    this.logStartup();

    this.backendVersion = require("../../package.json").version; // eslint-disable-line @typescript-eslint/no-var-requires
    initializeRpcBackend(options.enableOpenTelemetry);

    if (this._platform === undefined) {
      try {
        this.loadNative();
      } catch (error) {
        Logger.logError(loggerCategory, "Error registering/loading the native platform API", () => (options));
        throw error;
      }
    }

    if (options.crashReportingConfig && options.crashReportingConfig.crashDir && !ProcessDetector.isElectronAppBackend && !ProcessDetector.isMobileAppBackend) {
      this.platform.setCrashReporting(options.crashReportingConfig);

      Logger.logTrace(loggerCategory, "Configured crash reporting", {
        enableCrashDumps: options.crashReportingConfig?.enableCrashDumps,
        wantFullMemoryDumps: options.crashReportingConfig?.wantFullMemoryDumps,
        enableNodeReport: options.crashReportingConfig?.enableNodeReport,
        uploadToBentley: options.crashReportingConfig?.uploadToBentley,
      });

      if (options.crashReportingConfig.enableNodeReport) {
        try {
          // node-report reports on V8 fatal errors and unhandled exceptions/Promise rejections.
          const nodereport = require("node-report/api"); // eslint-disable-line @typescript-eslint/no-var-requires
          nodereport.setEvents("exception+fatalerror+apicall");
          nodereport.setDirectory(options.crashReportingConfig.crashDir);
          nodereport.setVerbose("yes");
          Logger.logTrace(loggerCategory, "Configured native crash reporting (node-report)");
        } catch (err) {
          Logger.logWarning(loggerCategory, "node-report is not installed.");
        }
      }
    }

    this.setupHostDirs(options);
    this.initializeWorkspace(options);

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

    if (undefined !== options.hubAccess)
      this._hubAccess = options.hubAccess;

    this.configuration = options;
    this.setupTileCache();

    this.platform.setUseTileCache(IModelHost.tileCacheService ? false : true);
    process.once("beforeExit", IModelHost.shutdown);
    this.onAfterStartup.raiseEvent();
  }

  private static _briefcaseCacheDir: LocalDirName;

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

  private static setupHostDirs(configuration: IModelHostOptions) {
    const setupDir = (dir: LocalDirName) => {
      dir = path.normalize(dir);
      IModelJsFs.recursiveMkDirSync(dir);
      return dir;
    };
    this._cacheDir = setupDir(configuration.cacheDir ?? NativeLibrary.defaultCacheDir);
    this._briefcaseCacheDir = path.join(this._cacheDir, "imodels");
  }

  /** This method must be called when an iTwin.js host is shut down. Raises [[onBeforeShutdown]] */
  public static async shutdown(): Promise<void> {
    // NB: This method is set as a node listener where `this` is unbound
    if (!IModelHost._isValid)
      return;

    IModelHost._isValid = false;
    IModelHost.onBeforeShutdown.raiseEvent();
    IModelHost.configuration = undefined;
    IModelHost.tileCacheService = undefined;
    IModelHost.tileUploader = undefined;
    IModelHost._appWorkspace?.close();
    IModelHost._appWorkspace = undefined;
    ITwinWorkspace.finalize();
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

  /** The time, in milliseconds, for which IModelTileRpcInterface.requestTileTreeProps should wait before returning a "pending" status.
   * @internal
   */
  public static get tileTreeRequestTimeout(): number {
    return IModelHost.configuration?.tileTreeRequestTimeout ?? IModelHostConfiguration.defaultTileRequestTimeout;
  }
  /** The time, in milliseconds, for which IModelTileRpcInterface.requestTileContent should wait before returning a "pending" status.
   * @internal
   */
  public static get tileContentRequestTimeout(): number {
    return IModelHost.configuration?.tileContentRequestTimeout ?? IModelHostConfiguration.defaultTileRequestTimeout;
  }

  /** The backend will log when a tile took longer to load than this threshold in seconds. */
  public static get logTileLoadTimeThreshold(): number { return IModelHost.configuration?.logTileLoadTimeThreshold ?? IModelHostConfiguration.defaultLogTileLoadTimeThreshold; }
  /** The backend will log when a tile is loaded with a size in bytes above this threshold. */
  public static get logTileSizeThreshold(): number { return IModelHost.configuration?.logTileSizeThreshold ?? IModelHostConfiguration.defaultLogTileSizeThreshold; }

  /** Whether external tile caching is active.
   * @internal
   */
  public static get usingExternalTileCache(): boolean {
    return undefined !== IModelHost.tileCacheService;
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
    assert(undefined !== IModelHost.configuration);
    const config = IModelHost.configuration;
    const service = config.tileCacheService;
    const credentials = config.tileCacheAzureCredentials;

    if (!service && !credentials)
      return;

    IModelHost.tileUploader = new CloudStorageTileUploader();

    if (credentials && !service) {
      IModelHost.tileCacheService = new AzureBlobStorage(credentials);
    } else if (!credentials && service) {
      IModelHost.tileCacheService = service;
    } else {
      throw new IModelError(BentleyStatus.ERROR, "Cannot use both Azure and custom cloud storage providers for tile cache.");
    }
  }

  /** @internal */
  public static computeSchemaChecksum(arg: { schemaXmlPath: string, referencePaths: string[], exactMatch?: boolean }): string {
    return this.platform.computeSchemaChecksum(arg);
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
