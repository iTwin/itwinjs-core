/*---------------------------------------------------------------------------------------------
* Copyright (c) 2019 Bentley Systems, Incorporated. All rights reserved.
* Licensed under the MIT License. See LICENSE.md in the project root for license terms.
*--------------------------------------------------------------------------------------------*/
/** @module Tile */

import {
  assert,
  BeDuration,
  BeTimePoint,
  dispose,
  Id64,
  Id64String,
  IDisposable,
  JsonUtils,
} from "@bentley/bentleyjs-core";
import {
  ClipVector,
  Range3d,
  Transform,
  Matrix4d,
  Point4d,
} from "@bentley/geometry-core";
import {
  BatchType,
  ElementAlignedBox3d,
  Frustum,
  FrustumPlanes,
  RenderMode,
  TileProps,
  TileTreeProps,
  ViewFlag,
  ViewFlags,
} from "@bentley/imodeljs-common";
import { IModelApp } from "../IModelApp";
import { IModelConnection } from "../IModelConnection";
import { GraphicBranch, RenderClipVolume, RenderMemory } from "../render/System";
import { DecorateContext, SceneContext } from "../ViewContext";
import { B3dmTileIO } from "./B3dmTileIO";
import { CompositeTileIO } from "./CompositeTileIO";
import { GltfTileIO } from "./GltfTileIO";
import { HitDetail } from "../HitDetail";
import { I3dmTileIO } from "./I3dmTileIO";
import { IModelTileIO } from "./IModelTileIO";
import { PntsTileIO } from "./PntsTileIO";
import { TileIO } from "./TileIO";
import { TileRequest } from "./TileRequest";
import { Tile } from "./Tile";

/**
 * Mapping between transient IDs assigned to 3D tiles "features" and batch table properties (and visa versa).
 * these properties may be present in batched tile sets.
 * @internal
 */
export class BatchedTileIdMap {
  private readonly _iModel: IModelConnection;
  private _featureMap?: Map<string, { id: Id64String, properties: any }>;
  private _idMap?: Map<Id64String, any>;

  public constructor(iModel: IModelConnection) {
    this._iModel = iModel;
  }

  /** Obtains or allocates the Id64String corresponding to the supplied set of JSON properties. */
  public getBatchId(properties: any): Id64String {
    if (undefined === this._featureMap || undefined === this._idMap) {
      assert(undefined === this._featureMap && undefined === this._idMap);
      this._featureMap = new Map<string, { id: Id64String, properties: any }>();
      this._idMap = new Map<Id64String, any>();
    }

    const key = JSON.stringify(properties);
    let entry = this._featureMap.get(key);
    if (undefined === entry) {
      const id = this._iModel.transientIds.next;
      entry = { id, properties };
      this._featureMap.set(key, entry);
      this._idMap.set(id, properties);
    }

    return entry.id;
  }

  /** Obtain the JSON properties associated with the specified Id64String, or undefined if none exist. */
  public getBatchProperties(id: Id64String): any {
    return undefined !== this._idMap ? this._idMap.get(id) : undefined;
  }
}

/** A hierarchical level-of-detail tree of 3d [[Tile]]s to be rendered in a [[Viewport]].
 * @internal
 */
export class TileTree implements IDisposable, RenderMemory.Consumer {
  private _lastSelected = BeTimePoint.now();
  public readonly iModel: IModelConnection;
  public readonly is3d: boolean;
  public readonly location: Transform;
  public readonly id: string;
  public readonly modelId: Id64String;
  public readonly viewFlagOverrides: ViewFlag.Overrides;
  public readonly maxTilesToSkip: number;
  public expirationTime: BeDuration;
  public clipVolume?: RenderClipVolume;
  protected _rootTile: Tile;
  public readonly loader: TileLoader;
  public readonly yAxisUp: boolean;
  public readonly isBackgroundMap?: boolean;
  // If defined, tight range around the contents of the entire tile tree. This is always no more than the root tile's range, and often much smaller.
  public readonly contentRange?: ElementAlignedBox3d;

