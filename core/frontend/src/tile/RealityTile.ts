/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module Tiles
 */

import { assert, BeTimePoint } from "@bentley/bentleyjs-core";
import { ClipMaskXYZRangePlanes, ClipShape, ClipVector, Point3d, Range3d, Transform, Vector3d } from "@bentley/geometry-core";
import { ColorDef } from "@bentley/imodeljs-common";
import { IModelApp } from "../IModelApp";
import { GraphicBranch } from "../render/GraphicBranch";
import { GraphicBuilder } from "../render/GraphicBuilder";
import { RenderGraphic } from "../render/RenderGraphic";
import { RenderSystem } from "../render/RenderSystem";
import { ViewingSpace } from "../ViewingSpace";
import { Viewport } from "../Viewport";
import {
  RealityTileTree, Tile, TileContent, TileDrawArgs, TileGraphicType, TileLoadStatus, TileParams, TileRequest, TileRequestChannel, TileTreeLoadStatus, TraversalDetails, TraversalSelectionContext,
} from "./internal";

/** @internal */
export interface RealityTileParams extends TileParams {
  readonly transformToRoot?: Transform;
  readonly additiveRefinement?: boolean;
  readonly noContentButTerminateOnSelection?: boolean;
  readonly rangeCorners?: Point3d[];
}

const scratchLoadedChildren = new Array<RealityTile>();
const scratchCorners = [Point3d.createZero(), Point3d.createZero(), Point3d.createZero(), Point3d.createZero(), Point3d.createZero(), Point3d.createZero(), Point3d.createZero(), Point3d.createZero()];
const cornerReorder = [0, 1, 3, 2];

// eslint-disable-next-line @typescript-eslint/no-unused-vars
// eslint-disable-next-line prefer-const
let debugMaxDepth: number, debugMinDepth = 0;

/**
 * A specialization of tiles that represent reality tiles.  3D Tilesets and maps use this class and have their own optimized traversal and lifetime management.
 * @internal
 */
export class RealityTile extends Tile {
  public transformToRoot?: Transform;   // May be reset during reprojection.
  public readonly additiveRefinement?: boolean;
  public readonly noContentButTerminateOnSelection?: boolean;
  public readonly rangeCorners?: Point3d[];
  private _everDisplayed = false;

  public constructor(props: RealityTileParams, tree: RealityTileTree) {
    super(props, tree);
    this.transformToRoot = props.transformToRoot;
    this.additiveRefinement = (undefined === props.additiveRefinement) ? this.realityParent?.additiveRefinement : props.additiveRefinement;
    this.noContentButTerminateOnSelection = props.noContentButTerminateOnSelection;
    this.rangeCorners = props.rangeCorners;

    if (undefined === this.transformToRoot)
      return;

    // Can transform be non-rigid?? -- if so would have to handle (readonly) radius.
    this.boundingSphere.transformBy(this.transformToRoot, this.boundingSphere);
    this.transformToRoot.multiplyRange(this.range, this.range);

    if (this.rangeCorners)
      this.transformToRoot.multiplyPoint3dArrayInPlace(this.rangeCorners);

    if (undefined !== this._contentRange)
      this.transformToRoot.multiplyRange(this._contentRange, this._contentRange);
  }

  public get realityChildren(): RealityTile[] | undefined { return this.children as RealityTile[] | undefined; }
  public get realityParent(): RealityTile { return this.parent as RealityTile; }
  public get realityRoot(): RealityTileTree { return this.tree as RealityTileTree; }
  public get graphicType(): TileGraphicType | undefined { return undefined; }     // If undefined, use tree type.
  public get maxDepth(): number { return this.realityRoot.loader.maxDepth; }
  public get isPointCloud() { return this.realityRoot.loader.containsPointClouds; }
  public get isLoaded() { return this.loadStatus === TileLoadStatus.Ready; }      // Reality tiles may depend on secondary tiles (maps) so can ge loaded but not ready.
  public get isDisplayable(): boolean {
    if (this.noContentButTerminateOnSelection)
      return false;
    else
      return super.isDisplayable;
  }

