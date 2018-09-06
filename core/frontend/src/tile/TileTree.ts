/*---------------------------------------------------------------------------------------------
|  $Copyright: (c) 2018 Bentley Systems, Incorporated. All rights reserved. $
 *--------------------------------------------------------------------------------------------*/
/** @module Tile */

import { assert, compareNumbers, compareStrings, SortedArray, Id64, BeTimePoint, BeDuration, JsonUtils, dispose, IDisposable, base64StringToUint8Array } from "@bentley/bentleyjs-core";
import { ElementAlignedBox3d, ViewFlag, ViewFlags, RenderMode, Frustum, FrustumPlanes, TileProps, TileTreeProps, ColorDef } from "@bentley/imodeljs-common";
import { Range3d, Point3d, Transform, ClipVector, ClipPlaneContainment } from "@bentley/geometry-core";
import { SceneContext } from "../ViewContext";
import { RenderGraphic, GraphicBranch } from "../render/System";
import { GraphicType } from "../render/GraphicBuilder";
import { IModelConnection } from "../IModelConnection";
import { IModelApp } from "../IModelApp";
import { TileIO } from "./TileIO";
import { GltfTileIO } from "./GltfTileIO";
import { B3dmTileIO } from "./B3dmTileIO";
import { PntsTileIO } from "./PntsTileIO";
import { DgnTileIO } from "./DgnTileIO";
import { IModelTileIO } from "./IModelTileIO";
import { ViewFrustum } from "../Viewport";
import { SpatialModelState } from "../ModelState";

function compareMissingTiles(lhs: Tile, rhs: Tile): number {
  const diff = compareNumbers(lhs.depth, rhs.depth);
  return 0 === diff ? compareStrings(lhs.contentId, rhs.contentId) : diff;
}

// ###TODO: TileRequests and MissingNodes are likely to change...
export class MissingNodes extends SortedArray<Tile> {
  public awaitingChildren: boolean = false;

  public constructor() { super(compareMissingTiles); }
}

export class TileRequests {
  private _map = new Map<TileTree, MissingNodes>();

  public insertMissing(tree: TileTree, missing: MissingNodes) { this._map.set(tree, missing); }
  public getMissing(root: TileTree): MissingNodes {
    let found = this._map.get(root);
    if (undefined === found) {
      found = new MissingNodes();
      this._map.set(root, found);
    }

    return found;
  }
  public requestMissing(): void {
    this._map.forEach((missing: MissingNodes, tree: TileTree) => {
      tree.requestTiles(missing);
    });
  }
  public get hasMissingTiles(): boolean {
    for (const value of this._map.values())
      if (value.length > 0 || value.awaitingChildren)
        return true;
    return false;
  }
}

export class Tile implements IDisposable {
  public readonly root: TileTree;
  public readonly range: ElementAlignedBox3d;
  public readonly parent: Tile | undefined;
  public readonly depth: number;
  public loadStatus: Tile.LoadStatus;
  public contentId: string;
  public readonly center: Point3d;
  public readonly radius: number;
  protected _maximumSize: number;
  protected _isLeaf: boolean;
  protected _childrenLastUsed: BeTimePoint;
  protected _childrenLoadStatus: TileTree.LoadStatus;
  protected _children?: Tile[];
  protected _contentRange?: ElementAlignedBox3d;
  protected _graphic?: RenderGraphic;
  protected _rangeGraphic?: RenderGraphic;
  protected _sizeMultiplier?: number;

