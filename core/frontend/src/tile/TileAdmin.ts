/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module Tiles
 */

import {
  assert, BeDuration, BeEvent, BeTimePoint, Id64Array, Id64String, PriorityQueue, ProcessDetector,
} from "@bentley/bentleyjs-core";
import {
  defaultTileOptions, ElementGraphicsRequestProps, getMaximumMajorTileFormatVersion, IModelTileRpcInterface, IModelTileTreeProps, ModelGeometryChanges,
  RpcOperation, RpcResponseCacheControl, ServerTimeoutError, TileTreeContentIds,
} from "@bentley/imodeljs-common";
import { IModelApp } from "../IModelApp";
import { IModelConnection } from "../IModelConnection";
import { Viewport } from "../Viewport";
import { ReadonlyViewportSet, UniqueViewportSets } from "../ViewportSet";
import { InteractiveEditingSession } from "../InteractiveEditingSession";
import { GeometricModelState } from "../ModelState";
import { DisclosedTileTreeSet, LRUTileList, Tile, TileLoadStatus, TileRequest, TileTree, TileTreeOwner, TileUsageMarker } from "./internal";
import { IpcApp } from "../IpcApp";

/** Details about any tiles not handled by [[TileAdmin]]. At this time, that means OrbitGT point cloud tiles.
 * Used for bookkeeping by SelectedAndReadyTiles
 * @alpha
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
  /** Details about any tiles not handled by [[TileAdmin]]. At this time, that means OrbitGT point cloud tiles and tiles for view attachments.
   * @alpha
   */
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
 * @beta
 */
export type GpuMemoryLimit = "none" | "default" | "aggressive" | "relaxed" | number;

/** Defines separate [[GpuMemoryLimit]]s for mobile and desktop clients.
 * @see [[TileAdmin.Props.gpuMemoryLimits]] to configure the limit at startup.
 * @see [[GpuMemoryLimit]] for a description of how the available limits and how they are imposed.
 * @beta
 */
export interface GpuMemoryLimits {
  /** Limits applied to clients running on mobile devices. Defaults to "default" if undefined. */
  mobile?: GpuMemoryLimit;
  /** Limits applied to clients running on non-mobile devices. Defaults to "none" if undefined. */
  nonMobile?: GpuMemoryLimit;
}

/** Manages [[Tile]]s and [[TileTree]]s on behalf of [[IModelApp]]. Its responsibilities include scheduling requests for tile content via a priority queue;
 * keeping track of and imposing limits upon the amount of GPU memory consumed by tiles; and notifying listeners of tile-related events.
 * @see [[IModelApp.tileAdmin]] to access the instance of the TileAdmin.
 * @see [[TileAdmin.Props]] to configure the TileAdmin at startup.
 * @beta
 */
export class TileAdmin {
  private readonly _viewports = new Set<Viewport>();
  private readonly _requestsPerViewport = new Map<Viewport, Set<Tile>>();
  private readonly _tileUsagePerViewport = new Map<Viewport, Set<TileUsageMarker>>();
  private readonly _selectedAndReady = new Map<Viewport, SelectedAndReadyTiles>();
  private readonly _viewportSetsForRequests = new UniqueViewportSets();
  private _maxActiveRequests: number;
  private readonly _maxActiveTileTreePropsRequests: number;
  private _defaultTileSizeModifier: number;
  private readonly _retryInterval: number;
  private readonly _enableInstancing: boolean;
  private readonly _enableImprovedElision: boolean;
  private readonly _ignoreAreaPatterns: boolean;
  private readonly _enableExternalTextures: boolean;
  private readonly _disableMagnification: boolean;
  private readonly _alwaysRequestEdges: boolean;
  private readonly _alwaysSubdivideIncompleteTiles: boolean;
  private readonly _minimumSpatialTolerance: number;
  private readonly _maxMajorVersion: number;
  private readonly _useProjectExtents: boolean;
  private readonly _maximumLevelsToSkip: number;
  private readonly _mobileRealityTileMinToleranceRatio: number;
  private readonly _removeIModelConnectionOnCloseListener: () => void;
  private _activeRequests = new Set<TileRequest>();
  private _pendingRequests = new Queue();
  private _swapPendingRequests = new Queue();
  private _numCanceled = 0;
  private _totalCompleted = 0;
  private _totalFailed = 0;
  private _totalTimedOut = 0;
  private _totalEmpty = 0;
  private _totalUndisplayable = 0;
  private _totalElided = 0;
  private _totalCacheMisses = 0;
  private _totalDispatchedRequests = 0;
  private _totalAbortedRequests = 0;
  private _rpcInitialized = false;
  private readonly _tileExpirationTime: BeDuration;
  private _nextPruneTime: BeTimePoint;
  private _nextPurgeTime: BeTimePoint;
  private readonly _treeExpirationTime: BeDuration;
  private readonly _contextPreloadParentDepth: number;
  private readonly _contextPreloadParentSkip: number;
  private _canceledIModelTileRequests?: Map<IModelConnection, Map<string, Set<string>>>;
  private _canceledElementGraphicsRequests?: Map<IModelConnection, string[]>;
  private _cancelBackendTileRequests: boolean;
  private _tileTreePropsRequests: TileTreePropsRequest[] = [];
  private _cleanup?: () => void;
  private readonly _lruList = new LRUTileList();
  private _maxTotalTileContentBytes?: number;
  private _gpuMemoryLimit: GpuMemoryLimit = "none";
  private readonly _isMobile: boolean;