  public constructor(props: TileTree.Params) {
    this.iModel = props.iModel;
    this.is3d = props.is3d;
    this.id = props.id;
    this.modelId = Id64.fromJSON(props.modelId);
    this.location = props.location;
    this.isBackgroundMap = props.isBackgroundMap;
    this.expirationTime = IModelApp.tileAdmin.tileExpirationTime;

    if (undefined !== props.clipVector)
      this.clipVolume = IModelApp.renderSystem.createClipVolume(props.clipVector);

    this.maxTilesToSkip = JsonUtils.asInt(props.maxTilesToSkip, 100);
    this.loader = props.loader;
    this._rootTile = new Tile(Tile.paramsFromJSON(props.rootTile, this)); // causes TileTree to no longer be disposed (assuming the Tile loaded a graphic and/or its children)
    this.viewFlagOverrides = this.loader.viewFlagOverrides;
    this.yAxisUp = props.yAxisUp ? props.yAxisUp : false;
    this.contentRange = props.contentRange;
  }

  public get rootTile(): Tile { return this._rootTile; }
  public get clipVector(): ClipVector | undefined { return undefined !== this.clipVolume ? this.clipVolume.clipVector : undefined; }

  public dispose() {
    dispose(this._rootTile);
    this.clipVolume = dispose(this.clipVolume);
  }

  public collectStatistics(stats: RenderMemory.Statistics): void {
    this._rootTile.collectStatistics(stats);
    if (undefined !== this.clipVolume)
      this.clipVolume.collectStatistics(stats);
  }

  public get is2d(): boolean { return !this.is3d; }
  public get range(): ElementAlignedBox3d { return this._rootTile !== undefined ? this._rootTile.range : new Range3d(); }

  /** The most recent time when tiles were selected for drawing. Used for purging least-recently-used tile trees to free up memory. */
  public get lastSelectedTime(): BeTimePoint { return this._lastSelected; }

  public selectTilesForScene(context: SceneContext): Tile[] { return this.selectTiles(this.createDrawArgs(context)); }
  public selectTiles(args: Tile.DrawArgs): Tile[] {
    this._lastSelected = BeTimePoint.now();
    const selected: Tile[] = [];
    if (undefined !== this._rootTile)
      this._rootTile.selectTiles(selected, args);

    return this.loader.processSelectedTiles(selected, args);
  }

  public drawScene(context: SceneContext): void { this.draw(this.createDrawArgs(context)); }
  public draw(args: Tile.DrawArgs): void {
    const selectedTiles = this.selectTiles(args);
    for (const selectedTile of selectedTiles)
      selectedTile.drawGraphics(args);

    args.drawGraphics();
    args.context.viewport.numSelectedTiles += selectedTiles.length;
  }

  public createDrawArgs(context: SceneContext): Tile.DrawArgs {
    const now = BeTimePoint.now();
    const purgeOlderThan = now.minus(this.expirationTime);
    return new Tile.DrawArgs(context, this.location.clone(), this, now, purgeOlderThan, this.clipVolume);
  }

  public debugForcedDepth?: number; // For debugging purposes - force selection of tiles of specified depth.
  private static _scratchFrustum = new Frustum();
  private static _scratchPoint4d = Point4d.createZero();
  private extendRangeForTileContent(range: Range3d, tile: Tile, matrix: Matrix4d, treeTransform: Transform, frustumPlanes?: FrustumPlanes) {
    if (tile.isEmpty || tile.contentRange.isNull)
      return;
    const box = Frustum.fromRange(tile.contentRange, TileTree._scratchFrustum);
    box.transformBy(treeTransform, box);
    if (frustumPlanes !== undefined && FrustumPlanes.Containment.Outside === frustumPlanes.computeFrustumContainment(box))
      return;
    if (tile.children === undefined) { //  || !tile.childrenAreLoaded) {
      for (const boxPoint of box.points) {
        matrix.multiplyPoint3d(boxPoint, 1, TileTree._scratchPoint4d);
        if (TileTree._scratchPoint4d.w > .0001)
          range.extendXYZW(TileTree._scratchPoint4d.x, TileTree._scratchPoint4d.y, TileTree._scratchPoint4d.z, TileTree._scratchPoint4d.w);
      }
    } else {
      for (const child of tile.children)
        this.extendRangeForTileContent(range, child, matrix, treeTransform, frustumPlanes);
    }
  }

