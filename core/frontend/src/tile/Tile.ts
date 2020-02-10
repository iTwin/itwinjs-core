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
  IDisposable,
} from "@bentley/bentleyjs-core";
import {
  Arc3d,
  ClipPlaneContainment,
  ClipShape,
  ClipMaskXYZRangePlanes,
  ClipVector,
  Point2d,
  Point3d,
  Range3d,
  Transform,
  Vector3d,
} from "@bentley/geometry-core";
import {
  BoundingSphere,
  ColorDef,
  computeChildTileRanges,
  ElementAlignedBox3d,
  Frustum,
  FrustumPlanes,
  LinePixels,
  TileProps,
} from "@bentley/imodeljs-common";
import { IModelApp } from "../IModelApp";
import { IModelConnection } from "../IModelConnection";
import { RenderGraphic } from "../render/RenderGraphic";
import { RenderMemory } from "../render/RenderSystem";
import { GraphicBuilder } from "../render/GraphicBuilder";
import { SceneContext } from "../ViewContext";
import { TileRequest, TileLoader, TileParams, tileParamsFromJSON, TileContent, TileDrawArgs, TileTree, TileTreeLoadStatus, TraversalSelectionContext, TraversalDetails } from "./internal";

// cSpell:ignore undisplayable bitfield