  /** Create a TileAdmin suitable for passing to [[IModelApp.startup]] via [[IModelAppOptions.tileAdmin]] to customize aspects of
   * its behavior.
   * @param props Options for customizing the behavior of the TileAdmin.
   * @returns the TileAdmin
   */
  public static create(props?: TileAdmin.Props): TileAdmin {
    return this.createForDeviceType(ProcessDetector.isMobileBrowser ? "mobile" : "non-mobile", props);
  }

  /** Strictly for tests.
   * @internal
   */
  public static createForDeviceType(type: "mobile" | "non-mobile", props?: TileAdmin.Props): TileAdmin {
    return new this("mobile" === type, props);
  }

  /** @internal */
  public get emptyViewportSet(): ReadonlyViewportSet { return UniqueViewportSets.emptySet; }

  /** Returns basic statistics about the TileAdmin's current state. */
  public get statistics(): TileAdmin.Statistics {
    let numActiveTileTreePropsRequests = 0;
    for (const req of this._tileTreePropsRequests) {
      if (!req.isDispatched)
        break;

      ++numActiveTileTreePropsRequests;
    }

    return {
      numPendingRequests: this._pendingRequests.length,
      numActiveRequests: this._activeRequests.size,
      numCanceled: this._numCanceled,
      totalCompletedRequests: this._totalCompleted,
      totalFailedRequests: this._totalFailed,
      totalTimedOutRequests: this._totalTimedOut,
      totalEmptyTiles: this._totalEmpty,
      totalUndisplayableTiles: this._totalUndisplayable,
      totalElidedTiles: this._totalElided,
      totalCacheMisses: this._totalCacheMisses,
      totalDispatchedRequests: this._totalDispatchedRequests,
      totalAbortedRequests: this._totalAbortedRequests,
      numActiveTileTreePropsRequests,
      numPendingTileTreePropsRequests: this._tileTreePropsRequests.length - numActiveTileTreePropsRequests,
    };
  }

  /** Resets the cumulative (per-session) statistics like totalCompletedRequests, totalEmptyTiles, etc. */
  public resetStatistics(): void {
    this._totalCompleted = this._totalFailed = this._totalTimedOut =
      this._totalEmpty = this._totalUndisplayable = this._totalElided =
      this._totalCacheMisses = this._totalDispatchedRequests = this._totalAbortedRequests = 0;
  }

