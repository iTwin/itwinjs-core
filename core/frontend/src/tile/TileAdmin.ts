/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module Tiles
 */
import {
  assert, BeDuration, BeEvent, BentleyStatus, BeTimePoint, Id64, Id64Array, Id64String, IModelStatus, ProcessDetector,
} from "@itwin/core-bentley";
import {
  BackendError, defaultTileOptions, EdgeOptions, ElementGraphicsRequestProps, getMaximumMajorTileFormatVersion, IModelError, IModelTileRpcInterface,
  IModelTileTreeProps, RenderSchedule, RpcOperation, RpcResponseCacheControl, ServerTimeoutError, TileContentSource, TileVersionInfo,
} from "@itwin/core-common";
import { IModelApp } from "../IModelApp";
import { IpcApp } from "../IpcApp";
import { IModelConnection } from "../IModelConnection";
import { Viewport } from "../Viewport";
import {
  DisclosedTileTreeSet, FetchCloudStorage, IModelTileTree, LRUTileList, ReadonlyTileUserSet, Tile, TileContentDecodingStatistics, TileLoadStatus,
  TileRequest, TileRequestChannels, TileStorage, TileTree, TileTreeOwner, TileUsageMarker, TileUser, UniqueTileUserSets,
} from "./internal";
import type { FrontendStorage } from "@itwin/object-storage-core/lib/frontend";

/** Details about any tiles not handled by [[TileAdmin]]. At this time, that means OrbitGT point cloud tiles.
 * Used for bookkeeping by SelectedAndReadyTiles
 * @internal
 */
export interface ExternalTileStatistics {
  requested: number;
  selected: number;
  ready: number;
}

/** Describes two sets of tiles associated with a viewport's current scene.
 * @internal
 */
export interface SelectedAndReadyTiles {
  /** The tiles actually selected for the viewport's scene. This includes tiles drawn to the screen; it may also include tiles selected for the shadow map.
   * These represent the "best available" tiles for the current view - some may have been selected as placeholders while more appropriate tiles are loaded.
   */
  readonly selected: Set<Tile>;
  /** The tiles that are considered appropriate for the current view and that are ready to draw. Some may not have actually been selected for drawing in the
   * current view, e.g., because sibling tiles are not yet ready to draw.
   */
  readonly ready: Set<Tile>;
  /** Details about any tiles not handled by [[TileAdmin]]. At this time, that means OrbitGT point cloud tiles and tiles for view attachments. */
  readonly external: ExternalTileStatistics;
}

/** Describes a strategy for imposing limits upon the amount of GPU memory consumed by [[Tile]] content.
 *
 * For a given view, a set of tiles is required to display its contents. As the user navigates the view by panning, rotating, zooming, etc, that set of tiles changes.
 * Previously-displayed tiles can remain in memory for a short while so that if they are subsequently required for display again they will be immediately available.
 * Keeping too many tiles in memory can consume excessive amounts of GPU memory; in extreme cases, more GPU memory can be consumed than is available, resulting in loss of
 * the WebGL context, which causes all rendering to stop.
 *
 * Over-consumption of GPU memory can be prevented by imposing a limit on the maximum amount that can be in use at any one time. When the limit is exceeded, the contents
 * of [[Tile]]s that are not currently being displayed by any [[Viewport]] are discarded, freeing up memory, until the limit is satisfied or all
 * undisplayed tiles' contents have been discarded. The least-recently-displayed tiles' contents are discarded first, under the assumption that they are the least likely to
 * be displayed again in the near future. Contents of tiles that are currently being displayed by at least one viewport will not be discarded.
 *
 * WebGL provides no direct access to the GPU, so the amount of memory actually being consumed can only be estimated based on the amount of memory
 * requested from it; the actual amount will invariably be larger - sometimes much larger.
 *
 * The number of bytes corresponding to the various limits is estimated at run-time based on whether the client is running on a mobile device or not - tighter limits
 * are imposed on mobile devices due to their tighter resource constraints.
 *
 * In addition to the memory limits, tile contents are naturally discarded after a certain length of time during which they have been displayed by no viewports based on
 * [[TileAdmin.Props.tileExpirationTime]].
 *
 * The options are:
 * - "none" - no limits are imposed. Tile contents are discarded solely based on [[TileAdmin.Props.tileExpirationTime]].
 * - "aggressive" - a small limit resulting in tile contents being more aggressively discarded.
 * - "default" - a moderate limit that strives to balance limiting memory consumption while keeping tiles likely to be displayed again in memory.
 * - "relaxed" - a larger limit that may be appropriate for devices equipped with ample GPU memory.
 * - number - an explicit limit, in number of bytes. Because of the vagaries of actual GPU memory consumption under WebGL, this should be a conservative estimate - no more than perhaps 1/4 of the total GPU memory available, depending on the device.
 * @see [[TileAdmin.Props.gpuMemoryLimits]] to configure the limit at startup.
 * @see [[TileAdmin.gpuMemoryLimit]] to adjust the limit after startup.
 * @see [[TileAdmin.totalTileContentBytes]] for the current amount of GPU memory being used for tile contents.
 * @public
 * @extensions
 */
export type GpuMemoryLimit = "none" | "default" | "aggressive" | "relaxed" | number;

/** Defines separate [[GpuMemoryLimit]]s for mobile and desktop clients.
 * @see [[TileAdmin.Props.gpuMemoryLimits]] to configure the limit at startup.
 * @see [[GpuMemoryLimit]] for a description of how the available limits and how they are imposed.
 * @public
 * @extensions
 */
export interface GpuMemoryLimits {
  /** Limits applied to clients running on mobile devices. Defaults to "default" if undefined. */
  mobile?: GpuMemoryLimit;
  /** Limits applied to clients running on non-mobile devices. Defaults to 6,000 MB if undefined. */
  nonMobile?: GpuMemoryLimit;
}

/** Manages [[Tile]]s and [[TileTree]]s on behalf of [[IModelApp]]. Its responsibilities include scheduling requests for tile content via a priority queue;
 * keeping track of and imposing limits upon the amount of GPU memory consumed by tiles; and notifying listeners of tile-related events.
 * @see [[IModelApp.tileAdmin]] to access the instance of the TileAdmin.
 * @see [[TileAdmin.Props]] to configure the TileAdmin at startup.
 * @public
 * @extensions
 */
