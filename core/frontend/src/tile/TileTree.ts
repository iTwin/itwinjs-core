/*---------------------------------------------------------------------------------------------
* Copyright (c) 2019 Bentley Systems, Incorporated. All rights reserved.
* Licensed under the MIT License. See LICENSE.md in the project root for license terms.
*--------------------------------------------------------------------------------------------*/
/** @module Tile */

import {
  assert,
  BeDuration,
  BeTimePoint,
  ByteStream,
  dispose,
  Id64,
  Id64String,
  IDisposable,
  JsonUtils,
} from "@bentley/bentleyjs-core";
import {
  ClipUtilities,
  ClipVector,
  ConvexClipPlaneSet,
  Matrix4d,
  Plane3dByOriginAndUnitNormal,
  Point3d,
  Point4d,
  Range3d,
  Transform,
} from "@bentley/geometry-core";
import {
  BatchType,
  bisectTileRange2d,
  bisectTileRange3d,
  ColorDef,
  CompositeTileHeader,
  ElementAlignedBox3d,
  Frustum,
  FrustumPlanes,
  RenderMode,
  TileFormat,
  TileProps,
  TileTreeProps,
  ViewFlag,
  ViewFlags,
} from "@bentley/imodeljs-common";

function pointIsContained(point: Point3d, range: Range3d): boolean {
  const tol = 1.0e-6;
  return point.x >= range.low.x - tol
    && point.y >= range.low.y - tol
    && point.z >= range.low.z - tol
    && point.x <= range.high.x + tol
    && point.y <= range.high.y + tol
    && point.z <= range.high.z + tol;
}

function pointsAreContained(points: Point3d[], range: Range3d): boolean {
  for (const point of points)
    if (!pointIsContained(point, range))
      return false;

  return true;
}

/** Sub-divide tile range until we find range of smallest tile containing all the points. */
function computeTileRangeContainingPoints(parentRange: Range3d, points: Point3d[], is2d: boolean): Range3d {
  const bisect = is2d ? bisectTileRange2d : bisectTileRange3d;
  const maxK = is2d ? 1 : 2;
  for (let i = 0; i < 2; i++) {
    for (let j = 0; j < 2; j++) {
      for (let k = 0; k < maxK; k++) {
        const range = parentRange.clone();
        bisect(range, 0 === i);
        bisect(range, 0 === j);
        if (!is2d)
          bisect(range, 0 === k);

        if (pointsAreContained(points, range))
          return computeTileRangeContainingPoints(range, points, is2d);
      }
    }
  }

  return parentRange;
}

/** A reference to a [[TileTree]] suitable for drawing within a [[Viewport]]. Does not *own* its TileTree - the tree is owned by a [[TileTree.Owner]].
 * The specific [[TileTree]] referenced by this object may change based on the current state of the Viewport in which it is drawn - for example,
 * as a result of changing the RenderMode, or animation settings, or classification settings, etc.
 * A reference to a TileTree is typically associated with a ViewState, a DisplayStyleState, or a ViewState.
 * Multiple references can refer to the same TileTree with different parameters and logic - for example, the same background map tiles can be displayed in two viewports with
 * differing levels of transparency.
 * @internal
 */
export abstract class TileTreeReference implements RenderMemory.Consumer {
  /** The owner of the currently-referenced [[TileTree]]. Do not store a direct reference to it, because it may change or become disposed. */
  public abstract get treeOwner(): TileTree.Owner;

