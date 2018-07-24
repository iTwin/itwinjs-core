/*---------------------------------------------------------------------------------------------
|  $Copyright: (c) 2018 Bentley Systems, Incorporated. All rights reserved. $
 *--------------------------------------------------------------------------------------------*/
/** @module Tile */

import { compareNumbers, compareStrings, SortedArray, Id64, BeTimePoint, BeDuration, JsonUtils, dispose, IDisposable } from "@bentley/bentleyjs-core";
import { ElementAlignedBox3d, ViewFlag, Frustum, FrustumPlanes, TileProps, TileTreeProps, TileId, ColorDef } from "@bentley/imodeljs-common";
import { Range3d, Point3d, Transform, ClipVector, ClipPlaneContainment } from "@bentley/geometry-core";
import { SceneContext } from "../ViewContext";
import { GeometricModelState } from "../ModelState";
import { RenderGraphic, GraphicBranch } from "../render/System";
import { GraphicType } from "../render/GraphicBuilder";
import { IModelConnection } from "../IModelConnection";
import { IModelApp } from "../IModelApp";
import { TileIO } from "./TileIO";
import { GltfTileIO } from "./GltfTileIO";
import { B3dmTileIO } from "./B3dmTileIO";
import { PntsTileIO } from "./PntsTileIO";
import { IModelTileIO } from "./IModelTileIO";

function compareMissingTiles(lhs: Tile, rhs: Tile): number {
  const diff = compareNumbers(lhs.depth, rhs.depth);
  return 0 === diff ? compareStrings(lhs.id, rhs.id) : diff;
}

// ###TODO: TileRequests and MissingNodes are likely to change...
export class MissingNodes extends SortedArray<Tile> {
  public constructor() { super(compareMissingTiles); }
}

export class TileRequests {
  private _map = new Map<TileTree, MissingNodes>();

  public getMissing(root: TileTree): MissingNodes {
    let found = this._map.get(root);
    if (undefined === found) {
      found = new MissingNodes();
      this._map.set(root, found);
    }

    return found;
  }
}

export class Tile implements IDisposable {
  public readonly root: TileTree;
  public readonly range: ElementAlignedBox3d;
  public readonly parent: Tile | undefined;
  public readonly depth: number;
  public loadStatus: Tile.LoadStatus;
  public readonly id: string;
  public readonly maximumSize: number;
  public readonly center: Point3d;
  public readonly radius: number;
  public readonly zoomFactor?: number;
  private readonly yAxisUp: boolean;
  private readonly _childIds: string[];
  private _childrenLastUsed: BeTimePoint;
  private _childrenLoadStatus: TileTree.LoadStatus;
  private _children?: Tile[];
  private _contentRange?: ElementAlignedBox3d;
  private _graphic?: RenderGraphic;
  private _rangeGraphic?: RenderGraphic;

  // ###TODO: Artificially limiting depth for now until tile selection is fixed...

  public constructor(props: Tile.Params, private _maxDepth = 32) {
    this.root = props.root;
    this.range = props.range;
    this.parent = props.parent;
    this.depth = 1 + (undefined !== this.parent ? this.parent.depth : 0);
    this.loadStatus = Tile.LoadStatus.NotLoaded;
    this.id = props.id;
    this.maximumSize = props.maximumSize;
    this._childIds = props.childIds;
    this._childrenLastUsed = BeTimePoint.now();
    this._contentRange = props.contentRange;
    this.yAxisUp = props.yAxisUp ? props.yAxisUp : false;

    // ###TODO: Defer loading of graphics (separate request to backend to obtain tile geometry)
    this.loadGraphics(props.geometry);

    this.center = this.range.low.interpolate(0.5, this.range.high);
    this.radius = 0.5 * this.range.low.distance(this.range.high);

    // ###TODO: Back-end is not setting maximumSize in json!
    if (undefined === this.maximumSize)
      this.maximumSize = this.hasGraphics ? 512 : 0;

    this._childrenLoadStatus = this.hasChildren && this.depth < this._maxDepth ? TileTree.LoadStatus.NotLoaded : TileTree.LoadStatus.Loaded;
  }

