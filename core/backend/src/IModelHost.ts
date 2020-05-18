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
import { AuthStatus, BeEvent, BentleyError, ClientRequestContext, Config, Guid, GuidString, IModelStatus, Logger } from "@bentley/bentleyjs-core";
import { IModelClient } from "@bentley/imodelhub-client";
import { BentleyStatus, IModelError, MobileRpcConfiguration, RpcConfiguration, SerializedRpcRequest } from "@bentley/imodeljs-common";
import { IModelJsNative, NativeLibrary } from "@bentley/imodeljs-native";
import { AccessToken, AuthorizationClient, AuthorizedClientRequestContext, UrlDiscoveryClient, UserInfo } from "@bentley/itwin-client";
import { AliCloudStorageService } from "./AliCloudStorageService";
import { BackendLoggerCategory } from "./BackendLoggerCategory";
import { BackendRequestContext } from "./BackendRequestContext";
import { BisCoreSchema } from "./BisCoreSchema";
import { BriefcaseManager } from "./BriefcaseManager";
import { AzureBlobStorage, CloudStorageService, CloudStorageServiceCredentials, CloudStorageTileUploader } from "./CloudStorageBackend";
import { Config as ConcurrentQueryConfig } from "./ConcurrentQuery";
import { FunctionalSchema } from "./domains/FunctionalSchema";
import { GenericSchema } from "./domains/GenericSchema";
import { IElementEditor } from "./ElementEditor";
import { IModelJsFs } from "./IModelJsFs";
import { DevToolsRpcImpl } from "./rpc-impl/DevToolsRpcImpl";
import { Editor3dRpcImpl } from "./rpc-impl/EditorRpcImpl";
import { IModelReadRpcImpl } from "./rpc-impl/IModelReadRpcImpl";
import { IModelTileRpcImpl } from "./rpc-impl/IModelTileRpcImpl";
import { IModelWriteRpcImpl } from "./rpc-impl/IModelWriteRpcImpl";
import { NativeAppRpcImpl } from "./rpc-impl/NativeAppRpcImpl";
import { SnapshotIModelRpcImpl } from "./rpc-impl/SnapshotIModelRpcImpl";
import { WipRpcImpl } from "./rpc-impl/WipRpcImpl";
import { initializeRpcBackend } from "./RpcBackend";

const loggerCategory: string = BackendLoggerCategory.IModelHost;

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
/** Configuration for event sink
 * @internal
 */
export interface EventSinkOptions {
  maxQueueSize: number;
  maxNamespace: number;
}

/**
 * Type of the backend application
 * @alpha
 */
export enum ApplicationType {
  WebAgent,
  WebApplicationBackend,
  NativeApp,
}

/** Configuration of imodeljs-backend.
 * @public
 */
export class IModelHostConfiguration {
  /** The native platform to use -- normally, the app should leave this undefined. [[IModelHost.startup]] will set it to the appropriate nativePlatform automatically. */
  public nativePlatform?: any;

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

  /** The path where the cache of briefcases are stored. Defaults to `path.join(KnownLocations.tmpdir, "Bentley/iModelJs/cache/")`
   * If overriding this, ensure it's set to a folder with complete access - it may have to be deleted and recreated.
   * @deprecated Use [[IModelHostConfiguration.cacheDir]] instead to specify the root of all caches.
   * - Using this new option will cause a new cache structure and invalidate existing caches - i.e., the cache will be
   *   re-created in a new location on disk, and the existing cache may have to be manually cleaned out.
   * - If [[IModelHostConfiguration.cacheDir]] is also specified, this setting will take precedence for the briefcase cache
   */
  public briefcaseCacheDir?: string;

  /** The directory where the app's assets are found. */
  public appAssetsDir?: string;

  /** The kind of iModel server to use. Defaults to iModelHubClient */
  public imodelClient?: IModelClient;

  /** The credentials to use for the tile cache service. If omitted, a local cache will be used.
   * @beta
   */
  public tileCacheCredentials?: CloudStorageServiceCredentials;

  /** Whether to restrict tile cache URLs by client IP address (if available).
   * @beta
   */
  public restrictTileUrlsByClientIp?: boolean;