const scratchRange2d = [new Point2d(), new Point2d(), new Point2d(), new Point2d()];
function addRangeGraphic(builder: GraphicBuilder, range: Range3d, is2d: boolean): void {
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

/** A 3d tile within a [[TileTree]].
 * @internal
 */
export class Tile implements IDisposable, RenderMemory.Consumer {
  public readonly root: TileTree;
  public readonly range: ElementAlignedBox3d;
  public readonly parent: Tile | undefined;
  public readonly depth: number;
  public contentId: string;
  public readonly center: Point3d;
  public readonly radius: number;
  public readonly transformToRoot?: Transform;
  protected _maximumSize: number;
  protected _isLeaf: boolean;
  protected _childrenLastUsed: BeTimePoint;
  protected _childrenLoadStatus: TileTreeLoadStatus;
  protected _children?: Tile[];
  protected _contentRange?: ElementAlignedBox3d;
  protected _graphic?: RenderGraphic;
  protected _rangeGraphic?: RenderGraphic;
  protected _rangeGraphicType: TileBoundingBoxes = TileBoundingBoxes.None;
  protected _sizeMultiplier?: number;
  protected _request?: TileRequest;
  protected _transformToRoot?: Transform;
  protected _emptySubRangeMask?: number;
  private _state: TileState;
  private static _loadedRealityChildren = new Array<Tile>();

  public constructor(props: TileParams) {
    this.root = props.root;
    this.range = props.range;
    this.parent = props.parent;
    this.depth = undefined !== this.parent ? this.parent.depth + 1 : 0;
    this._state = TileState.NotReady;
    this.contentId = props.contentId;
    this._maximumSize = props.maximumSize;
    this._isLeaf = (true === props.isLeaf);
    this._childrenLastUsed = BeTimePoint.now();
    this._contentRange = props.contentRange;
    this._sizeMultiplier = props.sizeMultiplier;
    if (undefined !== (this.transformToRoot = props.transformToRoot)) {
      this.transformToRoot.multiplyRange(props.range, this.range);
      if (undefined !== props.contentRange)
        this.transformToRoot.multiplyRange(props.contentRange, this._contentRange);
    }

    if (!this.root.loader.tileRequiresLoading(props)) {
      this.setIsReady();    // If no contents, this node is for structure only and no content loading is required.
    }

    this.center = this.range.low.interpolate(0.5, this.range.high);
    this.radius = 0.5 * this.range.low.distance(this.range.high);

    this._childrenLoadStatus = this.hasChildren && this.depth < this.root.loader.maxDepth ? TileTreeLoadStatus.NotLoaded : TileTreeLoadStatus.Loaded;
  }

  public dispose() {
    this._graphic = dispose(this._graphic);
    this._rangeGraphic = dispose(this._rangeGraphic);
    this._rangeGraphicType = TileBoundingBoxes.None;

    if (this._children)
      for (const child of this._children)
        dispose(child);

    this._children = undefined;
    this._state = TileState.Abandoned;
  }

  public collectStatistics(stats: RenderMemory.Statistics): void {
    if (undefined !== this._graphic)
      this._graphic.collectStatistics(stats);

    if (undefined !== this._children)
      for (const child of this._children)
        child.collectStatistics(stats);
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

  public get isLoading(): boolean { return TileLoadStatus.Loading === this.loadStatus; }
  public get isQueued(): boolean { return TileLoadStatus.Queued === this.loadStatus; }
  public get isNotFound(): boolean { return TileLoadStatus.NotFound === this.loadStatus; }
  public get isReady(): boolean { return TileLoadStatus.Ready === this.loadStatus; }

  public setContent(content: TileContent): void {
    // This should never happen but paranoia.
    this._graphic = dispose(this._graphic);

    const { graphic, isLeaf, contentRange, sizeMultiplier } = content;

    this._graphic = graphic;

    // NB: If this tile has no graphics, it may or may not have children - but we don't want to load the children until
    // this tile is too coarse for view based on its size in pixels.
    // That is different than an "undisplayable" tile (maximumSize=0) whose children should be loaded immediately.
    if (undefined !== graphic && 0 === this._maximumSize)
      this._maximumSize = 512;

    if (undefined !== isLeaf && isLeaf !== this._isLeaf) {
      this._isLeaf = isLeaf;
      this.unloadChildren();
    }

    if (undefined !== sizeMultiplier && (undefined === this._sizeMultiplier || sizeMultiplier > this._sizeMultiplier)) {
      this._sizeMultiplier = sizeMultiplier;
      this.contentId = this.loader.adjustContentIdSizeMultiplier(this.contentId, sizeMultiplier);
      if (undefined !== this._children && this._children.length > 1)
        this.unloadChildren();
    }

    if (undefined !== contentRange)
      this._contentRange = contentRange;

    this._emptySubRangeMask = content.emptySubRangeMask;

    this.setIsReady();
  }

  public setIsReady(): void { this._state = TileState.Ready; IModelApp.viewManager.onNewTilesReady(); }
  public setNotFound(): void { this._state = TileState.NotFound; }
  public setAbandoned(): void {
    const children = this.children;
    if (undefined !== children)
      for (const child of children)
        child.setAbandoned();

    this._state = TileState.Abandoned;
  }

  public get maximumSize(): number {
    return undefined !== this.sizeMultiplier ? this._maximumSize * this.sizeMultiplier : this._maximumSize;
  }
  public get isEmpty(): boolean { return this.isReady && !this.hasGraphics && !this.hasChildren; }
  public get hasChildren(): boolean { return !this.isLeaf; }
  public get contentRange(): ElementAlignedBox3d {
    if (undefined !== this._contentRange)
      return this._contentRange;
    else if (undefined === this.parent && undefined !== this.root.contentRange)
      return this.root.contentRange;
    else
      return this.range;
  }

  public get isLeaf(): boolean { return this._isLeaf; }
  public get isDisplayable(): boolean { return this.maximumSize > 0; }
  public get isParentDisplayable(): boolean { return undefined !== this.parent && this.parent.isDisplayable; }
  public get isUndisplayableRootTile(): boolean { return undefined === this.parent && !this.isDisplayable; }
  public get emptySubRangeMask(): number { return undefined !== this._emptySubRangeMask ? this._emptySubRangeMask : 0; }

  public get graphics(): RenderGraphic | undefined { return this._graphic; }
  public get hasGraphics(): boolean { return undefined !== this.graphics; }
  public get sizeMultiplier(): number | undefined { return this._sizeMultiplier; }
  public get hasSizeMultiplier(): boolean { return undefined !== this._sizeMultiplier; }
  public get children(): Tile[] | undefined { return this._children; }
  public get iModel(): IModelConnection { return this.root.iModel; }
  public get yAxisUp(): boolean { return this.root.yAxisUp; }
  public get loader(): TileLoader { return this.root.loader; }

  public get hasContentRange(): boolean { return undefined !== this._contentRange; }
  public isRegionCulled(args: TileDrawArgs): boolean { return scratchRootSphere.init(this.center, this.radius), this.isCulled(this.range, args, scratchRootSphere); }
  public isContentCulled(args: TileDrawArgs): boolean { return this.isCulled(this.contentRange, args); }

  public getRangeGraphic(context: SceneContext): RenderGraphic | undefined {
    const type = context.viewport.debugBoundingBoxes;
    if (type === this._rangeGraphicType)
      return this._rangeGraphic;

    this._rangeGraphicType = type;
    this._rangeGraphic = dispose(this._rangeGraphic);
    if (TileBoundingBoxes.None !== type) {
      const builder = context.createSceneGraphicBuilder();
      if (TileBoundingBoxes.Both === type) {
        builder.setSymbology(ColorDef.blue, ColorDef.blue, 1);
        addRangeGraphic(builder, this.range, this.root.is2d);
        if (this.hasContentRange) {
          builder.setSymbology(ColorDef.red, ColorDef.red, 1);
          addRangeGraphic(builder, this.contentRange, this.root.is2d);
        }
      } else if (TileBoundingBoxes.ChildVolumes === type) {
        const ranges = computeChildTileRanges(this, this.root);
        for (const range of ranges) {
          const color = range.isEmpty ? ColorDef.blue : ColorDef.green;
          const pixels = !range.isEmpty ? LinePixels.HiddenLine : LinePixels.Solid;
          const width = !range.isEmpty ? 2 : 1;
          builder.setSymbology(color, color, width, pixels);
          addRangeGraphic(builder, range.range, this.root.is2d);
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
        const color = this.hasSizeMultiplier ? ColorDef.red : (this.isLeaf ? ColorDef.blue : ColorDef.green);
        builder.setSymbology(color, color, 1);
        const range = TileBoundingBoxes.Content === type ? this.contentRange : this.range;
        addRangeGraphic(builder, range, this.root.is2d);
      }

      this._rangeGraphic = builder.finish();
    }

    return this._rangeGraphic;
  }

  public computeVisibility(args: TileDrawArgs): TileVisibility {
    const forcedDepth = this.root.debugForcedDepth;
    if (undefined !== forcedDepth) {
      if (this.depth === forcedDepth)
        return TileVisibility.Visible;
      else
        return TileVisibility.TooCoarse;
    }

    // NB: We test for region culling before isDisplayable - otherwise we will never unload children of undisplayed tiles when
    // they are outside frustum
    if (this.isEmpty || this.isRegionCulled(args))
      return TileVisibility.OutsideFrustum;

    // some nodes are merely for structure and don't have any geometry
    if (!this.isDisplayable)
      return TileVisibility.TooCoarse;

    const hasContentRange = this.hasContentRange;
    if (!this.hasChildren) {
      if (hasContentRange && this.isContentCulled(args))
        return TileVisibility.OutsideFrustum;
      else
        return TileVisibility.Visible; // it's a leaf node
    }
    const pixelSize = args.getPixelSize(this);
    const maxSize = this.maximumSize * args.tileSizeModifier;

    if (pixelSize > maxSize)
      return TileVisibility.TooCoarse;
    else if (hasContentRange && this.isContentCulled(args))
      return TileVisibility.OutsideFrustum;
    else
      return TileVisibility.Visible;
  }

  public getContentClip(): ClipVector | undefined {
    return ClipVector.createCapture([ClipShape.createBlock(this.contentRange, ClipMaskXYZRangePlanes.All)]);
  }

  protected get _anyChildNotFound() {
    if (this._children !== undefined)
      for (const child of this._children)
        if (child.isNotFound)
          return true;

    return this._childrenLoadStatus === TileTreeLoadStatus.NotFound;
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
      const traversalChildren = this.root.getTraversalChildren(this.depth);
      traversalChildren.initialize();
      for (let i = 0; i < this.children!.length; i++)
        this.children[i].selectRealityTiles(context, args, traversalChildren.getChildDetail(i));

      traversalChildren.combine(traversalDetails);
    }
  }
  public addBoundingRectangle(builder: GraphicBuilder, color: ColorDef) {
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

    for (const child of this._children) {
      if (child.isReady && TileVisibility.Visible === child.computeVisibility(args)) {
        this._childrenLastUsed = args.now;
        Tile._loadedRealityChildren.push(child);
      } else if (!child.getLoadedRealityChildren(args))
        return false;
    }
    return true;
  }

  public selectRealityTiles(context: TraversalSelectionContext, args: TileDrawArgs, traversalDetails: TraversalDetails) {
    const vis = this.computeVisibility(args);
    if (TileVisibility.OutsideFrustum === vis) {
      // Note -- Can't unload children here because this tile tree may be used by more than one viewport.
      return;
    }
    if (this.root.loader.forceTileLoad(this) && !this.isReady) {
      context.selectOrQueue(this, traversalDetails);    // Force loading if loader requires this tile. (cesium terrain visibility).
      return;
    }

    if (this.isDisplayable && (vis === TileVisibility.Visible || this.isLeaf || this._anyChildNotFound)) {
      context.selectOrQueue(this, traversalDetails);
      const preloadSkip = this.root.loader.preloadRealityParentSkip;
      let preloadCount = this.root.loader.preloadRealityParentDepth + preloadSkip;
      let parentDepth = 0;
      for (let parent = this.parent; preloadCount > 0 && parent !== undefined; parent = parent.parent) {
        if (parent.children!.length > 1 && ++parentDepth > preloadSkip) {
          context.preload(parent);
          preloadCount--;
        }

        if (!this.isReady) {      // This tile is visible but not loaded - Use higher resolution children if present
          if (this.getLoadedRealityChildren(args))
            context.select(Tile._loadedRealityChildren);
          Tile._loadedRealityChildren.length = 0;
        }
      }
    } else {
      this.selectRealityChildren(context, args, traversalDetails);
      if (this.isDisplayable && this.isReady && (traversalDetails.childrenLoading || 0 !== traversalDetails.queuedChildren.length)) {
        context.selectOrQueue(this, traversalDetails);
      }
    }
  }

  public selectTiles(selected: Tile[], args: TileDrawArgs, numSkipped: number = 0): SelectParent {
    const vis = this.computeVisibility(args);
    if (TileVisibility.OutsideFrustum === vis) {
      this.unloadChildren(args.purgeOlderThan);
      return SelectParent.No;
    }
    if (TileVisibility.Visible === vis) {
      // This tile is of appropriate resolution to draw. If need loading or refinement, enqueue.
      if (!this.isReady)
        args.insertMissing(this);

      if (this.hasGraphics) {
        // It can be drawn - select it
        ++args.context.viewport.numReadyTiles;
        selected.push(this);
        this.unloadChildren(args.purgeOlderThan);
      } else if (!this.isReady) {
        // It can't be drawn. Try to draw children in its place; otherwise draw the parent.
        // Do not load/request the children for this purpose.
        const initialSize = selected.length;
        const kids = this.children;
        if (undefined === kids)
          return SelectParent.Yes;

        // Find any descendant to draw, until we exceed max initial tiles to skip.
        if (this.depth < this.root.maxInitialTilesToSkip) {
          for (const kid of kids) {
            if (SelectParent.Yes === kid.selectTiles(selected, args, numSkipped)) {
              selected.length = initialSize;
              return SelectParent.Yes;
            }

            return SelectParent.No;
          }
        }

        // If all visible direct children can be drawn, draw them.
        for (const kid of kids) {
          if (TileVisibility.OutsideFrustum !== kid.computeVisibility(args)) {
            if (!kid.hasGraphics) {
              selected.length = initialSize;
              return SelectParent.Yes;
            } else {
              selected.push(kid);
            }
          }
        }

        this._childrenLastUsed = args.now;
      }

      // We're drawing either this tile, or its direct children.
      return SelectParent.No;
    }

    // This tile is too coarse to draw. Try to draw something more appropriate.
    // If it is not ready to draw, we may want to skip loading in favor of loading its descendants.
    let canSkipThisTile = this.depth < this.root.maxInitialTilesToSkip;
    if (canSkipThisTile) {
      numSkipped = 1;
    } else {
      canSkipThisTile = this.isReady || this.isParentDisplayable || this.depth < this.root.maxInitialTilesToSkip;
      if (canSkipThisTile && this.isDisplayable) { // skipping an undisplayable tile doesn't count toward the maximum
        // Some tiles do not sub-divide - they only facet the same geometry to a higher resolution. We can skip directly to the correct resolution.
        const isNotReady = !this.isReady && !this.hasGraphics && !this.hasSizeMultiplier;
        if (isNotReady) {
          if (numSkipped >= this.root.maxTilesToSkip)
            canSkipThisTile = false;
          else
            numSkipped += 1;
        }
      }
    }

    const childrenLoadStatus = this.loadChildren(); // NB: asynchronous
    const children = canSkipThisTile ? this.children : undefined;
    if (canSkipThisTile && TileTreeLoadStatus.Loading === childrenLoadStatus) {
      args.markChildrenLoading();
      this._childrenLastUsed = args.now;
    }

    if (undefined !== children) {
      // If we are the root tile and we are not displayable, then we want to draw *any* currently available children in our place, or else we would draw nothing.
      // Otherwise, if we want to draw children in our place, we should wait for *all* of them to load, or else we would show missing chunks where not-yet-loaded children belong.
      const isUndisplayableRootTile = this.isUndisplayableRootTile;
      this._childrenLastUsed = args.now;
      let drawChildren = true;
      const initialSize = selected.length;
      for (const child of children) {
        // NB: We must continue iterating children so that they can be requested if missing.
        if (SelectParent.Yes === child.selectTiles(selected, args, numSkipped)) {
          if (child.loadStatus === TileLoadStatus.NotFound) {
            // At least one child we want to draw failed to load. e.g., we reached max depth of map tile tree. Draw parent instead.
            drawChildren = canSkipThisTile = false;
          } else {
            // At least one child we want to draw is not yet loaded. Wait for it to load before drawing it and its siblings, unless we have nothing to draw in their place.
            drawChildren = isUndisplayableRootTile;
          }
        }
      }

      if (drawChildren)
        return SelectParent.No;

      // Some types of tiles (like maps) allow the ready children to be drawn on top of the parent while other children are not yet loaded.
      if (args.parentsAndChildrenExclusive)
        selected.length = initialSize;
    }

    if (this.isReady) {
      if (this.hasGraphics) {
        selected.push(this);
        if (!canSkipThisTile) {
          // This tile is too coarse, but we require loading it before we can start loading higher-res children.
          ++args.context.viewport.numReadyTiles;
        }
      }

      return SelectParent.No;
    }

    // This tile is not ready to be drawn. Request it *only* if we cannot skip it.
    if (!canSkipThisTile)
      args.insertMissing(this);

    return this.isParentDisplayable ? SelectParent.Yes : SelectParent.No;
  }

  public drawGraphics(args: TileDrawArgs): void {
    if (undefined !== this.graphics) {
      args.graphics.add(this.graphics);
      const rangeGraphics = this.getRangeGraphic(args.context);
      if (undefined !== rangeGraphics)
        args.graphics.add(rangeGraphics);
    }
  }

  protected unloadChildren(olderThan?: BeTimePoint): void {
    const children = this.children;
    if (undefined === children) {
      return;
    }

    if (undefined !== olderThan && (this.isUndisplayableRootTile || this._childrenLastUsed.milliseconds > olderThan.milliseconds)) {
      // this node has been used recently, or should never be unloaded based on expiration time. Keep it, but potentially unload its grandchildren.
      for (const child of children)
        child.unloadChildren(olderThan);
    } else {
      for (const child of children) {
        child.setAbandoned();
        child.dispose();
      }

      this._children = undefined;
      this._childrenLoadStatus = TileTreeLoadStatus.NotLoaded;
    }
  }

  private isCulled(range: ElementAlignedBox3d, args: TileDrawArgs, sphere?: BoundingSphere) {
    const box = Frustum.fromRange(range, scratchRootFrustum);
    const worldBox = box.transformBy(args.location, scratchWorldFrustum);
    const worldSphere = sphere ? sphere.transformBy(args.location, scratchWorldSphere) : undefined;

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

  protected loadChildren(): TileTreeLoadStatus {
    if (TileTreeLoadStatus.NotLoaded === this._childrenLoadStatus) {
      this._childrenLoadStatus = TileTreeLoadStatus.Loading;
      this.root.loader.getChildrenProps(this).then((props: TileProps[]) => {
        this._children = [];
        this._childrenLoadStatus = TileTreeLoadStatus.Loaded;
        if (undefined !== props) {
          // If this tile is undisplayable, update its content range based on children's content ranges.
          // Note, the children usually *have* no content at this point, so content range == tile range.
          const parentRange = (this.hasContentRange || undefined !== this.root.contentRange) ? undefined : new Range3d();
          for (const prop of props) {
            const child = new Tile(tileParamsFromJSON(prop, this.root, this));

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
        this._childrenLoadStatus = TileTreeLoadStatus.NotFound;
        this._children = undefined;
        this._isLeaf = true;
      });
    }

    return this._childrenLoadStatus;
  }

  public debugDump(): string {
    let str = "  ".repeat(this.depth);
    str += this.contentId;
    if (undefined !== this._children) {
      str += " " + this._children.length + "\n";
      for (const child of this._children)
        str += child.debugDump();
    } else {
      str += "\n";
    }

    return str;
  }

  public get request(): TileRequest | undefined { return this._request; }
  public set request(request: TileRequest | undefined) {
    assert(undefined === request || undefined === this.request);
    this._request = request;
  }

  public countDescendants(): number {
    let count = 0;
    if (undefined !== this._children) {
      count = this._children.length;
      for (const child of this._children)
        count += child.countDescendants();
    }

    return count;
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
 * Returned by Tile.selectTiles() to indicate whether a parent tile should be drawn in place of a child tile.
 * @internal
 */
export const enum SelectParent {
  No,
  Yes,
}

/**
 * Loosely describes the "importance" of a tile. Requests for tiles of more "importance" are prioritized for loading.
 * @note A lower LoadPriority value indicates higher importance.
 * @internal
 */
export const enum TileLoadPriority {
  /** Background map tiles. */
  Map = 1,
  /** Typically, tiles generated from the contents of geometric models. */
  Primary = 20,
  /** Terrain -- requires background/map tiles for drape. */
  Terrain = 30,
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
