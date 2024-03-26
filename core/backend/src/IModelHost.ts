/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module IModelHost
 */

// To avoid circular load errors, the "Element" classes must be loaded before IModelHost.
import "./IModelDb"; // DO NOT REMOVE OR MOVE THIS LINE!

import * as os from "os";
import "reflect-metadata"; // this has to be before @itwin/object-storage-* and @itwin/cloud-agnostic-core imports because those packages contain decorators that use this polyfill.
import { IModelJsNative, NativeLibrary } from "@bentley/imodeljs-native";
import { DependenciesConfig, Types as ExtensionTypes } from "@itwin/cloud-agnostic-core";
import { AccessToken, assert, BeEvent, DbResult, Guid, GuidString, IModelStatus, Logger, Mutable, ProcessDetector } from "@itwin/core-bentley";
import { AuthorizationClient, BentleyStatus, IModelError, LocalDirName, SessionProps } from "@itwin/core-common";
import { AzureServerStorageBindings } from "@itwin/object-storage-azure";
import { ServerStorage } from "@itwin/object-storage-core";
import { BackendHubAccess } from "./BackendHubAccess";
import { BackendLoggerCategory } from "./BackendLoggerCategory";
import { BisCoreSchema } from "./BisCoreSchema";
import { BriefcaseManager } from "./BriefcaseManager";
import { CloudSqlite } from "./CloudSqlite";
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
import { TileStorage } from "./TileStorage";
import { BaseSettings, SettingDictionary, SettingsPriority } from "./workspace/Settings";
import { SettingsSchemas } from "./workspace/SettingsSchemas";
import { Workspace, WorkspaceOpts } from "./workspace/Workspace";
import { Container } from "inversify";
import { join, normalize as normalizeDir } from "path";

const loggerCategory = BackendLoggerCategory.IModelHost;

// cspell:ignore nodereport fatalerror apicall alicloud rpcs inversify

/** @internal */
export interface CrashReportingConfigNameValuePair {
  name: string;
  value: string;
}

/** Configuration of the crash-reporting system.
 * @internal
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
  /** Enable Node.js crash reporting? If so, report files will be generated in the event of an unhandled exception or fatal error and written to crashDir. The default is false. */
  enableNodeReport?: boolean;
  /** Additional name, value pairs to write to iModelJsNativeCrash*.properties.txt file in the event of a crash. */
  params?: CrashReportingConfigNameValuePair[];
  /** Run this .js file to process .dmp and Node.js crash reporting .json files in the event of a crash.
   * This script will be executed with a single command-line parameter: the name of the dump or Node.js report file.
   * In the case of a dump file, there will be a second file with the same basename and the extension ".properties.txt".
   * Since it runs in a separate process, this script will have no access to the Javascript
   * context of the exiting backend. No default.
   */
  dumpProcessorScriptFileName?: string;
  /** Upload crash dump and node-reports to Bentley's crash-reporting service? Defaults to false */
  uploadToBentley?: boolean;
}

/** @beta */
export interface AzureBlobStorageCredentials {
  account: string;
  accessKey: string;
  baseUrl?: string;
}

/**
 * Options for [[IModelHost.startup]]
 * @public
 */
export interface IModelHostOptions {
  /**
   * The name of the *Profile* subdirectory of [[cacheDir]] for this process. If not present, "default" is used.
   * @see [[IModelHost.profileName]]
   * @beta
   */
  profileName?: string;

  /**
   * Root of the directory holding all the files that iTwin.js caches
   * - If not specified at startup a platform specific default is used -
   *   - Windows: $(HOMEDIR)/AppData/Local/iModelJs/
   *   - Mac/iOS: $(HOMEDIR)/Library/Caches/iModelJs/
   *   - Linux:   $(HOMEDIR)/.cache/iModelJs/
   *   where $(HOMEDIR) is documented [here](https://nodejs.org/api/os.html#os_os_homedir)
   * - if specified, ensure it is set to a folder with read/write access.
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
   * @internal
   */
  hubAccess?: BackendHubAccess;

  /** The Azure blob storage credentials to use for the tile cache service. If omitted and no external service implementation is provided, a local cache will be used.
   * @beta
   */
  tileCacheAzureCredentials?: AzureBlobStorageCredentials;

