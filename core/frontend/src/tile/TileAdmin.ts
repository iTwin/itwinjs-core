/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module Tiles
 */

import { assert, BeDuration, BeEvent, BeTimePoint, Id64Array, Id64String, PriorityQueue } from "@bentley/bentleyjs-core";
import {
  defaultTileOptions, ElementGraphicsRequestProps, getMaximumMajorTileFormatVersion, IModelTileRpcInterface, IModelTileTreeProps, ModelGeometryChanges,
  NativeAppRpcInterface, RpcOperation, RpcRegistry, RpcResponseCacheControl, ServerTimeoutError, TileTreeContentIds,
} from "@bentley/imodeljs-common";
import { IModelApp } from "../IModelApp";
import { IModelConnection } from "../IModelConnection";
import { RenderMemory } from "../render/RenderMemory";
import { Viewport } from "../Viewport";
import { ReadonlyViewportSet, UniqueViewportSets } from "../ViewportSet";
import { InteractiveEditingSession } from "../InteractiveEditingSession";
import { GeometricModelState } from "../ModelState";
import { Tile, TileLoadStatus, TileRequest, TileTree, TileTreeOwner, TileTreeSet, TileUsageMarker } from "./internal";

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

/** Provides functionality associated with [[Tile]]s, mostly in the area of scheduling requests for tile content.
 * The TileAdmin tracks [[Viewport]]s which have requested tile content, maintaining a priority queue of pending requests and
 * a set of active requests. On each update it identifies previously-requested tiles whose content no viewport is interested in any longer and
 * cancels them. It then pulls pending requests off the queue and dispatches them into the active set until either the maximum number of
 * simultaneously-active requests is reached or the queue becomes empty.
 * @alpha
 */
export abstract class TileAdmin {
  /** @internal */
  public abstract get emptyViewportSet(): ReadonlyViewportSet;
  /** Returns basic statistics about the TileAdmin's current state. */
  public abstract get statistics(): TileAdmin.Statistics;
  /** Resets the cumulative (per-session) statistics like totalCompletedRequests, totalEmptyTiles, etc. */
  public abstract resetStatistics(): void;

  /** Controls the maximum number of simultaneously-active requests allowed.
   * If the maximum is reduced below the current size of the active set, no active requests will be canceled - but no more will be dispatched until the
   * size of the active set falls below the new maximum.
   * @see [[TileAdmin.Props.maxActiveRequests]]
   * @note Browsers impose their own limitations on maximum number of total connections, and connections per-domain. These limitations are
   * especially strict when using HTTP1.1 instead of HTTP2. Increasing the maximum above the default may significantly affect performance as well as
   * bandwidth and memory consumption.
   * @alpha
   */
  public abstract get maxActiveRequests(): number;
  public abstract set maxActiveRequests(max: number);

  /** A default multiplier applied to the size in pixels of a [[Tile]] during tile selection for any [[Viewport]].
   * Individual Viewports can override this multiplier if desired.
   * A value greater than 1.0 causes lower-resolution tiles to be selected; a value < 1.0 selects higher-resolution tiles.
   * This can allow an application to sacrifice quality for performance or vice-versa.
   * This property is initialized from the value supplied by the [[TileAdmin.Props.defaultTileSizeModifier]] used to initialize the TileAdmin at startup.
   * Changing it after startup will change it for all Viewports that do not explicitly override it with their own multiplier.
   * This value must be greater than zero.
   * @alpha
   */
  public abstract get defaultTileSizeModifier(): number;
  public abstract set defaultTileSizeModifier(modifier: number);

  /** @internal */
  public abstract get enableInstancing(): boolean;
  /** @internal */
  public abstract get enableImprovedElision(): boolean;
  /** @internal */
  public abstract get ignoreAreaPatterns(): boolean;
  /** @internal */
  public abstract get useProjectExtents(): boolean;
  /** @internal */
  public abstract get disableMagnification(): boolean;
  /** @internal */
  public abstract get alwaysRequestEdges(): boolean;
  /** @internal */
  public abstract get alwaysSubdivideIncompleteTiles(): boolean;
  /** @internal */
  public abstract get minimumSpatialTolerance(): number;

