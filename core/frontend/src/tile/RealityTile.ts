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
  ElementAlignedBox3d,
  Frustum,
  FrustumPlanes,
} from "@bentley/imodeljs-common";

import {
  ClipPlaneContainment,
  ClipMaskXYZRangePlanes,
  ClipShape,
  ClipVector,
  Transform,
} from "@bentley/geometry-core";

import { GraphicBuilder } from "../render/GraphicBuilder";
import { RenderSystem } from "../render/RenderSystem";
import { ViewingSpace } from "../ViewingSpace";
import { Viewport } from "../Viewport";
import {
  RealityTileTree,
  Tile,
  TileContent,
  TileDrawArgs,
  TileGraphicType,
  TileParams,
  TileRequest,
  TileTreeLoadStatus,
  TileVisibility,
  TraversalDetails,
  TraversalSelectionContext,
} from "./internal";

/** @internal */
export interface RealityTileParams extends TileParams {
  readonly transformToRoot?: Transform;
}

const scratchLoadedChildren = new Array<RealityTile>();
const scratchWorldFrustum = new Frustum();
const scratchRootFrustum = new Frustum();
const scratchWorldSphere = new BoundingSphere();
const scratchRootSphere = new BoundingSphere();
/**
 * A specialization of tiles that represent reality tiles.  3D Tilesets and maps use this class and have their own optimized traversal and lifetime management.
 * @internal
 */
export class RealityTile extends Tile {
  public readonly transformToRoot?: Transform;

  public constructor(props: RealityTileParams, tree: RealityTileTree) {
    super(props, tree);
    this.transformToRoot = props.transformToRoot;
    if (undefined === this.transformToRoot)
      return;

    this.transformToRoot.multiplyRange(this.range, this.range);
    if (undefined !== this._contentRange)
      this.transformToRoot.multiplyRange(this._contentRange, this._contentRange);
  }

  public get realityChildren(): RealityTile[] | undefined { return this.children as RealityTile[] | undefined; }
  public get realityParent(): RealityTile { return this.parent as RealityTile; }
  public get realityRoot(): RealityTileTree { return this.tree as RealityTileTree; }
  public get graphicType(): TileGraphicType | undefined { return undefined; }     // If undefined, use tree type.
  public get maxDepth(): number { return this.realityRoot.loader.maxDepth; }
  public get isPointCloud() { return this.realityRoot.loader.containsPointClouds; }

  public markUsed(args: TileDrawArgs): void {
    args.markUsed(this);
  }

  public isOccluded(_viewingSpace: ViewingSpace): boolean {
    return false;
  }

  public async requestContent(isCanceled: () => boolean): Promise<TileRequest.Response> {
    return this.realityRoot.loader.requestTileContent(this, isCanceled);
  }

  protected _loadChildren(resolve: (children: Tile[] | undefined) => void, reject: (error: Error) => void): void {
    this.realityRoot.loader.loadChildren(this).then((children: Tile[] | undefined) => {
      resolve(children);
    }).catch((err) => {
      reject(err);
    });
  }

  public async readContent(data: TileRequest.ResponseData, system: RenderSystem, isCanceled?: () => boolean): Promise<TileContent> {
    return this.realityRoot.loader.loadTileContent(this, data, system, isCanceled);
  }

  public computeLoadPriority(viewports: Iterable<Viewport>): number {
    return this.realityRoot.loader.computeTilePriority(this, viewports);
  }

  public getContentClip(): ClipVector | undefined {
    return ClipVector.createCapture([ClipShape.createBlock(this.contentRange, ClipMaskXYZRangePlanes.All)]);
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

    if (undefined !== this.realityChildren) {
      for (const child of this.realityChildren)
        child.preloadRealityTilesAtDepth(depth, context, args);
    }
  }

  protected selectRealityChildren(context: TraversalSelectionContext, args: TileDrawArgs, traversalDetails: TraversalDetails) {
    const childrenLoadStatus = this.loadChildren(); // NB: asynchronous
    if (TileTreeLoadStatus.Loading === childrenLoadStatus) {
      args.markChildrenLoading();
      traversalDetails.childrenLoading = true;
      return;
    }

    if (undefined !== this.realityChildren) {
      const traversalChildren = this.realityRoot.getTraversalChildren(this.depth);
      traversalChildren.initialize();
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
    if (this._childrenLoadStatus !== TileTreeLoadStatus.Loaded || this.realityChildren === undefined)
      return false;

    for (const child of this.realityChildren) {
      if (child.isReady && TileVisibility.Visible === child.computeVisibility(args)) {
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

    if (this.realityRoot.loader.forceTileLoad(this) && !this.isReady) {
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
    // Discard contents of tiles that have not been "used" recently, where "used" may mean: selected/preloaded for display or content requested.
    // Note we do not discard the child Tile objects themselves.
    if (this.usageMarker.isExpired(olderThan))
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
    if (visibility === TileVisibility.Visible && this.isOccluded(args.viewingSpace)) // Add occlusion test to allow tile to determine occlusion (globe).
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

      if (this.realityRoot.loader.forceTileLoad(this) && !this.isReady && !this.isOccluded(args.viewingSpace)) {    // Force load if necessary (tile required for availability).
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
    } else if (undefined !== this.realityChildren) {
      for (const child of this.realityChildren)
        child.preloadTilesInFrustum(args, context, preloadSizeModifier);
    }
  }

  protected get _anyChildNotFound(): boolean {
    if (undefined !== this.children)
      for (const child of this.children)
        if (child.isNotFound)
          return true;

    return this._childrenLoadStatus === TileTreeLoadStatus.NotFound;
  }
}
