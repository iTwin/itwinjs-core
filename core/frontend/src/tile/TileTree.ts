/*---------------------------------------------------------------------------------------------
|  $Copyright: (c) 2018 Bentley Systems, Incorporated. All rights reserved. $
 *--------------------------------------------------------------------------------------------*/

import { BeTimePoint } from "@bentley/bentleyjs-core";
import { ElementAlignedBox3d /*, Frustum */ } from "@bentley/imodeljs-common";
import { Point3d, Transform, ClipVector } from "@bentley/geometry-core";

export class Tile {
  public readonly root: TileTree;
  public readonly range: ElementAlignedBox3d;
  public readonly parent: Tile | undefined;
  public readonly depth: number;
  public loadStatus: Tile.LoadStatus;
  public readonly id: string;
  public readonly maximumSize: number;
  private readonly _childIds: string[];
  private _childrenLastUsed: BeTimePoint;
  private _children?: Tile[];
  private readonly _contentRange?: ElementAlignedBox3d;

  public constructor(props: Tile.Props) {
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

  public get radius(): number { return 0.5 * this.range.low.distance(this.range.high); }
  public get radiusSquared(): number { return 0.5 * this.range.low.distanceSquared(this.range.high); }
  public get center(): Point3d { return this.range.low.interpolate(0.5, this.range.high); }
  public get isEmpty(): boolean { return this.isReady && !this.hasGraphics && !this.hasChildren; }

  public get hasGraphics(): boolean { return false; } // ###TODO
  public get children(): Tile[] | undefined { return this._children; }
  // ###TODO public loadChildren()

  public get hasContentRange(): boolean { return undefined !== this._contentRange; }
  public isRegionCulled(args: Tile.DrawArgs): boolean { return this.isCulled(this.range, args); }
  public isContentCulled(args: Tile.DrawArgs): boolean { return this.isCulled(this.contentRange, args); }
  public computeVisibility(_args: Tile.DrawArgs): Tile.Visibility {
    return Tile.Visibility.Visible; // ###TODO
  }

  // Override the following methods if desired...
  public get hasChildren(): boolean { return 0 !== this._childIds.length; }
  public get contentRange(): ElementAlignedBox3d { return undefined !== this._contentRange ? this._contentRange : this.range; }

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
    // ###TODO SceneContext, MissingNodes, GraphicBranch, ViewFlagsOverrides

    public constructor(location: Transform, root: TileTree, clip?: ClipVector) {
      this.location = location;
      this.root = root;
      this.clip = clip;
    }
  }

  /** Parameters used to construct a Tile. */
  export interface Props {
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
  // ###TODO: define interface for communicating with backend
}