  /** Disclose *all* TileTrees use by this reference. This may include things like map tiles used for draping on terrain.
   * Override this and call super if you have such auxiliary trees.
   * @note Any tree *NOT* disclosed becomes a candidate for *purging* (being unloaded from memory along with all of its tiles and graphics).
   */
  public discloseTileTrees(trees: TileTreeSet): void {
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

  public addPlanes(_planes: Plane3dByOriginAndUnitNormal[]): void { }
}

/** Divide range in half until we find smallest sub-range containing all the points. */
function computeSubRangeContainingPoints(parentRange: Range3d, points: Point3d[], is2d: boolean): Range3d {
  const bisect = is2d ? bisectTileRange2d : bisectTileRange3d;
  const range = parentRange.clone();
  bisect(range, false);
  if (pointsAreContained(points, range))
    return computeSubRangeContainingPoints(range, points, is2d);

  parentRange.clone(range);
  bisect(range, true);
  if (pointsAreContained(points, range))
    return computeSubRangeContainingPoints(range, points, is2d);

  return parentRange;
}

/** @internal */
export class TraversalDetails {
  public queuedChildren = new Array<Tile>();
  public childrenLoading = false;

  public initialize() {
    this.queuedChildren.length = 0;
    this.childrenLoading = false;
  }
}

/** @internal */
export class TraversalChildrenDetails {
  private _childDetails: TraversalDetails[] = [];

  public initialize() {
    for (const child of this._childDetails)
      child.initialize();
  }
  public getChildDetail(index: number) {
    while (this._childDetails.length <= index)
      this._childDetails.push(new TraversalDetails());

    return this._childDetails[index];
  }

  public combine(parentDetails: TraversalDetails) {
    parentDetails.queuedChildren.length = 0;
    for (const child of this._childDetails) {
      parentDetails.childrenLoading = parentDetails.childrenLoading || child.childrenLoading;
      for (const queuedChild of child.queuedChildren)
        parentDetails.queuedChildren.push(queuedChild);
    }
  }
}

/** @internal */
export class TraversalSelectionContext {
  public preloaded = new Set<Tile>();
  public missing = new Array<Tile>();
  constructor(public selected: Tile[], public displayedDescendants: Tile[][]) { }

  public selectOrQueue(tile: Tile, traversalDetails: TraversalDetails) {
    if (tile.isReady) {
      this.selected.push(tile);
      this.displayedDescendants.push(traversalDetails.queuedChildren.slice());
      traversalDetails.queuedChildren.length = 0;
    } else if (!tile.isNotFound) {
      traversalDetails.queuedChildren.push(tile);
      this.missing.push(tile);
    }
  }
  public preload(tile: Tile): void {
    this.preloaded.add(tile);
    if (!tile.isReady)
      this.missing.push(tile);
  }
  public select(tiles: Tile[]): void {
    for (const tile of tiles) {
      this.selected.push(tile);
      this.displayedDescendants.push([]);
    }
  }
}

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
  public traversalChildrenByDepth: TraversalChildrenDetails[] = [];
  public static debugSelectedTiles = false;           // tslint:disable-line: prefer-const
  public static debugMissingTiles = false;            // tslint:disable-line: prefer-const
  public static debugSelectedRanges = false;         // tslint:disable-line: prefer-const

  // If defined, tight range around the contents of the entire tile tree. This is always no more than the root tile's range, and often much smaller.
  public readonly contentRange?: ElementAlignedBox3d;