  /** Whether to compress cached tiles.
   * @beta
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
  /** Configuration for event sink
   * @internal
   */
  public eventSinkOptions: EventSinkOptions = { maxQueueSize: 5000, maxNamespace: 255 };
  public concurrentQuery: ConcurrentQueryConfig = {
    concurrent: (os.cpus().length - 1),
    autoExpireTimeForCompletedQuery: 2 * 60, // 2 minutes
    minMonitorInterval: 1, // 1 seconds
    idleCleanupTime: 30 * 60, // 30 minutes
    cachedStatementsPerThread: 40,
    maxQueueSize: (os.cpus().length - 1) * 500,
    pollInterval: 50,
    useSharedCache: false,
    useUncommittedRead: false,
    quota: {
      maxTimeAllowed: 60, // 1 Minute
      maxMemoryAllowed: 2 * 1024 * 1024, // 2 MB
    },
  };

  /**
   * Application (host) type
   * @alpha
   */
  public applicationType?: ApplicationType;
}

/** IModelHost initializes ($backend) and captures its configuration. A backend must call [[IModelHost.startup]] before using any backend classes.
 * See [the learning article]($docs/learning/backend/IModelHost.md)
 * @public
 */
export class IModelHost {
  private static _authorizationClient?: AuthorizationClient;
  private static _nativeAppBackend: boolean;
  public static backendVersion = "";
  private static _cacheDir = "";

  private static _platform?: typeof IModelJsNative;
  /** @internal */
  public static get platform(): typeof IModelJsNative { return this._platform!; }

  /** @internal */
  public static get isNativeAppBackend(): boolean { return IModelHost._nativeAppBackend; }

  public static configuration?: IModelHostConfiguration;
  /** Event raised just after the backend IModelHost was started */
  public static readonly onAfterStartup = new BeEvent<() => void>();

  /** Event raised just before the backend IModelHost is to be shut down */
  public static readonly onBeforeShutdown = new BeEvent<() => void>();

  /** A uniqueId for this backend session */
  public static sessionId: GuidString;

  /** The Id of this backend application - needs to be set only if it is an agent application. The applicationId will otherwise originate at the frontend. */
  public static applicationId: string;

  /** The version of this backend application - needs to be set if is an agent application. The applicationVersion will otherwise originate at the frontend. */
  public static applicationVersion: string;

  /** Root of the directory holding all the files that iModel.js caches */
  public static get cacheDir(): string { return this._cacheDir; }

  /** Active element editors. Each editor is identified by a GUID.
   * @internal
   */
  public static elementEditors = new Map<GuidString, IElementEditor>();

  /** The optional [[FileNameResolver]] that resolves keys and partial file names for snapshot iModels. */
  public static snapshotFileNameResolver?: FileNameResolver;

  /** Implementation of [AuthorizationClient]($itwin-client) to supply the authorization information for this session - only required for backend applications */
  /** Implementation of [AuthorizationClient]($itwin-client) to supply the authorization information for this session - only required for agent applications, or backends that want to override access tokens passed from the frontend */
  public static get authorizationClient(): AuthorizationClient | undefined { return IModelHost._authorizationClient; }
  public static set authorizationClient(authorizationClient: AuthorizationClient | undefined) { IModelHost._authorizationClient = authorizationClient; }

  /** Get the active authorization/access token for use with various services
   * @throws [[BentleyError]] if the access token cannot be obtained
   */
  public static async getAccessToken(requestContext: ClientRequestContext = new BackendRequestContext()): Promise<AccessToken> {
    requestContext.enter();
    if (!this.authorizationClient)
      throw new BentleyError(AuthStatus.Error, "No AuthorizationClient has been supplied to IModelHost", Logger.logError, loggerCategory);
    return this.authorizationClient.getAccessToken(requestContext);
  }

  private static get _isNativePlatformLoaded(): boolean { return this._platform !== undefined; }

  private static registerPlatform(platform: typeof IModelJsNative, region: number): void {
    this._platform = platform;
    if (undefined === platform)
      return;

    if (!Platform.isMobile)
      this.validateNativePlatformVersion();

    platform.logger = Logger;
    platform.NativeUlasClient.initializeRegion(region);
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
    if (!semver.satisfies(process.version, requiredVersion))
      throw new IModelError(IModelStatus.BadRequest, `Node.js version ${process.version} is not within the range acceptable to imodeljs-backend: (${requiredVersion})`);
  }

  private static getApplicationVersion(): string { return require("../package.json").version; }