  public dispose() {
    this._graphic = dispose(this._graphic);
    this._rangeGraphic = dispose(this._rangeGraphic);

    if (this._children)
      for (const child of this._children)
        dispose(child);

    this._children = undefined;
    this.loadStatus = Tile.LoadStatus.Abandoned;
  }

  private loadGraphics(blob?: Uint8Array): void {
    if (undefined === blob) {
      this.setIsReady();
      return;
    }

    this.loadStatus = Tile.LoadStatus.Loading;

    const streamBuffer: TileIO.StreamBuffer = new TileIO.StreamBuffer(blob.buffer);
    const format = streamBuffer.nextUint32;
    const isCanceled = () => !this.isLoading;
    let reader: GltfTileIO.Reader | undefined;
    streamBuffer.rewind(4);
    switch (format) {
      case TileIO.Format.B3dm:
        reader = B3dmTileIO.Reader.create(streamBuffer, this.root.model, this.range, IModelApp.renderSystem, this.yAxisUp, isCanceled);
        break;

      case TileIO.Format.IModel:
        reader = IModelTileIO.Reader.create(streamBuffer, this.root.model, IModelApp.renderSystem, isCanceled);
        break;

      case TileIO.Format.Pnts:
        {
          this._graphic = PntsTileIO.readPointCloud(streamBuffer, this.root.model, this.range, IModelApp.renderSystem, this.yAxisUp);
          this.setIsReady();
          return;
        }
    }

    if (undefined === reader) {
      this.setNotFound();
      return;
    }

    const read = reader.read();
    read.catch((_err) => this.setNotFound());
    read.then((result) => {
      // Make sure we still want this tile - may been unloaded, imodel may have been closed, IModelApp may have shut down taking render system with it, etc.
      if (this.isLoading) {
        this._graphic = result.renderGraphic;
        this.setIsReady();
      }
    });
  }

  public get isQueued(): boolean { return Tile.LoadStatus.Queued === this.loadStatus; }
  public get isAbandoned(): boolean { return Tile.LoadStatus.Abandoned === this.loadStatus; }
  public get isNotLoaded(): boolean { return Tile.LoadStatus.NotLoaded === this.loadStatus; }
  public get isLoading(): boolean { return Tile.LoadStatus.Loading === this.loadStatus; }
  public get isNotFound(): boolean { return Tile.LoadStatus.NotFound === this.loadStatus; }
  public get isReady(): boolean { return Tile.LoadStatus.Ready === this.loadStatus; }

  public setIsReady(): void { this.loadStatus = Tile.LoadStatus.Ready; }
  public setIsQueued(): void { this.loadStatus = Tile.LoadStatus.Queued; }
  public setNotLoaded(): void { this.loadStatus = Tile.LoadStatus.NotLoaded; }
  public setNotFound(): void { this.loadStatus = Tile.LoadStatus.NotFound; }
  public setAbandoned(): void {
    const children = this.children;
    if (undefined !== children)
      for (const child of children)
        child.setAbandoned();

    this.loadStatus = Tile.LoadStatus.Abandoned;
  }

  public get isEmpty(): boolean { return this.isReady && !this.hasGraphics && !this.hasChildren; }
  public get hasChildren(): boolean { return 0 !== this._childIds.length; }
  public get contentRange(): ElementAlignedBox3d { return undefined !== this._contentRange ? this._contentRange : this.range; }
  public get isLeaf(): boolean { return !this.hasChildren; }
  public get isDisplayable(): boolean { return this.maximumSize > 0; }
  public get isParentDisplayable(): boolean { return undefined !== this.parent && this.parent.isDisplayable; }

  public get graphics(): RenderGraphic | undefined { return this._graphic; }
  public get hasGraphics(): boolean { return undefined !== this.graphics; }
  public get hasZoomFactor(): boolean { return undefined !== this.zoomFactor; }
  public get children(): Tile[] | undefined { return this._children; }
  public get iModel(): IModelConnection { return this.root.iModel; }

  public get hasContentRange(): boolean { return undefined !== this._contentRange; }
  public isRegionCulled(args: Tile.DrawArgs): boolean { return this.isCulled(this.range, args); }
  public isContentCulled(args: Tile.DrawArgs): boolean { return this.isCulled(this.contentRange, args); }

