/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module Tile
 */

import {
  BeTimePoint,
} from "@bentley/bentleyjs-core";

import {
  BoundingSphere,
  ColorDef,
  Frustum,
  FrustumPlanes,
  ElementAlignedBox3d,
} from "@bentley/imodeljs-common";

import {
  ClipPlaneContainment,
} from "@bentley/geometry-core";

import { GraphicBuilder } from "../render/GraphicBuilder";
import { ViewingSpace } from "../ViewingSpace";
import { RealityTileTree, Tile, TileParams, TileVisibility, TileDrawArgs, TileGraphicType, TileTreeLoadStatus, TraversalSelectionContext, TraversalDetails } from "./internal";

const scratchLoadedChildren = new Array<RealityTile>();
const scratchWorldFrustum = new Frustum();
const scratchRootFrustum = new Frustum();
const scratchWorldSphere = new BoundingSphere();
const scratchRootSphere = new BoundingSphere();
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
  public get graphicType(): TileGraphicType | undefined { return undefined; }     // If undefined, use tree type.

  public setLastUsed(lastUsed: BeTimePoint) {
    this._lastUsed = lastUsed;
  }
  public isOccluded(_viewingSpace: ViewingSpace): boolean {
    return false;
  }
  // Allow tile to select additional tiles (Terrain Imagery...)
  public selectSecondaryTiles(_args: TileDrawArgs, _context: TraversalSelectionContext) { }

  // An upsampled tile is not loadable - will override to return loadable parent.
  public get loadableTile(): RealityTile { return this; }

  public preloadRealityTilesAtDepth(depth: number, context: TraversalSelectionContext, args: TileDrawArgs) {
    if (this.depth === depth) {
      context.preload(this, args);
      return;
    }

    this.loadChildren();
    this._childrenLastUsed = args.now;

    if (undefined !== this.children) {
      for (const child of this.realityChildren)
        child.preloadRealityTilesAtDepth(depth, context, args);
    }
  }

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

      if (!this.isReady) {      // This tile is visible but not loaded - Use higher resolution children if present
        if (this.getLoadedRealityChildren(args))
          context.select(scratchLoadedChildren, args);
        scratchLoadedChildren.length = 0;
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

  private testContainment(frustumPlanes: FrustumPlanes, range: ElementAlignedBox3d, args: TileDrawArgs, sphere?: BoundingSphere): FrustumPlanes.Containment {
    const box = Frustum.fromRange(range, scratchRootFrustum);
    const worldBox = box.transformBy(args.location, scratchWorldFrustum);
    const worldSphere = sphere ? sphere.transformBy(args.location, scratchWorldSphere) : undefined;

    // TBD - keep track of partial containment so we can avoid inside test if parent inside.

    // Test against frustum.
    const containment = frustumPlanes.computeFrustumContainment(worldBox, worldSphere);
    if (FrustumPlanes.Containment.Outside === containment)
      return FrustumPlanes.Containment.Outside;

    // Test against TileTree's own clip volume, if any.
    if (undefined !== args.clip && ClipPlaneContainment.StronglyOutside === args.clip.classifyPointContainment(box.points))
      return FrustumPlanes.Containment.Outside;

    // Test against view clip, if any (will be undefined if TileTree does not want view clip applied to it).
    if (undefined !== args.viewClip && ClipPlaneContainment.StronglyOutside === args.viewClip.classifyPointContainment(worldBox.points))
      return FrustumPlanes.Containment.Outside;

    return containment;
  }

  public computeVisibility(args: TileDrawArgs): TileVisibility {
    let visibility = super.computeVisibility(args);
    if (visibility === TileVisibility.Visible && !this.root.debugForcedDepth && this.isOccluded(args.viewingSpace))  // Add occlusion test to allow tile to determine occlusion (globe).
      visibility = TileVisibility.OutsideFrustum;

    return visibility;
  }

  public preloadTilesInFrustum(args: TileDrawArgs, context: TraversalSelectionContext, preloadSizeModifier: number) {
    scratchRootSphere.init(this.center, this.radius);
    if (FrustumPlanes.Containment.Outside === this.testContainment(args.frustumPlanes, this.range, args, scratchRootSphere))
      return;

    if (this.isDisplayable) {
      const pixelSize = args.getPixelSize(this);
      const maxSize = this.maximumSize * args.tileSizeModifier * preloadSizeModifier;

      if (this.root.loader.forceTileLoad(this) && !this.isReady && !this.isOccluded(args.viewingSpace)) {    // Force load if necessary (tile required for availability).
        context.preload(this, args);
        return;
      }

      if (pixelSize < maxSize) {
        if (!this.hasContentRange || this.testContainment(args.frustumPlanes, this.contentRange, args) !== FrustumPlanes.Containment.Outside)
          context.preload(this, args);
        return;
      }
    }
    const childrenLoadStatus = this.loadChildren(); // NB: asynchronous
    if (TileTreeLoadStatus.Loading === childrenLoadStatus) {
      args.markChildrenLoading();
      this._childrenLastUsed = args.now;
    } else if (undefined !== this.children) {
      for (const child of this.realityChildren)
        child.preloadTilesInFrustum(args, context, preloadSizeModifier);
    }
  }
}