  /* extend range to include transformed range of this tile tree */
  public accumulateTransformedRange(range: Range3d, matrix: Matrix4d, frustumPlanes?: FrustumPlanes) {
    this.extendRangeForTileContent(range, this.rootTile, matrix, this.location, frustumPlanes);
  }
}

const defaultViewFlagOverrides = new ViewFlag.Overrides(ViewFlags.fromJSON({
  renderMode: RenderMode.SmoothShade,
  noCameraLights: true,
  noSourceLights: true,
  noSolarLight: true,
}));

/** Serves as a "handler" for a specific type of [[TileTree]]. Its primary responsibilities involve loading tile content.
 * @internal
 */
export abstract class TileLoader {
  public abstract async getChildrenProps(parent: Tile): Promise<TileProps[]>;
  public abstract async requestTileContent(tile: Tile): Promise<TileRequest.Response>;
  public abstract get maxDepth(): number;
  public abstract get priority(): Tile.LoadPriority;
  protected get _batchType(): BatchType { return BatchType.Primary; }
  protected get _loadEdges(): boolean { return true; }
  public abstract tileRequiresLoading(params: Tile.Params): boolean;
  public getBatchIdMap(): BatchedTileIdMap | undefined { return undefined; }
  /** Given two tiles of the same [[Tile.LoadPriority]], determine which should be prioritized.
   * A negative value indicates lhs should load first, positive indicates rhs should load first, and zero indicates no distinction in priority.
   */
  public compareTilePriorities(lhs: Tile, rhs: Tile): number { return lhs.depth - rhs.depth; }
  public get parentsAndChildrenExclusive(): boolean { return true; }

  public processSelectedTiles(selected: Tile[], _args: Tile.DrawArgs): Tile[] { return selected; }

  // NB: The isCanceled arg is chiefly for tests...in usual case it just returns false if the tile is no longer in 'loading' state.
  public async loadTileContent(tile: Tile, data: TileRequest.ResponseData, isCanceled?: () => boolean): Promise<Tile.Content> {
    assert(data instanceof Uint8Array);
    const blob = data as Uint8Array;
    const streamBuffer: TileIO.StreamBuffer = new TileIO.StreamBuffer(blob.buffer);
    return this.loadTileContentFromStream(tile, streamBuffer, isCanceled);
  }
  public async loadTileContentFromStream(tile: Tile, streamBuffer: TileIO.StreamBuffer, isCanceled?: () => boolean): Promise<Tile.Content> {

    const position = streamBuffer.curPos;
    const format = streamBuffer.nextUint32;
    streamBuffer.curPos = position;

    if (undefined === isCanceled)
      isCanceled = () => !tile.isLoading;

    let reader: GltfTileIO.Reader | undefined;
    switch (format) {
      case TileIO.Format.Pnts:
        return { graphic: PntsTileIO.readPointCloud(streamBuffer, tile.root.iModel, tile.root.modelId, tile.root.is3d, tile.contentRange, IModelApp.renderSystem, tile.yAxisUp) };

      case TileIO.Format.B3dm:
        reader = B3dmTileIO.Reader.create(streamBuffer, tile.root.iModel, tile.root.modelId, tile.root.is3d, tile.contentRange, IModelApp.renderSystem, tile.yAxisUp, tile.isLeaf, tile.transformToRoot, isCanceled, this.getBatchIdMap());
        break;
      case TileIO.Format.IModel:
        reader = IModelTileIO.Reader.create(streamBuffer, tile.root.iModel, tile.root.modelId, tile.root.is3d, IModelApp.renderSystem, this._batchType, this._loadEdges, isCanceled, tile.hasSizeMultiplier ? tile.sizeMultiplier : undefined);
        break;
      case TileIO.Format.I3dm:
        reader = I3dmTileIO.Reader.create(streamBuffer, tile.root.iModel, tile.root.modelId, tile.root.is3d, tile.contentRange, IModelApp.renderSystem, tile.yAxisUp, tile.isLeaf, isCanceled);
        break;
      case TileIO.Format.Cmpt:
        const header = new CompositeTileIO.Header(streamBuffer);
        if (!header.isValid) return {};
        const branch = new GraphicBranch();
        for (let i = 0; i < header.tileCount; i++) {
          const tilePosition = streamBuffer.curPos;
          streamBuffer.advance(8);    // Skip magic and version.
          const tileBytes = streamBuffer.nextUint32;
          streamBuffer.curPos = tilePosition;
          const result = await this.loadTileContentFromStream(tile, streamBuffer, isCanceled);
          if (result.graphic)
            branch.add(result.graphic);
          streamBuffer.curPos = tilePosition + tileBytes;
        }
        return { graphic: branch.isEmpty ? undefined : IModelApp.renderSystem.createBranch(branch, Transform.createIdentity()), isLeaf: tile.isLeaf, sizeMultiplier: tile.sizeMultiplier };

      default:
        assert(false, "unknown tile format " + format);
        break;
    }

    let content: Tile.Content = {};
    if (undefined !== reader) {
      try {
        content = await reader.read();
      } catch (_err) {
        // Failure to load should prevent us from trying to load children
        content.isLeaf = true;
      }
    }

    return content;
  }