  private getRangeGraphic(context: SceneContext): RenderGraphic | undefined {
    if (undefined === this._rangeGraphic) {
      const builder = context.createGraphic(Transform.createIdentity(), GraphicType.Scene);
      builder.setSymbology(ColorDef.green, ColorDef.green, 1);
      builder.addRangeBox(this.contentRange);
      this._rangeGraphic = builder.finish();
    }

    return this._rangeGraphic;
  }

  /** Returns the range of this tile's contents in world coordinates. */
  public computeWorldContentRange(): ElementAlignedBox3d {
    const range = new ElementAlignedBox3d();
    this.root.location.multiplyRange(this.contentRange, range);
    return range;
  }

  public computeVisibility(args: Tile.DrawArgs): Tile.Visibility {
    // NB: We test for region culling before isDisplayable - otherwise we will never unload children of undisplayed tiles when
    // they are outside frustum
    if (this.isEmpty || this.isRegionCulled(args))
      return Tile.Visibility.OutsideFrustum;

    // some nodes are merely for structure and don't have any geometry
    if (!this.isDisplayable)
      return Tile.Visibility.TooCoarse;

    const hasContentRange = this.hasContentRange;
    if (!this.hasChildren) {
      if (hasContentRange && this.isContentCulled(args))
        return Tile.Visibility.OutsideFrustum;
      else
        return Tile.Visibility.Visible; // it's a leaf node
    }

    const radius = args.getTileRadius(this); // use a sphere to test pixel size. We don't know the orientation of the image within the bounding box.
    const center = args.getTileCenter(this);

    const pixelSizeAtPt = args.context.getPixelSizeAtPoint(center);
    const pixelSize = 0 !== pixelSizeAtPt ? radius / pixelSizeAtPt : 1.0e-3;

    if (pixelSize > this.maximumSize * args.tileSizeModifier)
      return Tile.Visibility.TooCoarse;
    else if (hasContentRange && this.isContentCulled(args))
      return Tile.Visibility.OutsideFrustum;
    else
      return Tile.Visibility.Visible;
  }

  public selectTiles(selected: Tile[], args: Tile.DrawArgs, numSkipped: number = 0): Tile.SelectParent {
    const vis = this.computeVisibility(args);
    if (Tile.Visibility.OutsideFrustum === vis) {
      this.unloadChildren(args.purgeOlderThan);
      return Tile.SelectParent.No;
    }

    if (Tile.Visibility.Visible === vis) {
      // This tile is of appropriate resolution to draw. If need loading or refinement, enqueue.
      if (!this.isReady)
        args.insertMissing(this);

      if (this.hasGraphics) {
        // It can be drawn - select it
        selected.push(this);
        this.unloadChildren(args.purgeOlderThan);
      } else {
        // It can't be drawn. If direct children are drawable, draw them in this tile's place; otherwise draw the parent.
        // Do not load/request the children for this purpose.
        const initialSize = selected.length;
        const kids = this.children;
        if (undefined === kids)
          return Tile.SelectParent.Yes;

        for (const kid of kids) {
          if (Tile.Visibility.OutsideFrustum !== kid.computeVisibility(args)) {
            if (!kid.hasGraphics) {
              selected.length = initialSize;
              return Tile.SelectParent.Yes;
            } else {
              selected.push(kid);
            }
          }
        }

        this._childrenLastUsed = args.now;
      }

      // We're drawing either this tile, or its direct children.
      return Tile.SelectParent.No;
    }

    // This tile is too coarse to draw. Try to draw something more appropriate.
    // If it is not ready to draw, we may want to skip loading in favor of loading its descendants.
    let canSkipThisTile = this.isReady || this.isParentDisplayable;
    if (canSkipThisTile && this.isDisplayable) { // skipping an undisplayable tile doesn't count toward the maximum
      // Some tiles do not sub-divide - they only facet the same geometry to a higher resolution. We can skip directly to the correct resolution.
      const isNotReady = !this.hasGraphics && !this.hasZoomFactor;
      if (isNotReady) {
        if (numSkipped >= this.root.maxTilesToSkip)
          canSkipThisTile = false;
        else
          numSkipped += 1;
      }
    }

    this.loadChildren(); // NB: asynchronous
    const children = canSkipThisTile ? this.children : undefined;
    if (undefined !== children) {
      this._childrenLastUsed = args.now;
      let allChildrenDrawable = true;
      const initialSize = selected.length;
      for (const child of children) {
        if (Tile.SelectParent.Yes === child.selectTiles(selected, args, numSkipped))
          allChildrenDrawable = false; // NB: We must continue iterating children so that they can be requested if missing.
      }

      if (allChildrenDrawable)
        return Tile.SelectParent.No;

      selected.length = initialSize;
    }

    if (this.hasGraphics) {
      if (!this.isReady)
        args.insertMissing(this);

      selected.push(this);
      return Tile.SelectParent.No;
    }

    args.insertMissing(this);
    return this.isParentDisplayable ? Tile.SelectParent.Yes : Tile.SelectParent.No;
  }

