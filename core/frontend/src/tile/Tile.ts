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
  dispose,
} from "@bentley/bentleyjs-core";
import {
  Arc3d,
  ClipPlaneContainment,
  Matrix4d,
  Point2d,
  Point3d,
  Point4d,
  Range3d,
  Transform,
  Vector3d,
} from "@bentley/geometry-core";
import {
  BoundingSphere,
  ColorDef,
  ElementAlignedBox3d,
  Frustum,
  FrustumPlanes,
} from "@bentley/imodeljs-common";
import { IModelApp } from "../IModelApp";
import { IModelConnection } from "../IModelConnection";
import { RenderGraphic } from "../render/RenderGraphic";
import { RenderMemory } from "../render/RenderMemory";
import { RenderSystem } from "../render/RenderSystem";
import { GraphicBuilder } from "../render/GraphicBuilder";
import { Viewport } from "../Viewport";
import { SceneContext } from "../ViewContext";
import {
  TileContent,
  TileDrawArgs,
  TileParams,
  TileRequest,
  TileTree,
  TileTreeLoadStatus,
} from "./internal";

// cSpell:ignore undisplayable bitfield

const scratchRange2d = [new Point2d(), new Point2d(), new Point2d(), new Point2d()];

/** @internal */
export function addRangeGraphic(builder: GraphicBuilder, range: Range3d, is2d: boolean): void {
  if (!is2d) {
    builder.addRangeBox(range);
    return;
  }

  // 3d box is useless in 2d and will be clipped by near/far planes anyway
  const pts = scratchRange2d;
  pts[0].set(range.low.x, range.low.y);
  pts[1].set(range.high.x, range.low.y);
  pts[2].set(range.high.x, range.high.y);
  pts[3].set(range.low.x, range.high.y);
  builder.addLineString2d(pts, 0);
}

const scratchWorldFrustum = new Frustum();
const scratchRootFrustum = new Frustum();
const scratchWorldSphere = new BoundingSphere();
const scratchRootSphere = new BoundingSphere();
const scratchPoint4d = Point4d.createZero();
const scratchFrustum = new Frustum();

/** A 3d tile within a [[TileTree]].
 * @internal
 */
export abstract class Tile {
  private _state: TileState = TileState.NotReady;
  private _children: Tile[] | undefined;
  private _rangeGraphic?: RenderGraphic;
  private _rangeGraphicType: TileBoundingBoxes = TileBoundingBoxes.None;
  protected _graphic?: RenderGraphic;
  protected _contentId: string;
  protected _childrenLastUsed = BeTimePoint.now();
  protected _childrenLoadStatus: TileTreeLoadStatus;
  protected _request?: TileRequest;
  protected _isLeaf: boolean;
  protected _contentRange?: ElementAlignedBox3d;
  protected _maximumSize: number;
  public readonly tree: TileTree;
  public readonly range: ElementAlignedBox3d;
  public readonly parent: Tile | undefined;
  public readonly depth: number;
  public readonly center: Point3d;
  public readonly radius: number;

  /** Load this tile's children, possibly asynchronously. Pass them to `resolve`, or an error to `reject`. */
  protected abstract _loadChildren(resolve: (children: Tile[] | undefined) => void, reject: (error: Error) => void): void;

  /** Return a Promise that resolves to the raw data representing this tile's content. */
  public abstract async requestContent(isCanceled: () => boolean): Promise<TileRequest.Response>;

  /** Return a Promise that deserializes this tile's content from raw format produced by [[requestContent]]. */
  public abstract async readContent(data: TileRequest.ResponseData, system: RenderSystem, isCanceled?: () => boolean): Promise<TileContent>;