  /**
   * @beta
   * @note A reference implementation is set for AzureServerStorage from @itwin/object-storage-azure if [[tileCacheAzureCredentials]] property is set. To supply a different implementation for any service provider (such as AWS),
   *       set this property with a custom ServerStorage.
   */
  tileCacheStorage?: ServerStorage;

  /** The maximum size in bytes to which a local sqlite database used for caching tiles can grow before it is purged of least-recently-used tiles.
   * The local cache is used only if an external cache has not been configured via [[tileCacheStorage]], and [[tileCacheAzureCredentials]].
   * Defaults to 1 GB. Must be an unsigned integer. A value of zero disables the local cache entirely.
   * @beta
   */
  maxTileCacheDbSize?: number;

  /** Whether to restrict tile cache URLs by client IP address (if available).
   * @beta
   */
  restrictTileUrlsByClientIp?: boolean;

  /** Whether to enable OpenTelemetry tracing.
   * Defaults to `false`.
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
   * @internal
   */
  crashReportingConfig?: CrashReportingConfig;

  /** The AuthorizationClient used to obtain [AccessToken]($bentley)s. */
  authorizationClient?: AuthorizationClient;
}

/** Configuration of core-backend.
 * @public
 */
export class IModelHostConfiguration implements IModelHostOptions {
  public static defaultTileRequestTimeout = 20 * 1000;
  public static defaultLogTileLoadTimeThreshold = 40;
  public static defaultLogTileSizeThreshold = 20 * 1000000;
  /** @internal */
  public static defaultMaxTileCacheDbSize = 1024 * 1024 * 1024;

  public appAssetsDir?: LocalDirName;
  public cacheDir?: LocalDirName;

  /** @beta */
  public workspace?: WorkspaceOpts;
  /** @internal */
  public hubAccess?: BackendHubAccess;
  /** The AuthorizationClient used to obtain [AccessToken]($bentley)s. */
  public authorizationClient?: AuthorizationClient;
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
  /** @internal */
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
    this.addDictionary("_default_", 0 as SettingsPriority, defaults);
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

  /** The AuthorizationClient used to obtain [AccessToken]($bentley)s. */
  public static authorizationClient?: AuthorizationClient;

  public static backendVersion = "";
  private static _profileName: string;
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

  /**
   * The name of the *Profile* directory (a subdirectory of "[[cacheDir]]/profiles/") for this process.
   *
   * The *Profile* directory is used to cache data that is specific to a type-of-usage of the iTwin.js library.
   * It is important that information in the profile cache be consistent but isolated across sessions (i.e.
   * data for a profile is maintained between runs, but each profile is completely independent and
   * unaffected by the presence ot use of others.)
   * @note **Only one process at a time may be using a given profile**, and an exception will be thrown by [[startup]]
   * if a second process attempts to use the same profile.
   * @beta
   */
  public static get profileName(): string {
    return this._profileName;
  }

  /** The full path of the Profile directory.
   * @see [[profileName]]
   * @beta
   */
  public static get profileDir(): LocalDirName {
    return join(this._cacheDir, "profiles", this._profileName);
  }

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