  public drawGraphics(args: Tile.DrawArgs): void {
    if (undefined !== this.graphics) {
      args.graphics.add(this.graphics);
      if (args.context.viewport.wantTileBoundingBoxes) {
        const rangeGraphics = this.getRangeGraphic(args.context);
        if (undefined !== rangeGraphics)
          args.graphics.add(rangeGraphics);
      }
    }
  }

  private unloadChildren(olderThan: BeTimePoint): void {
    const children = this.children;
    if (undefined === children) {
      return;
    }

    if (this._childrenLastUsed.milliseconds > olderThan.milliseconds) {
      // this node has been used recently. Keep it, but potentially unload its grandchildren.
      for (const child of children)
        child.unloadChildren(olderThan);
    } else {
      for (const child of children) {
        child.setAbandoned();
        child.dispose();
      }

      this._children = undefined;
      this._childrenLoadStatus = TileTree.LoadStatus.NotLoaded;
    }
  }

  private static scratchWorldFrustum = new Frustum();
  private static scratchRootFrustum = new Frustum();
  private isCulled(range: ElementAlignedBox3d, args: Tile.DrawArgs) {
    const box = Frustum.fromRange(range, Tile.scratchRootFrustum);
    const worldBox = box.transformBy(args.location, Tile.scratchWorldFrustum);
    const isOutside = FrustumPlanes.Containment.Outside === args.context.frustumPlanes.computeFrustumContainment(worldBox);
    const isClipped = !isOutside && undefined !== args.clip && ClipPlaneContainment.StronglyOutside === args.clip.classifyPointContainment(box.points);
    const isCulled = isOutside || isClipped;
    return isCulled;
  }

  private loadChildren(): TileTree.LoadStatus {
    if (TileTree.LoadStatus.NotLoaded === this._childrenLoadStatus) {
      this._childrenLoadStatus = TileTree.LoadStatus.Loading;
      this.root.loader!.getTileProps(this._childIds).then((props: TileProps[]) => {
        this._children = [];
        this._childrenLoadStatus = TileTree.LoadStatus.Loaded;
        if (undefined !== props) {
          // If this tile is undisplayable, update its content range based on children's content ranges.
          const parentRange = this.hasContentRange ? undefined : new ElementAlignedBox3d();
          for (const prop of props) {
            // ###TODO if child is empty don't bother adding it to list...
            const child = new Tile(Tile.Params.fromJSON(prop, this.root, this), this.root.loader!.getMaxDepth());
            this._children.push(child);
            if (undefined !== parentRange && !child.isEmpty)
              parentRange.extendRange(child.contentRange);
          }

          if (undefined !== parentRange)
            this._contentRange = parentRange;
        }

        IModelApp.viewManager.onNewTilesReady();
      }).catch((_err) => { this._childrenLoadStatus = TileTree.LoadStatus.NotFound; this._children = undefined; });
    }

    return this._childrenLoadStatus;
  }
}