  public constructor(props: Tile.Params) {
    this.root = props.root;
    this.range = props.range;
    this.parent = props.parent;
    this.depth = undefined !== this.parent ? this.parent.depth + 1 : 0;
    this.loadStatus = Tile.LoadStatus.NotLoaded;
    this.contentId = props.contentId;
    this._maximumSize = props.maximumSize;
    this._isLeaf = (true === props.isLeaf);
    this._childrenLastUsed = BeTimePoint.now();
    this._contentRange = props.contentRange;

    if (!this.root.loader.tileRequiresLoading(props)) {
      this.setIsReady();    // If no contents, this node is for structure only and no content loading is required.
    }

    this.center = this.range.low.interpolate(0.5, this.range.high);
    this.radius = 0.5 * this.range.low.distance(this.range.high);

    this._childrenLoadStatus = this.hasChildren && this.depth < this.root.loader.maxDepth ? TileTree.LoadStatus.NotLoaded : TileTree.LoadStatus.Loaded;
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

  public cancelAllLoads(): void {
    if (this.isLoading) {
      this.loadStatus = Tile.LoadStatus.NotLoaded;
      if (this._children !== undefined) {
        for (const child of this._children)
          child.cancelAllLoads();
      }
    }
  }

  public get isQueued(): boolean { return Tile.LoadStatus.Queued === this.loadStatus; }
  public get isAbandoned(): boolean { return Tile.LoadStatus.Abandoned === this.loadStatus; }
  public get isNotLoaded(): boolean { return Tile.LoadStatus.NotLoaded === this.loadStatus; }
  public get isLoading(): boolean { return Tile.LoadStatus.Loading === this.loadStatus; }
  public get isNotFound(): boolean { return Tile.LoadStatus.NotFound === this.loadStatus; }
  public get isReady(): boolean { return Tile.LoadStatus.Ready === this.loadStatus; }

  public setGraphic(graphic: RenderGraphic | undefined, isLeaf?: boolean, contentRange?: ElementAlignedBox3d, sizeMultiplier?: number): void {
    this._graphic = graphic;
    if (undefined === graphic)
      this._maximumSize = 0;
    else if (0 === this._maximumSize)
      this._maximumSize = 512;

    if (undefined !== isLeaf && isLeaf !== this._isLeaf) {
      this._isLeaf = isLeaf;
      this.unloadChildren(BeTimePoint.now());
    }

    if (undefined !== sizeMultiplier && sizeMultiplier !== this._sizeMultiplier) {
      this._sizeMultiplier = sizeMultiplier;
      this.contentId = this.contentId.substring(0, this.contentId.lastIndexOf("/") + 1) + sizeMultiplier;
      if (undefined !== this._children && this._children.length > 1)
        this.unloadChildren(BeTimePoint.now());
    }

    if (undefined !== contentRange)
      this._contentRange = contentRange;

    this.setIsReady();
  }

  public setIsReady(): void { this.loadStatus = Tile.LoadStatus.Ready; IModelApp.viewManager.onNewTilesReady(); }
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

  public get maximumSize(): number { return this._maximumSize * this.sizeMultiplier; }
  public get isEmpty(): boolean { return this.isReady && !this.hasGraphics && !this.hasChildren; }
  public get hasChildren(): boolean { return !this.isLeaf; }
  public get contentRange(): ElementAlignedBox3d { return undefined !== this._contentRange ? this._contentRange : this.range; }
  public get isLeaf(): boolean { return this._isLeaf; }
  public get isDisplayable(): boolean { return this.maximumSize > 0; }
  public get isParentDisplayable(): boolean { return undefined !== this.parent && this.parent.isDisplayable; }

  public get graphics(): RenderGraphic | undefined { return this._graphic; }
  public get hasGraphics(): boolean { return undefined !== this.graphics; }
  public get sizeMultiplier(): number { return undefined !== this._sizeMultiplier ? this._sizeMultiplier : 1.0; }
  public get hasSizeMultiplier(): boolean { return undefined !== this._sizeMultiplier; }
  public get children(): Tile[] | undefined { return this._children; }
  public get iModel(): IModelConnection { return this.root.iModel; }
  public get yAxisUp(): boolean { return this.root.yAxisUp; }

  public get hasContentRange(): boolean { return undefined !== this._contentRange; }
  public isRegionCulled(args: Tile.DrawArgs): boolean { return this.isCulled(this.range, args); }
  public isContentCulled(args: Tile.DrawArgs): boolean { return this.isCulled(this.contentRange, args); }

  private getRangeGraphic(context: SceneContext): RenderGraphic | undefined {
    if (undefined === this._rangeGraphic) {
      const builder = context.createGraphicBuilder(GraphicType.Scene);
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

    const pixelSizeAtPt = args.getPixelSizeAtPoint(center);
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
      if (!this.isReady && !this.isQueued) {
        args.insertMissing(this);
      }

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
      const isNotReady = !this.hasGraphics && !this.hasSizeMultiplier;
      if (isNotReady) {
        if (numSkipped >= this.root.maxTilesToSkip)
          canSkipThisTile = false;
        else
          numSkipped += 1;
      }
    }

    const childrenLoadStatus = this.loadChildren(); // NB: asynchronous
    const children = canSkipThisTile ? this.children : undefined;
    if (canSkipThisTile && TileTree.LoadStatus.Loading === childrenLoadStatus)
      args.markChildrenLoading();

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
      selected.push(this);
      return Tile.SelectParent.No;
    }

    if (!this.isReady)
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

  protected unloadChildren(olderThan: BeTimePoint): void {
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

  private static _scratchWorldFrustum = new Frustum();
  private static _scratchRootFrustum = new Frustum();
  private isCulled(range: ElementAlignedBox3d, args: Tile.DrawArgs) {
    const box = Frustum.fromRange(range, Tile._scratchRootFrustum);
    const worldBox = box.transformBy(args.location, Tile._scratchWorldFrustum);
    const isOutside = FrustumPlanes.Containment.Outside === args.frustumPlanes.computeFrustumContainment(worldBox);
    const isClipped = !isOutside && undefined !== args.clip && ClipPlaneContainment.StronglyOutside === args.clip.classifyPointContainment(box.points);
    const isCulled = isOutside || isClipped;
    return isCulled;
  }

  private loadChildren(): TileTree.LoadStatus {
    if (TileTree.LoadStatus.NotLoaded === this._childrenLoadStatus) {
      this._childrenLoadStatus = TileTree.LoadStatus.Loading;
      this.root.loader.getChildrenProps(this).then((props: TileProps[]) => {
        this._children = [];
        this._childrenLoadStatus = TileTree.LoadStatus.Loaded;
        if (undefined !== props) {
          // If this tile is undisplayable, update its content range based on children's content ranges.
          const parentRange = this.hasContentRange ? undefined : new ElementAlignedBox3d();
          for (const prop of props) {
            // ###TODO if child is empty don't bother adding it to list...
            const child = new Tile(Tile.Params.fromJSON(prop, this.root, this));
            this._children.push(child);
            if (undefined !== parentRange && !child.isEmpty)
              parentRange.extendRange(child.contentRange);
          }

          if (undefined !== parentRange)
            this._contentRange = parentRange;
        }

        if (0 === this._children.length) {
          this._children = undefined;
          this._isLeaf = true;
        } else {
          IModelApp.viewManager.onNewTilesReady();
        }
      }).catch((_err) => {
        this._childrenLoadStatus = TileTree.LoadStatus.NotFound;
        this._children = undefined;
        this._isLeaf = true;
      });
    }

    return this._childrenLoadStatus;
  }
}

export namespace Tile {
  /** Describes the current status of a Tile. Tiles are loaded by making asynchronous requests to the backend. */
  export const enum LoadStatus {
    NotLoaded = 0, // No attempt to load the tile has been made, or the tile has since been unloaded. It currently has no graphics.
    Queued = 1, // A request has been made to load the tile from the backend, and a response is pending.
    Loading = 2, // A response has been received and the tile's graphics and other data are being loaded on the frontend.
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
    public viewFrustum?: ViewFrustum;
    public readonly graphics: GraphicBranch = new GraphicBranch();
    public readonly now: BeTimePoint;
    public readonly purgeOlderThan: BeTimePoint;
    public readonly missing: MissingNodes;
    private readonly _frustumPlanes?: FrustumPlanes;

    public getPixelSizeAtPoint(inPoint?: Point3d): number {
      return this.viewFrustum !== undefined ? this.viewFrustum.getPixelSizeAtPoint(inPoint) : this.context.getPixelSizeAtPoint();
    }

    public get frustumPlanes(): FrustumPlanes {
      return this._frustumPlanes !== undefined ? this._frustumPlanes : this.context.frustumPlanes;
    }

    public constructor(context: SceneContext, location: Transform, root: TileTree, now: BeTimePoint, purgeOlderThan: BeTimePoint, clip?: ClipVector) {
      this.location = location;
      this.root = root;
      this.clip = clip;
      this.context = context;
      this.now = now;
      this.purgeOlderThan = purgeOlderThan;
      this.graphics.setViewFlagOverrides(root.viewFlagOverrides);
      this.missing = context.requests.getMissing(root);
      this.viewFrustum = (undefined !== context.backgroundMap) ? ViewFrustum.createFromViewportAndPlane(context.viewport, context.backgroundMap.getPlane()) : context.viewport.viewFrustum;
      if (this.viewFrustum !== undefined)
        this._frustumPlanes = new FrustumPlanes(this.viewFrustum.getFrustum());
    }

    public get tileSizeModifier(): number { return 1.0; } // ###TODO? may adjust for performance, or device pixel density, etc
    public getTileCenter(tile: Tile): Point3d { return this.location.multiplyPoint3d(tile.center); }

    private static _scratchRange = new Range3d();
    public getTileRadius(tile: Tile): number {
      let range = tile.range.clone(DrawArgs._scratchRange);
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
    public markChildrenLoading(): void { this.missing.awaitingChildren = true; }
  }

  /** Parameters used to construct a Tile. */
  export class Params {
    public constructor(
      public readonly root: TileTree,
      public readonly contentId: string,
      public readonly range: ElementAlignedBox3d,
      public readonly maximumSize: number,
      public readonly isLeaf?: boolean,
      public readonly parent?: Tile,
      public readonly contentRange?: ElementAlignedBox3d,
      public readonly sizeMultiplier?: number) { }

    public static fromJSON(props: TileProps, root: TileTree, parent?: Tile) {
      const contentRange = undefined !== props.contentRange ? ElementAlignedBox3d.fromJSON(props.contentRange) : undefined;
      return new Params(root, props.contentId, ElementAlignedBox3d.fromJSON(props.range), props.maximumSize, props.isLeaf, parent, contentRange, props.sizeMultiplier);
    }
  }
}

export class TileTree implements IDisposable {
  public readonly iModel: IModelConnection;
  public readonly is3d: boolean;
  public readonly location: Transform;
  public readonly id: string;
  public readonly modelId: Id64;
  public readonly viewFlagOverrides: ViewFlag.Overrides;
  public readonly maxTilesToSkip: number;
  public expirationTime: BeDuration;
  public clipVector?: ClipVector;
  protected _rootTile: Tile;
  public readonly loader: TileLoader;
  public readonly yAxisUp: boolean;

  public constructor(props: TileTree.Params) {
    this.iModel = props.iModel;
    this.is3d = props.is3d;
    this.id = props.id;
    const prefixIndex = props.id.lastIndexOf("_");
    this.modelId = Id64.fromJSON(props.id.slice(prefixIndex < 0 ? 0 : prefixIndex + 1));
    this.location = props.location;
    this.expirationTime = BeDuration.fromSeconds(5); // ###TODO tile purging strategy
    this.clipVector = props.clipVector;
    this.maxTilesToSkip = JsonUtils.asInt(props.maxTilesToSkip, 100);
    this.loader = props.loader;
    this._rootTile = new Tile(Tile.Params.fromJSON(props.rootTile, this)); // causes TileTree to no longer be disposed (assuming the Tile loaded a graphic and/or its children)
    this.viewFlagOverrides = this.loader.viewFlagOverrides;
    this.yAxisUp = props.yAxisUp ? props.yAxisUp : false;
  }

  public get rootTile(): Tile { return this._rootTile; }

  public dispose() {
    dispose(this._rootTile);
  }

  public get is2d(): boolean { return !this.is3d; }
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

    args.context.requests.insertMissing(this, args.missing);
    args.drawGraphics();
    this.requestTiles(args.missing);
  }
  public requestTiles(missingNodes: MissingNodes): void {
    // TBD - cancel any loaded/queued tiles which are no longer needed.
    this.loader.loadTileContents(missingNodes);
  }

  public createDrawArgs(context: SceneContext): Tile.DrawArgs {
    const now = BeTimePoint.now();
    const purgeOlderThan = now.minus(this.expirationTime);
    return new Tile.DrawArgs(context, this.location.clone(), this, now, purgeOlderThan, this.clipVector);
  }
}

const defaultViewFlagOverrides = new ViewFlag.Overrides(ViewFlags.fromJSON({
  renderMode: RenderMode.SmoothShade,
  noCameraLights: true,
  noSourceLights: true,
  noSolarLight: true,
}));

export abstract class TileLoader {
  public abstract async getChildrenProps(parent: Tile): Promise<TileProps[]>;
  public abstract async loadTileContents(missingtiles: MissingNodes): Promise<void>;
  public abstract get maxDepth(): number;
  public abstract tileRequiresLoading(params: Tile.Params): boolean;
  public loadGraphics(tile: Tile, geometry: any, asClassifier: boolean = false): void {
    let blob: Uint8Array | undefined;
    if (typeof geometry === "string") {
      blob = base64StringToUint8Array(geometry as string);
    } else if (geometry instanceof Uint8Array) {
      blob = geometry;
    } else if (geometry instanceof ArrayBuffer) {
      blob = new Uint8Array(geometry as ArrayBuffer);
    } else {
      tile.setIsReady();
      return;
    }

    tile.loadStatus = Tile.LoadStatus.Loading;

    const streamBuffer: TileIO.StreamBuffer = new TileIO.StreamBuffer(blob.buffer);
    const format = streamBuffer.nextUint32;
    const isCanceled = () => !tile.isLoading;
    let reader: GltfTileIO.Reader | undefined;
    streamBuffer.rewind(4);
    switch (format) {
      case TileIO.Format.B3dm:
        reader = B3dmTileIO.Reader.create(streamBuffer, tile.root.iModel, tile.root.modelId, tile.root.is3d, tile.range, IModelApp.renderSystem, tile.yAxisUp, tile.isLeaf, isCanceled);
        break;

      case TileIO.Format.Dgn:
        reader = DgnTileIO.Reader.create(streamBuffer, tile.root.iModel, tile.root.modelId, tile.root.is3d, IModelApp.renderSystem, asClassifier, isCanceled);
        break;

      case TileIO.Format.IModel:
        reader = IModelTileIO.Reader.create(streamBuffer, tile.root.iModel, tile.root.modelId, tile.root.is3d, IModelApp.renderSystem, asClassifier, isCanceled);
        break;

      case TileIO.Format.Pnts:
          tile.setGraphic(PntsTileIO.readPointCloud(streamBuffer, tile.root.iModel, tile.root.modelId, tile.root.is3d, tile.range, IModelApp.renderSystem, tile.yAxisUp));
          return;

        default:
          assert(false, "unknown tile format " + format);
          break;
    }

    if (undefined === reader) {
      tile.setNotFound();
      return;
    }

    const read = reader.read();
    read.catch((_err) => tile.setNotFound());
    read.then((result) => {
      // Make sure we still want this tile - may been unloaded, imodel may have been closed, IModelApp may have shut down taking render system with it, etc.
      if (tile.isLoading) {
        tile.setGraphic(result.renderGraphic, result.isLeaf, result.contentRange, result.sizeMultiplier);
        IModelApp.viewManager.onNewTilesReady();
      }
    });
  }

  public get viewFlagOverrides(): ViewFlag.Overrides { return defaultViewFlagOverrides; }
}

function bisectRange3d(range: Range3d, takeLow: boolean): void {
  const diag = range.diagonal();
  const pt = takeLow ? range.high : range.low;
  if (diag.x > diag.y && diag.x > diag.z)
    pt.x = (range.low.x + range.high.x) / 2.0;
  else if (diag.y > diag.z)
    pt.y = (range.low.y + range.high.y) / 2.0;
  else
    pt.z = (range.low.z + range.high.z) / 2.0;
}

function bisectRange2d(range: Range3d, takeLow: boolean): void {
  const diag = range.diagonal();
  const pt = takeLow ? range.high : range.low;
  if (diag.x > diag.y)
    pt.x = (range.low.x + range.high.x) / 2.0;
  else
    pt.y = (range.low.y + range.high.y) / 2.0;
}

export class IModelTileLoader extends TileLoader {
  constructor(private _iModel: IModelConnection, private _asClassifier: boolean) { super(); }

  public get maxDepth(): number { return 32; }  // Can be removed when element tile selector is working.
  public tileRequiresLoading(params: Tile.Params): boolean { return 0 !== params.maximumSize; }

  protected static _viewFlagOverrides = new ViewFlag.Overrides();
  public get viewFlagOverrides() { return IModelTileLoader._viewFlagOverrides; }

  public async getChildrenProps(parent: Tile): Promise<TileProps[]> {
    const kids: TileProps[] = [];

    // Leaf nodes have no children.
    if (parent.isLeaf)
      return kids;

    // One child, same range as parent, higher-resolution.
    if (parent.hasSizeMultiplier) {
      const sizeMultiplier = 2 * parent.sizeMultiplier;
      let contentId = parent.contentId;
      const lastSlashPos = contentId.lastIndexOf("/");
      assert(-1 !== lastSlashPos);
      contentId = contentId.substring(0, lastSlashPos + 1) + sizeMultiplier;
      kids.push({
        contentId,
        range: parent.range,
        contentRange: parent.contentRange,
        sizeMultiplier,
        isLeaf: false,
        maximumSize: 512,
      });

      return kids;
    }

    // Eight children sub-dividing parent's range
    // ###TODO: Only produce 4 for 2d tile trees...
    const parentIdParts = parent.contentId.split("/");
    assert(5 === parentIdParts.length);

    const pI = parseInt(parentIdParts[1], 10);
    const pJ = parseInt(parentIdParts[2], 10);
    const pK = parseInt(parentIdParts[3], 10);

    const bisectRange = parent.root.is3d ? bisectRange3d : bisectRange2d;
    for (let i = 0; i < 2; i++) {
      for (let j = 0; j < 2; j++) {
        for (let k = 0; k < 2; k++) {
          const range = parent.range.clone();
          bisectRange(range, 0 === i);
          bisectRange(range, 0 === j);
          bisectRange(range, 0 === k);

          const cI = pI * 2 + i;
          const cJ = pJ * 2 + j;
          const cK = pK * 2 + k;
          const childId = (parent.depth + 1) + "/" + cI + "/" + cJ + "/" + cK + "/1";

          kids.push({ contentId: childId, range, maximumSize: 512 });
        }
      }
    }

    return kids;
  }

  public async loadTileContents(missingTiles: MissingNodes): Promise<void> {
    for (const tile of missingTiles.extractArray()) {
      tile.setIsQueued();
      this._iModel.tiles.getTileContent(tile.root.id, tile.contentId).then((content: Uint8Array) => {
        if (tile.isQueued)
          this.loadGraphics(tile, content, this._asClassifier);
      }).catch((_err: any) => {
        tile.setNotFound();
      });
    }
  }
}

export namespace TileTree {
  /** Parameters used to construct a TileTree */
  export class Params {
    public constructor(
      public readonly id: string,
      public readonly rootTile: TileProps,
      public readonly iModel: IModelConnection,
      public readonly is3d: boolean,
      public readonly loader: TileLoader,
      public readonly location: Transform,
      public readonly maxTilesToSkip?: number,
      public readonly yAxisUp?: boolean,
      public readonly isTerrain?: boolean,
      public readonly clipVector?: ClipVector) { }

    public static fromJSON(props: TileTreeProps, iModel: IModelConnection, is3d: boolean, loader: TileLoader) {
      return new Params(props.id, props.rootTile, iModel, is3d, loader, Transform.fromJSON(props.location), props.maxTilesToSkip, props.yAxisUp, props.isTerrain);
    }
  }

  export enum LoadStatus {
    NotLoaded,
    Loading,
    Loaded,
    NotFound,
  }
}

export class TileTreeState {
  public tileTree?: TileTree;
  public loadStatus: TileTree.LoadStatus = TileTree.LoadStatus.NotLoaded;
  public get iModel() { return this._modelState.iModel; }

  constructor(private _modelState: SpatialModelState) { }
  public setTileTree(props: TileTreeProps, loader: TileLoader) {
    this.tileTree = new TileTree(TileTree.Params.fromJSON(props, this._modelState.iModel, this._modelState.is3d, loader));
    this.loadStatus = TileTree.LoadStatus.Loaded;
  }
}