  protected constructor(params: TileParams, tree: TileTree) {
    this.tree = tree;
    this.parent = params.parent;
    this.depth = undefined !== this.parent ? this.parent.depth + 1 : 0;
    this.range = params.range;
    this._maximumSize = params.maximumSize;
    this._contentRange = params.contentRange;
    this._contentId = params.contentId;

    this.center = this.range.low.interpolate(0.5, this.range.high);
    this.radius = 0.5 * this.range.low.distance(this.range.high);

    if (params.maximumSize <= 0)
      this.setIsReady();

    this._isLeaf = true === params.isLeaf;
    this._childrenLoadStatus = (undefined !== tree.maxDepth && this.depth < tree.maxDepth) ? TileTreeLoadStatus.NotLoaded : TileTreeLoadStatus.Loaded;
  }

  /** Dispose of resources held by this tile. */
  public disposeContents(): void {
    this._state = TileState.NotReady;

    this._graphic = dispose(this._graphic);
    this._rangeGraphic = dispose(this._rangeGraphic);
    this._rangeGraphicType = TileBoundingBoxes.None;
  }

  /** Dispose of resources held by this tile and all of its children, marking it and all of its children as "abandoned". */
  public dispose(): void {
    this._state = TileState.Abandoned;
    this.disposeContents();
    this.unloadChildren();
  }

  /** Return whether this tile can be drawn. */
  public get children(): Tile[] | undefined { return this._children; }
  public get iModel() { return this.tree.iModel; }
  public get contentId(): string { return this._contentId; }

  public get isLoading(): boolean { return TileLoadStatus.Loading === this.loadStatus; }
  public get isQueued(): boolean { return TileLoadStatus.Queued === this.loadStatus; }
  public get isNotFound(): boolean { return TileLoadStatus.NotFound === this.loadStatus; }
  public get isReady(): boolean { return TileLoadStatus.Ready === this.loadStatus; }

  public setNotFound(): void {
    this._state = TileState.NotFound;
  }

  public setIsReady(): void {
    this._state = TileState.Ready;
    IModelApp.viewManager.onNewTilesReady();
  }

  public setLeaf(): void {
    // Don't potentially re-request the children later.
    this.unloadChildren();
    this._isLeaf = true;
    this._childrenLoadStatus = TileTreeLoadStatus.Loaded;
  }

  public get isLeaf(): boolean { return this._isLeaf; }
  public get isEmpty(): boolean { return this.isReady && !this.hasGraphics && this.isLeaf; }
  public get isDisplayable(): boolean { return 0 < this.maximumSize; }
  public get maximumSize(): number { return this._maximumSize; }
  public get isParentDisplayable(): boolean { return undefined !== this.parent && this.parent.isDisplayable; }
  public get isUndisplayableRootTile(): boolean { return undefined === this.parent && !this.isDisplayable; }

  public get request(): TileRequest | undefined { return this._request; }
  public set request(request: TileRequest | undefined) {
    assert(undefined === request || undefined === this.request);
    this._request = request;
  }

  public onActiveRequestCanceled(): void { }
  public computeLoadPriority(_viewports: Iterable<Viewport>): number {
    return this.depth;
  }

  protected get hasGraphics(): boolean { return undefined !== this._graphic; }
  public get hasContentRange(): boolean { return undefined !== this._contentRange; }
  public get contentRange(): ElementAlignedBox3d {
    if (undefined !== this._contentRange)
      return this._contentRange;
    else if (undefined === this.parent && undefined !== this.tree.contentRange)
      return this.tree.contentRange;
    else
      return this.range;
  }

  public get loadStatus(): TileLoadStatus {
    switch (this._state) {
      case TileState.NotReady: {
        if (undefined === this.request)
          return TileLoadStatus.NotLoaded;
        else if (TileRequest.State.Loading === this.request.state)
          return TileLoadStatus.Loading;

        assert(TileRequest.State.Completed !== this.request.state && TileRequest.State.Failed !== this.request.state); // this.request should be undefined in these cases...
        return TileLoadStatus.Queued;
      }
      case TileState.Ready: {
        assert(undefined === this.request);
        return TileLoadStatus.Ready;
      }
      case TileState.NotFound: {
        assert(undefined === this.request);
        return TileLoadStatus.NotFound;
      }
      default: {
        assert(TileState.Abandoned === this._state);
        return TileLoadStatus.Abandoned;
      }
    }
  }