export namespace Tile {
  /** Describes the current status of a Tile. Tiles are loaded by making asynchronous requests to the backend. */
  export const enum LoadStatus {
    NotLoaded = 0, // No attempt to load the tile has been made, or the tile has since been unloaded. It currently has no graphics.
    Queued = 1, // A request has been made to load the tile from the backend, and a response is pending.
    Loading = 2, // A response has been received from the backend, and the tile's graphics and other data are being loaded on the frontend.
    Ready = 3, // The tile has been loaded, and if the tile is displayable it has graphics.
    NotFound = 4, // The tile was requested, and the response from the backend indicated the tile could not be found.
    Abandoned = 5, // A request was made to the backed, then later cancelled as it was determined that the tile is no longer needed on the frontend.
  }

  /** Describes the visibility of a tile based on its size and a view frustum. */
  export const enum Visibility {
    OutsideFrustum, // this tile is entirely outside of the viewing frustum
    TooCoarse, // this tile is too coarse to be drawn
    Visible, // this tile is of the correct size to be drawn
  }

  /** Returned by Tile.selectTiles() to indicate whether a parent tile should be drawn in place of a child tile. */
  export const enum SelectParent {
    No,
    Yes,
  }

  /** Arguments used when selecting and drawing tiles. */
  export class DrawArgs {
    public readonly location: Transform;
    public readonly root: TileTree;
    public clip?: ClipVector;
    public readonly context: SceneContext;
    public readonly graphics: GraphicBranch = new GraphicBranch();
    public readonly now: BeTimePoint;
    public readonly purgeOlderThan: BeTimePoint;
    public readonly missing: MissingNodes;

    public constructor(context: SceneContext, location: Transform, root: TileTree, now: BeTimePoint, purgeOlderThan: BeTimePoint, clip?: ClipVector) {
      this.location = location;
      this.root = root;
      this.clip = clip;
      this.context = context;
      this.now = now;
      this.purgeOlderThan = purgeOlderThan;
      this.graphics.setViewFlagOverrides(root.viewFlagOverrides);
      this.missing = context.requests.getMissing(root);
    }

    public get tileSizeModifier(): number { return 1.0; } // ###TODO? may adjust for performance, or device pixel density, etc
    public getTileCenter(tile: Tile): Point3d { return this.location.multiplyPoint3d(tile.center); }

    private static scratchRange = new Range3d();
    public getTileRadius(tile: Tile): number {
      let range = tile.range.clone(DrawArgs.scratchRange);
      range = this.location.multiplyRange(range, range);
      return 0.5 * (tile.root.is3d ? range.low.distance(range.high) : range.low.distanceXY(range.high));
    }

    public clear(): void {
      this.graphics.clear();
      this.missing.clear();
    }

    public drawGraphics(): void {
      if (this.graphics.isEmpty)
        return;

      const clipVolume = this.clip !== undefined ? IModelApp.renderSystem.getClipVolume(this.clip, this.root.iModel) : undefined;
      const branch = this.context.createBranch(this.graphics, this.location, clipVolume);
      this.context.outputGraphic(branch);
    }

    public insertMissing(tile: Tile): void { this.missing.insert(tile); }
  }

  /** Parameters used to construct a Tile. */
  export class Params {
    public constructor(
      public readonly root: TileTree,
      public readonly id: string,
      public readonly range: ElementAlignedBox3d,
      public readonly maximumSize: number,
      public readonly childIds: string[],
      public readonly yAxisUp?: boolean,
      public readonly parent?: Tile,
      public readonly contentRange?: ElementAlignedBox3d,
      public readonly zoomFactor?: number,
      public readonly geometry?: Uint8Array) { }

    public static fromJSON(props: TileProps, root: TileTree, parent?: Tile) {
      // ###TODO: We should be requesting the geometry separately, when needed
      // ###TODO: Transmit as binary, not base-64
      let tileBytes: Uint8Array | undefined;
      if (typeof props.geometry === "string") {
        tileBytes = new Uint8Array(atob(props.geometry as string).split("").map((c) => c.charCodeAt(0)));
      } else if (props.geometry instanceof ArrayBuffer) {
        tileBytes = new Uint8Array(props.geometry as ArrayBuffer);
      } else { tileBytes = undefined; }
      const contentRange = undefined !== props.contentRange ? ElementAlignedBox3d.fromJSON(props.contentRange) : undefined;
      return new Params(root, props.id.tileId, ElementAlignedBox3d.fromJSON(props.range), props.maximumSize, props.childIds, props.yAxisUp, parent, contentRange, props.zoomFactor, tileBytes);
    }
  }
}