export class TileAdmin {
  private _versionInfo?: TileVersionInfo;
  public readonly channels: TileRequestChannels;
  private readonly _users = new Set<TileUser>();
  private readonly _requestsPerUser = new Map<TileUser, Set<Tile>>();
  private readonly _tileUsagePerUser = new Map<TileUser, Set<TileUsageMarker>>();
  private readonly _selectedAndReady = new Map<TileUser, SelectedAndReadyTiles>();
  private readonly _tileUserSetsForRequests = new UniqueTileUserSets();
  private readonly _maxActiveTileTreePropsRequests: number;
  private _defaultTileSizeModifier: number;
  private readonly _retryInterval: number;
  private readonly _enableInstancing: boolean;
  /** @internal */
  public readonly edgeOptions: EdgeOptions;
  /** @internal */
  public readonly enableImprovedElision: boolean;
  /** @internal */
  public readonly enableFrontendScheduleScripts: boolean;
  /** @internal */
  public readonly decodeImdlInWorker: boolean;
  /** @internal */
  public readonly ignoreAreaPatterns: boolean;
  /** @internal */
  public readonly enableExternalTextures: boolean;
  /** @internal */
  public readonly disableMagnification: boolean;
  /** @internal */
  public readonly percentGPUMemDisablePreload: number;
  /** @internal */
  public readonly alwaysRequestEdges: boolean;
  /** @internal */
  public readonly alwaysSubdivideIncompleteTiles: boolean;
  /** @internal */
  public readonly minimumSpatialTolerance: number;
  /** @internal */
  public readonly maximumMajorTileFormatVersion: number;
  /** @internal */
  public readonly useProjectExtents: boolean;
  /** @internal */
  public readonly expandProjectExtents: boolean;
  /** @internal */
  public readonly optimizeBRepProcessing: boolean;
  /** @internal */
  public readonly useLargerTiles: boolean;
  /** @internal */
  public readonly maximumLevelsToSkip: number;
  /** @internal */
  public readonly mobileRealityTileMinToleranceRatio: number;
  /** @internal */
  public readonly tileTreeExpirationTime: BeDuration;
  /** @internal */
  public readonly tileExpirationTime: BeDuration;
  /** @internal */
  public readonly contextPreloadParentDepth: number;
  /** @internal */
  public readonly contextPreloadParentSkip: number;
  /** @beta */
  public readonly cesiumIonKey?: string;
  private readonly _removeIModelConnectionOnCloseListener: () => void;
  private _totalElided = 0;
  private _rpcInitialized = false;
  private _nextPruneTime: BeTimePoint;
  private _nextPurgeTime: BeTimePoint;
  private _tileTreePropsRequests: TileTreePropsRequest[] = [];
  private _cleanup?: () => void;
  private readonly _lruList = new LRUTileList();
  private _maxTotalTileContentBytes?: number;
  private _gpuMemoryLimit: GpuMemoryLimit = "none";
  private readonly _isMobile: boolean;
  private readonly _cloudStorage?: FrontendStorage;

  /** Create a TileAdmin suitable for passing to [[IModelApp.startup]] via [[IModelAppOptions.tileAdmin]] to customize aspects of
   * its behavior.
   * @param props Options for customizing the behavior of the TileAdmin.
   * @returns the TileAdmin
   */
  public static async create(props?: TileAdmin.Props): Promise<TileAdmin> {
    const rpcConcurrency = IpcApp.isValid ? (await IpcApp.appFunctionIpc.queryConcurrency("cpu")) : undefined;
    const isMobile = ProcessDetector.isMobileBrowser;
    return new TileAdmin(isMobile, rpcConcurrency, props);
  }

  /** @internal */
  public get emptyTileUserSet(): ReadonlyTileUserSet { return UniqueTileUserSets.emptySet; }

  /** Returns basic statistics about the TileAdmin's current state. */
  public get statistics(): TileAdmin.Statistics {
    let numActiveTileTreePropsRequests = 0;
    for (const req of this._tileTreePropsRequests) {
      if (!req.isDispatched)
        break;

      ++numActiveTileTreePropsRequests;
    }

    return {
      ...this.channels.statistics,
      totalElidedTiles: this._totalElided,
      numActiveTileTreePropsRequests,
      numPendingTileTreePropsRequests: this._tileTreePropsRequests.length - numActiveTileTreePropsRequests,
    };
  }

  /** Resets the cumulative (per-session) statistics like totalCompletedRequests, totalEmptyTiles, etc. */
  public resetStatistics(): void {
    this.channels.resetStatistics();
    this._totalElided = 0;
  }

  /** Exposed as public strictly for tests.
   * @internal
   */
  public constructor(isMobile: boolean, rpcConcurrency: number | undefined, options?: TileAdmin.Props) {
    this._isMobile = isMobile;
    if (undefined === options)
      options = {};

    this.channels = new TileRequestChannels(rpcConcurrency, true === options.cacheTileMetadata);

    this._maxActiveTileTreePropsRequests = options.maxActiveTileTreePropsRequests ?? 10;
    this._defaultTileSizeModifier = (undefined !== options.defaultTileSizeModifier && options.defaultTileSizeModifier > 0) ? options.defaultTileSizeModifier : 1.0;
    this._retryInterval = undefined !== options.retryInterval ? options.retryInterval : 1000;
    this._enableInstancing = options.enableInstancing ?? defaultTileOptions.enableInstancing;
    this.edgeOptions = {
      type: false === options.enableIndexedEdges ? "non-indexed" : "compact",
      smooth: options.generateAllPolyfaceEdges ?? true,
    };
    this.enableImprovedElision = options.enableImprovedElision ?? defaultTileOptions.enableImprovedElision;
    this.enableFrontendScheduleScripts = options.enableFrontendScheduleScripts ?? false;
    this.decodeImdlInWorker = options.decodeImdlInWorker ?? true;
    this.ignoreAreaPatterns = options.ignoreAreaPatterns ?? defaultTileOptions.ignoreAreaPatterns;
    this.enableExternalTextures = options.enableExternalTextures ?? defaultTileOptions.enableExternalTextures;
    this.disableMagnification = options.disableMagnification ?? defaultTileOptions.disableMagnification;
    this.percentGPUMemDisablePreload = Math.max(0, Math.min((options.percentGPUMemDisablePreload === undefined ? 80 : options.percentGPUMemDisablePreload), 80));
    this.alwaysRequestEdges = true === options.alwaysRequestEdges;
    this.alwaysSubdivideIncompleteTiles = options.alwaysSubdivideIncompleteTiles ?? defaultTileOptions.alwaysSubdivideIncompleteTiles;
    this.maximumMajorTileFormatVersion = options.maximumMajorTileFormatVersion ?? defaultTileOptions.maximumMajorTileFormatVersion;
    this.useProjectExtents = options.useProjectExtents ?? defaultTileOptions.useProjectExtents;
    this.expandProjectExtents = options.expandProjectExtents ?? defaultTileOptions.expandProjectExtents;
    this.optimizeBRepProcessing = options.optimizeBRepProcessing ?? defaultTileOptions.optimizeBRepProcessing;
    this.useLargerTiles = options.useLargerTiles ?? defaultTileOptions.useLargerTiles;
    this.mobileRealityTileMinToleranceRatio = Math.max(options.mobileRealityTileMinToleranceRatio ?? 3.0, 1.0);
    this.cesiumIonKey = options.cesiumIonKey;
    this._cloudStorage = options.tileStorage;

    const gpuMemoryLimits = options.gpuMemoryLimits;
    let gpuMemoryLimit: GpuMemoryLimit | undefined;
    if (typeof gpuMemoryLimits === "object")
      gpuMemoryLimit = isMobile ? gpuMemoryLimits.mobile : gpuMemoryLimits.nonMobile;
    else
      gpuMemoryLimit = gpuMemoryLimits;

    if (undefined === gpuMemoryLimit)
      gpuMemoryLimit = isMobile ? "default" : TileAdmin.nonMobileUndefinedGpuMemoryLimit;

    this.gpuMemoryLimit = gpuMemoryLimit;

    if (undefined !== options.maximumLevelsToSkip)
      this.maximumLevelsToSkip = Math.floor(Math.max(0, options.maximumLevelsToSkip));
    else
      this.maximumLevelsToSkip = 1;

    const minSpatialTol = options.minimumSpatialTolerance;
    this.minimumSpatialTolerance = undefined !== minSpatialTol ? Math.max(minSpatialTol, 0) : 0.001;

    const clamp = (seconds: number, min: number, max: number): BeDuration => {
      seconds = Math.min(seconds, max);
      seconds = Math.max(seconds, min);
      return BeDuration.fromSeconds(seconds);
    };

    const ignoreMinimums = true === options.ignoreMinimumExpirationTimes;
    const minTileTime = ignoreMinimums ? 0.1 : 5;
    const minTreeTime = ignoreMinimums ? 0.1 : 10;

    // If unspecified, tile expiration time defaults to 20 seconds.
    this.tileExpirationTime = clamp((options.tileExpirationTime ?? 20), minTileTime, 60)!;

    // If unspecified, trees never expire (will change this to use a default later).
    this.tileTreeExpirationTime = clamp(options.tileTreeExpirationTime ?? 300, minTreeTime, 3600);

    const now = BeTimePoint.now();
    this._nextPruneTime = now.plus(this.tileExpirationTime);
    this._nextPurgeTime = now.plus(this.tileTreeExpirationTime);

    this._removeIModelConnectionOnCloseListener = IModelConnection.onClose.addListener((iModel) => this.onIModelClosed(iModel));

    // If unspecified preload 2 levels of parents for context tiles.
    this.contextPreloadParentDepth = Math.max(0, Math.min((options.contextPreloadParentDepth === undefined ? 2 : options.contextPreloadParentDepth), 8));
    // If unspecified skip one level before preloading  of parents of context tiles.
    this.contextPreloadParentSkip = Math.max(0, Math.min((options.contextPreloadParentSkip === undefined ? 1 : options.contextPreloadParentSkip), 5));

    const removals = [
      this.onTileLoad.addListener(() => this.invalidateAllScenes()),
      this.onTileChildrenLoad.addListener(() => this.invalidateAllScenes()),
      this.onTileTreeLoad.addListener(() => {
        // A reality model tile tree's range may extend outside of the project extents - we'll want to recompute the extents
        // of any spatial view's that may be displaying the reality model.
        for (const user of this.tileUsers)
          if (user instanceof Viewport && user.view.isSpatialView())
            user.invalidateController();
      }),
    ];

    this._cleanup = () => {
      removals.forEach((removal) => removal());
    };
  }