  private static setupRpcRequestContext() {
    RpcConfiguration.requestContext.deserialize = async (serializedContext: SerializedRpcRequest): Promise<ClientRequestContext> => {
      // Setup a ClientRequestContext if authorization is NOT required for the RPC operation
      if (!serializedContext.authorization)
        return new ClientRequestContext(serializedContext.id, serializedContext.applicationId, serializedContext.applicationVersion, serializedContext.sessionId);

      // Setup an AuthorizationClientRequestContext if authorization is required for the RPC operation
      let accessToken: AccessToken;
      if (!IModelHost.authorizationClient) {
        // Determine the access token from the frontend request
        accessToken = AccessToken.fromTokenString(serializedContext.authorization);
        const userId = serializedContext.userId;
        if (userId)
          accessToken.setUserInfo(new UserInfo(userId));
      } else {
        // Determine the access token from  the backend's authorization client
        accessToken = await IModelHost.authorizationClient.getAccessToken();
      }

      return new AuthorizedClientRequestContext(accessToken, serializedContext.id, serializedContext.applicationId, serializedContext.applicationVersion, serializedContext.sessionId);
    };
  }

  /** @internal */
  public static loadNative(region: number): void { this.registerPlatform(Platform.load(), region); }

  /**
   * @beta
   * @note A reference implementation is set by default for [AzureBlobStorage]. To supply a different implementation for any service provider (such as AWS),
   *       set this property with a custom [CloudStorageService] and also set [IModelHostConfiguration.tileCacheCredentials] using "external" for the service name.
   *       Note that the account and access key members of [CloudStorageServiceCredentials] may have blank values unless the custom service implementation uses them.
   */
  public static tileCacheService: CloudStorageService;

  /** @internal */
  public static tileUploader: CloudStorageTileUploader;