  /** Produce the graphics that should be drawn. */
  public produceGraphics(): RenderGraphic | undefined {
    return this._graphic;
  }

  protected setGraphic(graphic: RenderGraphic | undefined): void {
    dispose(this._graphic);
    this._graphic = graphic;
    this.setIsReady();
  }

  /** Set this tile's content to the result of [[readContent]] */
  public setContent(content: TileContent): void {
    const { graphic, isLeaf, contentRange } = content;
    this.setGraphic(graphic);

    if (undefined !== isLeaf && isLeaf !== this._isLeaf) {
      if (isLeaf)
        this.setLeaf();
      else
        this._isLeaf = false;
    }

    if (undefined !== contentRange)
      this._contentRange = contentRange;

    this.setIsReady();
  }

  /** Disclose any additional resources owned by this tile. */
  protected _collectStatistics(_stats: RenderMemory.Statistics): void { }

  /** Disclose resources owned by this tile and all of its child tiles. */
  public collectStatistics(stats: RenderMemory.Statistics): void {
    if (undefined !== this._graphic)
      this._graphic.collectStatistics(stats);

    this._collectStatistics(stats);

    const children = this.children;
    if (undefined !== children)
      for (const child of children)
        child.collectStatistics(stats);
  }

  /** Don't override this method. Implement [[_loadChildren]]. */
  protected loadChildren(): TileTreeLoadStatus {
    if (this._childrenLoadStatus !== TileTreeLoadStatus.NotLoaded)
      return this._childrenLoadStatus;

    this._childrenLoadStatus = TileTreeLoadStatus.Loading;

    this._loadChildren((children: Tile[] | undefined) => {
      this._children = children;
      this._childrenLoadStatus = TileTreeLoadStatus.Loaded;

      if (undefined === children || 0 === children.length)
        this._isLeaf = true;

      IModelApp.viewManager.onNewTilesReady();
    }, (_error: Error) => {
      this._isLeaf = true;
      this._childrenLoadStatus = TileTreeLoadStatus.NotFound;

      IModelApp.viewManager.onNewTilesReady();
    });

    return this._childrenLoadStatus;
  }

  protected unloadChildren(olderThan?: BeTimePoint): void {
    const children = this.children;
    if (undefined === children)
      return;

    if (undefined !== olderThan && this._childrenLastUsed.milliseconds > olderThan.milliseconds) {
      // this node has been used recently. Keep it, but potentially unload its grandchildren.
      for (const child of children)
        child.unloadChildren(olderThan);
    } else {
      for (const child of children) {
        child._state = TileState.Abandoned;
        child.dispose();
      }

      this._childrenLoadStatus = TileTreeLoadStatus.NotLoaded;
      this._children = undefined;
    }
  }

  protected isRegionCulled(args: TileDrawArgs): boolean {
    scratchRootSphere.init(this.center, this.radius);
    return this.isCulled(this.range, args, scratchRootSphere);
  }

  protected isContentCulled(args: TileDrawArgs): boolean {
    return this.isCulled(this.contentRange, args);
  }

  private isCulled(range: ElementAlignedBox3d, args: TileDrawArgs, sphere?: BoundingSphere) {
    const box = Frustum.fromRange(range, scratchRootFrustum);
    const worldBox = box.transformBy(args.location, scratchWorldFrustum);
    const worldSphere = sphere?.transformBy(args.location, scratchWorldSphere);

    // Test against frustum.
    if (FrustumPlanes.Containment.Outside === args.frustumPlanes.computeFrustumContainment(worldBox, worldSphere))
      return true;

    // Test against TileTree's own clip volume, if any.
    if (undefined !== args.clip && ClipPlaneContainment.StronglyOutside === args.clip.classifyPointContainment(box.points))
      return true;

    // Test against view clip, if any (will be undefined if TileTree does not want view clip applied to it).
    if (undefined !== args.viewClip && ClipPlaneContainment.StronglyOutside === args.viewClip.classifyPointContainment(worldBox.points))
      return true;

    return false;
  }