  private _tileStorage?: TileStorage;
  private async getTileStorage(): Promise<TileStorage> {
    if (this._tileStorage !== undefined)
      return this._tileStorage;

    // if custom implementation is provided, construct a new TileStorage instance and return it.
    if (this._cloudStorage !== undefined) {
      this._tileStorage = new TileStorage(this._cloudStorage);
      return this._tileStorage;
    }

    const fetchStorage = new FetchCloudStorage();
    this._tileStorage = new TileStorage(fetchStorage);
    return this._tileStorage;
  }

  /** @internal */
  public get enableInstancing() { return this._enableInstancing; }

  /** Given a numeric combined major+minor tile format version (typically obtained from a request to the backend to query the maximum tile format version it supports),
   * return the maximum *major* format version to be used to request tile content from the backend.
   * @see [[TileAdmin.Props.maximumMajorTileFormatVersion]]
   * @see [[CurrentImdlVersion]]
   */
  public getMaximumMajorTileFormatVersion(formatVersion?: number): number {
    return getMaximumMajorTileFormatVersion(this.maximumMajorTileFormatVersion, formatVersion);
  }

  /** A default multiplier applied to the size in pixels of a [[Tile]] during tile selection for any [[Viewport]].
   * Individual Viewports can override this multiplier if desired.
   * A value greater than 1.0 causes lower-resolution tiles to be selected; a value < 1.0 selects higher-resolution tiles.
   * This can allow an application to sacrifice quality for performance or vice-versa.
   * This property is initialized from the value supplied by the [[TileAdmin.Props.defaultTileSizeModifier]] used to initialize the TileAdmin at startup.
   * Changing it after startup will change it for all Viewports that do not explicitly override it with their own multiplier.
   * This value must be greater than zero.
   */
  public get defaultTileSizeModifier() { return this._defaultTileSizeModifier; }
  public set defaultTileSizeModifier(modifier: number) {
    if (modifier !== this._defaultTileSizeModifier && modifier > 0 && !Number.isNaN(modifier)) {
      this._defaultTileSizeModifier = modifier;
      IModelApp.viewManager.invalidateScenes();
    }
  }

  /** The total number of bytes of GPU memory allocated to [[Tile]] contents.
   * @see [[gpuMemoryLimit]] to impose limits on how high this can grow.
   */
  public get totalTileContentBytes(): number {
    return this._lruList.totalBytesUsed;
  }

  /** The maximum number of bytes of GPU memory that can be allocated to the contents of [[Tile]]s. When this limit is exceeded, the contents of the least-recently-drawn
   * tiles are discarded until the total is below this limit or all undisplayed tiles' contents have been discarded.
   * @see [[totalTileContentBytes]] for the current GPU memory usage.
   * @see [[gpuMemoryLimit]] to adjust this maximum.
   */
  public get maxTotalTileContentBytes(): number | undefined {
    return this._maxTotalTileContentBytes;
  }

  /** The strategy for limiting the amount of GPU memory allocated to [[Tile]] graphics.
   * @see [[TileAdmin.Props.gpuMemoryLimits]] to configure this at startup.
   * @see [[maxTotalTileContentBytes]] for the limit as a maximum number of bytes.
   */
  public get gpuMemoryLimit(): GpuMemoryLimit {
    return this._gpuMemoryLimit;
  }
  public set gpuMemoryLimit(limit: GpuMemoryLimit) {
    if (limit === this.gpuMemoryLimit)
      return;

    let maxBytes: number | undefined;
    if (typeof limit === "number") {
      limit = Math.max(0, limit);
      maxBytes = limit;
    } else {
      switch (limit) {
        case "default":
        case "aggressive":
        case "relaxed":
          const spec = this._isMobile ? TileAdmin.mobileGpuMemoryLimits : TileAdmin.nonMobileGpuMemoryLimits;
          maxBytes = spec[limit];
          break;
        default:
          limit = "none";
        // eslint-disable-next-line no-fallthrough
        case "none":
          maxBytes = undefined;
          break;
      }
    }

    this._gpuMemoryLimit = limit;
    this._maxTotalTileContentBytes = maxBytes;
  }

  /** Returns whether or not preloading for context (reality and map tiles) is currently allowed.
   * It is not allowed on mobile devices or if [[TileAdmin.Props.percentGPUMemDisablePreload]] is 0.
   * Otherwise it is always allowed if [[GpuMemoryLimit]] is "none".
   * Otherwise it is only allowed if current GPU memory utilization is less than [[TileAdmin.Props.percentGPUMemDisablePreload]] of GpuMemoryLimit.
   * @internal
   */
  public get isPreloadingAllowed(): boolean {
    return !this._isMobile && this.percentGPUMemDisablePreload > 0 && (this._maxTotalTileContentBytes === undefined || this._lruList.totalBytesUsed / this._maxTotalTileContentBytes * 100 < this.percentGPUMemDisablePreload);
  }

  /** Invoked from the [[ToolAdmin]] event loop to process any pending or active requests for tiles.
   * @internal
   */
  public process(): void {
    this.processQueue();

    // Prune expired tiles and purge expired tile trees. This may free up some memory.
    this.pruneAndPurge();

    // Free up any additional memory as required to keep within our limit.
    this.freeMemory();
  }

  /** Iterate over the tiles that have content loaded but are not in use by any [[TileUser]].
   * @alpha
   */
  public get unselectedLoadedTiles(): Iterable<Tile> {
    return this._lruList.unselectedTiles;
  }

  /** Iterate over the tiles that have content loaded and are in use by any [[TileUser]].
   * @alpha
   */
  public get selectedLoadedTiles(): Iterable<Tile> {
    return this._lruList.selectedTiles;
  }

  /** Returns the number of pending and active requests associated with the specified viewport. */
  public getNumRequestsForViewport(vp: Viewport): number {
    return this.getNumRequestsForUser(vp);
  }

  /** Returns the number of pending and active requests associated with the specified user. */
  public getNumRequestsForUser(user: TileUser): number {
    const requests = this.getRequestsForUser(user);
    let count = requests?.size ?? 0;
    const tiles = this.getTilesForUser(user);
    if (tiles)
      count += tiles.external.requested;

    return count;
  }

  /** Returns the current set of Tiles requested by the specified TileUser.
   * Do not modify the set or the Tiles.
   * @internal
   */
  public getRequestsForUser(user: TileUser): Set<Tile> | undefined {
    return this._requestsPerUser.get(user);
  }