  /** @internal */
  public abstract get tileExpirationTime(): BeDuration;
  /** @internal */
  public abstract get tileTreeExpirationTime(): BeDuration;
  /** @internal */
  public abstract get contextPreloadParentDepth(): number;
  /** @internal */
  public abstract get contextPreloadParentSkip(): number;
  /** @internal */
  public abstract get maximumMajorTileFormatVersion(): number;
  /** @internal */
  public abstract get maximumLevelsToSkip(): number;
  /** @internal */
  public abstract get mobileExpirationMemoryThreshold(): number;
  /** @internal */
  public abstract get mobileRealityTileMinToleranceRatio(): number;

  /** Given a numeric combined major+minor tile format version (typically obtained from a request to the backend to query the maximum tile format version it supports),
   * return the maximum *major* format version to be used to request tile content from the backend.
   * @see [[TileAdmin.Props.maximumMajorTileFormatVersion]]
   * @see [[CurrentImdlVersion]]
   * @see [IModelTileTreeProps.formatVersion]($common)
   * @internal
   */
  public abstract getMaximumMajorTileFormatVersion(formatVersion?: number): number;

  /** Returns the union of the input set and the input viewport, to be associated with a [[TileRequest]].
   * @internal
   */
  public abstract getViewportSetForRequest(vp: Viewport, vps?: ReadonlyViewportSet): ReadonlyViewportSet;

  /** Marks the Tile as "in use" by the specified Viewport, where the tile defines what "in use" means.
   * A tile will not be discarded while it is in use by any Viewport.
   * @see [[TileTree.prune]]
   * @internal
   */
  public abstract markTileUsedByViewport(marker: TileUsageMarker, vp: Viewport): void;

  /** Returns true if the Tile is currently in use by any Viewport.
   * @see [[markTileUsedByViewport]].
   * @internal
   */
  public abstract isTileInUse(marker: TileUsageMarker): boolean;

  /** Invoked from the [[ToolAdmin]] event loop to process any pending or active requests for tiles.
   * @internal
   */
  public abstract process(): void;

  /** Specifies the set of tiles currently requested for use by a viewport. This set replaces any previously specified for the same viewport.
   * The requests are not actually processed until the next call to [[TileAdmin.process].
   * This is typically invoked when the viewport recreates its scene, e.g. in response to camera movement.
   * @internal
   */
  public abstract requestTiles(vp: Viewport, tiles: Set<Tile>): void;

  /** Returns the number of pending and active requests associated with the specified viewport.
   * @alpha
   */
  public abstract getNumRequestsForViewport(vp: Viewport): number;

  /** Returns the current set of Tiles requested by the specified Viewport.
   * Do not modify the set or the Tiles.
   * @internal
   */
  public abstract getRequestsForViewport(vp: Viewport): Set<Tile> | undefined;

  /** Returns two sets of tiles associated with the specified Viewport's current scene.
   * Do not modify the returned sets.
   * @internal
   */
  public abstract getTilesForViewport(vp: Viewport): SelectedAndReadyTiles | undefined;

  /** Adds the specified tiles to the sets of selected and ready tiles for the specified Viewport.
   * The TileAdmin takes ownership of the `ready` set - do not modify it after passing it in.
   * @internal
   */
  public abstract addTilesForViewport(vp: Viewport, selected: Tile[], ready: Set<Tile>): void;

  /** Disclose statistics about tiles that are handled externally from TileAdmin. At this time, that means OrbitGT point cloud tiles.
   * These statistics are included in the return value of [[getTilesForViewport]].
   * @internal
   */
  public abstract addExternalTilesForViewport(vp: Viewport, statistics: ExternalTileStatistics): void;

  /** Clears the sets of tiles associated with a viewport's current scene.
   * @internal
   */
  public abstract clearTilesForViewport(vp: Viewport): void;

  /** Indicates that the TileAdmin should cease tracking the specified viewport, e.g. because it is about to be destroyed.
   * Any requests which are of interest only to the specified viewport will be canceled.
   * @internal
   */
  public abstract forgetViewport(vp: Viewport): void;