export class TileTree implements IDisposable {
  public readonly model: GeometricModelState;
  public readonly location: Transform;
  public readonly id: Id64;
  public readonly viewFlagOverrides: ViewFlag.Overrides;
  public readonly maxTilesToSkip: number;
  public expirationTime: BeDuration;
  public clipVector?: ClipVector;
  protected _rootTile: Tile;
  protected _loader?: TileLoader;

  public constructor(props: TileTree.Params) {
    this.model = props.model;
    this.id = props.id;
    this.location = props.location;
    this.expirationTime = BeDuration.fromSeconds(5000); // ###TODO tile purging strategy
    this.clipVector = props.clipVector;
    this.viewFlagOverrides = undefined !== props.viewFlagOverrides ? props.viewFlagOverrides : new ViewFlag.Overrides();
    this.maxTilesToSkip = JsonUtils.asInt(props.maxTilesToSkip, 100);
    this._rootTile = new Tile(Tile.Params.fromJSON(props.rootTile, this));
    this._loader = props.loader;
  }

  public get rootTile(): Tile { return this._rootTile; }
  public get loader(): TileLoader | undefined { return this._loader; }

  public dispose() {
    dispose(this._rootTile);
  }

  public get is3d(): boolean { return this.model.is3d; }
  public get is2d(): boolean { return this.model.is2d; }
  public get modelId(): Id64 { return this.model.id; }
  public get iModel(): IModelConnection { return this.model.iModel; }
  public get range(): ElementAlignedBox3d { return this._rootTile !== undefined ? this._rootTile.range : new ElementAlignedBox3d(); }

  public selectTilesForScene(context: SceneContext): Tile[] { return this.selectTiles(this.createDrawArgs(context)); }
  public selectTiles(args: Tile.DrawArgs): Tile[] {
    const selected: Tile[] = [];
    if (undefined !== this._rootTile)
      this._rootTile.selectTiles(selected, args);

    return selected;
  }

  public drawScene(context: SceneContext): void { this.draw(this.createDrawArgs(context)); }
  public draw(args: Tile.DrawArgs): void {
    const selectedTiles = this.selectTiles(args);
    for (const selectedTile of selectedTiles)
      selectedTile.drawGraphics(args);

    args.drawGraphics();
  }

  // ###TODO: requestTile(), requestTiles()

  public createDrawArgs(context: SceneContext): Tile.DrawArgs {
    const now = BeTimePoint.now();
    const purgeOlderThan = now.minus(this.expirationTime);
    return new Tile.DrawArgs(context, this.location, this, now, purgeOlderThan, this.clipVector);
  }

  public constructTileId(tileId: string): TileId { return new TileId(this.id, tileId); }
}

export abstract class TileLoader {
  public abstract async getTileProps(ids: string[]): Promise<TileProps[]>;
  public abstract getMaxDepth(): number;
}
export class IModelTileLoader {
  constructor(private iModel: IModelConnection, private rootId: Id64) { }
  public getMaxDepth(): number { return 32; }  // Can be removed when element tile selector is working.

  public async getTileProps(ids: string[]): Promise<TileProps[]> {
    const tileIds: TileId[] = ids.map((id: string) => new TileId(this.rootId, id));
    return this.iModel.tiles.getTileProps(tileIds);
  }
}

export namespace TileTree {
  /** Parameters used to construct a TileTree */
  export class Params {
    public constructor(
      public readonly id: Id64,
      public readonly rootTile: TileProps,
      public readonly model: GeometricModelState,
      public readonly loader: TileLoader | undefined,
      public readonly location: Transform,
      public readonly maxTilesToSkip?: number,
      public readonly clipVector?: ClipVector,
      public readonly viewFlagOverrides?: ViewFlag.Overrides) { }

    public static fromJSON(props: TileTreeProps, model: GeometricModelState, loader: TileLoader) {
      return new Params(Id64.fromJSON(props.id), props.rootTile, model, loader, Transform.fromJSON(props.location), props.maxTilesToSkip);
    }
  }

  export enum LoadStatus {
    NotLoaded,
    Loading,
    Loaded,
    NotFound,
  }
}