  /** Specifies the set of tiles currently requested for use by a TileUser. This set replaces any previously specified for the same user.
   * The requests are not actually processed until the next call to [[TileAdmin.process].
   * This is typically invoked when a viewport recreates its scene, e.g. in response to camera movement.
   * @internal
   */
  public requestTiles(user: TileUser, tiles: Set<Tile>): void {
    this._requestsPerUser.set(user, tiles);
  }

  /** Returns two sets of tiles associated with the specified user - typically, a viewport's current scene.
   * Do not modify the returned sets.
   * @internal
   */
  public getTilesForUser(user: TileUser): SelectedAndReadyTiles | undefined {
    return this._selectedAndReady.get(user);
  }

  /** Adds the specified tiles to the sets of selected and ready tiles for the specified TileUser.
   * The TileAdmin takes ownership of the `ready` set - do not modify it after passing it in.
   * @internal
   */
  public addTilesForUser(user: TileUser, selected: Tile[], ready: Set<Tile>, touched: Set<Tile>): void {
    // "selected" are tiles we are drawing.
    this._lruList.markUsed(user.tileUserId, selected);
    // "ready" are tiles we want to draw but can't yet because, for example, their siblings are not yet ready to be drawn.
    this._lruList.markUsed(user.tileUserId, ready);
    // "touched" are tiles whose contents we want to keep in memory regardless of whether they are "selected" or "ready".
    this._lruList.markUsed(user.tileUserId, touched);

    const entry = this.getTilesForUser(user);
    if (undefined === entry) {
      this._selectedAndReady.set(user, { ready, selected: new Set<Tile>(selected), external: { selected: 0, requested: 0, ready: 0 } });
      return;
    }

    for (const tile of selected)
      entry.selected.add(tile);

    for (const tile of ready)
      entry.ready.add(tile);
  }

  /** Disclose statistics about tiles that are handled externally from TileAdmin. At this time, that means OrbitGT point cloud tiles.
   * These statistics are included in the return value of [[getTilesForUser]].
   * @internal
   */
  public addExternalTilesForUser(user: TileUser, statistics: ExternalTileStatistics): void {
    const entry = this.getTilesForUser(user);
    if (!entry) {
      this._selectedAndReady.set(user, { ready: new Set<Tile>(), selected: new Set<Tile>(), external: { ...statistics } });
      return;
    }

    entry.external.requested += statistics.requested;
    entry.external.selected += statistics.selected;
    entry.external.ready += statistics.ready;
  }

  /** Clears the sets of tiles associated with a TileUser. */
  public clearTilesForUser(user: TileUser): void {
    this._selectedAndReady.delete(user);
    this._lruList.clearUsed(user.tileUserId);
  }

  /** Indicates that the TileAdmin should cease tracking the specified TileUser, e.g. because it is about to be destroyed.
   * Any requests which are of interest only to the specified user will be canceled.
   */
  public forgetUser(user: TileUser): void {
    this.onUserIModelClosed(user);
    this._users.delete(user);
  }

  /** Indicates that the TileAdmin should track tile requests for the specified TileUser.
   * This is invoked by the Viewport constructor and should be invoked manually for any non-Viewport TileUser.
   * [[forgetUser]] must be later invoked to unregister the user.
   */
  public registerUser(user: TileUser): void {
    this._users.add(user);
  }

  /** Iterable over all TileUsers registered with TileAdmin. This may include [[OffScreenViewport]]s.
   * @alpha
   */
  public get tileUsers(): Iterable<TileUser> {
    return this._users;
  }

  /** @internal */
  public invalidateAllScenes() {
    for (const user of this.tileUsers)
      if (user instanceof Viewport)
        user.invalidateScene();
  }

  /** @internal */
  public onShutDown(): void {
    if (this._cleanup) {
      this._cleanup();
      this._cleanup = undefined;
    }

    this._removeIModelConnectionOnCloseListener();
    this.channels.onShutDown();

    for (const req of this._tileTreePropsRequests)
      req.abandon();

    this._requestsPerUser.clear();
    this._tileUserSetsForRequests.clear();
    this._tileUsagePerUser.clear();
    this._tileTreePropsRequests.length = 0;
    this._lruList.dispose();
  }

  /** Returns the union of the input set and the input TileUser, to be associated with a [[TileRequest]].
   * @internal
   */
  public getTileUserSetForRequest(user: TileUser, users?: ReadonlyTileUserSet): ReadonlyTileUserSet {
    return this._tileUserSetsForRequests.getTileUserSet(user, users);
  }

  /** Marks the Tile as "in use" by the specified TileUser, where the tile defines what "in use" means.
   * A tile will not be discarded while it is in use by any TileUser.
   * @see [[TileTree.prune]]
   * @internal
   */
  public markTileUsed(marker: TileUsageMarker, user: TileUser): void {
    let set = this._tileUsagePerUser.get(user);
    if (!set)
      this._tileUsagePerUser.set(user, set = new Set<TileUsageMarker>());

    set.add(marker);
  }

  /** Returns true if the Tile is currently in use by any TileUser.
   * @see [[markTileUsed]].
   * @internal
   */
  public isTileInUse(marker: TileUsageMarker): boolean {
    for (const [_user, markers] of this._tileUsagePerUser)
      if (markers.has(marker))
        return true;

    return false;
  }

  /** Indicates that the TileAdmin should reset usage tracking for the specified TileUser, e.g. because the user is a Viewport about
   * to recreate its scene. Any tiles currently marked as "in use" by this user no longer will be.
   * @internal
   */
  public clearUsageForUser(user: TileUser): void {
    this._tileUsagePerUser.delete(user);
  }

  /** @internal */
  public async requestTileTreeProps(iModel: IModelConnection, treeId: string): Promise<IModelTileTreeProps> {
    this.initializeRpc();
    const requests = this._tileTreePropsRequests;
    return new Promise<IModelTileTreeProps>((resolve, reject) => {
      const request = new TileTreePropsRequest(iModel, treeId, resolve, reject);
      requests.push(request);
      if (this._tileTreePropsRequests.length <= this._maxActiveTileTreePropsRequests)
        request.dispatch();
    });
  }

  /** Temporary workaround for authoring applications. Usage:
   * ```ts
   *  async function handleModelChanged(modelId: Id64String, iModel: IModelConnection): Promise<void> {
   *    await iModel.tiles.purgeTileTrees([modelId]);
   *    IModelApp.viewManager.refreshForModifiedModels(modelId);
   *  }
   * ```
   * @internal
   */
  public async purgeTileTrees(iModel: IModelConnection, modelIds: Id64Array | undefined): Promise<void> {
    this.initializeRpc();
    return IModelTileRpcInterface.getClient().purgeTileTrees(iModel.getRpcProps(), modelIds);
  }

  /** @internal */
  public async requestCachedTileContent(tile: { iModelTree: IModelTileTree, contentId: string }): Promise<Uint8Array | undefined> {
    if (tile.iModelTree.iModel.iModelId === undefined)
      throw new Error("Provided iModel has no iModelId");

    const { guid, tokenProps, treeId } = this.getTileRequestProps(tile);
    const content = await (await this.getTileStorage()).downloadTile(tokenProps, tile.iModelTree.iModel.iModelId, tile.iModelTree.iModel.changeset.id, treeId, tile.contentId, guid);
    return content;
  }