  public get viewFlagOverrides(): ViewFlag.Overrides { return defaultViewFlagOverrides; }
  public adjustContentIdSizeMultiplier(contentId: string, _sizeMultiplier: number): string { return contentId; }
}

/** A hierarchical level-of-detail tree of 3d [[Tile]]s to be rendered in a [[Viewport]].
 * @internal
 */
export namespace TileTree {
  /**
   * Parameters used to construct a TileTree
   * @internal
   */
  export interface Params {
    readonly id: string;
    readonly rootTile: TileProps;
    readonly iModel: IModelConnection;
    readonly is3d: boolean;
    readonly loader: TileLoader;
    readonly location: Transform;
    readonly modelId: Id64String;
    readonly maxTilesToSkip?: number;
    readonly yAxisUp?: boolean;
    readonly isBackgroundMap?: boolean;
    readonly clipVector?: ClipVector;
    readonly contentRange?: ElementAlignedBox3d;
  }

  /** Create TileTree.Params from JSON and context.
   * @internal
   */
  export function paramsFromJSON(props: TileTreeProps, iModel: IModelConnection, is3d: boolean, loader: TileLoader, modelId: Id64String): Params {
    const contentRange = undefined !== props.contentRange ? Range3d.fromJSON<ElementAlignedBox3d>(props.contentRange) : undefined;
    return {
      id: props.id,
      rootTile: props.rootTile,
      iModel,
      is3d,
      loader,
      location: Transform.fromJSON(props.location),
      modelId,
      maxTilesToSkip: props.maxTilesToSkip,
      yAxisUp: props.yAxisUp,
      isBackgroundMap: props.isBackgroundMap,
      contentRange,
    };
  }

  /** @internal */
  export enum LoadStatus {
    NotLoaded,
    Loading,
    Loaded,
    NotFound,
  }

  /** Owns and manages the lifecycle of a [[TileTree]]. It is in turn owned by an IModelConnection.Tiles object.
   * @note The *only* legitimate way to obtain a TileTree.Owner is via [[IModelConnection.Tiles.getTileTreeOwner]].
   * @internal
   */
  export interface Owner {
    /** The owned [[TileTree]]. Do not store a direct reference to it, because it may become disposed by its owner.
     * @see [[TileTree.Owner.load]] to ensure the tree is enqueued for loading if necessary.
     */
    readonly tileTree: TileTree | undefined;
    /** The current load state of the tree. This can be reset to NotLoaded after loading if the Owner becomes disposed or the tree is not used for a long period of time.
     * @see [[TileTree.Owner.load]] to ensure the tree is enqueued for loading if necessary.
     */
    readonly loadStatus: TileTree.LoadStatus;
    /** If the TileTree has not yet been loaded (loadStatus = NotLoaded), enqueue an asynchronous request to load it (changing loadStatus to Loading).
     * loadStatus will be updated to Loaded when that request succeeds, or NotFound if the request fails.
     * @returns the loaded TileTree if loading completed successfully, or undefined if the tree is still loading or loading failed.
     */
    load(): TileTree | undefined;
  }