  /** This method must be called before any iModel.js services are used.
   * @param configuration Host configuration data.
   * Raises [[onAfterStartup]].
   * @see [[shutdown]].
   */
  public static async startup(configuration: IModelHostConfiguration = new IModelHostConfiguration()): Promise<void> {
    if (IModelHost.configuration)
      throw new IModelError(BentleyStatus.ERROR, "startup may only be called once", Logger.logError, loggerCategory, () => (configuration));

    IModelHost.sessionId = Guid.createValue();
    if (configuration.applicationType && configuration.applicationType === ApplicationType.NativeApp) {
      this._nativeAppBackend = true;
    }

    // Setup a current context for all requests that originate from this backend
    const requestContext = new BackendRequestContext();
    requestContext.enter();

    if (!MobileRpcConfiguration.isMobileBackend) {
      this.validateNodeJsVersion();
    }
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
        Logger.logError(loggerCategory, "Error registering/loading the native platform API", () => (configuration));
        throw error;
      }
    }

    this._platform!.setNopBriefcaseManager(); // Tell native code that requests for locks and codes are managed in JS.

    if (configuration.crashReportingConfig && configuration.crashReportingConfig.crashDir && this._platform && (Platform.isNodeJs && !Platform.electron)) {
      this._platform.setCrashReporting(configuration.crashReportingConfig);

      if (configuration.crashReportingConfig.enableNodeReport) {
        try {
          // node-report reports on V8 fatal errors and unhandled exceptions/Promise rejections.
          const nodereport = require("node-report/api");
          nodereport.setEvents("exception+fatalerror+apicall");
          nodereport.setDirectory(configuration.crashReportingConfig.crashDir);
          nodereport.setVerbose("yes");
        } catch (err) {
          Logger.logWarning(loggerCategory, "node-report is not installed.");
        }
      }
    }

    this.setupCacheDirs(configuration);
    BriefcaseManager.initialize(this._briefcaseCacheDir, configuration.imodelClient);

    IModelHost.setupRpcRequestContext();

    const rpcs = [
      IModelReadRpcImpl,
      IModelTileRpcImpl,
      IModelWriteRpcImpl,
      SnapshotIModelRpcImpl,
      WipRpcImpl,
      DevToolsRpcImpl,
      Editor3dRpcImpl,
      NativeAppRpcImpl,
    ];
    const schemas = [
      BisCoreSchema,
      GenericSchema,
      FunctionalSchema,
    ];

    rpcs.forEach((rpc) => rpc.register()); // register all of the RPC implementations
    schemas.forEach((schema) => schema.registerSchema()); // register all of the schemas

    IModelHost.configuration = configuration;
    IModelHost.setupTileCache();
    if (!IModelHost.applicationId) IModelHost.applicationId = "2686"; // Default to product id of iModel.js
    if (!IModelHost.applicationVersion) IModelHost.applicationVersion = this.getApplicationVersion(); // Default to version of this package

    if (undefined !== this._platform) {
      this._platform.setUseTileCache(configuration.tileCacheCredentials ? false : true);
    }

    IModelHost.onAfterStartup.raiseEvent();
  }

  private static _briefcaseCacheDir: string;

  // Get a platform specific default cache dir
  private static getDefaultCacheDir(): string {
    let baseDir: string;
    const homedir = os.homedir();
    const platform = os.platform() as string;
    switch (platform) {
      case "win32":
        baseDir = path.join(homedir, "AppData", "Local");
        break;
      case "darwin":
      case "ios":
        baseDir = path.join(homedir, "Library", "Caches");
        break;
      case "linux":
        baseDir = path.join(homedir, ".cache");
        break;
      default:
        throw new BentleyError(BentleyStatus.ERROR, "Unknown platform that does not support iModel.js backends", () => ({ platform }));
    }
    return path.join(baseDir, "iModelJs");
  }

  private static setupCacheDirs(configuration: IModelHostConfiguration) {
    this._cacheDir = configuration.cacheDir ? path.normalize(configuration.cacheDir) : this.getDefaultCacheDir();

    // Setup the briefcaseCacheDir, defaulting to the the legacy/deprecated value
    if (configuration.briefcaseCacheDir) // tslint:disable-line:deprecation
      this._briefcaseCacheDir = path.normalize(configuration.briefcaseCacheDir); // tslint:disable-line:deprecation
    else
      this._briefcaseCacheDir = path.join(this._cacheDir, "bc");
  }

  /** This method must be called when an iModel.js services is shut down. Raises [[onBeforeShutdown]] */
  public static async shutdown(): Promise<void> {
    if (!IModelHost.configuration)
      return;
    IModelHost.onBeforeShutdown.raiseEvent();
    IModelHost.configuration = undefined;
    IModelHost._nativeAppBackend = false;
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
  public static get usingExternalTileCache(): boolean { return undefined !== IModelHost.configuration && undefined !== IModelHost.configuration.tileCacheCredentials; }

  /** Whether to restrict tile cache URLs by client IP address.
   * @internal
   */
  public static get restrictTileUrlsByClientIp(): boolean { return undefined !== IModelHost.configuration && (IModelHost.configuration.restrictTileUrlsByClientIp ? true : false); }

  /** Whether to compress cached tiles.
   * @internal
   */
  public static get compressCachedTiles(): boolean { return undefined !== IModelHost.configuration && (IModelHost.configuration.compressCachedTiles ? true : false); }

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
  /** The imodeljs mobile info object, if this is running in the imodeljs mobile platform.
   * @beta
   */
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

  /** The Electron info object, if this is running in Electron.
   * @beta
   */
  public static get electron(): any { return ((typeof (process) !== "undefined") && ("electron" in process.versions)) ? require("electron") : undefined; }

  /** Query if this is a desktop configuration */
  public static get isDesktop(): boolean { return Platform.electron !== undefined; }

  /** Query if this is a mobile configuration */
  public static get isMobile(): boolean { return Platform.imodeljsMobile !== undefined; }

  /** Query if this is running in Node.js  */
  public static get isNodeJs(): boolean { return !Platform.isMobile; } // currently we use nodejs for all non-mobile backend apps

  /** @internal */
  public static load(): typeof IModelJsNative {
    return this.isMobile ? this.imodeljsMobile.imodeljsNative : NativeLibrary.load();
  }
}

/** Well known directories that may be used by the application. Also see [[Platform]]
 * @public
 */
export class KnownLocations {

  /** The directory where the imodeljs-native assets are stored. */
  public static get nativeAssetsDir(): string { return IModelHost.platform.DgnDb.getAssetsDir(); }

  /** The directory where the imodeljs-backend assets are stored. */
  public static get packageAssetsDir(): string {
    const imodeljsMobile = Platform.imodeljsMobile;
    if (imodeljsMobile !== undefined) {
      return path.join(process.execPath!, "Assets", "assets");
    }
    // Assume that we are running in nodejs
    return path.join(__dirname, "assets");
  }

  /** The temporary directory. */
  public static get tmpdir(): string {
    const imodeljsMobile = Platform.imodeljsMobile;
    return imodeljsMobile !== undefined ? imodeljsMobile.knownLocations.tempDir : os.tmpdir();
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
      throw new IModelError(IModelStatus.NotFound, `${fileKey} not resolved`, Logger.logWarning, loggerCategory);
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
      throw new IModelError(IModelStatus.NotFound, `${inFileName} not resolved`, Logger.logWarning, loggerCategory);
    }
    return resolvedFileName;
  }
}