  /** @internal */
  public async generateTileContent(tile: { iModelTree: IModelTileTree, contentId: string, request?: { isCanceled: boolean } }): Promise<Uint8Array> {
    this.initializeRpc();
    const props = this.getTileRequestProps(tile);
    const retrieveMethod = await IModelTileRpcInterface.getClient().generateTileContent(props.tokenProps, props.treeId, props.contentId, props.guid);
    if (tile.request?.isCanceled) {
      // the content is no longer needed, return an empty array.
      return new Uint8Array();
    }

    if (retrieveMethod === TileContentSource.ExternalCache) {
      const tileContent = await this.requestCachedTileContent(tile);
      if (tileContent === undefined)
        throw new IModelError(IModelStatus.NoContent, "Failed to fetch generated tile from external cache");
      return tileContent;
    } else if (retrieveMethod === TileContentSource.Backend) {
      return IModelTileRpcInterface.getClient().retrieveTileContent(props.tokenProps, this.getTileRequestProps(tile));
    }
    throw new BackendError(BentleyStatus.ERROR, "", "Invalid response from RPC backend");
  }

  /** @internal */
  public getTileRequestProps(tile: { iModelTree: IModelTileTree, contentId: string }) {
    const tree = tile.iModelTree;
    const tokenProps = tree.iModel.getRpcProps();
    let guid = tree.geometryGuid || tokenProps.changeset?.id || "first";
    if (tree.contentIdQualifier)
      guid = `${guid}_${tree.contentIdQualifier}`;

    const contentId = tile.contentId;
    const treeId = tree.id;
    return { tokenProps, treeId, contentId, guid };
  }

  /** Request graphics for a single element or geometry stream.
   * @see [[readElementGraphics]] to convert the result into a [[RenderGraphic]] for display.
   * @public
   */
  public async requestElementGraphics(iModel: IModelConnection, requestProps: ElementGraphicsRequestProps): Promise<Uint8Array | undefined> {
    if (true !== requestProps.omitEdges && undefined === requestProps.edgeType)
      requestProps = { ...requestProps, edgeType: "non-indexed" !== this.edgeOptions.type ? 2 : 1 };

    // For backwards compatibility, these options default to true in the backend. Explicitly set them to false in (newer) frontends if not supplied.
    if (undefined === requestProps.quantizePositions || undefined === requestProps.useAbsolutePositions) {
      requestProps = {
        ...requestProps,
        quantizePositions: requestProps.quantizePositions ?? false,
        useAbsolutePositions: requestProps.useAbsolutePositions ?? false,
      };
    }

    this.initializeRpc();
    const intfc = IModelTileRpcInterface.getClient();
    return intfc.requestElementGraphics(iModel.getRpcProps(), requestProps);
  }

  /** Obtain information about the version/format of the tiles supplied by the backend. */
  public async queryVersionInfo(): Promise<Readonly<TileVersionInfo>> {
    if (!this._versionInfo) {
      this.initializeRpc();
      this._versionInfo = await IModelTileRpcInterface.getClient().queryVersionInfo();
    }

    return this._versionInfo;
  }

  /** @internal */
  public onTilesElided(numElided: number) {
    this._totalElided += numElided;
  }

  /** Invoked when a Tile marks itself as "ready" - i.e., its content is loaded (or determined not to exist, or not to be needed).
   * If the tile has content, it is added to the LRU list of tiles with content.
   * The `onTileLoad` event will also be raised.
   * @internal
   */
  public onTileContentLoaded(tile: Tile): void {
    // It may already be present if it previously had content - perhaps we're replacing its content.
    this._lruList.drop(tile);
    this._lruList.add(tile);
    this.onTileLoad.raiseEvent(tile);
  }

  /** Invoked when a Tile's content is disposed of. It will be removed from the LRU list of tiles with content.
   * @internal
   */
  public onTileContentDisposed(tile: Tile): void {
    this._lruList.drop(tile);
  }

  /** @internal */
  public terminateTileTreePropsRequest(request: TileTreePropsRequest): void {
    const index = this._tileTreePropsRequests.indexOf(request);
    if (index >= 0) {
      this._tileTreePropsRequests.splice(index, 1);
      this.dispatchTileTreePropsRequests();
    }
  }

  /** Event raised when a request to load a tile's content completes. */
  public readonly onTileLoad = new BeEvent<(tile: Tile) => void>();

  /** Event raised when a request to load a tile tree completes. */
  public readonly onTileTreeLoad = new BeEvent<(tileTree: TileTreeOwner) => void>();

  /** Event raised when a request to load a tile's child tiles completes. */
  public readonly onTileChildrenLoad = new BeEvent<(parentTile: Tile) => void>();

  /** Subscribe to [[onTileLoad]], [[onTileTreeLoad]], and [[onTileChildrenLoad]]. */
  public addLoadListener(callback: (imodel: IModelConnection) => void): () => void {
    const tileLoad = this.onTileLoad.addListener((tile) => callback(tile.tree.iModel));
    const treeLoad = this.onTileTreeLoad.addListener((tree) => callback(tree.iModel));
    const childLoad = this.onTileChildrenLoad.addListener((tile) => callback(tile.tree.iModel));
    return () => {
      tileLoad();
      treeLoad();
      childLoad();
    };
  }

  /** Determine what information about the schedule script is needed to produce tiles.
   * If no script, or the script doesn't require batching, then no information is needed - normal tiles can be used.
   * If possible and enabled, normal tiles can be requested and then processed on the frontend based on the ModelTimeline.
   * Otherwise, special tiles must be requested based on the script's sourceId (RenderTimeline or DisplayStyle element).
   * @internal
   */
  public getScriptInfoForTreeId(modelId: Id64String, script: RenderSchedule.ScriptReference | undefined): { timeline?: RenderSchedule.ModelTimeline, animationId?: Id64String } | undefined {
    if (!script || !script.script.requiresBatching)
      return undefined;

    const timeline = script.script.modelTimelines.find((x) => x.modelId === modelId);
    if (!timeline || (!timeline.requiresBatching && !timeline.containsTransform))
      return undefined;

    // Frontend schedule scripts require the element Ids to be included in the script - previously saved views may have omitted them.
    if (!Id64.isValidId64(script.sourceId) || (this.enableFrontendScheduleScripts && !timeline.omitsElementIds))
      return { timeline };

    return { animationId: script.sourceId };
  }

  private dispatchTileTreePropsRequests(): void {
    for (let i = 0; i < this._maxActiveTileTreePropsRequests && i < this._tileTreePropsRequests.length; i++)
      this._tileTreePropsRequests[i].dispatch();
  }

  private processQueue(): void {
    // Mark all requests as being associated with no users, indicating they are no longer needed.
    this._tileUserSetsForRequests.clearAll();

    // Notify channels that we are enqueuing new requests.
    this.channels.swapPending();

    // Repopulate pending requests queue from each user. We do NOT sort by priority while doing so.
    this._requestsPerUser.forEach((value, key) => this.processRequests(key, value));

    // Ask channels to update their queues and dispatch requests.
    this.channels.process();
  }

  /** Exported strictly for tests. @internal */
  public freeMemory(): void {
    if (undefined !== this._maxTotalTileContentBytes)
      this._lruList.freeMemory(this._maxTotalTileContentBytes);
  }

