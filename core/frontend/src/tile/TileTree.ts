/*---------------------------------------------------------------------------------------------
|  $Copyright: (c) 2018 Bentley Systems, Incorporated. All rights reserved. $
 *--------------------------------------------------------------------------------------------*/

import { Id64, BeTimePoint, BeDuration } from "@bentley/bentleyjs-core";
import { ElementAlignedBox3d, ViewFlag /*, Frustum */ } from "@bentley/imodeljs-common";
import { Range3d, Point3d, Transform, ClipVector } from "@bentley/geometry-core";
import { RenderContext } from "../ViewContext";
import { GeometricModelState } from "../ModelState";
import { RenderSystem, GraphicBranch } from "../render/System";
import { IModelConnection } from "../IModelConnection";

export class SceneContext extends RenderContext {
}

export class Tile {
  public readonly root: TileTree;
  public readonly range: ElementAlignedBox3d;
  public readonly parent: Tile | undefined;
  public readonly depth: number;
  public loadStatus: Tile.LoadStatus;
  public readonly id: string;
  public readonly maximumSize: number;
  public readonly center: Point3d;
  public readonly radius: number;
  private readonly _childIds: string[];
  private _childrenLastUsed: BeTimePoint;
  private _children?: Tile[];
  private readonly _contentRange?: ElementAlignedBox3d;

  public constructor(props: Tile.Params) {
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

    this.center = this.range.low.interpolate(0.5, this.range.high);
    this.radius = 0.5 * this.range.low.distance(this.range.high);
  }

  public get isQueued(): boolean { return Tile.LoadStatus.Queued === this.loadStatus; }
  public get isAbandoned(): boolean { return Tile.LoadStatus.Abandoned === this.loadStatus; }
  public get isNotLoaded(): boolean { return Tile.LoadStatus.NotLoaded === this.loadStatus; }
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

  public get hasGraphics(): boolean { return false; } // ###TODO
  public get children(): Tile[] | undefined { return this._children; }
  // ###TODO public loadChildren()

  public get hasContentRange(): boolean { return undefined !== this._contentRange; }
  public isRegionCulled(args: Tile.DrawArgs): boolean { return this.isCulled(this.range, args); }
  public isContentCulled(args: Tile.DrawArgs): boolean { return this.isCulled(this.contentRange, args); }
  public computeVisibility(_args: Tile.DrawArgs): Tile.Visibility {
    return Tile.Visibility.Visible; // ###TODO
  }

  public selectTiles(selected: Tile[], args: Tile.DrawArgs): Tile.SelectParent {
    // ###TODO: selectTiles()
    if (Tile.Visibility.Visible !== this.computeVisibility(args))
      return Tile.SelectParent.Yes;

    selected.push(this);
    return Tile.SelectParent.No;
  }

  public drawGraphics(_args: Tile.DrawArgs): void {
    // ###TODO...
  }

  private unloadChildren(olderThan: BeTimePoint): void {
    const children = this.children;
    if (undefined === children)
      return;
    else if (this._childrenLastUsed.milliseconds > olderThan.milliseconds) {
      // this node has been used recently. Keep it, but potentially unload its grandchildren.
      for (const child of children)
        child.unloadChildren(olderThan);
    } else {
      for (const child of children)
        child.setAbandoned();

      children.length = 0;
    }
  }

  // private static scratchWorldFrustum = new Frustum();
  // private static scratchRootFrustum = new Frustum();
  private isCulled(_range: ElementAlignedBox3d, _args: Tile.DrawArgs) {
    // const box = Frustum.fromRange(range, Tile.scratchRootFrustum);
    // const worldBox = box.transformby(args.location, Tile.scratchWorldFrustum);
    // const isOutside = ###TODO...
    return false;
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
    // ###TODO: public readonly missing: MissingNodes;

    public constructor(context: SceneContext, location: Transform, root: TileTree, now: BeTimePoint, purgeOlderThan: BeTimePoint, clip?: ClipVector) {
      this.location = location;
      this.root = root;
      this.clip = clip;
      this.context = context;
      this.now = now;
      this.purgeOlderThan = purgeOlderThan;
      this.graphics.viewFlagOverrides = root.viewFlagOverrides;
      // ###TODO this.missing = context.requests.getMissing(root)
    }

    public getTileCenter(tile: Tile): Point3d { return this.location.multiplyPoint(tile.center); }

    private static scratchRange = new Range3d();
    public getTileRadius(tile: Tile): number {
      let range = tile.range.clone(DrawArgs.scratchRange);
      range = this.location.multiplyRange(range, range);
      return 0.5 * (tile.root.is3d ? range.low.distance(range.high) : range.low.distanceXY(range.high));
    }
  }

  /** Parameters used to construct a Tile. */
  export interface Params {
    root: TileTree;
    parent?: Tile;
    range: ElementAlignedBox3d;
    contentRange?: ElementAlignedBox3d;
    id: string;
    maximumSize: number;
    childIds: string[];
  }
}

export class TileTree {
  public readonly model: GeometricModelState;
  public readonly location: Transform;
  private _rootTile?: Tile;
  public readonly renderSystem: RenderSystem;
  public readonly expirationTime: BeDuration;
  public readonly clipVector?: ClipVector;
  public readonly rootResource: string;
  public readonly viewFlagOverrides: ViewFlag.Overrides;

  public static create(props: TileTree.Params) {
    const tree = new TileTree(props);
    tree.loadRootTile(props.rootTileId);
    return undefined === tree._rootTile ? undefined : tree;
  }

  public get is3d(): boolean { return this.model.is3d; }
  public get is2d(): boolean { return this.model.is2d; }
  public get modelId(): Id64 { return this.model.id; }
  public get iModel(): IModelConnection { return this.model.iModel; }
  public get range(): ElementAlignedBox3d { return this.rootTile.range; }
  public get rootTile(): Tile { return this.rootTile!; }

  public selectTilesForScene(_context: SceneContext): Tile[] { return []; }
  public selectTiles(_args: Tile.DrawArgs): Tile[] { return []; } // ###TODO

  public drawScene(_context: SceneContext): void { }
  public draw(_args: Tile.DrawArgs): void { } // ###TODO

  // ###TODO: requestTile(), requestTiles()

  // ###TODO public const createDrawArgs(context: SceneContext): Tile.DrawArgs { }

  public constructTileResource(tileId: string): string { return this.rootResource + tileId; }

  private constructor(props: TileTree.Params) {
    this.model = props.model;
    this.location = props.location;
    this.renderSystem = props.renderSystem;
    this.expirationTime = props.expirationTime;
    this.clipVector = props.clipVector;
    this.rootResource = props.rootResource;
    this.viewFlagOverrides = undefined !== props.viewFlagOverrides ? props.viewFlagOverrides : new ViewFlag.Overrides();
  }

  private loadRootTile(_tileId: string): Tile | undefined { return undefined; } // ###TODO
}

export namespace TileTree {
  /** Parameters used to construct a TileTree */
  export interface Params {
    rootResource: string;
    rootTileId: string;
    model: GeometricModelState;
    location: Transform;
    renderSystem: RenderSystem;
    expirationTime: BeDuration;
    clipVector?: ClipVector;
    viewFlagOverrides?: ViewFlag.Overrides;
  }
}