  /** Indicates that the TileAdmin should reset usage tracking for the specified viewport, e.g. because the viewport is about
   * to recreate its scene. Any tiles currently marked as "in use" by this viewport no longer will be.
   * @internal
   */
  public abstract clearUsageForViewport(vp: Viewport): void;

  /** Indicates that the TileAdmin should track tile requests for the specified viewport.
   * This is invoked by the Viewport constructor and should not be invoked from elsewhere.
   * @internal
   */
  public abstract registerViewport(vp: Viewport): void;

  /** @internal */
  public abstract onShutDown(): void;

  /** @internal */
  public abstract async requestTileTreeProps(iModel: IModelConnection, treeId: string): Promise<IModelTileTreeProps>;

  /** @internal */
  public abstract async requestTileContent(iModel: IModelConnection, treeId: string, contentId: string, isCanceled: () => boolean, guid: string | undefined, qualifier: string | undefined): Promise<Uint8Array>;

  /** @internal */
  public abstract async requestElementGraphics(iModel: IModelConnection, props: ElementGraphicsRequestProps): Promise<Uint8Array | undefined>;

  /** Create a TileAdmin. Chiefly intended for use by subclasses of [[IModelApp]] to customize the behavior of the TileAdmin.
   * @param props Options for customizing the behavior of the TileAdmin.
   * @returns the TileAdmin
   * @beta
   */
  public static create(props?: TileAdmin.Props): TileAdmin {
    return new Admin(props);
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
  public abstract async purgeTileTrees(iModel: IModelConnection, modelIds: Id64Array | undefined): Promise<void>;

  /** @internal */
  public abstract onTileCompleted(tile: Tile): void;
  /** @internal */
  public abstract onTileTimedOut(tile: Tile): void;
  /** @internal */
  public abstract onTileFailed(tile: Tile): void;
  /** @internal */
  public abstract onTilesElided(numElided: number): void;
  /** @internal */
  public abstract onCacheMiss(): void;
  /** @internal */
  public abstract cancelIModelTileRequest(tile: Tile): void;
  /** @internal */
  public abstract cancelElementGraphicsRequest(tile: Tile): void;

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
}

/** @alpha */
export namespace TileAdmin { // eslint-disable-line no-redeclare
  /** Statistics regarding the current and cumulative state of the [[TileAdmin]]. Useful for monitoring performance and diagnosing problems.
   * @alpha
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
   * @alpha
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
     */
    ignoreAreaPatterns?: boolean;

    /** The interval in milliseconds at which a request for tile content will be retried until a response is received.
     *
     * Default value: 1000 (1 second)
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

    /** When the total used memory of all tile trees exceeds this many bytes, tiles belonging to the trees will be immediately considered eligible for disposal if they are unused by any viewport.
     * This disposal will occur by calling the `forcePrune` method on every tree.
     * This pruning criteria exists in addition to the pruning eligibility based on expiration time.
     *
     * @note This value only has an effect on mobile devices. On non-mobile devices, unused tiles will only be pruned based on expiration time, not memory usage.
     *
     * Default value: 200MB (200,000,000 bytes)
     * Minimum value: 100MB (100,000,000 bytes)
     *
     * @alpha
     */
    mobileExpirationMemoryThreshold?: number;

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
     * @alpha
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
    (IModelApp.tileAdmin as Admin).terminateTileTreePropsRequest(this);
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

class Admin extends TileAdmin {
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
  private readonly _disableMagnification: boolean;
  private readonly _alwaysRequestEdges: boolean;
  private readonly _alwaysSubdivideIncompleteTiles: boolean;
  private readonly _minimumSpatialTolerance: number;
  private readonly _maxMajorVersion: number;
  private readonly _useProjectExtents: boolean;
  private readonly _maximumLevelsToSkip: number;
  private readonly _mobileExpirationMemoryThreshold: number;
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
  private _nextPruneForMemoryUsageTime: BeTimePoint;
  private readonly _pruneForMemoryUsageTime: BeDuration;
  private readonly _contextPreloadParentDepth: number;
  private readonly _contextPreloadParentSkip: number;
  private _canceledIModelTileRequests?: Map<IModelConnection, Map<string, Set<string>>>;
  private _canceledElementGraphicsRequests?: Map<IModelConnection, string[]>;
  private _cancelBackendTileRequests: boolean;
  private _tileTreePropsRequests: TileTreePropsRequest[] = [];
  private _cleanup?: () => void;