  private pruneAndPurge(): void {
    const now = BeTimePoint.now();
    const needPrune = this._nextPruneTime.before(now);
    const needPurge = this._nextPurgeTime.before(now);
    if (!needPrune && !needPurge)
      return;

    // Identify all of the TileTrees in use by all of the TileUsers known to the TileAdmin.
    // NOTE: A single viewport can display tiles from more than one IModelConnection.
    // NOTE: A viewport may be displaying no trees - but we need to record its IModel so we can purge those which are NOT being displayed
    //  NOTE: That won't catch external tile trees previously used by that viewport.
    const trees = new DisclosedTileTreeSet();
    const treesByIModel = needPurge ? new Map<IModelConnection, Set<TileTree>>() : undefined;
    for (const user of this._users) {
      if (!user.iModel.isOpen) // case of closing an IModelConnection while keeping the Viewport open, possibly for reuse with a different IModelConnection.
        continue;

      user.discloseTileTrees(trees);
      if (treesByIModel && undefined === treesByIModel.get(user.iModel))
        treesByIModel.set(user.iModel, new Set<TileTree>());
    }

    if (needPrune) {
      // Request that each displayed tile tree discard any tiles and/or tile content that is no longer needed.
      for (const tree of trees)
        tree.prune();

      this._nextPruneTime = now.plus(this.tileExpirationTime);
    }

    if (treesByIModel) {
      for (const tree of trees) {
        let set = treesByIModel.get(tree.iModel);
        if (undefined === set)
          treesByIModel.set(tree.iModel, set = new Set<TileTree>());

        set.add(tree);
      }

      // Discard any tile trees that are no longer in use by any user.
      const olderThan = now.minus(this.tileTreeExpirationTime);
      for (const entry of treesByIModel)
        entry[0].tiles.purge(olderThan, entry[1]);

      this._nextPurgeTime = now.plus(this.tileTreeExpirationTime);
    }
  }

  private processRequests(user: TileUser, tiles: Set<Tile>): void {
    for (const tile of tiles) {
      if (undefined === tile.request) {
        // ###TODO: This assertion triggers for AttachmentViewports used for rendering 3d sheet attachments.
        // Determine why and fix.
        // assert(tile.loadStatus === Tile.LoadStatus.NotLoaded);
        if (TileLoadStatus.NotLoaded === tile.loadStatus) {
          const request = new TileRequest(tile, user);
          tile.request = request;
          assert(this.channels.has(request.channel));
          request.channel.append(request);
        }
      } else {
        const req = tile.request;
        assert(undefined !== req);
        if (undefined !== req) {
          // Request may already be dispatched (in channel's active requests) - if so do not re-enqueue!
          if (req.isQueued && 0 === req.users.length)
            req.channel.append(req);

          req.addUser(user);
          assert(0 < req.users.length);
        }
      }
    }
  }

  // NB: This does *not* remove from this._users - a viewport could later be reused with a different IModelConnection.
  private onUserIModelClosed(user: TileUser): void {
    this.clearUsageForUser(user);
    this.clearTilesForUser(user);

    // NB: user will be removed from TileUserSets in process() - but if we can establish that only this user wants a given tile, cancel its request immediately.
    const tiles = this._requestsPerUser.get(user);
    if (undefined !== tiles) {
      for (const tile of tiles) {
        const request = tile.request;
        if (undefined !== request && 1 === request.users.length)
          request.cancel();
      }

      this._requestsPerUser.delete(user);
    }
  }

  private onIModelClosed(iModel: IModelConnection): void {
    this._requestsPerUser.forEach((_req, user) => {
      if (user.iModel === iModel)
        this.onUserIModelClosed(user);
    });

    // Remove any TileTreeProps requests associated with this iModel.
    this._tileTreePropsRequests = this._tileTreePropsRequests.filter((req) => {
      if (req.iModel !== iModel)
        return true;

      req.abandon();
      return false;
    });

    // Dispatch TileTreeProps requests not associated with this iModel.
    this.dispatchTileTreePropsRequests();

    this.channels.onIModelClosed(iModel);
  }

  private initializeRpc(): void {
    // Would prefer to do this in constructor - but nothing enforces that the app initializes the rpc interfaces before it creates the TileAdmin (via IModelApp.startup()) - so do it on first request instead.
    if (this._rpcInitialized)
      return;

    this._rpcInitialized = true;
    const retryInterval = this._retryInterval;
    RpcOperation.lookup(IModelTileRpcInterface, "requestTileTreeProps").policy.retryInterval = () => retryInterval;

    const policy = RpcOperation.lookup(IModelTileRpcInterface, "generateTileContent").policy;
    policy.retryInterval = () => retryInterval;
    policy.allowResponseCaching = () => RpcResponseCacheControl.Immutable;
  }
}

/** @public */
export namespace TileAdmin {
  /** Statistics regarding the current and cumulative state of the [[TileAdmin]]. Useful for monitoring performance and diagnosing problems.
   * @public
   */
  export interface Statistics {
    /** The number of requests in the queue which have not yet been dispatched. */
    numPendingRequests: number;
    /** The number of requests which have been dispatched but not yet completed. */
    numActiveRequests: number;
    /** The number of requests canceled during the most recent update. */
    numCanceled: number;
    /** The total number of completed requests during this session. */
    totalCompletedRequests: number;
    /** The total number of failed requests during this session. */
    totalFailedRequests: number;
    /** The total number of timed-out requests during this session. */
    totalTimedOutRequests: number;
    /** The total number of completed requests during this session which produced an empty tile. These tiles also contribute to totalCompletedRequests, but not to totalUndisplayableTiles. */
    totalEmptyTiles: number;
    /** The total number of completed requests during this session which produced an undisplayable tile. These tiles also contribute to totalCompletedRequests, but not to totalEmptyTiles. */
    totalUndisplayableTiles: number;
    /** The total number of tiles whose contents were not requested during this session because their volumes were determined to be empty. */
    totalElidedTiles: number;
    /** The total number of tiles whose contents were not found in cloud storage cache and therefore resulted in a backend request to generate the tile content. */
    totalCacheMisses: number;
    /** The total number of tiles for which content requests were dispatched. */
    totalDispatchedRequests: number;
    /** The total number of tiles for which content requests were dispatched and then canceled on the backend before completion. */
    totalAbortedRequests: number;
    /** The number of in-flight IModelTileTreeProps requests. */
    numActiveTileTreePropsRequests: number;
    /** The number of pending IModelTileTreeProps requests. */
    numPendingTileTreePropsRequests: number;
    /** See [[TileContentDecodingStatistics]].
     * @beta
     */
    decoding: TileContentDecodingStatistics;
  }

  /** Describes the configuration of the [[TileAdmin]].
   * @see [[TileAdmin.create]] to specify the configuration at [[IModelApp.startup]] time.
   * @note Many of these settings serve as "feature gates" introduced alongside new, potentially experimental features.
   * Over time, as a feature is tested and proven, their relevance wanes, and the feature becomes enabled by default.
   * Such properties should be flagged as `beta` and removed or rendered non-operational once the feature itself is considered
   * stable.
   * @public
   */
  export interface Props {
    /**
     * The client side storage implementation of @itwin/object-storage-core to use for retrieving tiles from tile cache.
     *
     * Defaults to AzureFrontendStorage
     * @beta
     */
    tileStorage?: FrontendStorage;

    /** The maximum number of simultaneously active requests for IModelTileTreeProps. Requests are fulfilled in FIFO order.
     *
     * Default value: 10
     * @alpha
     */
    maxActiveTileTreePropsRequests?: number;

    /** A default multiplier applied to the size in pixels of a [[Tile]] during tile selection for any [[Viewport]].
     * Individual Viewports can override this multiplier if desired.
     * A value greater than 1.0 causes lower-resolution tiles to be selected; a value < 1.0 selects higher-resolution tiles.
     * This value must be greater than zero.
     * This can allow an application to sacrifice quality for performance or vice-versa.
     *
     * Default value: 1.0
     */
    defaultTileSizeModifier?: number;

    /** If true, tiles may represent repeated geometry as sets of instances. This can reduce tile size and tile generation time, and improve performance.
     *
     * Default value: true
     */
    enableInstancing?: boolean;

    /** If true - and WebGL 2 is supported by the [[RenderSystem]] - when tiles containing edges are requested, request that they produce
     * indexed edges to reduce tile size and GPU memory consumption.
     *
     * Default value: true
     */
    enableIndexedEdges?: boolean;