  public computeVisibility(args: TileDrawArgs): TileVisibility {
    // NB: We test for region culling before isDisplayable - otherwise we will never unload children of undisplayed tiles when
    // they are outside frustum
    if (this.isEmpty || this.isRegionCulled(args))
      return TileVisibility.OutsideFrustum;

    // some nodes are merely for structure and don't have any geometry
    if (!this.isDisplayable)
      return TileVisibility.TooCoarse;

    if (this.hasContentRange && this.isContentCulled(args))
      return TileVisibility.OutsideFrustum;

    if (this.isLeaf)
      return TileVisibility.Visible;

    const pixelSize = args.getPixelSize(this);
    const maxSize = this.maximumSize * args.tileSizeModifier;

    return pixelSize > maxSize ? TileVisibility.TooCoarse : TileVisibility.Visible;
  }

  public extendRangeForContent(range: Range3d, matrix: Matrix4d, treeTransform: Transform, frustumPlanes?: FrustumPlanes): void {
    if (this.isEmpty || this.contentRange.isNull)
      return;

    const box = Frustum.fromRange(this.contentRange, scratchFrustum);
    box.transformBy(treeTransform, box);
    if (frustumPlanes !== undefined && FrustumPlanes.Containment.Outside === frustumPlanes.computeFrustumContainment(box))
      return;

    if (this.children === undefined) {
      for (const boxPoint of box.points) {
        const pt = matrix.multiplyPoint3d(boxPoint, 1, scratchPoint4d);
        if (pt.w > .0001)
          range.extendXYZW(pt.x, pt.y, pt.z, pt.w);
        else
          range.high.z = Math.max(1.0, range.high.z);   // behind eye plane...
      }
    } else {
      for (const child of this.children)
        child.extendRangeForContent(range, matrix, treeTransform, frustumPlanes);
    }
  }

  public countDescendants(): number {
    const children = this.children;
    if (undefined === children || 0 === children.length)
      return 0;

    let count = 0;
    for (const child of children)
      count += child.countDescendants();

    return count;
  }

  public drawGraphics(args: TileDrawArgs): void {
    const gfx = this.produceGraphics();
    if (undefined === gfx)
      return;

    args.graphics.add(gfx);
    const rangeGfx = this.getRangeGraphic(args.context);
    if (undefined !== rangeGfx)
      args.graphics.add(rangeGfx);
  }

  protected get rangeGraphicColor(): ColorDef {
    return this.isLeaf ? ColorDef.blue : ColorDef.green;
  }

  public getRangeGraphic(context: SceneContext): RenderGraphic | undefined {
    const type = context.viewport.debugBoundingBoxes;
    if (type === this._rangeGraphicType)
      return this._rangeGraphic;

    this._rangeGraphic = dispose(this._rangeGraphic);
    this._rangeGraphicType = type;
    if (TileBoundingBoxes.None !== type) {
      const builder = context.createSceneGraphicBuilder();
      this.addRangeGraphic(builder, type);
      this._rangeGraphic = builder.finish();
    }

    return this._rangeGraphic;
  }