  public constructor(props: TileTree.Params) {
    this.iModel = props.iModel;
    this.is3d = props.is3d;
    this.id = props.id;
    this.modelId = Id64.fromJSON(props.modelId);
    this.location = props.location;

    if (undefined !== props.clipVector)
      this.clipVolume = IModelApp.renderSystem.createClipVolume(props.clipVector);

    this.maxTilesToSkip = JsonUtils.asInt(props.maxTilesToSkip, 100);
    this.loader = props.loader;
    this._rootTile = new Tile(Tile.paramsFromJSON(props.rootTile, this)); // causes TileTree to no longer be disposed (assuming the Tile loaded a graphic and/or its children)
    this.viewFlagOverrides = this.loader.viewFlagOverrides;
    this.yAxisUp = props.yAxisUp ? props.yAxisUp : false;
    this.contentRange = props.contentRange;
    if (!this.loader.isContentUnbounded) {
      const worldContentRange = this.rootTile.computeWorldContentRange();
      if (!worldContentRange.isNull)
        this.iModel.displayedExtents.extendRange(worldContentRange);
    }

    const admin = IModelApp.tileAdmin;
    this.expirationTime = Tile.LoadPriority.Context === this.loader.priority ? admin.realityTileExpirationTime : admin.tileExpirationTime;
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

  public selectTilesForScene(context: SceneContext): Tile[] { return this.loader.drawAsRealityTiles ? this.selectRealityTiles(this.createDrawArgs(context), new Array<Tile[]>()) : this.selectTiles(this.createDrawArgs(context)); }
  public selectTiles(args: Tile.DrawArgs): Tile[] {
    this._lastSelected = BeTimePoint.now();
    const selected: Tile[] = [];
    if (undefined !== this._rootTile)
      this._rootTile.selectTiles(selected, args);

    return this.loader.processSelectedTiles(selected, args);
  }

  public drawRealityTiles(args: Tile.DrawArgs): void {
    const displayedTileDescendants = new Array<Tile[]>();
    const selectedTiles = this.selectRealityTiles(args, displayedTileDescendants);
    if (!this.loader.parentsAndChildrenExclusive)
      selectedTiles.sort((a, b) => a.depth - b.depth);                    // If parent and child are not exclusive then display parents (low resolution) first.
    assert(selectedTiles.length === displayedTileDescendants.length);
    for (let i = 0; i < selectedTiles.length; i++) {
      const selectedTile = selectedTiles[i];
      if (undefined !== selectedTile.graphics) {
        const builder = TileTree.debugSelectedRanges ? args.context.createSceneGraphicBuilder() : undefined;
        const displayedDescendants = displayedTileDescendants[i];
        const graphics = selectedTile.graphics;
        if (0 === displayedDescendants.length || !this.loader.parentsAndChildrenExclusive || selectedTile.allChildrenIncluded(displayedDescendants)) {
          args.graphics.add(graphics);
          if (builder) selectedTile.addBoundingRectangle(builder, ColorDef.green);
        } else {
          if (builder) selectedTile.addBoundingRectangle(builder, ColorDef.red);
          for (const displayedDescendant of displayedDescendants) {
            const clipVector = displayedDescendant.getContentClip();
            if (undefined === clipVector) {
              args.graphics.add(graphics);
            } else {
              clipVector.transformInPlace(this.location);
              if (builder) displayedDescendant.addBoundingRectangle(builder, ColorDef.blue);
              const branch = new GraphicBranch();
              const doClipOverride = new ViewFlag.Overrides();
              doClipOverride.setShowClipVolume(true);
              branch.add(graphics);
              branch.setViewFlagOverrides(doClipOverride);
              const clipVolume = args.context.target.renderSystem.createClipVolume(clipVector);

              args.graphics.add(args.context.createGraphicBranch(branch, Transform.createIdentity(), { clipVolume }));
            }
          }
        }
        if (builder) args.graphics.add(builder.finish());
        const rangeGraphic = selectedTile.getRangeGraphic(args.context);
        if (undefined !== rangeGraphic)
          args.graphics.add(rangeGraphic);
      }
    }
    args.drawGraphics();
    args.context.viewport.numSelectedTiles += selectedTiles.length;
  }
  public getTraversalChildren(depth: number) {
    while (this.traversalChildrenByDepth.length <= depth)
      this.traversalChildrenByDepth.push(new TraversalChildrenDetails());

    return this.traversalChildrenByDepth[depth];
  }

  public selectRealityTiles(args: Tile.DrawArgs, displayedDescendants: Tile[][]): Tile[] {
    this._lastSelected = BeTimePoint.now();
    const selected: Tile[] = [];
    const context = new TraversalSelectionContext(selected, displayedDescendants);

    this._rootTile.selectRealityTiles(context, args, new TraversalDetails());

    for (const tile of context.missing)
      args.insertMissing(tile);

    if (TileTree.debugSelectedTiles) {
      this.logTiles("Selected: ", selected);
      const preloaded = [];
      for (const tile of context.preloaded)
        preloaded.push(tile);
      this.logTiles("Preloaded: ", preloaded);
    }

    if (TileTree.debugMissingTiles && context.missing.length)
      this.logTiles("Missing: ", context.missing);

    return selected;
  }
  private logTiles(label: string, tiles: Tile[]) {
    let depthString = "";
    let min = 10000, max = -10000;
    const depthMap = new Map<number, number>();
    for (const tile of tiles) {
      const depth = tile.depth;
      min = Math.min(min, tile.depth);
      max = Math.max(max, tile.depth);
      const found = depthMap.get(depth);
      depthMap.set(depth, found === undefined ? 1 : found + 1);
    }

    depthMap.forEach((key, value) => depthString += key + "-" + value + ", ");
    console.log(label + ": " + tiles.length + " Min: " + min + " Max: " + max + " Depths: " + depthString);    // tslint:disable-line
  }

  public computeTileRangeForFrustum(vp: Viewport): Range3d | undefined {
    if (this.range.isNull)
      return undefined;

    const range = this.location.multiplyRange(this.range);
    const frustum = vp.getFrustum(CoordSystem.World, true);
    const frustumPlanes = new FrustumPlanes(frustum);
    const planes = ConvexClipPlaneSet.createPlanes(frustumPlanes.planes!);
    const points: Point3d[] = [];
    ClipUtilities.announceLoopsOfConvexClipPlaneSetIntersectRange(planes, range, (array) => {
      for (const point of array.points)
        points.push(point);
    }, true, true, false);

    if (0 === points.length)
      return undefined;

    assert(pointsAreContained(points, range));
    const useTileRange = false;
    return useTileRange ? computeTileRangeContainingPoints(range, points, this.is2d) : computeSubRangeContainingPoints(range, points, this.is2d);
  }

  public drawScene(context: SceneContext): void {
    this.draw(this.createDrawArgs(context));
  }

  public draw(args: Tile.DrawArgs): void {
    if (this.loader.drawAsRealityTiles)
      return this.drawRealityTiles(args);

    const selectedTiles = this.selectTiles(args);
    for (const selectedTile of selectedTiles)
      selectedTile.drawGraphics(args);

    args.drawGraphics();
    args.context.viewport.numSelectedTiles += selectedTiles.length;
  }

  public createDrawArgs(context: SceneContext): Tile.DrawArgs {
    const now = BeTimePoint.now();
    const purgeOlderThan = now.minus(this.expirationTime);
    return new Tile.DrawArgs(context, this.location.clone(), this, now, purgeOlderThan, this.clipVolume, this.loader.parentsAndChildrenExclusive);
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
    if (tile.children === undefined) {
      for (const boxPoint of box.points) {
        matrix.multiplyPoint3d(boxPoint, 1, TileTree._scratchPoint4d);
        if (TileTree._scratchPoint4d.w > .0001)
          range.extendXYZW(TileTree._scratchPoint4d.x, TileTree._scratchPoint4d.y, TileTree._scratchPoint4d.z, TileTree._scratchPoint4d.w);
        else
          range.high.z = Math.max(1.0, range.high.z);   // behind eye plane...
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

  public countTiles(): number {
    return 1 + this.rootTile.countDescendants();
  }
}

const defaultViewFlagOverrides = new ViewFlag.Overrides(ViewFlags.fromJSON({
  renderMode: RenderMode.SmoothShade,
  noCameraLights: true,
  noSourceLights: true,
  noSolarLight: true,
}));

const scratchTileCenterWorld = new Point3d();
const scratchTileCenterView = new Point3d();
/** Serves as a "handler" for a specific type of [[TileTree]]. Its primary responsibilities involve loading tile content.
 * @internal
 */
export abstract class TileLoader {
  private _containsPointClouds = false;

  public abstract async getChildrenProps(parent: Tile): Promise<TileProps[]>;
  public abstract async requestTileContent(tile: Tile, isCanceled: () => boolean): Promise<TileRequest.Response>;
  public abstract get maxDepth(): number;
  public abstract get priority(): Tile.LoadPriority;
  protected get _batchType(): BatchType { return BatchType.Primary; }
  protected get _loadEdges(): boolean { return true; }
  public abstract tileRequiresLoading(params: Tile.Params): boolean;
  public getBatchIdMap(): BatchedTileIdMap | undefined { return undefined; }
  public get isContentUnbounded(): boolean { return false; }
  public get containsPointClouds(): boolean { return this._containsPointClouds; }
  public get preloadRealityParentDepth(): number { return 0; }
  public get preloadRealityParentSkip(): number { return 0; }
  public get drawAsRealityTiles(): boolean { return false; }
  public get parentsAndChildrenExclusive(): boolean { return true; }

  public computeTilePriority(tile: Tile, _viewports: Iterable<Viewport>): number {
    return tile.depth;
  }

  public processSelectedTiles(selected: Tile[], _args: Tile.DrawArgs): Tile[] { return selected; }

  // NB: The isCanceled arg is chiefly for tests...in usual case it just returns false if the tile is no longer in 'loading' state.
  public async loadTileContent(tile: Tile, data: TileRequest.ResponseData, isCanceled?: () => boolean): Promise<Tile.Content> {
    assert(data instanceof Uint8Array);
    const blob = data as Uint8Array;
    const streamBuffer = new ByteStream(blob.buffer);
    return this.loadTileContentFromStream(tile, streamBuffer, isCanceled);
  }

  public async loadTileContentFromStream(tile: Tile, streamBuffer: ByteStream, isCanceled?: () => boolean): Promise<Tile.Content> {
    const position = streamBuffer.curPos;
    const format = streamBuffer.nextUint32;
    streamBuffer.curPos = position;

    if (undefined === isCanceled)
      isCanceled = () => !tile.isLoading;

    let reader: GltfReader | undefined;
    switch (format) {
      case TileFormat.Pnts:
        this._containsPointClouds = true;
        return { graphic: readPointCloudTileContent(streamBuffer, tile.root.iModel, tile.root.modelId, tile.root.is3d, tile.contentRange, IModelApp.renderSystem, tile.yAxisUp) };

      case TileFormat.B3dm:
        reader = B3dmReader.create(streamBuffer, tile.root.iModel, tile.root.modelId, tile.root.is3d, tile.contentRange, IModelApp.renderSystem, tile.yAxisUp, tile.isLeaf, tile.center, tile.transformToRoot, isCanceled, this.getBatchIdMap());
        break;
      case TileFormat.IModel:
        reader = ImdlReader.create(streamBuffer, tile.root.iModel, tile.root.modelId, tile.root.is3d, IModelApp.renderSystem, this._batchType, this._loadEdges, isCanceled, tile.hasSizeMultiplier ? tile.sizeMultiplier : undefined, tile.contentId);
        break;
      case TileFormat.I3dm:
        reader = I3dmReader.create(streamBuffer, tile.root.iModel, tile.root.modelId, tile.root.is3d, tile.contentRange, IModelApp.renderSystem, tile.yAxisUp, tile.isLeaf, isCanceled);
        break;
      case TileFormat.Cmpt:
        const header = new CompositeTileHeader(streamBuffer);
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

  public static computeTileClosestToEyePriority(tile: Tile, viewports: Iterable<Viewport>): number {
    // Prioritize tiles closer to eye.
    // NB: In NPC coords, 0 = far plane, 1 = near plane.
    const center = tile.root.location.multiplyPoint3d(tile.center, scratchTileCenterWorld);
    let minDistance = 1.0;
    for (const viewport of viewports) {
      const npc = viewport.worldToNpc(center, scratchTileCenterView);
      const distance = 1.0 - npc.z;
      minDistance = Math.min(distance, minDistance);
    }

    return minDistance;
  }
}

/** Specialization of loader used for context tiles (reality models and maps).
 * Turn son optimized realitytile traversal.
 * @internal
 */
export abstract class ContextTileLoader extends TileLoader {
  private _preloadRealityParentDepth: number;
  private _preloadRealityParentSkip: number;
  public get preloadRealityParentDepth(): number { return this._preloadRealityParentDepth; }
  public get preloadRealityParentSkip(): number { return this._preloadRealityParentSkip; }
  public get drawAsRealityTiles(): boolean { return true; }

  constructor() {
    super();
    this._preloadRealityParentDepth = IModelApp.tileAdmin.contextPreloadParentDepth;
    this._preloadRealityParentSkip = IModelApp.tileAdmin.contextPreloadParentSkip;
  }
  public computeTilePriority(tile: Tile, viewports: Iterable<Viewport>): number {
    return TileLoader.computeTileClosestToEyePriority(tile, viewports);
  }
}

/** @internal */
export interface TileTreeDiscloser {
  discloseTileTrees: (trees: TileTreeSet) => void;
}

/** A set of TileTrees, populated by a call to a `discloseTileTrees` function on an object like a [[Viewport]], [[ViewState]], or [[TileTreeReference]].
 * @internal
 */
export class TileTreeSet {
  private readonly _processed = new Set<TileTreeDiscloser>();
  public readonly trees = new Set<TileTree>();

  public add(tree: TileTree): void {
    this.trees.add(tree);
  }

  public disclose(discloser: TileTreeDiscloser): void {
    if (!this._processed.has(discloser)) {
      this._processed.add(discloser);
      discloser.discloseTileTrees(this);
    }
  }

  public get size(): number { return this.trees.size; }
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

    /** Do not call this directly.
     * @internal
     */
    dispose(): void;

    /** It is generally not a good idea to await the TileTree - use load() instead. */
    loadTree(): Promise<TileTree | undefined>;
  }

  /** Interface adopted by an object which can supply a [[TileTree]] for rendering.
   * A supplier can supply any number of tile trees; the only requirement is that each tile tree has a unique identifier within the context of the supplier and a single IModelConnection.
   * The identifier can be any type, as the supplier is responsible for interpreting it.
   * However, it is *essential* that the identifier is treated as immutable, because it is used as a lookup key in a sorted collection; changes to its properties may affect comparison and therefore sorting order.
   * @internal
   */
  export interface Supplier {
    /** Compare two tree Ids returning a negative number if lhs < rhs, a positive number if lhs > rhs, or 0 if the Ids are equivalent. */
    compareTileTreeIds(lhs: any, rhs: any): number;

    /** Produce the TileTree corresponding to the specified tree Id. The returned TileTree will be associated with its Id in a Map. */
    createTileTree(id: any, iModel: IModelConnection): Promise<TileTree | undefined>;
  }

  /** Describes the type of graphics produced by a [[TileTreeReference]].
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
}

import { IModelApp } from "../IModelApp";
import { IModelConnection } from "../IModelConnection";
import { GraphicBranch, RenderClipVolume, RenderMemory } from "../render/System";
import { DecorateContext, SceneContext } from "../ViewContext";
import { B3dmReader } from "./B3dmReader";
import { GltfReader } from "./GltfReader";
import { HitDetail } from "../HitDetail";
import { I3dmReader } from "./I3dmReader";
import { ImdlReader } from "./ImdlReader";
import { readPointCloudTileContent } from "./PntsReader";
import { TileRequest } from "./TileRequest";
import {
  Tile,
} from "./Tile";
import { CoordSystem, Viewport } from "../Viewport";