  /** Interface adopted by an object which can supply a [[TileTree]] for rendering.
   * A supplier can supply any number of tile trees; the only requirement is that each tile tree has a unique identifier within the context of the supplier and a single IModelConnection.
   * The identifier can be any type, as the supplier is responsible for interpreting it.
   * @internal
   */
  export interface Supplier {
    /** Compare two tree Ids returning a negative number if lhs < rhs, a positive number if lhs > rhs, or 0 if the Ids are equivalent. */
    compareTileTreeIds(lhs: any, rhs: any): number;

    /** Produce the TileTree corresponding to the specified tree Id. The returned TileTree will be associated with its Id in a Map. */
    createTileTree(id: any, iModel: IModelConnection): Promise<TileTree | undefined>;
  }

  /** Describes the type of graphics produced by a [[TileTree.Reference]].
   * @internal
   */
  export enum GraphicType {
    /** Rendered behind all other geometry without depth. */
    BackgroundMap = 0,
    /** Rendered with normal scene graphics. */
    Scene = 1,
    /** Renders overlaid on all other geometry. */
    Overlay = 2,
  }

  /** A reference to a [[TileTree]] suitable for drawing within a [[Viewport]]. Does not *own* its TileTree - the tree is owned by a [[TileTree.Owner]].
   * The specific [[TileTree]] referenced by this object may change based on the current state of the Viewport in which it is drawn - for example,
   * as a result of changing the RenderMode, or animation settings, or classification settings, etc.
   * A reference to a TileTree is typically associated with a ViewState, a DisplayStyleState, or a ViewState.
   * Multiple references can refer to the same TileTree with different parameters and logic - for example, the same background map tiles can be displayed in two viewports with
   * differing levels of transparency.
   * @internal
   */
  export abstract class Reference implements RenderMemory.Consumer {
    /** The owner of the currently-referenced [[TileTree]]. Do not store a direct reference to it, because it may change or become disposed. */
    public abstract get treeOwner(): Owner;

    /** Disclose *all* TileTrees use by this reference. This may include things like map tiles used for draping on terrain.
     * Override this and call super if you have such auxiliary trees.
     * @note Any tree *NOT* disclosed becomes a candidate for *purging* (being unloaded from memory along with all of its tiles and graphics).
     */
    public discloseTileTrees(trees: Set<TileTree>): void {
      const tree = this.treeOwner.tileTree;
      if (undefined !== tree)
        trees.add(tree);
    }

    /** Adds this reference's graphics to the scene. By default this invokes [[TileTree.drawScene]] on the referenced TileTree, if it is loaded. */
    public addToScene(context: SceneContext): void {
      const tree = this.treeOwner.load();
      if (undefined !== tree)
        tree.drawScene(context);
    }

    /** Optionally return a tooltip describing the hit. */
    public getToolTip(_hit: HitDetail): HTMLElement | string | undefined { return undefined; }

    /** Optionally add any decorations specific to this reference. For example, map tile trees may add a logo image and/or copyright attributions.
     * @note This is only invoked for background maps and TiledGraphicsProviders - others have no decorations, but if they did implement this it would not be called.
     */
    public decorate(_context: DecorateContext): void { }

    /** Unions this reference's range with the supplied range to help compute a volume in world space for fitting a viewport to its contents.
     * Override this function if a reference's range should not be included in the fit range, or a range different from its tile tree's range should be used.
     */
    public unionFitRange(union: Range3d): void {
      const tree = this.treeOwner.load();
      if (undefined === tree || undefined === tree.rootTile)
        return;

      const contentRange = tree.rootTile.computeWorldContentRange();
      if (!contentRange.isNull)
        union.extendRange(contentRange);
    }

    public collectStatistics(stats: RenderMemory.Statistics): void {
      const tree = this.treeOwner.tileTree;
      if (undefined !== tree)
        tree.collectStatistics(stats);
    }
  }
}