    /** If true then if a [Polyface]($geometry) lacks edge visibility information, the display system will display the edges of all of its faces.
     * Otherwise, the display system will attempt to infer the visibility of each interior edge based on the angle between the two adjacent faces.
     * Edge inference can produce less visually useful results.
     *
     * Default value: true
     * @beta
     */
    generateAllPolyfaceEdges?: boolean;

    /** If true, during tile generation the backend will perform tighter intersection tests to more accurately identify empty sub-volumes.
     * This can reduce the number of tiles requested and the number of tile requests that return no content.
     *
     * Default value: true
     */
    enableImprovedElision?: boolean;

    /** If true, during tile generation the backend will omit geometry for area patterns. This can help reduce the amount of memory consumed by the backend and the amount
     * of geometry sent to the frontend.
     *
     * Default value: false
     * @public
     */
    ignoreAreaPatterns?: boolean;

    /** If true, during tile generation the backend will not embed all texture image data in the tile content. If texture image data is considered large enough by the backend, it will not be embedded in the tile content and the frontend will request that element texture data separately from the backend. This can help reduce the amount of memory consumed by the frontend and the amount of data sent to the frontend. Also, if this is enabled, requested textures that exceed the maximum texture size supported by the client will be downsampled.
     *
     * Default value: true
     */
    enableExternalTextures?: boolean;

    /** The interval in milliseconds at which a request for tile content will be retried until a response is received.
     *
     * Default value: 1000 (1 second)
     * @public
     */
    retryInterval?: number;

    /** If defined, specifies the maximum MAJOR tile format version to request. For example, if CurrentImdlVersion.Major = 3, and maximumMajorTileFormatVersion = 2,
     * requests for tile content will obtain tile content in some version 2.x of the format, never of some version 3.x.
     * Note that the actual maximum major version is also dependent on the backend which fulfills the requests - if the backend only knows how to produce tiles of format version 1.5, for example,
     * requests for tiles in format version 2.1 will still return content in format version 1.5.
     * This can be used to feature-gate newer tile formats on a per-user basis.
     *
     * Default value: undefined
     * @internal
     */
    maximumMajorTileFormatVersion?: number;

    /** When computing the range of a spatial tile tree we can use either the range of the model, or the project extents. If the model range is small relative to the
     * project extents, the "low-resolution" tiles will be much higher-resolution than is appropriate when the view is fit to the project extents. This can cause poor
     * framerate due to too much tiny geometry. Setting this option to `true` will use the project extents for the tile tree range; `false` will use the model range.
     *
     * Default value: true
     *
     * @internal
     */
    useProjectExtents?: boolean;

    /** @internal See TreeFlags.ExpandProjectExtents. Default: true. */
    expandProjectExtents?: boolean;

    /** When producing facets from BRep entities, use an optimized pipeline to improve performance.
     * Default value: true
     * @internal
     */
    optimizeBRepProcessing?: boolean;

    /** Produce tiles that are larger in screen pixels to reduce the number of tiles requested and drawn by the scene.
     * Default value: true
     * @public
     */
    useLargerTiles?: boolean;

    /** Specifies that metadata about each [[IModelTile]] loaded during the session should be cached until the corresponding [[IModelConnection]] is closed; and
     * that the graphics for cached tiles should never be reloaded when the tile is re-requested after having been discarded. This fulfills a niche scenario in
     * which the application does not care about displaying the graphics, only about ensuring the tile content is generated and uploaded to blob storage.
     * @internal
     */
    cacheTileMetadata?: boolean;

    /** The minimum number of seconds to keep a Tile in memory after it has become unused.
     * Each tile has an expiration timer. Each time tiles are selected for drawing in a view, if we decide to draw a tile we reset its expiration timer.
     * Otherwise, if its expiration timer has exceeded this minimum, we discard it along with all of its children. This allows us to free up memory for other tiles.
     * If we later want to draw the same tile, we must re-request it (typically from some cache).
     * Setting this value too small will cause excessive tile requests. Setting it too high will cause excessive memory consumption.
     *
     * Default value: 20 seconds.
     * Minimum value: 5 seconds.
     * Maximum value: 60 seconds.
     */
    tileExpirationTime?: number;

    /** The minimum number of seconds to keep a TileTree in memory after it has become disused.
     * Each time a TileTree is drawn, we record the current time as its most-recently-used time.
     * Periodically we traverse all TileTrees in the system. Any which have not been used within this specified number of seconds will be discarded, freeing up memory.
     *
     * @note This is separate from [[tileExpirationTime]], which is applied to individual Tiles each time the TileTree *is* drawn.
     *
     * Default value: 300 seconds (5 minutes).
     * Minimum value: 10 seconds.
     * Maximum value: 3600 seconds (1 hour).
     *
     * @public
     */
    tileTreeExpirationTime?: number;

    /** Defines optional limits on the total amount of GPU memory allocated to [[Tile]] contents.
     * If an instance of [[GpuMemoryLimits]], defines separate limits for mobile and non-mobile devices; otherwise, defines the limit for whatever
     * type of device the client is running on.
     *
     * Default value: `{ "mobile": "default" }`.
     *
     * @see [[GpuMemoryLimit]] for a description of the available limits and how they are imposed.
     */
    gpuMemoryLimits?: GpuMemoryLimit | GpuMemoryLimits;

    /** Nominally the error on screen size of a reality tile. The minimum value of 1.0 will apply a direct 1:1 scale.
     * A ratio higher than 1.0 will result in lower quality display as the reality tile refinement becomes more coarse.
     *
     * @note This value only has an effect on mobile devices. On non-mobile devices, this ratio will always internally be 1.0 and any setting here will be ignored.
     *
     * Default value: 3.0
     * Minimum value: 1.0
     *
     * @public
     */
    mobileRealityTileMinToleranceRatio?: number;

    /** Used strictly for tests to circumvent the minimum expiration times.
     * This allows tests to reduce the expiration times below their stated minimums so that tests execute more quickly.
     * @internal
     */
    ignoreMinimumExpirationTimes?: boolean;

    /** When producing child tiles for a given tile, two refinement strategies are considered:
     *  - Subdivision: typical oct- or quad-tree subdivision into 8 or 4 smaller child tiles; and
     *  - Magnification: production of a single child tile of the same size as the parent but with twice the level of detail
     * The magnification strategy can in some cases produce extremely large, detailed tiles, because the heuristic which decides which strategy to use considers that if
     * a tile contains fewer than some "small" number of elements, it is not worth subdividing, and instead chooses magnification - but element sizes vary **wildly**.
     *
     * If this option is defined and true, the magnification strategy will never be chosen.
     *
     * Default value: false
     * @alpha
     */
    disableMagnification?: boolean;

    /** The Percentage of GPU memory utilization at which to disable preloading for context (reality and map tiles).
     * While GPU memory usage is at or above this percentage of the limit, preloading will be disabled.
     * A setting of 0 will disable preloading altogether.
     * If GpuMemoryLimit is "none", then a setting of anything above 0 is ignored.
     * Mobile devices do not allow preloading and will ignore this setting.
     *
     * Default value: 80
     * Minimum value 0.
     * Maximum value 80.
     * @alpha
     */
    percentGPUMemDisablePreload?: number;

    /** Preloading parents for context (reality and map tiles) will improve the user experience by making it more likely that tiles in nearly the required resolution will be
     * already loaded as the view is manipulated.  This value controls the depth above the the selected tile depth that will be preloaded. The default
     * value (2) with default contextPreloadParentDepth of one will load only grandparents and great grandparents. This generally preloads around 20% more tiles than are required.
     * Default value: 2.
     * Minimum value 0.
     * Maximum value 8.
     * @alpha
     */
    contextPreloadParentDepth?: number;