  protected constructor(isMobile: boolean, options?: TileAdmin.Props) {
    this._isMobile = isMobile;
    if (undefined === options)
      options = {};

    this._maxActiveRequests = options.maxActiveRequests ?? 10;
    this._maxActiveTileTreePropsRequests = options.maxActiveTileTreePropsRequests ?? 10;
    this._defaultTileSizeModifier = (undefined !== options.defaultTileSizeModifier && options.defaultTileSizeModifier > 0) ? options.defaultTileSizeModifier : 1.0;
    this._retryInterval = undefined !== options.retryInterval ? options.retryInterval : 1000;
    this._enableInstancing = options.enableInstancing ?? defaultTileOptions.enableInstancing;
    this._enableImprovedElision = options.enableImprovedElision ?? defaultTileOptions.enableImprovedElision;
    this._ignoreAreaPatterns = options.ignoreAreaPatterns ?? defaultTileOptions.ignoreAreaPatterns;
    this._enableExternalTextures = options.enableExternalTextures ?? defaultTileOptions.enableExternalTextures;
    this._disableMagnification = options.disableMagnification ?? defaultTileOptions.disableMagnification;
    this._alwaysRequestEdges = true === options.alwaysRequestEdges;
    this._alwaysSubdivideIncompleteTiles = options.alwaysSubdivideIncompleteTiles ?? defaultTileOptions.alwaysSubdivideIncompleteTiles;
    this._maxMajorVersion = options.maximumMajorTileFormatVersion ?? defaultTileOptions.maximumMajorTileFormatVersion;
    this._useProjectExtents = options.useProjectExtents ?? defaultTileOptions.useProjectExtents;
    this._mobileRealityTileMinToleranceRatio = Math.max(options.mobileRealityTileMinToleranceRatio ?? 3.0, 1.0);

    const gpuMemoryLimits = options.gpuMemoryLimits;
    let gpuMemoryLimit: GpuMemoryLimit | undefined;
    if (typeof gpuMemoryLimits === "object")
      gpuMemoryLimit = isMobile ? gpuMemoryLimits.mobile : gpuMemoryLimits.nonMobile;
    else
      gpuMemoryLimit = gpuMemoryLimits;

    if (undefined === gpuMemoryLimit && isMobile)
      gpuMemoryLimit = "default";

    if (undefined !== gpuMemoryLimit)
      this.gpuMemoryLimit = gpuMemoryLimit;

    if (undefined !== options.maximumLevelsToSkip)
      this._maximumLevelsToSkip = Math.floor(Math.max(0, options.maximumLevelsToSkip));
    else
      this._maximumLevelsToSkip = 1;

    const minSpatialTol = options.minimumSpatialTolerance;
    this._minimumSpatialTolerance = minSpatialTol ? Math.max(minSpatialTol, 0) : 0;

    this._cancelBackendTileRequests = true === options.cancelBackendTileRequests;

    const clamp = (seconds: number, min: number, max: number): BeDuration => {
      seconds = Math.min(seconds, max);
      seconds = Math.max(seconds, min);
      return BeDuration.fromSeconds(seconds);
    };

    const ignoreMinimums = true === options.ignoreMinimumExpirationTimes;
    const minTileTime = ignoreMinimums ? 0.1 : 5;
    const minTreeTime = ignoreMinimums ? 0.1 : 10;

    // If unspecified, tile expiration time defaults to 20 seconds.
    this._tileExpirationTime = clamp((options.tileExpirationTime ?? 20), minTileTime, 60)!;

    // If unspecified, trees never expire (will change this to use a default later).
    this._treeExpirationTime = clamp(options.tileTreeExpirationTime ?? 300, minTreeTime, 3600);

    const now = BeTimePoint.now();
    this._nextPruneTime = now.plus(this._tileExpirationTime);
    this._nextPurgeTime = now.plus(this._treeExpirationTime);

    this._removeIModelConnectionOnCloseListener = IModelConnection.onClose.addListener((iModel) => this.onIModelClosed(iModel));

    // If unspecified preload 2 levels of parents for context tiles.
    this._contextPreloadParentDepth = Math.max(0, Math.min((options.contextPreloadParentDepth === undefined ? 2 : options.contextPreloadParentDepth), 8));
    // If unspecified skip one level before preloading  of parents of context tiles.
    this._contextPreloadParentSkip = Math.max(0, Math.min((options.contextPreloadParentSkip === undefined ? 1 : options.contextPreloadParentSkip), 5));

    const removeEditingListener = InteractiveEditingSession.onBegin.addListener((session) => {
      const removeGeomListener = session.onGeometryChanges.addListener((changes: Iterable<ModelGeometryChanges>) => this.onModelGeometryChanged(changes));
      session.onEnded.addOnce((sesh: InteractiveEditingSession) => {
        assert(sesh === session);
        removeGeomListener();
        this.onSessionEnd(session);
      });
    });

    const removeLoadListener = this.addLoadListener(() => {
      this._viewports.forEach((vp) => vp.invalidateScene());
    });

    this._cleanup = () => {
      removeEditingListener();
      removeLoadListener();
    };
  }

  /** @internal */
  public get enableInstancing() { return this._enableInstancing && IModelApp.renderSystem.supportsInstancing; }
  /** @internal */
  public get enableImprovedElision() { return this._enableImprovedElision; }
  /** @internal */
  public get ignoreAreaPatterns() { return this._ignoreAreaPatterns; }
  /** @internal */
  public get useProjectExtents() { return this._useProjectExtents; }
  /** @internal */
  public get enableExternalTextures(): boolean { return this._enableExternalTextures; }
  /** @internal */
  public get maximumLevelsToSkip() { return this._maximumLevelsToSkip; }
  /** @internal */
  public get mobileRealityTileMinToleranceRatio() { return this._mobileRealityTileMinToleranceRatio; }
  /** @internal */
  public get disableMagnification() { return this._disableMagnification; }
  /** @internal */
  public get alwaysRequestEdges() { return this._alwaysRequestEdges; }
  /** @internal */
  public get alwaysSubdivideIncompleteTiles() { return this._alwaysSubdivideIncompleteTiles; }
  /** @internal */
  public get minimumSpatialTolerance() { return this._minimumSpatialTolerance; }
  /** @internal */
  public get tileExpirationTime() { return this._tileExpirationTime; }
  /** @internal */
  public get tileTreeExpirationTime() { return this._treeExpirationTime; }
  /** @internal */
  public get contextPreloadParentDepth() { return this._contextPreloadParentDepth; }
  /** @internal */
  public get contextPreloadParentSkip() { return this._contextPreloadParentSkip; }
  /** @internal */
  public get maximumMajorTileFormatVersion() { return this._maxMajorVersion; }

  /** Given a numeric combined major+minor tile format version (typically obtained from a request to the backend to query the maximum tile format version it supports),
   * return the maximum *major* format version to be used to request tile content from the backend.
   * @see [[TileAdmin.Props.maximumMajorTileFormatVersion]]
   * @see [[CurrentImdlVersion]]
   */
  public getMaximumMajorTileFormatVersion(formatVersion?: number): number {
    return getMaximumMajorTileFormatVersion(this.maximumMajorTileFormatVersion, formatVersion);
  }