  protected addRangeGraphic(builder: GraphicBuilder, type: TileBoundingBoxes): void {
    if (TileBoundingBoxes.Both === type) {
      builder.setSymbology(ColorDef.blue, ColorDef.blue, 1);
      addRangeGraphic(builder, this.range, this.tree.is2d);

      if (this.hasContentRange) {
        builder.setSymbology(ColorDef.red, ColorDef.red, 1);
        addRangeGraphic(builder, this.contentRange, this.tree.is2d);
      }
    } else if (TileBoundingBoxes.Sphere === type) {
      builder.setSymbology(ColorDef.green, ColorDef.green, 1);

      const x = new Vector3d(this.radius, 0, 0);
      const y = new Vector3d(0, this.radius, 0);
      const z = new Vector3d(0, 0, this.radius);

      builder.addArc(Arc3d.create(this.center, x, y), false, false);
      builder.addArc(Arc3d.create(this.center, x, z), false, false);
      builder.addArc(Arc3d.create(this.center, y, z), false, false);
    } else {
      const color = this.rangeGraphicColor;
      builder.setSymbology(color, color, 1);
      const range = TileBoundingBoxes.Content === type ? this.contentRange : this.range;
      addRangeGraphic(builder, range, this.tree.is2d);
    }
  }
}

// tslint:disable:no-const-enum

/**
 * Describes the current status of a Tile. Tiles are loaded by making asynchronous requests to the backend.
 * @internal
 */
export const enum TileLoadStatus {
  NotLoaded = 0, // No attempt to load the tile has been made, or the tile has since been unloaded. It currently has no graphics.
  Queued = 1, // A request has been made to load the tile from the backend, and a response is pending.
  Loading = 2, // A response has been received and the tile's graphics and other data are being loaded on the frontend.
  Ready = 3, // The tile has been loaded, and if the tile is displayable it has graphics.
  NotFound = 4, // The tile was requested, and the response from the backend indicated the tile could not be found.
  Abandoned = 5, // The tile has been discarded.
}

/**
 * Describes the visibility of a tile based on its size and a view frustum.
 * @internal
 */
export const enum TileVisibility {
  OutsideFrustum, // this tile is entirely outside of the viewing frustum
  TooCoarse, // this tile is too coarse to be drawn
  Visible, // this tile is of the correct size to be drawn
}

/**
 * Loosely describes the "importance" of a tile. Requests for tiles of more "importance" are prioritized for loading.
 * @note A lower LoadPriority value indicates higher importance.
 * @internal
 */
export const enum TileLoadPriority {
  /** Background map tiles. */
  Map = 15,
  /** Typically, tiles generated from the contents of geometric models. */
  Primary = 20,
  /** Terrain -- requires background/map tiles for drape. */
  Terrain = 10,
  /** Typically, context reality models. */
  Context = 40,
  /** Supplementary tiles used to classify the contents of geometric or reality models. */
  Classifier = 50,
}

/**
 * Options for displaying tile bounding boxes for debugging purposes.
 *
 * Bounding boxes are color-coded based on refinement strategy:
 *  - Blue: A leaf tile (has no child tiles).
 *  - Green: An ordinary tile (sub-divides into 4 or 8 child tiles).
 *  - Red: A tile which refines to a single higher-resolution child occupying the same volume.
 * @see [[Viewport.debugBoundingBoxes]]
 * @internal
 */
export const enum TileBoundingBoxes {
  /** Display no bounding boxes */
  None = 0,
  /** Display boxes representing the tile's full volume. */
  Volume,
  /** Display boxes representing the range of the tile's contents, which may be tighter than (but never larger than) the tile's full volume. */
  Content,
  /** Display both volume and content boxes. */
  Both,
  /** Display boxes for direct children, where blue boxes indicate empty volumes. */
  ChildVolumes,
  /** Display bounding sphere. */
  Sphere,
}
// TileLoadStatus is computed from the combination of Tile._state and, if Tile.request is defined, Tile.request.state.
const enum TileState {
  NotReady = TileLoadStatus.NotLoaded, // Tile requires loading, but no request has yet completed.
  Ready = TileLoadStatus.Ready, // request completed successfully, or no loading was required.
  NotFound = TileLoadStatus.NotFound, // request failed.
  Abandoned = TileLoadStatus.Abandoned, // tile was abandoned.
}