    /** Preloading parents for context (reality and map tiles) will improve the user experience by making it more likely that tiles in nearly the required resolution will be
     * already loaded as the view is manipulated.  This value controls the number of parents that are skipped before parents are preloaded. The default value of 1 will skip
     * immediate parents and significantly reduce the number of preloaded tiles without significant reducing the value of preloading.
     * Default value: 1;
     * Minimum value: 0.
     * Maximum value: 5.
     * @alpha
     */
    contextPreloadParentSkip?: number;

    /** For iModel tile trees, the maximum number of levels of the tree to skip loading when selecting tiles.
     * When selecting tiles, if a given tile is too coarse to display and its graphics have not yet been loaded, we can skip loading its graphics and instead try to select one or more of its children
     * - *until* we have skipped the specified maximum number of levels of the tree, at which point we will load the coarse tile's graphics before evaluating its children for selection.
     * Increasing this value can reduce the amount of time before all tiles are ready when opening a zoomed-in view, but can also increase the number of tiles requested.
     * Default value: 1
     * Minimum value: 0
     * @alpha
     */
    maximumLevelsToSkip?: number;

    /** If true, when requesting tile content, edges will always be requested, even if they are not required for the view.
     * This can improve user experience in cases in which the user or application is expected to frequently switch between views of the same models with
     * different edge settings, because otherwise, toggling edge display may require loading completely new tiles.
     * However, edges require additional memory and bandwidth that may be wasted if they are never displayed.
     * Default value: false
     * @public
     */
    alwaysRequestEdges?: boolean;

    /** If true, when choosing whether to sub-divide or magnify a tile for refinement, the tile will always be sub-divided if any geometry was omitted from it.
     * Default value: false
     * @internal
     */
    alwaysSubdivideIncompleteTiles?: boolean;

    /** If defined and greater than zero, specifies the minimum chord tolerance in meters of a tile. A tile with chord tolerance less than this minimum will not be refined.
     * Applies only to spatial models, which model real-world assets on real-world scales.
     * A reasonable value is on the order of millimeters.
     * Default value: 0.001 (1 millimeter).
     * @public
     */
    minimumSpatialTolerance?: number;

    /** An API key that can be used to access content from [Cesium ION](https://cesium.com/platform/cesium-ion/) like terrain meshes and OpenStreetMap Buildings meshes.
     * If a valid key is not supplied, such content can neither be obtained nor displayed.
     * @public
     */
    cesiumIonKey?: string;

    /** If true, when applying a schedule script to a view, ordinary tiles will be requested and then reprocessed on the frontend to align with the script's
     * animation nodes. This permits the use of schedule scripts not stored in the iModel and improves utilization of the tile cache for animated views.
     * If false, the schedule script must be stored in the iModel and special tiles must be requested from the backend to align with the script's animation nodes.
     * Default value: false.
     * @public
     */
    enableFrontendScheduleScripts?: boolean;

    /** If true, contents of tiles in iMdl format will be decoded in a web worker to avoid blocking the main (UI) thread.
     * Default value: true
     * @alpha This was primarily introduced because the electron version of certa does not serve local assets, so the tests can't locate the worker script.
     */
    decodeImdlInWorker?: boolean;
  }

  /** The number of bytes of GPU memory associated with the various [[GpuMemoryLimit]]s for non-mobile devices.
   * @see [[TileAdmin.Props.gpuMemoryLimits]] to specify the limit at startup.
   * @see [[TileAdmin.gpuMemoryLimit]] to adjust the actual limit after startup.
   * @see [[TileAdmin.mobileMemoryLimits]] for mobile devices.
   */
  export const nonMobileGpuMemoryLimits = {
    default: 1024 * 1024 * 1024, // 1 GB
    aggressive: 500 * 1024 * 1024, // 500 MB
    relaxed: 2.5 * 1024 * 1024 * 1024, // 2.5 GB
  };

  /** @internal exported for tests */
  export const nonMobileUndefinedGpuMemoryLimit = 6000 * 1024 * 1024; // 6,000 MB - used when nonMobile limit is undefined

  /** The number of bytes of GPU memory associated with the various [[GpuMemoryLimit]]s for mobile devices.
   * @see [[TileAdmin.Props.gpuMemoryLimits]] to specify the limit at startup.
   * @see [[TileAdmin.gpuMemoryLimit]] to adjust the actual limit after startup.
   * @see [[TileAdmin.nonMobileMemoryLimits]] for non-mobile devices.
   */
  export const mobileGpuMemoryLimits = {
    default: 200 * 1024 * 1024, // 200 MB
    aggressive: 75 * 1024 * 1024, // 75 MB
    relaxed: 500 * 1024 * 1024, // 500 MB
  };
}

/** Some views contain thousands of models. When we open such a view, the first thing we do is request the IModelTileTreeProps for each model. This involves a http request per model,
 * which can exceed the maximum number of simultaneous requests permitted by the browser.
 * Similar to how we throttle requests for tile *content*, we throttle requests for IModelTileTreeProps based on `TileAdmin.Props.maxActiveTileTreePropsRequests`, heretofore referred to as `N`.
 * TileAdmin maintains a FIFO queue of requests for IModelTileTreeProps. The first N of those requests have been dispatched; the remainder are waiting for their turn.
 * When `TileAdmin.requestTileTreeProps` is called, it appends a new request to the queue, and if the queue length < N, dispatches it immediately.
 * When a request completes, throws an error, or is canceled, it is removed from the queue, and any not-yet-dispatched requests are dispatched (not exceeding N total in flight).
 * When an IModelConnection is closed, any requests associated with that iModel are canceled.
 * NOTE: This request queue currently does not interact at all with the tile content request queue.
 * NOTE: We rely on TreeOwner to not request the same IModelTileTreeProps multiple times - we do not check the queue for presence of a requested tree before enqeueing it.
 */
class TileTreePropsRequest {
  private _isDispatched = false;

  public constructor(
    public readonly iModel: IModelConnection,
    private readonly _treeId: string,
    private readonly _resolve: (props: IModelTileTreeProps) => void,
    private readonly _reject: (error: Error) => void) {
  }

  public get isDispatched(): boolean { return this._isDispatched; }

  public dispatch(): void {
    if (this.isDispatched)
      return;

    this._isDispatched = true;

    requestTileTreeProps(this.iModel, this._treeId).then((props) => {
      this.terminate();
      this._resolve(props);
    }).catch((err) => {
      this.terminate();
      this._reject(err);
    });
  }

  /** The IModelConnection was closed, or IModelApp was shut down. Don't call terminate(), because we don't want to dispatch pending requests as a result.
   * Just reject if not yet dispatched.
   */
  public abandon(): void {
    if (!this.isDispatched) {
      // A little white lie that tells the TileTreeOwner it can try to load again later if needed, rather than treating rejection as failure to load.
      this._reject(new ServerTimeoutError("requestTileTreeProps cancelled"));
    }
  }

  private terminate(): void {
    IModelApp.tileAdmin.terminateTileTreePropsRequest(this);
  }
}

/** @internal */
export type RequestTileTreePropsFunc = (iModel: IModelConnection, treeId: string) => Promise<IModelTileTreeProps>;

let requestTileTreePropsOverride: RequestTileTreePropsFunc | undefined;

async function requestTileTreeProps(iModel: IModelConnection, treeId: string): Promise<IModelTileTreeProps> {
  if (requestTileTreePropsOverride)
    return requestTileTreePropsOverride(iModel, treeId);

  return IModelTileRpcInterface.getClient().requestTileTreeProps(iModel.getRpcProps(), treeId);
}

/** Strictly for tests - overrides the call to IModelTileRpcInterface.requestTileTreeProps with a custom function, or clears the override.
 * @internal
 */
export function overrideRequestTileTreeProps(func: RequestTileTreePropsFunc | undefined): void {
  requestTileTreePropsOverride = func;
}