  /** Controls the maximum number of simultaneously-active requests allowed.
   * If the maximum is reduced below the current size of the active set, no active requests will be canceled - but no more will be dispatched until the
   * size of the active set falls below the new maximum.
   * @see [[TileAdmin.Props.maxActiveRequests]]
   * @note Browsers impose their own limitations on maximum number of total connections, and connections per-domain. These limitations are
   * especially strict when using HTTP1.1 instead of HTTP2. Increasing the maximum above the default may significantly affect performance as well as
   * bandwidth and memory consumption.
   */
  public get maxActiveRequests() { return this._maxActiveRequests; }
  public set maxActiveRequests(max: number) {
    if (max > 0)
      this._maxActiveRequests = max;
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
   * @beta
   */
  public get totalTileContentBytes(): number {
    return this._lruList.totalBytesUsed;
  }

  /** The maximum number of bytes of GPU memory that can be allocated to the contents of [[Tile]]s. When this limit is exceeded, the contents of the least-recently-drawn
   * tiles are discarded until the total is below this limit or all undisplayed tiles' contents have been discarded.
   * @see [[totalTileContentBytes]] for the current GPU memory usage.
   * @see [[gpuMemoryLimit]] to adjust this maximum.
   * @beta
   */
  public get maxTotalTileContentBytes(): number | undefined {
    return this._maxTotalTileContentBytes;
  }

  /** The strategy for limiting the amount of GPU memory allocated to [[Tile]] graphics.
   * @see [[TileAdmin.Props.gpuMemoryLimits]] to configure this at startup.
   * @see [[maxTotalTileContentBytes]] for the limit as a maximum number of bytes.
   * @beta
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

  /** Iterate over the tiles that have content loaded but are not selected for display in any viewport.
   * @alpha
   */
  public get unselectedLoadedTiles(): Iterable<Tile> {
    return this._lruList.unselectedTiles;
  }

  /** Iterate over the tiles that have content loaded and are selected for display in any viewport.
   * @alpha
   */
  public get selectedLoadedTiles(): Iterable<Tile> {
    return this._lruList.selectedTiles;
  }

  /** Returns the number of pending and active requests associated with the specified viewport. */
  public getNumRequestsForViewport(vp: Viewport): number {
    const requests = this.getRequestsForViewport(vp);
    let count = requests?.size ?? 0;
    const tiles = this.getTilesForViewport(vp);
    if (tiles)
      count += tiles.external.requested;

    return count;
  }

  /** Returns the current set of Tiles requested by the specified Viewport.
   * Do not modify the set or the Tiles.
   * @internal
   */
  public getRequestsForViewport(vp: Viewport): Set<Tile> | undefined {
    return this._requestsPerViewport.get(vp);
  }

  /** Specifies the set of tiles currently requested for use by a viewport. This set replaces any previously specified for the same viewport.
   * The requests are not actually processed until the next call to [[TileAdmin.process].
   * This is typically invoked when the viewport recreates its scene, e.g. in response to camera movement.
   * @internal
   */
  public requestTiles(vp: Viewport, tiles: Set<Tile>): void {
    this._requestsPerViewport.set(vp, tiles);
  }

  /** Returns two sets of tiles associated with the specified Viewport's current scene.
   * Do not modify the returned sets.
   * @internal
   */
  public getTilesForViewport(vp: Viewport): SelectedAndReadyTiles | undefined {
    return this._selectedAndReady.get(vp);
  }

  /** Adds the specified tiles to the sets of selected and ready tiles for the specified Viewport.
   * The TileAdmin takes ownership of the `ready` set - do not modify it after passing it in.
   * @internal
   */
  public addTilesForViewport(vp: Viewport, selected: Tile[], ready: Set<Tile>): void {
    // "selected" are tiles we are drawing.
    this._lruList.markSelectedForViewport(vp.viewportId, selected);
    // "ready" are tiles we want to draw but can't yet because, for example, their siblings are not yet ready to be drawn.
    this._lruList.markSelectedForViewport(vp.viewportId, ready);

    const entry = this.getTilesForViewport(vp);
    if (undefined === entry) {
      this._selectedAndReady.set(vp, { ready, selected: new Set<Tile>(selected), external: { selected: 0, requested: 0, ready: 0 } });
      return;
    }

    for (const tile of selected)
      entry.selected.add(tile);

    for (const tile of ready)
      entry.ready.add(tile);
  }

  /** Disclose statistics about tiles that are handled externally from TileAdmin. At this time, that means OrbitGT point cloud tiles.
   * These statistics are included in the return value of [[getTilesForViewport]].
   * @internal
   */
  public addExternalTilesForViewport(vp: Viewport, statistics: ExternalTileStatistics): void {
    const entry = this.getTilesForViewport(vp);
    if (!entry) {
      this._selectedAndReady.set(vp, { ready: new Set<Tile>(), selected: new Set<Tile>(), external: { ...statistics } });
      return;
    }

    entry.external.requested += statistics.requested;
    entry.external.selected += statistics.selected;
    entry.external.ready += statistics.ready;
  }

  /** Clears the sets of tiles associated with a viewport's current scene.
   * @internal
   */
  public clearTilesForViewport(vp: Viewport): void {
    this._selectedAndReady.delete(vp);
    this._lruList.clearSelectedForViewport(vp.viewportId);
  }

  /** Indicates that the TileAdmin should cease tracking the specified viewport, e.g. because it is about to be destroyed.
   * Any requests which are of interest only to the specified viewport will be canceled.
   * @internal
   */
  public forgetViewport(vp: Viewport): void {
    this.onViewportIModelClosed(vp);
    this._viewports.delete(vp);
  }

  /** Indicates that the TileAdmin should track tile requests for the specified viewport.
   * This is invoked by the Viewport constructor and should not be invoked from elsewhere.
   * @internal
   */
  public registerViewport(vp: Viewport): void {
    this._viewports.add(vp);
  }

  /** @internal */
  public forEachViewport(func: (vp: Viewport) => void): void {
    for (const vp of this._viewports)
      func(vp);
  }

  /** @internal */
  public invalidateAllScenes() {
    this.forEachViewport((vp) => vp.invalidateScene());
  }

  /** @internal */
  public onShutDown(): void {
    if (this._cleanup) {
      this._cleanup();
      this._cleanup = undefined;
    }

    this._removeIModelConnectionOnCloseListener();

    for (const request of this._activeRequests)
      request.cancel();

    this._activeRequests.clear();

    for (const queued of this._pendingRequests)
      queued.cancel();

    for (const req of this._tileTreePropsRequests)
      req.abandon();

    this._requestsPerViewport.clear();
    this._viewportSetsForRequests.clear();
    this._tileUsagePerViewport.clear();
    this._tileTreePropsRequests.length = 0;
    this._lruList.dispose();
  }

  /** Returns the union of the input set and the input viewport, to be associated with a [[TileRequest]].
   * @internal
   */
  public getViewportSetForRequest(vp: Viewport, vps?: ReadonlyViewportSet): ReadonlyViewportSet {
    return this._viewportSetsForRequests.getViewportSet(vp, vps);
  }

  /** Marks the Tile as "in use" by the specified Viewport, where the tile defines what "in use" means.
   * A tile will not be discarded while it is in use by any Viewport.
   * @see [[TileTree.prune]]
   * @internal
   */
  public markTileUsedByViewport(marker: TileUsageMarker, vp: Viewport): void {
    let set = this._tileUsagePerViewport.get(vp);
    if (!set)
      this._tileUsagePerViewport.set(vp, set = new Set<TileUsageMarker>());

    set.add(marker);
  }

  /** Returns true if the Tile is currently in use by any Viewport.
   * @see [[markTileUsedByViewport]].
   * @internal
   */
  public isTileInUse(marker: TileUsageMarker): boolean {
    // eslint-disable-next-line @typescript-eslint/naming-convention
    for (const [_viewport, markers] of this._tileUsagePerViewport)
      if (markers.has(marker))
        return true;

    return false;
  }

  /** Indicates that the TileAdmin should reset usage tracking for the specified viewport, e.g. because the viewport is about
   * to recreate its scene. Any tiles currently marked as "in use" by this viewport no longer will be.
   * @internal
   */
  public clearUsageForViewport(vp: Viewport): void {
    this._tileUsagePerViewport.delete(vp);
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
  public async requestTileContent(iModel: IModelConnection, treeId: string, contentId: string, isCanceled: () => boolean, guid: string | undefined, qualifier: string | undefined): Promise<Uint8Array> {
    this.initializeRpc();

    const iModelRpcProps = iModel.getRpcProps();

    if (!guid)
      guid = iModelRpcProps.changeSetId || "first";

    if (qualifier)
      guid = `${guid}_${qualifier}`;

    const intfc = IModelTileRpcInterface.getClient();
    return intfc.requestTileContent(iModelRpcProps, treeId, contentId, isCanceled, guid);
  }

  /** @internal */
  public async requestElementGraphics(iModel: IModelConnection, requestProps: ElementGraphicsRequestProps): Promise<Uint8Array | undefined> {
    this.initializeRpc();
    const intfc = IModelTileRpcInterface.getClient();
    return intfc.requestElementGraphics(iModel.getRpcProps(), requestProps);
  }

  /** @internal */
  public onTileFailed(_tile: Tile) {
    ++this._totalFailed;
  }

  /** @internal */
  public onTileTimedOut(_tile: Tile) {
    ++this._totalTimedOut;
  }

  /** @internal */
  public onTilesElided(numElided: number) {
    this._totalElided += numElided;
  }

  /** @internal */
  public onCacheMiss() {
    ++this._totalCacheMisses;
  }

  /** @internal */
  public onTileCompleted(tile: Tile) {
    ++this._totalCompleted;
    if (tile.isEmpty)
      ++this._totalEmpty;
    else if (!tile.isDisplayable)
      ++this._totalUndisplayable;
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
  public cancelIModelTileRequest(tile: Tile): void {
    if (undefined === this._canceledIModelTileRequests)
      return;

    let iModelEntry = this._canceledIModelTileRequests.get(tile.tree.iModel);
    if (undefined === iModelEntry) {
      iModelEntry = new Map<string, Set<string>>();
      this._canceledIModelTileRequests.set(tile.tree.iModel, iModelEntry);
    }

    let contentIds = iModelEntry.get(tile.tree.id);
    if (undefined === contentIds) {
      contentIds = new Set<string>();
      iModelEntry.set(tile.tree.id, contentIds);
    }

    contentIds.add(tile.contentId);
  }

  /** @internal */
  public cancelElementGraphicsRequest(tile: Tile): void {
    const requests = this._canceledElementGraphicsRequests;
    if (!requests)
      return;

    let ids = requests.get(tile.tree.iModel);
    if (!ids)
      requests.set(tile.tree.iModel, ids = []);

    ids.push(tile.contentId);
  }

  /** @internal */
  public terminateTileTreePropsRequest(request: TileTreePropsRequest): void {
    const index = this._tileTreePropsRequests.indexOf(request);
    if (index >= 0) {
      this._tileTreePropsRequests.splice(index, 1);
      this.dispatchTileTreePropsRequests();
    }
  }

  /** Event raised when a request to load a tile's content completes.
   * @internal
   */
  public readonly onTileLoad = new BeEvent<(tile: Tile) => void>();

  /** Event raised when a request to load a tile tree completes.
   * @internal
   */
  public readonly onTileTreeLoad = new BeEvent<(tileTree: TileTreeOwner) => void>();

  /** Event raised when a request to load a tile's child tiles completes.
   * @internal
   */
  public readonly onTileChildrenLoad = new BeEvent<(parentTile: Tile) => void>();

  /** Subscribe to onTileLoad, onTileTreeLoad, and onTileChildrenLoad.
   * @internal
   */
  public addLoadListener(callback: (imodel: IModelConnection) => void): () => void {
    const tileLoad = this.onTileLoad.addListener((tile) => callback(tile.tree.iModel));
    const treeLoad = this.onTileTreeLoad.addListener((tree) => callback(tree.iModel));
    const childLoad = this.onTileChildrenLoad.addListener((tile) => callback(tile.tree.iModel));
    return () => { tileLoad(); treeLoad(); childLoad(); };
  }

  private dispatchTileTreePropsRequests(): void {
    for (let i = 0; i < this._maxActiveTileTreePropsRequests && i < this._tileTreePropsRequests.length; i++)
      this._tileTreePropsRequests[i].dispatch();
  }

  private processQueue(): void {
    this._numCanceled = 0;

    // Mark all requests as being associated with no Viewports, indicating they are no longer needed.
    this._viewportSetsForRequests.clearAll();

    // Process all requests, enqueueing on new queue.
    const previouslyPending = this._pendingRequests;
    this._pendingRequests = this._swapPendingRequests;
    this._swapPendingRequests = previouslyPending;

    // We will repopulate pending requests queue from each viewport. We do NOT sort by priority while doing so.
    this._requestsPerViewport.forEach((value, key) => this.processRequests(key, value));

    // Recompute priority of each request.
    for (const req of this._pendingRequests)
      req.priority = req.tile.computeLoadPriority(req.viewports);

    // Sort pending requests by priority.
    this._pendingRequests.sort();

    // Cancel any previously pending requests which are no longer needed.
    for (const queued of previouslyPending)
      if (queued.viewports.isEmpty)
        this.cancel(queued);

    previouslyPending.clear();

    // Cancel any active requests which are no longer needed.
    // NB: Do NOT remove them from the active set until their http activity has completed.
    for (const active of this._activeRequests)
      if (active.viewports.isEmpty)
        this.cancel(active);

    // If the backend is servicing a single client, ask it to immediately stop processing requests for content we no longer want.
    if (undefined !== this._canceledIModelTileRequests && this._canceledIModelTileRequests.size > 0) {
      for (const [iModelConnection, entries] of this._canceledIModelTileRequests) {
        const treeContentIds: TileTreeContentIds[] = [];
        for (const [treeId, tileIds] of entries) {
          const contentIds = Array.from(tileIds);
          treeContentIds.push({ treeId, contentIds });
          this._totalAbortedRequests += contentIds.length;
        }

        // eslint-disable-next-line @typescript-eslint/no-floating-promises
        IpcApp.callIpcHost("cancelTileContentRequests", iModelConnection.getRpcProps(), treeContentIds);
      }

      this._canceledIModelTileRequests.clear();
    }

    if (this._canceledElementGraphicsRequests && this._canceledElementGraphicsRequests.size > 0) {
      for (const [connection, requestIds] of this._canceledElementGraphicsRequests) {
        // eslint-disable-next-line @typescript-eslint/no-floating-promises
        IpcApp.callIpcHost("cancelElementGraphicsRequests", connection.key, requestIds);
        this._totalAbortedRequests += requestIds.length;
      }

      this._canceledElementGraphicsRequests.clear();
    }

    // Fill up the active requests from the queue.
    while (this._activeRequests.size < this._maxActiveRequests) {
      const request = this._pendingRequests.pop();
      if (undefined === request)
        break;
      else
        this.dispatch(request);
    }
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

    // Identify all of the TileTrees being displayed by all of the Viewports known to the TileAdmin.
    // A single viewport can display tiles from more than one IModelConnection.
    // NOTE: A viewport may be displaying no trees - but we need to record its IModel so we can purge those which are NOT being displayed
    //  NOTE: That won't catch external tile trees previously used by that viewport.
    const trees = new DisclosedTileTreeSet();
    const treesByIModel = needPurge ? new Map<IModelConnection, Set<TileTree>>() : undefined;
    for (const vp of this._viewports) {
      if (!vp.iModel.isOpen) // case of closing an IModelConnection while keeping the Viewport open, possibly for reuse with a different IModelConnection.
        continue;

      vp.discloseTileTrees(trees);
      if (treesByIModel && undefined === treesByIModel.get(vp.iModel))
        treesByIModel.set(vp.iModel, new Set<TileTree>());
    }

    if (needPrune) {
      // Request that each displayed tile tree discard any tiles and/or tile content that is no longer needed.
      for (const tree of trees)
        tree.prune();

      this._nextPruneTime = now.plus(this._tileExpirationTime);
    }

    if (treesByIModel) {
      for (const tree of trees) {
        let set = treesByIModel.get(tree.iModel);
        if (undefined === set)
          treesByIModel.set(tree.iModel, set = new Set<TileTree>());

        set.add(tree);
      }

      // Discard any tile trees that are no longer in use by any viewport.
      const olderThan = now.minus(this._treeExpirationTime);
      for (const entry of treesByIModel)
        entry[0].tiles.purge(olderThan, entry[1]);

      this._nextPurgeTime = now.plus(this._treeExpirationTime);
    }
  }

  private processRequests(vp: Viewport, tiles: Set<Tile>): void {
    for (const tile of tiles) {
      if (undefined === tile.request) {
        // ###TODO: This assertion triggers for AttachmentViewports used for rendering 3d sheet attachments.
        // Determine why and fix.
        // assert(tile.loadStatus === Tile.LoadStatus.NotLoaded);
        if (TileLoadStatus.NotLoaded === tile.loadStatus) {
          const request = new TileRequest(tile, vp);
          tile.request = request;
          this._pendingRequests.append(request);
        }
      } else {
        const req = tile.request;
        assert(undefined !== req);
        if (undefined !== req) {
          // Request may already be dispatched (in this._activeRequests) - if so do not re-enqueue!
          if (req.isQueued && 0 === req.viewports.length)
            this._pendingRequests.append(req);

          req.addViewport(vp);
          assert(0 < req.viewports.length);
        }
      }
    }
  }

  // NB: This does *not* remove from this._viewports - the viewport could later be reused with a different IModelConnection.
  private onViewportIModelClosed(vp: Viewport): void {
    this.clearUsageForViewport(vp);
    this.clearTilesForViewport(vp);

    // NB: vp will be removed from ViewportSets in process() - but if we can establish that only this vp wants a given tile, cancel its request immediately.
    const tiles = this._requestsPerViewport.get(vp);
    if (undefined !== tiles) {
      for (const tile of tiles) {
        const request = tile.request;
        if (undefined !== request && 1 === request.viewports.length)
          request.cancel();
      }

      this._requestsPerViewport.delete(vp);
    }
  }

  private onIModelClosed(iModel: IModelConnection): void {
    this._requestsPerViewport.forEach((_req, vp) => {
      if (vp.iModel === iModel)
        this.onViewportIModelClosed(vp);
    });

    // Remove any TileTreeProps requests associated with this iModel.
    this._tileTreePropsRequests = this._tileTreePropsRequests.filter((req) => {
      if (req.iModel !== iModel)
        return true;

      req.abandon();
      return false;
    });

    // Remove any canceled requests for this iModel.
    this._canceledIModelTileRequests?.delete(iModel);
    this._canceledElementGraphicsRequests?.delete(iModel);

    // Dispatch TileTreeProps requests not associated with this iModel.
    this.dispatchTileTreePropsRequests();
  }

  private dispatch(req: TileRequest): void {
    ++this._totalDispatchedRequests;
    this._activeRequests.add(req);
    req.dispatch(() => {
      this.dropActiveRequest(req);
    }).catch((_) => {
      //
    });
  }

  private cancel(req: TileRequest) {
    req.cancel();
    ++this._numCanceled;
  }

  private dropActiveRequest(req: TileRequest) {
    assert(this._activeRequests.has(req) || req.isCanceled);
    this._activeRequests.delete(req);
  }

  private initializeRpc(): void {
    // Would prefer to do this in constructor - but nothing enforces that the app initializes the rpc interfaces before it creates the TileAdmin (via IModelApp.startup()) - so do it on first request instead.
    if (this._rpcInitialized)
      return;

    this._rpcInitialized = true;
    const retryInterval = this._retryInterval;
    RpcOperation.lookup(IModelTileRpcInterface, "requestTileTreeProps").policy.retryInterval = () => retryInterval;

    const policy = RpcOperation.lookup(IModelTileRpcInterface, "requestTileContent").policy;
    policy.retryInterval = () => retryInterval;
    policy.allowResponseCaching = () => RpcResponseCacheControl.Immutable;

    if (IpcApp.isValid) {
      this._canceledElementGraphicsRequests = new Map<IModelConnection, string[]>();
      if (this._cancelBackendTileRequests)
        this._canceledIModelTileRequests = new Map<IModelConnection, Map<string, Set<string>>>();
    } else {
      this._cancelBackendTileRequests = false;
    }
  }

  /** The geometry of one or models has changed during an [[InteractiveEditingSession]]. Invalidate the scenes and feature overrides of any viewports
   * viewing any of those models.
   */
  private onModelGeometryChanged(changes: Iterable<ModelGeometryChanges>): void {
    for (const vp of this._viewports) {
      for (const change of changes) {
        if (vp.view.viewsModel(change.id)) {
          vp.invalidateScene();
          vp.setFeatureOverrideProviderChanged();
          break;
        }
      }
    }
  }

  /** An interactive editing session has ended. Update geometry guid for affected models and invalidate scenes of affected viewports. */
  private onSessionEnd(session: InteractiveEditingSession): void {
    // Updating model's geometry guid will cause TileTreeReference to request new TileTree if guid changed.
    const modelIds: Id64String[] = [];
    for (const change of session.getGeometryChanges()) {
      modelIds.push(change.id);
      const model = session.iModel.models.getLoaded(change.id);
      if (model && model instanceof GeometricModelState)
        model.geometryGuid = change.geometryGuid;
    }

    // Invalidate scenes of all viewports viewing any affected model.
    for (const vp of this._viewports) {
      if (vp.iModel !== session.iModel)
        continue;

      for (const modelId of modelIds) {
        if (vp.view.viewsModel(modelId)) {
          vp.invalidateScene();
          break;
        }
      }
    }
  }
}

/** @beta */
export namespace TileAdmin { // eslint-disable-line no-redeclare
  /** Statistics regarding the current and cumulative state of the [[TileAdmin]]. Useful for monitoring performance and diagnosing problems.
   * @beta
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
  }

  /** Describes configuration of a [[TileAdmin]].
   * @see [[TileAdmin.create]]
   * @beta
   */
  export interface Props {
    /** The maximum number of simultaneously-active requests. Any requests beyond this maximum are placed into a priority queue.
     *
     * Default value: 10
     */
    maxActiveRequests?: number;

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
     * @alpha
     */
    ignoreAreaPatterns?: boolean;

    /** If true, during tile generation the backend will not embed all texture image data in the tile content. If texture image data is considered large enough by the backend, it will not be embedded in the tile content and the frontend will request that element texture data separately from the backend. This can help reduce the amount of memory consumed by the frontend and the amount of data sent to the frontend.
     *
     * Default value: false
     */
    enableExternalTextures?: boolean;

    /** The interval in milliseconds at which a request for tile content will be retried until a response is received.
     *
     * Default value: 1000 (1 second)
     * @alpha
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
     * @alpha
     */
    tileTreeExpirationTime?: number;

    /** Defines optional limits on the total amount of GPU memory allocated to [[Tile]] contents.
     * If an instance of [[GpuMemoryLimits]], defines separate limits for mobile and non-mobile devices; otherwise, defines the limit for whatever
     * type of device the client is running on.
     *
     * Default value: `{ "mobile": "default" }`.
     *
     * @see [[GpuMemoryLimit]] for a description of the available limits and how they are imposed.
     * @beta
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
     * @alpha
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

    /** In a single-client application, when a request for tile content is cancelled, whether to ask the backend to cancel the corresponding tile generation task.
     * Has no effect unless `NativeAppRpcInterface` is registered.
     * Default value: false.
     * @internal
     */
    cancelBackendTileRequests?: boolean;

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
     * @beta
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
     * Default value: undefined
     * @alpha
     */
    minimumSpatialTolerance?: number;
  }

  /** The number of bytes of GPU memory associated with the various [[GpuMemoryLimit]]s for non-mobile devices.
   * @see [[TileAdmin.Props.gpuMemoryLimits]] to specify the limit at startup.
   * @see [[TileAdmin.gpuMemoryLimit]] to adjust the actual limit after startup.
   * @see [[TileAdmin.mobileMemoryLimits]] for mobile devices.
   * @beta
   */
  export const nonMobileGpuMemoryLimits = {
    default: 1024 * 1024 * 1024, // 1 GB
    aggressive: 500 * 1024 * 1024, // 500 MB
    relaxed: 2.5 * 1024 * 1024 * 1024, // 2.5 GB
  };

  /** The number of bytes of GPU memory associated with the various [[GpuMemoryLimit]]s for mobile devices.
   * @see [[TileAdmin.Props.gpuMemoryLimits]] to specify the limit at startup.
   * @see [[TileAdmin.gpuMemoryLimit]] to adjust the actual limit after startup.
   * @see [[TileAdmin.nonMobileMemoryLimits]] for non-mobile devices.
   * @beta
   */
  export const mobileGpuMemoryLimits = {
    default: 200 * 1024 * 1024, // 200 MB
    aggressive: 75 * 1024 * 1024, // 75 MB
    relaxed: 500 * 1024 * 1024, // 500 MB
  };
}

function comparePriorities(lhs: TileRequest, rhs: TileRequest): number {
  let diff = lhs.tile.tree.loadPriority - rhs.tile.tree.loadPriority;
  if (0 === diff)
    diff = lhs.priority - rhs.priority;

  return diff;
}

class Queue extends PriorityQueue<TileRequest> {
  public constructor() {
    super((lhs, rhs) => comparePriorities(lhs, rhs));
  }

  public has(request: TileRequest): boolean {
    return this._array.indexOf(request) >= 0;
  }
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
