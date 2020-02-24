/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module Tile
 */

import {
  assert,
  BeTimePoint,
} from "@bentley/bentleyjs-core";

import {
  ColorDef,
} from "@bentley/imodeljs-common";
import { GraphicBuilder } from "../render/GraphicBuilder";
import { Tile, TileParams, TileVisibility, TileDrawArgs, TileTreeLoadStatus, TraversalSelectionContext, TraversalDetails } from "./internal";
import { RealityTileTree } from "./RealityTileTree";

const scratchLoadedChildren = new Array<RealityTile>();
/**
 * A specialization of tiles that represent reality tles.  3D Tilesets and maps use this class and have their own optimized traversal and lifetime management.
 * @internal
 */
export class RealityTile extends Tile {
  private _lastUsed: BeTimePoint;
  public constructor(props: TileParams) {
    super(props);
    this._lastUsed = BeTimePoint.now();
  }
  public get realityChildren(): RealityTile[] { return this._children as RealityTile[]; }
  public get realityParent(): RealityTile { return this.parent as RealityTile; }
  public get realityRoot(): RealityTileTree { return this.root as RealityTileTree; }

  public setLastUsed(lastUsed: BeTimePoint) {
    this._lastUsed = lastUsed;
  }
  // Allow tile to select additional tiles (Terrain Imagery...)
  public selectSecondaryTiles(_args: TileDrawArgs, _context: TraversalSelectionContext) { }

  // An upsampled tile is not loadable - will override to return loadable parent.
  public get loadableTile(): RealityTile { return this; }

  protected selectRealityChildren(context: TraversalSelectionContext, args: TileDrawArgs, traversalDetails: TraversalDetails) {
    const childrenLoadStatus = this.loadChildren(); // NB: asynchronous
    if (TileTreeLoadStatus.Loading === childrenLoadStatus) {
      args.markChildrenLoading();
      this._childrenLastUsed = args.now;
      traversalDetails.childrenLoading = true;
      return;
    }

    if (undefined !== this.children) {
      const traversalChildren = this.realityRoot.getTraversalChildren(this.depth);
      traversalChildren.initialize();
      this._childrenLastUsed = args.now;
      for (let i = 0; i < this.children!.length; i++)
        this.realityChildren[i].selectRealityTiles(context, args, traversalChildren.getChildDetail(i));

      traversalChildren.combine(traversalDetails);
    }
  }
  public addBoundingGraphic(builder: GraphicBuilder, color: ColorDef) {
    builder.setSymbology(color, color, 3);
    builder.addRangeBox(this.range);
  }

  public allChildrenIncluded(tiles: Tile[]) {
    if (this.children === undefined || tiles.length !== this.children.length)
      return false;
    for (const tile of tiles)
      if (tile.parent !== this)
        return false;
    return true;
  }

  protected getLoadedRealityChildren(args: TileDrawArgs): boolean {
    if (this._childrenLoadStatus !== TileTreeLoadStatus.Loaded || this._children === undefined)
      return false;

    for (const child of this.realityChildren) {
      if (child.isReady && TileVisibility.Visible === child.computeVisibility(args)) {
        this._childrenLastUsed = args.now;
        scratchLoadedChildren.push(child);
      } else if (!child.getLoadedRealityChildren(args))
        return false;
    }
    return true;
  }
  public forceSelectRealityTile(): boolean { return false; }

  public preloadRealityTilesAtDepth(depth: number, context: TraversalSelectionContext, args: TileDrawArgs) {
    if (this.depth === depth) {
      context.preload(this, args);
      return;
    }

    this.loadChildren();
    this._childrenLastUsed = args.now;
    assert(TileTreeLoadStatus.Loaded === this._childrenLoadStatus && this.children !== undefined); // These children should all be synchronously loaded.

    if (undefined !== this.children) {
      for (const child of this.realityChildren)
        child.preloadRealityTilesAtDepth(depth, context, args);
    }
  }

  public selectRealityTiles(context: TraversalSelectionContext, args: TileDrawArgs, traversalDetails: TraversalDetails) {
    const vis = this.computeVisibility(args);
    if (TileVisibility.OutsideFrustum === vis)
      return;

    if (this.root.loader.forceTileLoad(this) && !this.isReady) {
      context.selectOrQueue(this, args, traversalDetails);    // Force loading if loader requires this tile. (cesium terrain visibility).
      return;
    }

    if (this.isDisplayable && (vis === TileVisibility.Visible || this.isLeaf || this._anyChildNotFound || this.forceSelectRealityTile())) {
      context.selectOrQueue(this, args, traversalDetails);
      const preloadSkip = this.root.loader.preloadRealityParentSkip;
      let preloadCount = this.root.loader.preloadRealityParentDepth + preloadSkip;
      let parentDepth = 0;
      for (let parent = this.realityParent; preloadCount > 0 && parent !== undefined; parent = parent.realityParent) {
        if (parent.children!.length > 1 && ++parentDepth > preloadSkip) {
          context.preload(parent, args);
          preloadCount--;
        }

        if (!this.isReady) {      // This tile is visible but not loaded - Use higher resolution children if present
          if (this.getLoadedRealityChildren(args))
            context.select(scratchLoadedChildren, args);

          scratchLoadedChildren.length = 0;
        }
      }
    } else {
      this.selectRealityChildren(context, args, traversalDetails);
      if (this.isDisplayable && this.isReady && (traversalDetails.childrenLoading || 0 !== traversalDetails.queuedChildren.length)) {
        context.selectOrQueue(this, args, traversalDetails);
      }
    }
  }
  public purgeContents(olderThan: BeTimePoint): void {
    if (this._lastUsed.milliseconds < olderThan.milliseconds)
      this.disposeContents();

    const children = this.realityChildren;
    if (children)
      for (const child of children)
        child.purgeContents(olderThan);
  }
}