  public get emptyViewportSet(): ReadonlyViewportSet { return UniqueViewportSets.emptySet; }
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

  public resetStatistics(): void {
    this._totalCompleted = this._totalFailed = this._totalTimedOut =
      this._totalEmpty = this._totalUndisplayable = this._totalElided =
      this._totalCacheMisses = this._totalDispatchedRequests = this._totalAbortedRequests = 0;
  }

  public constructor(options?: TileAdmin.Props) {
    super();

    if (undefined === options)
      options = {};

    this._maxActiveRequests = options.maxActiveRequests ?? 10;
    this._maxActiveTileTreePropsRequests = options.maxActiveTileTreePropsRequests ?? 10;
    this._defaultTileSizeModifier = (undefined !== options.defaultTileSizeModifier && options.defaultTileSizeModifier > 0) ? options.defaultTileSizeModifier : 1.0;
    this._retryInterval = undefined !== options.retryInterval ? options.retryInterval : 1000;
    this._enableInstancing = options.enableInstancing ?? defaultTileOptions.enableInstancing;
    this._enableImprovedElision = options.enableImprovedElision ?? defaultTileOptions.enableImprovedElision;
    this._ignoreAreaPatterns = options.ignoreAreaPatterns ?? defaultTileOptions.ignoreAreaPatterns;
    this._disableMagnification = options.disableMagnification ?? defaultTileOptions.disableMagnification;
    this._alwaysRequestEdges = true === options.alwaysRequestEdges;
    this._alwaysSubdivideIncompleteTiles = options.alwaysSubdivideIncompleteTiles ?? defaultTileOptions.alwaysSubdivideIncompleteTiles;
    this._maxMajorVersion = options.maximumMajorTileFormatVersion ?? defaultTileOptions.maximumMajorTileFormatVersion;
    this._useProjectExtents = options.useProjectExtents ?? defaultTileOptions.useProjectExtents;
    this._mobileExpirationMemoryThreshold = Math.max(options.mobileExpirationMemoryThreshold ?? 200000000, 100000000);
    this._mobileRealityTileMinToleranceRatio = Math.max(options.mobileRealityTileMinToleranceRatio ?? 3.0, 1.0);
    this._pruneForMemoryUsageTime = BeDuration.fromSeconds(1);

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
    this._nextPruneForMemoryUsageTime = now.plus(this._pruneForMemoryUsageTime);

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

  public get enableInstancing() { return this._enableInstancing && IModelApp.renderSystem.supportsInstancing; }
  public get enableImprovedElision() { return this._enableImprovedElision; }
  public get ignoreAreaPatterns() { return this._ignoreAreaPatterns; }
  public get useProjectExtents() { return this._useProjectExtents; }
  public get maximumLevelsToSkip() { return this._maximumLevelsToSkip; }
  public get mobileExpirationMemoryThreshold() { return this._mobileExpirationMemoryThreshold; }
  public get mobileRealityTileMinToleranceRatio() { return this._mobileRealityTileMinToleranceRatio; }
  public get disableMagnification() { return this._disableMagnification; }
  public get alwaysRequestEdges() { return this._alwaysRequestEdges; }
  public get alwaysSubdivideIncompleteTiles() { return this._alwaysSubdivideIncompleteTiles; }
  public get minimumSpatialTolerance() { return this._minimumSpatialTolerance; }
  public get tileExpirationTime() { return this._tileExpirationTime; }
  public get tileTreeExpirationTime() { return this._treeExpirationTime; }
  public get contextPreloadParentDepth() { return this._contextPreloadParentDepth; }
  public get contextPreloadParentSkip() { return this._contextPreloadParentSkip; }
  public get maximumMajorTileFormatVersion() { return this._maxMajorVersion; }
  public getMaximumMajorTileFormatVersion(formatVersion?: number): number {
    return getMaximumMajorTileFormatVersion(this.maximumMajorTileFormatVersion, formatVersion);
  }

  public get maxActiveRequests() { return this._maxActiveRequests; }
  public set maxActiveRequests(max: number) {
    if (max > 0)
      this._maxActiveRequests = max;
  }

  public get defaultTileSizeModifier() { return this._defaultTileSizeModifier; }
  public set defaultTileSizeModifier(modifier: number) {
    if (modifier !== this._defaultTileSizeModifier && modifier > 0 && !Number.isNaN(modifier)) {
      this._defaultTileSizeModifier = modifier;
      IModelApp.viewManager.invalidateScenes();
    }
  }

  public process(): void {
    this.processQueue();
    this.pruneAndPurge();
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
        NativeAppRpcInterface.getClient().cancelTileContentRequests(iModelConnection.getRpcProps(), treeContentIds);
      }

      this._canceledIModelTileRequests.clear();
    }