  /** A string that can identify the current user to other users when collaborating. */
  public static userMoniker = "unknown";

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
      return (await IModelHost.authorizationClient?.getAccessToken()) ?? "";
    } catch (e) {
      return "";
    }
  }

  private static syncNativeLogLevels() {
    this.platform.clearLogLevelCache();
  }
  private static loadNative(options: IModelHostOptions) {
    if (undefined !== this._platform)
      return;

    this._platform = ProcessDetector.isMobileAppBackend ? (process as any)._linkedBinding("iModelJsNative") as typeof IModelJsNative : NativeLibrary.load();
    this._platform.logger = Logger;
    Logger.logLevelChangedFn = () => IModelHost.syncNativeLogLevels(); // the arrow function exists only so that it can be spied in tests

    if (options.crashReportingConfig && options.crashReportingConfig.crashDir && !ProcessDetector.isElectronAppBackend && !ProcessDetector.isMobileAppBackend) {
      this.platform.setCrashReporting(options.crashReportingConfig);

      Logger.logTrace(loggerCategory, "Configured crash reporting", {
        enableCrashDumps: options.crashReportingConfig?.enableCrashDumps,
        wantFullMemoryDumps: options.crashReportingConfig?.wantFullMemoryDumps,
        enableNodeReport: options.crashReportingConfig?.enableNodeReport,
        uploadToBentley: options.crashReportingConfig?.uploadToBentley,
      });

      if (options.crashReportingConfig.enableNodeReport) {
        if (process.report !== undefined) {
          process.report.reportOnFatalError = true;
          process.report.reportOnUncaughtException = true;
          process.report.directory = options.crashReportingConfig.crashDir;
          Logger.logTrace(loggerCategory, "Configured Node.js crash reporting");
        } else {
          Logger.logWarning(loggerCategory, "Unable to configure Node.js crash reporting");
        }
      }
    }
  }

  /** @internal */
  public static tileStorage?: TileStorage;

  private static _hubAccess?: BackendHubAccess;
  /** @internal */
  public static setHubAccess(hubAccess: BackendHubAccess | undefined) { this._hubAccess = hubAccess; }

  /** get the current hubAccess, if present.
   * @internal
   */
  public static getHubAccess(): BackendHubAccess | undefined { return this._hubAccess; }

  /** Provides access to the IModelHub for this IModelHost
   * @internal
   * @note If [[IModelHostOptions.hubAccess]] was undefined when initializing this class, accessing this property will throw an error.
   * To determine whether one is present, use [[getHubAccess]].
   */
  public static get hubAccess(): BackendHubAccess {
    if (IModelHost._hubAccess === undefined)
      throw new IModelError(IModelStatus.BadRequest, "No BackendHubAccess supplied in IModelHostOptions");
    return IModelHost._hubAccess;
  }

  private static initializeWorkspace(configuration: IModelHostOptions) {
    const settingAssets = join(KnownLocations.packageAssetsDir, "Settings");
    SettingsSchemas.addDirectory(join(settingAssets, "Schemas"));
    this._appWorkspace = Workspace.construct(new ApplicationSettings(), configuration.workspace);

    // Create the CloudCache for Workspaces. This will fail if another process is already using the same profile.
    try {
      this.appWorkspace.getCloudCache();
    } catch (e: any) {
      throw (e.errorNumber === DbResult.BE_SQLITE_BUSY) ? new IModelError(DbResult.BE_SQLITE_BUSY, `Profile [${this.profileDir}] is already in use by another process`) : e;
    }

    this.appWorkspace.settings.addDirectory(settingAssets, SettingsPriority.defaults);

    GeoCoordConfig.onStartup();
    // allow applications to load their default settings
    this.onWorkspaceStartup.raiseEvent();
  }

  private static _isValid = false;

  /** true between a successful call to [[startup]] and before [[shutdown]] */
  public static get isValid() {
    return IModelHost._isValid;
  }

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
    if (this.sessionId === "")
      this.sessionId = Guid.createValue();

    this.authorizationClient = options.authorizationClient;

    this.backendVersion = require("../../package.json").version; // eslint-disable-line @typescript-eslint/no-var-requires
    initializeRpcBackend(options.enableOpenTelemetry);

    this.loadNative(options);
    this.setupCacheDir(options);
    this.initializeWorkspace(options);

    BriefcaseManager.initialize(join(this._cacheDir, "imodels"));

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

    process.once("beforeExit", IModelHost.shutdown);
    this.onAfterStartup.raiseEvent();
  }

  private static setupCacheDir(configuration: IModelHostOptions) {
    this._cacheDir = normalizeDir(configuration.cacheDir ?? NativeLibrary.defaultCacheDir);
    IModelJsFs.recursiveMkDirSync(this._cacheDir);

    this._profileName = configuration.profileName ?? "default";
    Logger.logInfo(loggerCategory, `cacheDir: [${this.cacheDir}], profileDir: [${this.profileDir}]`);
  }

  /** This method must be called when an iTwin.js host is shut down. Raises [[onBeforeShutdown]] */
  public static async shutdown(this: void): Promise<void> {
    // Note: This method is set as a node listener where `this` is unbound. Call private method to
    // ensure `this` is correct. Don't combine these methods.
    return IModelHost.doShutdown();
  }

  private static async doShutdown() {
    if (!this._isValid)
      return;

    this._isValid = false;
    this.onBeforeShutdown.raiseEvent();
    this.configuration = undefined;
    this.tileStorage = undefined;
    this._appWorkspace?.close();
    this._appWorkspace = undefined;

    CloudSqlite.CloudCaches.destroy();
    process.removeListener("beforeExit", IModelHost.shutdown);
  }

  /**
   * Add or update a property that should be included in a crash report.
   * @internal
   */
  public static setCrashReportProperty(name: string, value: string): void {
    this.platform.setCrashReportProperty(name, value);
  }

  /**
   * Remove a previously defined property so that will not be included in a crash report.
   * @internal
   */
  public static removeCrashReportProperty(name: string): void {
    this.platform.setCrashReportProperty(name, undefined);
  }

  /**
   * Get all properties that will be included in a crash report.
   * @internal
   */
  public static getCrashReportProperties(): CrashReportingConfigNameValuePair[] {
    return this.platform.getCrashReportProperties();
  }

  /** The directory where application assets may be found */
  public static get appAssetsDir(): string | undefined {
    return undefined !== IModelHost.configuration ? IModelHost.configuration.appAssetsDir : undefined;
  }

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
  public static get logTileLoadTimeThreshold(): number {
    return IModelHost.configuration?.logTileLoadTimeThreshold ?? IModelHostConfiguration.defaultLogTileLoadTimeThreshold;
  }
  /** The backend will log when a tile is loaded with a size in bytes above this threshold. */
  public static get logTileSizeThreshold(): number {
    return IModelHost.configuration?.logTileSizeThreshold ?? IModelHostConfiguration.defaultLogTileSizeThreshold;
  }

  /** Whether external tile caching is active.
   * @internal
   */
  public static get usingExternalTileCache(): boolean {
    return undefined !== IModelHost.tileStorage;
  }

  /** Whether to restrict tile cache URLs by client IP address.
   * @internal
   */
  public static get restrictTileUrlsByClientIp(): boolean {
    return undefined !== IModelHost.configuration && (IModelHost.configuration.restrictTileUrlsByClientIp ? true : false);
  }

  /** Whether to compress cached tiles.
   * @internal
   */
  public static get compressCachedTiles(): boolean {
    return false !== IModelHost.configuration?.compressCachedTiles;
  }

  private static setupTileCache() {
    assert(undefined !== IModelHost.configuration);
    const config = IModelHost.configuration;
    const storage = config.tileCacheStorage;
    const credentials = config.tileCacheAzureCredentials;

    if (!storage && !credentials) {
      this.platform.setMaxTileCacheSize(config.maxTileCacheDbSize ?? IModelHostConfiguration.defaultMaxTileCacheDbSize);
      return;
    }

    this.platform.setMaxTileCacheSize(0);
    if (credentials) {
      if (storage)
        throw new IModelError(BentleyStatus.ERROR, "Cannot use both Azure and custom cloud storage providers for tile cache.");
      this.setupAzureTileCache(credentials);
    }
    if (storage)
      IModelHost.tileStorage = new TileStorage(storage);
  }

  private static setupAzureTileCache(credentials: AzureBlobStorageCredentials) {
    const config = {
      // eslint-disable-next-line @typescript-eslint/naming-convention
      ServerSideStorage: {
        dependencyName: "azure",
        accountName: credentials.account,
        accountKey: credentials.accessKey,
        baseUrl: credentials.baseUrl ?? `https://${credentials.account}.blob.core.windows.net`,
      },
    };
    const ioc: Container = new Container();
    ioc.bind<DependenciesConfig>(ExtensionTypes.dependenciesConfig).toConstantValue(config);
    new AzureServerStorageBindings().register(ioc, config.ServerSideStorage);
    IModelHost.tileStorage = new TileStorage(ioc.get(ServerStorage));
  }

  /** @internal */
  public static computeSchemaChecksum(arg: { schemaXmlPath: string, referencePaths: string[], exactMatch?: boolean }): string {
    return this.platform.computeSchemaChecksum(arg);
  }
}

/** Information about the platform on which the app is running.
 * @public
 */
export class Platform {
  /** Get the name of the platform. */
  public static get platformName(): "win32" | "linux" | "darwin" | "ios" | "android" | "uwp" {
    return process.platform as any;
  }
}

/** Well known directories that may be used by the application.
 * @public
 */
export class KnownLocations {

  /** The directory where the imodeljs-native assets are stored. */
  public static get nativeAssetsDir(): LocalDirName {
    return IModelHost.platform.DgnDb.getAssetsDir();
  }

  /** The directory where the core-backend assets are stored. */
  public static get packageAssetsDir(): LocalDirName {
    return join(__dirname, "assets");
  }

  /** The temporary directory. */
  public static get tmpdir(): LocalDirName {
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