  public markUsed(args: TileDrawArgs): void {
    args.markUsed(this);
  }

  public markDisplayed(): void {
    this._everDisplayed = true;
  }

  public isOccluded(_viewingSpace: ViewingSpace): boolean {
    return false;
  }

  public get channel(): TileRequestChannel {
    return this.realityRoot.loader.getRequestChannel(this);
  }

  public async requestContent(isCanceled: () => boolean): Promise<TileRequest.Response> {
    return this.realityRoot.loader.requestTileContent(this, isCanceled);
  }

  protected _loadChildren(resolve: (children: Tile[] | undefined) => void, reject: (error: Error) => void): void {
    this.realityRoot.loader.loadChildren(this).then((children: Tile[] | undefined) => {
      if (this.additiveRefinement && this.isDisplayable && this.realityRoot.doReprojectChildren(this))
        this.loadAdditiveRefinementChildren((stepChildren: Tile[]) =>  { children = children ? children?.concat(stepChildren) : stepChildren; });

      if (children)
        this.realityRoot.reprojectAndResolveChildren(this, children, resolve);
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
    if (debugMaxDepth !== undefined && this.depth > debugMaxDepth)
      return;
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
    builder.addRangeBoxFromCorners(this.rangeCorners ? this.rangeCorners : this.range.corners());
    /*
    const corners = this.rangeCorners;
    if (!corners)
      return;

    const origin = corners[0];
    const xVector = Vector3d.createStartEnd(origin, corners[1]);
    const yVector = Vector3d.createStartEnd(origin, corners[2]);
    const zVector = Vector3d.createStartEnd(origin, corners[4]);
    const xHalf = xVector.magnitude() / 2;
    const yHalf = yVector.magnitude() / 2;
    const clipTransform = Transform.createOriginAndMatrixColumns(origin, xVector.normalize()!, yVector.normalize()!, zVector.normalize()!);
    if (!clipTransform) {
      assert(false);
      return;
    }
    builder.setSymbology(ColorDef.red, ColorDef.red, 5);

    for (let i = 0, x = 0; i < 2; i++, x += xHalf) {
      for (let j = 0, y = 0; j < 2; j++, y += yHalf) {
        const clipPolygon = new Array<Point3d>();

        clipPolygon.push(Point3d.create(x, y, 0));
        clipPolygon.push(Point3d.create(x + xHalf, y, 0));
        clipPolygon.push(Point3d.create(x + xHalf, y + yHalf, 0));
        clipPolygon.push(Point3d.create(x, y + yHalf, 0));

        const rangeCorners = new Array<Point3d>();
        for (let k = 0; k < 4; k++) {
          const thisCorner = clipTransform.multiplyPoint3d(clipPolygon[cornerReorder[k]]);
          rangeCorners.push(thisCorner);
          rangeCorners.push(thisCorner.plus(zVector));
        }
        builder.addRangeBoxFromCorners(rangeCorners);
      }
    } */
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
      if (child.isReady && child.computeVisibilityFactor(args) > 0) {
        scratchLoadedChildren.push(child);
      } else if (!child.getLoadedRealityChildren(args))
        return false;
    }
    return true;
  }
  public forceSelectRealityTile(): boolean { return false; }

  public selectRealityTiles(context: TraversalSelectionContext, args: TileDrawArgs, traversalDetails: TraversalDetails) {
    const visibility = this.computeVisibilityFactor(args);
    if (visibility < 0)
      return;

    if (this.realityRoot.loader.forceTileLoad(this) && !this.isReady) {
      context.selectOrQueue(this, args, traversalDetails);    // Force loading if loader requires this tile. (cesium terrain visibility).
      return;
    }

    if (visibility >= 1 && this.noContentButTerminateOnSelection)
      return;

    if (this.isDisplayable && this.depth > debugMinDepth && (visibility >= 1 || this._anyChildNotFound || this.forceSelectRealityTile() || context.selectionCountExceeded)) {
      if (!this.isOccluded(args.viewingSpace)) {
        context.selectOrQueue(this, args, traversalDetails);

        if (!this.isReady) {      // This tile is visible but not loaded - Use higher resolution children if present
          if (this.getLoadedRealityChildren(args))
            context.select(scratchLoadedChildren, args);
          scratchLoadedChildren.length = 0;
        }
      }
    } else {
      if (this.additiveRefinement && this.isDisplayable) {
        if (!this.realityRoot.doReprojectChildren(this))
          context.selectOrQueue(this, args, traversalDetails);
      }

      this.selectRealityChildren(context, args, traversalDetails);
      if (this.isReady && (traversalDetails.childrenLoading || 0 !== traversalDetails.queuedChildren.length)) {
        const minimumVisibleFactor = .25;     // If the tile has not yet been displayed in this viewport -- display only if it is within 25% of visible. Avoid overly tiles popping into view unexpectedly (terrain)

        if (visibility > minimumVisibleFactor || this._everDisplayed)
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

  public computeVisibilityFactor(args: TileDrawArgs): number {
    if (this.isEmpty || this.isRegionCulled(args))
      return -1;

    // some nodes are merely for structure and don't have any geometry
    if (0 === this.maximumSize)
      return 0;

    if (this.isLeaf)
      return this.hasContentRange && this.isContentCulled(args) ? -1 : 1;

    return this.maximumSize / args.getPixelSize(this);
  }

  public preloadTilesInFrustum(args: TileDrawArgs, context: TraversalSelectionContext, preloadSizeModifier: number) {
    const visibility = this.computeVisibilityFactor(args);
    if (visibility < 0)
      return;

    if (visibility * preloadSizeModifier > 1) {
      if (this.isDisplayable)
        context.preload(this, args);
    } else {
      const childrenLoadStatus = this.loadChildren(); // NB: asynchronous
      if (TileTreeLoadStatus.Loading === childrenLoadStatus) {
        args.markChildrenLoading();
      } else if (undefined !== this.realityChildren) {
        for (const child of this.realityChildren)
          child.preloadTilesInFrustum(args, context, preloadSizeModifier);
      }
    }
  }

  protected get _anyChildNotFound(): boolean {
    if (undefined !== this.children)
      for (const child of this.children)
        if (child.isNotFound)
          return true;

    return this._childrenLoadStatus === TileTreeLoadStatus.NotFound;
  }
  public getSizeProjectionCorners(): Point3d[] | undefined {
    if (!this.tree.isContentUnbounded)
      return undefined;           // For a non-global tree use the standard size algorithm.

    // For global tiles (as in OSM buildings) return the range corners - this allows an algorithm that uses the area of the projected corners to attenuate horizon tiles.
    return this.range.corners(scratchCorners);
  }

  public get isStepChild() { return false; }

  protected loadAdditiveRefinementChildren(resolve: (children: Tile[]) => void): void {
    const corners = this.rangeCorners;
    if (!corners)
      return;

    const origin = corners[0];
    const xVector = Vector3d.createStartEnd(origin, corners[1]);
    const yVector = Vector3d.createStartEnd(origin, corners[2]);
    const zVector = Vector3d.createStartEnd(origin, corners[4]);
    const xHalf = xVector.magnitude() / 2;
    const yHalf = yVector.magnitude() / 2;
    const maximumSize = this.maximumSize;
    const isLeaf = this.depth > 14;
    const localTransform = Transform.createOriginAndMatrixColumns(origin, xVector.normalize()!, yVector.normalize()!, zVector.normalize()!);
    if (!localTransform) {
      assert(false);
      return;
    }

    const stepChildren = new Array<StepChildRealityTile>();
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const allRange = Range3d.createNull(), cornersRange = Range3d.createArray(corners);
    const clipTransform = this.tree.iModelTransform.multiplyTransformTransform(localTransform);

    for (let i = 0, x = 0; i < 2; i++, x += xHalf) {
      for (let j = 0, y = 0; j < 2; j++, y += yHalf) {
        const clipPolygon = new Array<Point3d>();

        clipPolygon.push(Point3d.create(x, y, 0));
        clipPolygon.push(Point3d.create(x + xHalf, y, 0));
        clipPolygon.push(Point3d.create(x + xHalf, y + yHalf, 0));
        clipPolygon.push(Point3d.create(x, y + yHalf, 0));

        const clipShape = ClipShape.createShape(clipPolygon, undefined, undefined, clipTransform);
        const rangeCorners = new Array<Point3d>();
        for (let k = 0; k < 4; k++) {
          const thisCorner = localTransform.multiplyPoint3d(clipPolygon[cornerReorder[k]]);
          rangeCorners.push(thisCorner);
          rangeCorners.push(thisCorner.plus(zVector));
        }

        const contentId = `${this.contentId}_Step${i}`;
        const range = Range3d.createArray(rangeCorners);
        allRange.extendArray(rangeCorners);
        const childParams: RealityTileParams = { rangeCorners, contentId, range, maximumSize, parent: this, additiveRefinement: false, isLeaf };

        stepChildren.push(new StepChildRealityTile(childParams, this.realityRoot, ClipVector.create([clipShape!])));
      }
    }
    resolve(stepChildren);
  }
}

// eslint-disable-next-line prefer-const
let debugStep: number = 0; /** 1 - display nothing, 2 omit clip */

class StepChildRealityTile  extends RealityTile {
  public get isStepChild() { return true; }
  private _loadableTile: RealityTile;

  public constructor(props: RealityTileParams, tree: RealityTileTree, private _boundingClip: ClipVector) {
    super(props, tree);
    this._loadableTile = this.realityParent;
    for (; this._loadableTile && this._loadableTile.isStepChild; this._loadableTile = this._loadableTile.realityParent)
      ;
  }
  public get loadableTile(): RealityTile {
    return this._loadableTile;
  }
  public get isLoading(): boolean { return this._loadableTile.isLoading; }
  public get isQueued(): boolean { return this._loadableTile.isQueued; }
  public get isNotFound(): boolean { return this._loadableTile.isNotFound; }
  public get isReady(): boolean { return this._loadableTile.isReady; }
  public get isLoaded(): boolean { return this._loadableTile.isLoaded; }
  public get isEmpty() { return false; }
  public produceGraphics(): RenderGraphic | undefined {
    const parentGraphics = this._loadableTile.produceGraphics();

    if (1 === debugStep)
      return undefined;

    if (!parentGraphics)
      return undefined;

    const branch = new GraphicBranch(false);
    branch.add(parentGraphics);
    const renderSystem =  IModelApp.renderSystem;
    const clipVolume = debugStep === 2 ? undefined : renderSystem.createClipVolume(this._boundingClip);
    return  renderSystem.createGraphicBranch(branch, Transform.createIdentity(), { clipVolume });
  }
  public addBoundingGraphic(builder: GraphicBuilder, _color: ColorDef) {
    super.addBoundingGraphic(builder, ColorDef.red);
  }
  public markUsed(args: TileDrawArgs): void {
    args.markUsed(this);
    args.markUsed(this._loadableTile);
  }
  protected _loadChildren(resolve: (children: Tile[] | undefined) => void, _reject: (error: Error) => void): void {
    this.loadAdditiveRefinementChildren((stepChildren: Tile[]) =>  {
      if (stepChildren)
        this.realityRoot.reprojectAndResolveChildren(this, stepChildren, resolve);
    });
  }
}