    if (this._canceledElementGraphicsRequests && this._canceledElementGraphicsRequests.size > 0) {
      for (const [connection, requestIds] of this._canceledElementGraphicsRequests) {
        // eslint-disable-next-line @typescript-eslint/no-floating-promises
        NativeAppRpcInterface.getClient().cancelElementGraphicsRequests(connection.getRpcProps(), requestIds);
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

  // Possibly prune tiles belonging to trees based on overall tree memory usage.
  // Note: this currently only occurs on mobile devices.
  private pruneForMemoryUsage(): void {
    const memoryTrees = new TileTreeSet();
    for (const vp of this._viewports) {
      if (!vp.iModel.isOpen) // case of closing an IModelConnection while keeping the Viewport open, possibly for reuse with a different IModelConnection.
        continue;
      vp.discloseTileTrees(memoryTrees);
    }

    let exceedsThreshold = false;

    // Gather total memory used by trees.
    const stats = new RenderMemory.Statistics();
    for (const tree of memoryTrees.trees) {
      tree.collectStatistics(stats);
      if (stats.totalBytes > this.mobileExpirationMemoryThreshold) {
        exceedsThreshold = true;
        break;
      }
    }

    // Force pruning those trees if total bytes consumed exceeds the threshold.
    if (exceedsThreshold) {
      for (const tree of memoryTrees.trees)
        tree.forcePrune();
    }
  }

  private pruneAndPurge(): void {
    const now = BeTimePoint.now();

    if (IModelApp.renderSystem.isMobile) {
      const needPruneForMemoryUsage = this._nextPruneForMemoryUsageTime.before(now);
      if (needPruneForMemoryUsage) {
        this.pruneForMemoryUsage();
        this._nextPruneForMemoryUsageTime = now.plus(this._pruneForMemoryUsageTime);
      }
    }

    const needPrune = this._nextPruneTime.before(now);
    const needPurge = this._nextPurgeTime.before(now);
    if (!needPrune && !needPurge)
      return;

    // Identify all of the TileTrees being displayed by all of the Viewports known to the TileAdmin.
    // A single viewport can display tiles from more than one IModelConnection.
    // NOTE: A viewport may be displaying no trees - but we need to record its IModel so we can purge those which are NOT being displayed
    //  NOTE: That won't catch external tile trees previously used by that viewport.
    const trees = new TileTreeSet();
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
      for (const tree of trees.trees)
        tree.prune();

      this._nextPruneTime = now.plus(this._tileExpirationTime);
    }

    if (treesByIModel) {
      for (const tree of trees.trees) {
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

  public getNumRequestsForViewport(vp: Viewport): number {
    const requests = this.getRequestsForViewport(vp);
    let count = requests?.size ?? 0;
    const tiles = this.getTilesForViewport(vp);
    if (tiles)
      count += tiles.external.requested;

    return count;
  }

  public getRequestsForViewport(vp: Viewport): Set<Tile> | undefined {
    return this._requestsPerViewport.get(vp);
  }

  public requestTiles(vp: Viewport, tiles: Set<Tile>): void {
    this._requestsPerViewport.set(vp, tiles);
  }

  public getTilesForViewport(vp: Viewport): SelectedAndReadyTiles | undefined {
    return this._selectedAndReady.get(vp);
  }

  public addTilesForViewport(vp: Viewport, selected: Tile[], ready: Set<Tile>): void {
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

  public clearTilesForViewport(vp: Viewport): void {
    this._selectedAndReady.delete(vp);
  }

  public forgetViewport(vp: Viewport): void {
    this.onViewportIModelClosed(vp);
    this._viewports.delete(vp);
  }

  // NB: This does *not* remove from this._viewports - the viewport could later be reused with a different IModelConnection.
  private onViewportIModelClosed(vp: Viewport): void {
    this._selectedAndReady.delete(vp);
    this.clearUsageForViewport(vp);

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

  public registerViewport(vp: Viewport): void {
    this._viewports.add(vp);
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

  public getViewportSetForRequest(vp: Viewport, vps?: ReadonlyViewportSet): ReadonlyViewportSet {
    return this._viewportSetsForRequests.getViewportSet(vp, vps);
  }

  public markTileUsedByViewport(marker: TileUsageMarker, vp: Viewport): void {
    let set = this._tileUsagePerViewport.get(vp);
    if (!set)
      this._tileUsagePerViewport.set(vp, set = new Set<TileUsageMarker>());

    set.add(marker);
  }

  public isTileInUse(marker: TileUsageMarker): boolean {
    // eslint-disable-next-line @typescript-eslint/naming-convention
    for (const [_viewport, markers] of this._tileUsagePerViewport)
      if (markers.has(marker))
        return true;

    return false;
  }

  public clearUsageForViewport(vp: Viewport): void {
    this._tileUsagePerViewport.delete(vp);
  }

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

  public async purgeTileTrees(iModel: IModelConnection, modelIds: Id64Array | undefined): Promise<void> {
    this.initializeRpc();
    return IModelTileRpcInterface.getClient().purgeTileTrees(iModel.getRpcProps(), modelIds);
  }

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

  public async requestElementGraphics(iModel: IModelConnection, requestProps: ElementGraphicsRequestProps): Promise<Uint8Array | undefined> {
    this.initializeRpc();
    const intfc = IModelTileRpcInterface.getClient();
    return intfc.requestElementGraphics(iModel.getRpcProps(), requestProps);
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

    if (RpcRegistry.instance.isRpcInterfaceInitialized(NativeAppRpcInterface)) {
      this._canceledElementGraphicsRequests = new Map<IModelConnection, string[]>();
      if (this._cancelBackendTileRequests)
        this._canceledIModelTileRequests = new Map<IModelConnection, Map<string, Set<string>>>();
    } else {
      this._cancelBackendTileRequests = false;
    }
  }

  public onTileFailed(_tile: Tile) { ++this._totalFailed; }
  public onTileTimedOut(_tile: Tile) { ++this._totalTimedOut; }
  public onTilesElided(numElided: number) { this._totalElided += numElided; }
  public onCacheMiss() { ++this._totalCacheMisses; }
  public onTileCompleted(tile: Tile) {
    ++this._totalCompleted;
    if (tile.isEmpty)
      ++this._totalEmpty;
    else if (!tile.isDisplayable)
      ++this._totalUndisplayable;
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

  public cancelElementGraphicsRequest(tile: Tile): void {
    const requests = this._canceledElementGraphicsRequests;
    if (!requests)
      return;

    let ids = requests.get(tile.tree.iModel);
    if (!ids)
      requests.set(tile.tree.iModel, ids = []);

    ids.push(tile.contentId);
  }

  public terminateTileTreePropsRequest(request: TileTreePropsRequest): void {
    const index = this._tileTreePropsRequests.indexOf(request);
    if (index >= 0) {
      this._tileTreePropsRequests.splice(index, 1);
      this.dispatchTileTreePropsRequests();
    }
  }

  private dispatchTileTreePropsRequests(): void {
    for (let i = 0; i < this._maxActiveTileTreePropsRequests && i < this._tileTreePropsRequests.length; i++)
      this._tileTreePropsRequests[i].dispatch();
  }
}
