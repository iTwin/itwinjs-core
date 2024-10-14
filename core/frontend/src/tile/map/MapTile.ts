/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module Tiles
 */

import { assert, dispose } from "@itwin/core-bentley";
import { ColorByName, ColorDef, FrustumPlanes, GlobeMode, PackedFeatureTable, RenderTexture } from "@itwin/core-common";
import { AxisOrder, BilinearPatch, ClipPlane, ClipPrimitive, ClipShape, ClipVector, Constant, ConvexClipPlaneSet, EllipsoidPatch, LongitudeLatitudeNumber, Matrix3d, Point3d, PolygonOps, Range1d, Range2d, Range3d, Ray3d, Transform, Vector2d, Vector3d } from "@itwin/core-geometry";
import { IModelApp } from "../../IModelApp";
import { GraphicBuilder } from "../../render/GraphicBuilder";
import { RealityMeshParams } from "../../render/RealityMeshParams";
import { upsampleRealityMeshParams } from "../../render/UpsampleRealityMeshParams";
import { RenderGraphic } from "../../render/RenderGraphic";
import { RenderMemory } from "../../render/RenderMemory";
import { RenderSystem, RenderTerrainGeometry, TerrainTexture } from "../../render/RenderSystem";
import { ViewingSpace } from "../../ViewingSpace";
import {
  ImageryMapTile, MapCartoRectangle, MapTileLoader, MapTileTree, QuadId, RealityTile, RealityTileParams, Tile, TileContent, TileDrawArgs, TileGraphicType,
  TileLoadStatus, TileTreeLoadStatus, TraversalSelectionContext,
} from "../internal";

/** @internal */
export class PlanarTilePatch {
  constructor(public corners: Point3d[], public normal: Vector3d, private _chordHeight: number) {
  }

  public getRangeCorners(heightRange: Range1d, result: Point3d[]): Point3d[] {
    let index = 0;
    for (const corner of this.corners)
      corner.plusScaled(this.normal, heightRange.low - this._chordHeight, result[index++]);

    for (const corner of this.corners)
      corner.plusScaled(this.normal, heightRange.high + this._chordHeight, result[index++]);

    return result;
  }
  public getClipShape(): Point3d[] {
    return [this.corners[0], this.corners[1], this.corners[3], this.corners[2]];
  }
}

/** @internal */
export type TilePatch = PlanarTilePatch | EllipsoidPatch;

/** Projects points within the rectangular region of a [[MapTile]] into 3d space.
 * @see [[MapTile.getProjection]] to obtain the projection for a [[MapTile]].
 * @public
 */
export abstract class MapTileProjection {
  /** The extents of the volume of space associated with the projected [[MapTile]]. */
  public abstract get localRange(): Range3d;
  /** @alpha */
  public abstract get transformFromLocal(): Transform;

  /** Given parametric coordinates in [0, 1] within the tile's rectangular region, and an elevation above the Earth,
   * compute the 3d position in space.
   */
  public abstract getPoint(u: number, v: number, height: number, result?: Point3d): Point3d;

  /** @alpha */
  public get ellipsoidPatch(): EllipsoidPatch | undefined { return undefined; }

  /** @alpha */
  public getGlobalPoint(u: number, v: number, z: number, result?: Point3d): Point3d {
    const point = this.getPoint(u, v, z, result);
    return this.transformFromLocal.multiplyPoint3d(point, point);
  }
}

/** @alpha */
class EllipsoidProjection extends MapTileProjection {
  public transformFromLocal = Transform.createIdentity();
  public localRange: Range3d;
  constructor(private _patch: EllipsoidPatch, heightRange?: Range1d) {
    super();
    this.localRange = _patch.range();
    this.localRange.expandInPlace(heightRange ? (heightRange.high - heightRange.low) : 0);
  }
  private static _scratchAngles = LongitudeLatitudeNumber.createZero();
  private static _scratchRay = Ray3d.createZero();
  public getPoint(u: number, v: number, height: number, result?: Point3d): Point3d {
    const angles = this._patch.uvFractionToAngles(u, v, height, EllipsoidProjection._scratchAngles);
    const ray = this._patch.anglesToUnitNormalRay(angles, EllipsoidProjection._scratchRay);
    return Point3d.createFrom(ray!.origin, result);
  }
  public override get ellipsoidPatch() { return this._patch; }
}

/** @alpha */
class PlanarProjection extends MapTileProjection {
  private _bilinearPatch: BilinearPatch;
  public transformFromLocal: Transform;
  public localRange: Range3d;
  constructor(patch: PlanarTilePatch, heightRange?: Range1d) {
    super();
    this.transformFromLocal = Transform.createOriginAndMatrix(patch.corners[0], Matrix3d.createRigidHeadsUp(patch.normal, AxisOrder.ZYX));
    const planeCorners = this.transformFromLocal.multiplyInversePoint3dArray([patch.corners[0], patch.corners[1], patch.corners[2], patch.corners[3]])!;
    this.localRange = Range3d.createArray(planeCorners);
    this.localRange.low.z += heightRange ? heightRange.low : 0;
    this.localRange.high.z += heightRange ? heightRange.high : 0;
    this._bilinearPatch = new BilinearPatch(planeCorners[0], planeCorners[1], planeCorners[2], planeCorners[3]);
  }
  public getPoint(u: number, v: number, z: number, result?: Point3d): Point3d {
    result = this._bilinearPatch.uvFractionToPoint(u, v, result);
    result.z += z;
    return result;
  }
}

/** @internal */
export interface TerrainTileContent extends TileContent {
  terrain?: {
    renderGeometry?: RenderTerrainGeometry;
    /** Used on leaves to support up-sampling. */
    mesh?: RealityMeshParams;
  };
}

const scratchNormal = Vector3d.create();
const scratchViewZ = Vector3d.create();
const scratchPoint = Point3d.create();
const scratchClipPlanes = [ClipPlane.createNormalAndPoint(scratchNormal, scratchPoint), ClipPlane.createNormalAndPoint(scratchNormal, scratchPoint), ClipPlane.createNormalAndPoint(scratchNormal, scratchPoint), ClipPlane.createNormalAndPoint(scratchNormal, scratchPoint)];
const scratchCorners = [Point3d.createZero(), Point3d.createZero(), Point3d.createZero(), Point3d.createZero(), Point3d.createZero(), Point3d.createZero(), Point3d.createZero(), Point3d.createZero()];

/** A [[Tile]] belonging to a [[MapTileTree]] representing a rectangular region of a map of the Earth.
 * @public
 */
export class MapTile extends RealityTile {
  private static _maxParentHeightDepth = 4;
  private _imageryTiles?: ImageryMapTile[];
  private _hiddenTiles?: ImageryMapTile[];
  private _highResolutionReplacementTiles?: ImageryMapTile[];
  /** @internal */
  public everLoaded = false;                    // If the tile is only required for availability metadata, load it once and then allow it to be unloaded.
  /** @internal */
  protected _heightRange: Range1d | undefined;
  /** @internal */
  protected _renderGeometry?: RenderTerrainGeometry;
  /** @internal */
  protected _mesh?: RealityMeshParams; // Primitive retained on leaves only for upsampling.
  /** @internal */
  public override get isReady(): boolean {
    return super.isReady && this.baseImageryIsReady;
  }

  /** @internal */
  public override get hasGraphics(): boolean {
    return this._renderGeometry !== undefined;
  }

  /** @internal */
  public get renderGeometry() { return this._renderGeometry; }
  /** @internal */
  public get mesh() { return this._mesh; }
  /** @internal */
  public get loadableTerrainTile() { return this.loadableTile as MapTile; }
  /** @internal */
  public get isPlanar(): boolean { return this._patch instanceof PlanarTilePatch; }
  /** @internal */
  public get imageryTiles(): ImageryMapTile[] | undefined { return this._imageryTiles; }
  /** List of selected tiles but are currently in hidden state (i.e. scale range visibility)
   * @internal
   */
  public get hiddenImageryTiles(): ImageryMapTile[] | undefined { return this._hiddenTiles; }

  /** List of leafs tiles that have been selected as a replacement for missing high resolution tiles.
   * When this list is non-empty this means we are past the maximum LOD available of the tile tree.
   * By using those tiles, you are likely to get a display where tiles looks pixelated..
   * in some cases this is preferred to have no tile at all.
   * @internal
   */
  public get highResolutionReplacementTiles(): ImageryMapTile[] | undefined { return this._highResolutionReplacementTiles; }

  /** The [[MapTileTree]] to which this tile belongs. */
  public readonly mapTree: MapTileTree;
  /** Uniquely identifies this tile within its [[mapTree]]. */
  public readonly quadId: QuadId;
  private _patch: TilePatch;
  /** The area of the surface of the Earth that this tile represents. */
  public readonly rectangle: MapCartoRectangle;
  /** @internal */
  protected _cornerRays?: Ray3d[];

  /** @internal */
  constructor(params: RealityTileParams, mapTree: MapTileTree, quadId: QuadId, patch: TilePatch, rectangle: MapCartoRectangle, heightRange: Range1d | undefined, cornerRays: Ray3d[] | undefined) {
    super(params, mapTree);
    this.mapTree = mapTree;
    this.quadId = quadId;
    this._patch = patch;
    this.rectangle = rectangle;
    this._cornerRays = cornerRays;
    this._heightRange = heightRange?.clone();
  }

  /** @internal */
  public getRangeCorners(result: Point3d[]): Point3d[] {
    return this._patch instanceof PlanarTilePatch ? this._patch.getRangeCorners(this.heightRange!, result) : this.range.corners(result);
  }

  /** @internal */
  public override getSizeProjectionCorners(): Point3d[] | undefined {
    // Use only the first 4 corners -- On terrain tiles the height is initially exagerated to world height range which can cause excessive tile loading.
    const rangeCorners = this.getRangeCorners(scratchCorners);
    return rangeCorners.slice(0, 4);
  }

  /** @internal */
  public override markUsed(args: TileDrawArgs) {
    super.markUsed(args);
    if (this._imageryTiles)
      for (const imageryTile of this._imageryTiles)
        imageryTile.markUsed(args);
  }

  /** @internal */
  public override get graphicType() {
    if (this.mapTree.isOverlay)
      return TileGraphicType.Overlay;

    return (this.mapTree.useDepthBuffer || this._forceDepthBuffer) ? TileGraphicType.Scene : TileGraphicType.BackgroundMap;
  }

  /** @internal */
  public get mapLoader() { return this.realityRoot.loader as MapTileLoader; }
  /** @internal */
  public get isUpsampled() { return false; }

  /** @internal */
  public tileFromQuadId(quadId: QuadId): MapTile | undefined {
    if (0 === quadId.compare(this.quadId))
      return this;

    assert(quadId.level > this.quadId.level);
    if (quadId.level <= this.quadId.level)
      return undefined;

    if (this.children) {
      const shift = quadId.level - this.quadId.level - 1;
      const childRow = quadId.row >> shift;
      const childColumn = quadId.column >> shift;
      for (const child of this.children) {
        const mapChild = child as MapTile;
        const childQuadId = mapChild.quadId;
        if (childQuadId.row === childRow && childQuadId.column === childColumn)
          return mapChild.tileFromQuadId(quadId);
      }
    }

    return undefined;
  }

  private get _forceDepthBuffer() {
    // For large ellipsoidal globe tile force the depth buffer on to avoid anomalies at horizon.
    return this.mapTree.globeMode === GlobeMode.Ellipsoid && this.depth < 8;
  }

  /** @internal */
  public override addBoundingGraphic(builder: GraphicBuilder, color: ColorDef) {
    if (!this.isDisplayable)
      return;

    const heightRange = (this.heightRange === undefined) ? Range1d.createXX(-1, 1) : this.heightRange;
    const lows = [], highs = [], reorder = [0, 1, 3, 2, 0];
    const cornerRays = this._cornerRays!;
    if (this._patch instanceof PlanarTilePatch) {
      const normal = this._patch.normal;
      for (let i = 0; i < 5; i++) {
        const corner = this._patch.corners[reorder[i]];
        lows.push(corner.plusScaled(normal, heightRange.low));
        highs.push(corner.plusScaled(normal, heightRange.high));
      }
    } else {
      for (let i = 0; i < 5; i++) {
        const cornerRay = cornerRays[reorder[i]];
        lows.push(cornerRay.origin.plusScaled(cornerRay.direction, heightRange.low));
        highs.push(cornerRay.origin.plusScaled(cornerRay.direction, heightRange.high));
      }
    }

    builder.setSymbology(color, color, 1);
    builder.addLineString(lows);
    builder.addLineString(highs);
    for (let i = 0; i < 4; i++)
      builder.addLineString([lows[i], highs[i]]);

    const inColor = ColorDef.create(ColorByName.cornflowerBlue);
    const outColor = ColorDef.create(ColorByName.chartreuse);
    const transitionColor = ColorDef.create(ColorByName.aquamarine);

    const inPoints = [], outPoints = [], transitionPoints = [];

    for (const point of highs)
      if (this.mapTree.cartesianRange.containsPoint(point))
        inPoints.push(point);
      else if (this.mapTree.cartesianRange.distanceToPoint(point) < this.mapTree.cartesianTransitionDistance)
        transitionPoints.push(point);
      else
        outPoints.push(point);

    builder.setSymbology(inColor, inColor, 15);
    builder.addPointString(inPoints);
    builder.setSymbology(outColor, outColor, 15);
    builder.addPointString(outPoints);
    builder.setSymbology(transitionColor, transitionColor, 31);
    builder.addPointString(transitionPoints);
  }

  /** @internal */
  public override getContentClip(): ClipVector | undefined {
    const points = this.getClipShape();
    if (points.length < 3)
      return undefined;
    if (this.mapTree.globeMode === GlobeMode.Ellipsoid) {
      const normal = PolygonOps.areaNormal(points);
      const globeOrigin = this.mapTree.globeOrigin;
      const globeNormal = Vector3d.createStartEnd(globeOrigin, points[0]);
      const negate = normal.dotProduct(globeNormal) < 0;
      const clipPlanes = [];
      for (let i = 0; i < 4; i++) {
        const point = points[i];
        const clipNormal = globeOrigin.crossProductToPoints(point, points[(i + 1) % 4], scratchNormal);
        if (negate)
          clipNormal.negate(clipNormal);

        const clipPlane = ClipPlane.createNormalAndPoint(clipNormal, point, false, false, scratchClipPlanes[i]);
        if (clipPlane !== undefined) // Undefined at pole tiles...
          clipPlanes.push(clipPlane);
      }

      const planeSet = ConvexClipPlaneSet.createPlanes(clipPlanes);
      const clipPrimitive = ClipPrimitive.createCapture(planeSet);

      return ClipVector.createCapture([clipPrimitive]);
    } else {
      return ClipVector.createCapture([ClipShape.createShape(points)!]);
    }
  }

  /** @internal */
  public override setNotFound(): void {
    super.setNotFound();

    // For map tiles assume that an unfound tile implies descendants and siblings will also be unfound.
    if (undefined !== this.parent)
      this.parent.setLeaf();
  }

  /** @internal */
  public getGraphic(_system: RenderSystem, _texture: RenderTexture): RenderGraphic | undefined {
    return undefined;
  }

  /** For globe tiles displaying less then depth 2 appears distorted
   * @internal
   */
  public override get isDisplayable() {
    return this.mapTree.globeMode === GlobeMode.Ellipsoid ? (this.depth >= MapTileTree.minDisplayableDepth) : super.isDisplayable;
  }

  /** @internal */
  public override isOccluded(viewingSpace: ViewingSpace): boolean {
    if (undefined === this._cornerRays || this.mapTree.globeMode !== GlobeMode.Ellipsoid)
      return false;

    if (viewingSpace.eyePoint !== undefined) {
      if (!this.mapTree.pointAboveEllipsoid(viewingSpace.eyePoint))
        return false;

      for (const cornerNormal of this._cornerRays) {
        const eyeNormal = Vector3d.createStartEnd(viewingSpace.eyePoint, cornerNormal.origin, scratchNormal);
        eyeNormal.normalizeInPlace();
        if (eyeNormal.dotProduct(cornerNormal.direction) < .01)
          return false;
      }
    } else {
      const viewZ = viewingSpace.rotation.getRow(2, scratchViewZ);
      for (const cornerNormal of this._cornerRays)
        if (cornerNormal.direction.dotProduct(viewZ) > 0)
          return false;
    }

    return true;
  }

  /** @internal */
  protected override _loadChildren(resolve: (children: Tile[] | undefined) => void, _reject: (error: Error) => void): void {
    const mapTree = this.mapTree;
    const childLevel = this.quadId.level + 1;
    const rowCount = mapTree.sourceTilingScheme.getNumberOfYChildrenAtLevel(childLevel);
    const columnCount = mapTree.sourceTilingScheme.getNumberOfXChildrenAtLevel(childLevel);

    const resolveChildren = (children: Tile[]) => {
      const childrenRange = Range3d.createNull();
      for (const child of children)
        childrenRange.extendRange(child.range);

      if (!this.range.containsRange(childrenRange))
        this.range.extendRange(childrenRange);

      resolve(children);
    };

    if (mapTree.doCreateGlobeChildren(this)) {
      this.createGlobeChildren(columnCount, rowCount, resolveChildren);
      return;
    }

    const resolvePlanarChildren = (childCorners: Point3d[][]) => {
      const level = this.quadId.level + 1;
      const column = this.quadId.column * 2;
      const row = this.quadId.row * 2;
      const children = [];
      const childrenAreLeaves = (this.depth + 1) === mapTree.loader.maxDepth;
      const globeMode = this.mapTree.globeMode;
      for (let j = 0; j < rowCount; j++) {
        for (let i = 0; i < columnCount; i++) {
          const quadId = new QuadId(level, column + i, row + j);
          const corners = childCorners[j * columnCount + i];
          const rectangle = mapTree.getTileRectangle(quadId);
          const normal = PolygonOps.areaNormal([corners[0], corners[1], corners[3], corners[2]]);
          normal.normalizeInPlace();

          const heightRange = this.mapTree.getChildHeightRange(quadId, rectangle, this);
          const diagonal = Math.max(corners[0].distance(corners[3]), corners[1].distance(corners[2])) / 2.0;
          const chordHeight = globeMode === GlobeMode.Ellipsoid ? Math.sqrt(diagonal * diagonal + Constant.earthRadiusWGS84.equator * Constant.earthRadiusWGS84.equator) - Constant.earthRadiusWGS84.equator : 0.0;
          const rangeCorners = MapTile.computeRangeCorners(corners, normal, chordHeight, undefined, heightRange);
          const range = Range3d.createArray(rangeCorners);
          const child = this.mapTree.createPlanarChild({ contentId: quadId.contentId, maximumSize: 512, range, parent: this, isLeaf: childrenAreLeaves }, quadId, corners, normal, rectangle, chordHeight, heightRange);
          if (child)
            children.push(child);
        }
      }

      resolveChildren(children);
    };

    mapTree.getPlanarChildCorners(this, columnCount, rowCount, resolvePlanarChildren);
  }

  private createGlobeChildren(columnCount: number, rowCount: number, resolve: (children: MapTile[]) => void) {
    const level = this.quadId.level + 1;
    const column = this.quadId.column * 2;
    const row = this.quadId.row * 2;
    const mapTree = this.mapTree;
    const children = [];

    for (let j = 0; j < rowCount; j++) {
      for (let i = 0; i < columnCount; i++) {
        const quadId = new QuadId(level, column + i, row + j);
        const angleSweep = quadId.getAngleSweep(mapTree.sourceTilingScheme);
        const ellipsoidPatch = EllipsoidPatch.createCapture(this.mapTree.earthEllipsoid, angleSweep.longitude, angleSweep.latitude);
        const range = ellipsoidPatch.range();
        const rectangle = mapTree.getTileRectangle(quadId);
        const heightRange = this.mapTree.getChildHeightRange(quadId, rectangle, this);
        if (undefined !== heightRange)
          range.expandInPlace(heightRange.high - heightRange.low);

        children.push(this.mapTree.createGlobeChild({ contentId: quadId.contentId, maximumSize: 512, range, parent: this, isLeaf: false }, quadId, range.corners(), rectangle, ellipsoidPatch, heightRange));
      }
    }

    resolve(children);
    return children;
  }

  /** @internal */
  public static computeRangeCorners(corners: Point3d[], normal: Vector3d, chordHeight: number, result?: Point3d[], heightRange?: Range1d) {
    if (result === undefined) {
      result = [];
      for (let i = 0; i < 8; i++)
        result.push(Point3d.create());
    }

    let index = 0;
    assert(corners.length === 4);
    const deltaLow = normal.scale(- chordHeight + (heightRange ? heightRange.low : 0));
    const deltaHigh = normal.scale(chordHeight + (heightRange ? heightRange.high : 0));

    for (const corner of corners)
      corner.plus(deltaLow, result[index++]);

    for (const corner of corners)
      corner.plus(deltaHigh, result[index++]);

    return result;
  }

  /** @internal */
  public override isRegionCulled(args: TileDrawArgs): boolean {
    return this.isContentCulled(args);
  }

  /** @internal */
  public override isContentCulled(args: TileDrawArgs): boolean {
    return FrustumPlanes.Containment.Outside === args.frustumPlanes.computeContainment(this.getRangeCorners(scratchCorners));
  }

  /** @internal */
  public clearLayers() {
    this.clearImageryTiles();
    this._graphic = undefined;
    if (this.children)
      for (const child of this.children)
        (child as MapTile).clearLayers();
  }

  private clearImageryTiles() {
    if (this._imageryTiles) {
      this._imageryTiles.forEach((tile) => tile.releaseMapTileUsage());
      this._imageryTiles = undefined;
    }
    if (this._hiddenTiles) {
      this._hiddenTiles = undefined;
    }
    if (this._highResolutionReplacementTiles) {
      this._highResolutionReplacementTiles = undefined;
    }
  }

  /** @internal */
  public override produceGraphics(): RenderGraphic | undefined {
    if (undefined !== this._graphic && this.imageryIsReady)
      return this._graphic;

    const geometry = this.renderGeometry;
    if (undefined === geometry)
      return undefined;

    const textures = this.getDrapeTextures();
    const { baseColor, baseTransparent, layerClassifiers } = this.mapTree;
    const graphic = IModelApp.renderSystem.createRealityMeshGraphic({ realityMesh: geometry, projection: this.getProjection(), tileRectangle: this.rectangle, featureTable: PackedFeatureTable.pack(this.mapLoader.featureTable), tileId: this.contentId, baseColor, baseTransparent, textures, layerClassifiers, disableClipStyle: true }, true);

    // If there are no layer classifiers then we can save this graphic for re-use.  If layer classifiers exist they are regenerated based on view and we must collate them with the imagery.
    if (this.imageryIsReady && 0 === this.mapTree.layerClassifiers.size)
      this._graphic = graphic;

    return graphic;
  }

  /** @internal */
  public getClipShape(): Point3d[] {
    return (this._patch instanceof PlanarTilePatch) ? this._patch.getClipShape() : [this._cornerRays![0].origin, this._cornerRays![1].origin, this._cornerRays![3].origin, this._cornerRays![2].origin];
  }

  /** @internal */
  protected override _collectStatistics(stats: RenderMemory.Statistics): void {
    super._collectStatistics(stats);

    this._renderGeometry?.collectStatistics(stats);
    if (this._mesh) {
      stats.addTerrain(this._mesh.indices.byteLength
        + this._mesh.positions.points.byteLength
        + this._mesh.uvs.points.byteLength
        + (this._mesh.normals ? this._mesh.normals.byteLength : 0),
      );
    }
  }

  /** Height range is along with the tile corners to detect if tile intersects view frustum.
   * Range will be single value fo ron-terrain tiles -- if terrain tile is not loaded it will
   * inherit height from ancestors.
   * @internal
   */
  public get heightRange(): Range1d | undefined {
    if (undefined !== this._heightRange)
      return this._heightRange;

    for (let parent = this.parent; undefined !== parent; parent = parent.parent) {
      const mapParent = parent as MapTile;
      if (undefined !== mapParent._heightRange)
        return mapParent._heightRange;
    }

    assert(false);
    return Range1d.createNull();
  }

  /** @internal */
  public get mapTilingScheme() {
    return this.mapTree.sourceTilingScheme;
  }

  /** Adjust the minimum and maximum elevations of the terrain within this tile. */
  public adjustHeights(minHeight: number, maxHeight: number) {
    if (undefined === this._heightRange)
      this._heightRange = Range1d.createXX(minHeight, maxHeight);
    else {
      this._heightRange.low = Math.max(this.heightRange!.low, minHeight);
      this._heightRange.high = Math.min(this.heightRange!.high, maxHeight);
    }

    if (this.rangeCorners && this._patch instanceof PlanarTilePatch)
      this._patch.getRangeCorners(this.heightRange!, this.rangeCorners);
  }

  /** Obtain a [[MapTileProjection]] to project positions within this tile's area into 3d space. */
  public getProjection(heightRange?: Range1d): MapTileProjection {
    return this._patch instanceof PlanarTilePatch ? new PlanarProjection(this._patch, heightRange) : new EllipsoidProjection(this._patch, heightRange);
  }

  /** @internal */
  public get baseImageryIsReady(): boolean {
    if (undefined !== this.mapTree.baseColor || 0 === this.mapTree.layerImageryTrees.length)
      return true;

    if (undefined === this._imageryTiles)
      return false;

    const baseTreeId = this.mapTree.layerImageryTrees[0].tree.modelId;
    return this._imageryTiles.every((imageryTile) => imageryTile.imageryTree.modelId !== baseTreeId || imageryTile.isReady);
  }

  /** @internal */
  public get imageryIsReady(): boolean {
    if (undefined === this._imageryTiles)
      return 0 === this.mapTree.layerImageryTrees.length;

    return this._imageryTiles.every((tile) => tile.isReady);
  }

  /** Select secondary (imagery) tiles
   * @internal
   */
  public override selectSecondaryTiles(args: TileDrawArgs, context: TraversalSelectionContext) {
    if (0 === this.mapTree.layerImageryTrees.length || this.imageryIsReady)
      return;

    this.clearImageryTiles();
    this._imageryTiles = new Array<ImageryMapTile>();
    this._hiddenTiles = new Array<ImageryMapTile>();
    this._highResolutionReplacementTiles = new Array<ImageryMapTile>();
    for (const layerImageryTree of this.mapTree.layerImageryTrees) {
      let tmpTiles = new Array<ImageryMapTile>();
      const tmpLeafTiles = new Array<ImageryMapTile>();
      if (TileTreeLoadStatus.Loaded !== layerImageryTree.tree.selectCartoDrapeTiles(tmpTiles, tmpLeafTiles, this, args)) {
        this._imageryTiles = undefined;
        return;
      }

      // When the base layer is zoomed-in beyond it's max resolution,
      // we display leaf tiles and stretched them if needed.
      // We don't want the same behavior non-base layers, in the case,
      // the layer will simply disappear past its max resolution.
      // Note: Replacement leaf tiles are kept as a mean to determine which
      // imagery tree has reached it's maximum zoom level.
      if (layerImageryTree.baseImageryLayer) {
        tmpTiles = [...tmpTiles, ...tmpLeafTiles];
      } else {
        this._highResolutionReplacementTiles = [...this._highResolutionReplacementTiles, ...tmpLeafTiles];
      }

      // MapTileTree might include a non-visible imagery tree, we need to check for that.
      if (layerImageryTree.settings.visible && !layerImageryTree.settings.allSubLayersInvisible) {
        for (const imageryTile of tmpTiles) {
          imageryTile.markMapTileUsage();
          if (imageryTile.isReady)
            args.markReady(imageryTile);
          else
            context.missing.push(imageryTile);
          this._imageryTiles.push(imageryTile);
        }
      } else {
        // Even though those selected imagery tile are not visible,
        // we keep track of them for scale range reporting.
        for (const imageryTile of tmpTiles) {
          this._hiddenTiles.push(imageryTile);
        }
      }
    }
  }

  private static _scratchRectangle1 = MapCartoRectangle.createZero();
  private static _scratchRectangle2 = MapCartoRectangle.createZero();

  /** The height range for terrain tiles is not known until the tiles are unloaded.  We use "ApproximateTerrainHeight" for first 6 levels but below
   * that the tiles inherit height range from parents.  This is problematic as tiles with large height range will be unnecessarily selected as
   * they apparently intersect view frustum.   To avoid this force loading of terrain tiles if they exceed "_maxParentHightDepth".
   * @internal
   */
  protected override forceSelectRealityTile(): boolean {
    let parentHeightDepth = 0;

    // eslint-disable-next-line @typescript-eslint/no-this-alias
    for (let parent: MapTile = this; parent !== undefined && parent._heightRange === undefined; parent = parent.parent as MapTile)
      parentHeightDepth++;

    return parentHeightDepth > MapTile._maxParentHeightDepth;
  }

  /** @internal */
  protected override minimumVisibleFactor(): number {
    // if minimumVisibleFactor is more than 0, it stops parents from loading when children are not ready, to fill in gaps
    return 0.0;
  }

  private static _scratchThisDiagonal = Vector2d.create();
  private static _scratchDrapeDiagonal = Vector2d.create();

  /** @internal */
  public getDrapeTextures(): TerrainTexture[] | undefined {
    if (undefined === this._imageryTiles)
      return undefined;

    const drapeTextures: TerrainTexture[] = [];
    const thisRectangle = this.loadableTerrainTile.rectangle;
    const thisDiagonal = thisRectangle.diagonal(MapTile._scratchThisDiagonal);
    const bordersNorthPole = this.quadId.bordersNorthPole(this.mapTree.sourceTilingScheme);
    const bordersSouthPole = this.quadId.bordersSouthPole(this.mapTree.sourceTilingScheme);
    for (const imageryTile of this._imageryTiles) {
      if (imageryTile.texture) {
        drapeTextures.push(this.computeDrapeTexture(thisRectangle, thisDiagonal, imageryTile, imageryTile.rectangle));

        if ((bordersNorthPole && imageryTile.quadId.bordersNorthPole(imageryTile.tilingScheme) && imageryTile.rectangle.high.y < thisRectangle.high.y) ||
          (bordersSouthPole && imageryTile.quadId.bordersSouthPole(imageryTile.tilingScheme) && imageryTile.rectangle.low.y > thisRectangle.low.y)) {
          // Add separate texture stretching last sliver of tile imagery to cover pole.
          const sliverRectangle = imageryTile.rectangle.clone(MapTile._scratchRectangle1);
          const clipRectangle = thisRectangle.clone(MapTile._scratchRectangle2);
          const sliverHeight = sliverRectangle.high.y - sliverRectangle.low.y;

          if (bordersSouthPole) {
            clipRectangle.high.y = sliverRectangle.low.y;
            sliverRectangle.low.y = thisRectangle.low.y;
            sliverRectangle.high.y += 1 / sliverHeight;
          } else {
            clipRectangle.low.y = sliverRectangle.high.y;
            sliverRectangle.high.y = thisRectangle.high.y;
            sliverRectangle.low.y -= 1 / sliverHeight;
          }

          drapeTextures.push(this.computeDrapeTexture(thisRectangle, thisDiagonal, imageryTile, sliverRectangle, clipRectangle));
        }
      } else {
        for (let parent = imageryTile.parent; undefined !== parent; parent = parent.parent) {
          const mapTile = parent as ImageryMapTile;
          if (mapTile.texture) {
            drapeTextures.push(this.computeDrapeTexture(thisRectangle, thisDiagonal, mapTile, mapTile.rectangle, imageryTile.rectangle));
            break;
          }
        }
      }
    }

    return drapeTextures.length > 0 ? drapeTextures : undefined;
  }

  private static _scratchIntersectRange = Range2d.createNull();

  private computeDrapeTexture(thisRectangle: Range2d, thisDiagonal: Vector2d, imageryTile: ImageryMapTile, drapeRectangle: Range2d, clipRectangle?: Range2d): TerrainTexture {
    assert(imageryTile.texture !== undefined);

    // Compute transformation from the terrain tile texture coordinates (0-1) to the drape tile texture coordinates.
    const drapeDiagonal = drapeRectangle.diagonal(MapTile._scratchDrapeDiagonal);
    const translate = Vector2d.create((thisRectangle.low.x - drapeRectangle.low.x) / drapeDiagonal.x, (thisRectangle.low.y - drapeRectangle.low.y) / drapeDiagonal.y);
    const scale = Vector2d.create(thisDiagonal.x / drapeDiagonal.x, thisDiagonal.y / drapeDiagonal.y);
    const featureIndex = this.mapLoader.getFeatureIndex(imageryTile.imageryTree.modelId);
    let clipRect;
    if (undefined !== clipRectangle) {
      const intersect = clipRectangle.intersect(drapeRectangle, MapTile._scratchIntersectRange);
      assert(!intersect.isNull);
      clipRect = Range2d.createXYXY((intersect.low.x - drapeRectangle.low.x) / drapeDiagonal.x, (intersect.low.y - drapeRectangle.low.y) / drapeDiagonal.y, (intersect.high.x - drapeRectangle.low.x) / drapeDiagonal.x, (intersect.high.y - drapeRectangle.low.y) / drapeDiagonal.y);
    }

    const imageryModelId = imageryTile.tree.modelId;
    return new TerrainTexture(imageryTile.texture, featureIndex, scale, translate, drapeRectangle, this.mapTree.getLayerIndex(imageryModelId), this.mapTree.getLayerTransparency(imageryModelId), clipRect);
  }

  /** @internal */
  public override setContent(content: TerrainTileContent): void {

    if (this.quadId.level < this.maxDepth) {
      const childIds = this.quadId.getChildIds();
      for (const childId of childIds) {
        if (!this.mapLoader.isTileAvailable(childId)) {
          this._mesh = content.terrain?.mesh; // If a child is unavailable retain mesh for upsampling.
          break;
        }
      }
    }

    if (this.mapTree.produceGeometry) {
      const iModelTransform = this.mapTree.iModelTransform;
      const geometryTransform = content.terrain?.renderGeometry?.transform;
      const transform = geometryTransform ? iModelTransform.multiplyTransformTransform(geometryTransform) : iModelTransform;
      const polyface = content.terrain?.mesh ? RealityMeshParams.toPolyface(content.terrain.mesh, { transform }) : undefined;
      this._geometry = polyface ? { polyfaces: [polyface] } : undefined;

    } else {
      dispose(this._renderGeometry);
      this._renderGeometry = content.terrain?.renderGeometry;
    }

    this.everLoaded = true;

    if (undefined !== content.contentRange)
      this._contentRange = content.contentRange;

    this.setIsReady();
  }

  /** @internal */
  public override freeMemory(): void {
    // ###TODO MapTiles and ImageryMapTiles share resources and don't currently interact well with TileAdmin.freeMemory(). Opt out for now.
  }

  /** @internal */
  public override disposeContents() {
    super.disposeContents();
    this._renderGeometry = dispose(this._renderGeometry);
    this.clearImageryTiles();
    // Note - don't dispose of mesh - these should only ever exist on terrain leaf tile and are required by children.  Let garbage collector handle them.
  }
}

/** A child tile that has no content of its own available. It instead produces content by up-sampling the content of an ancestor tile.
 * @internal
  */
export class UpsampledMapTile extends MapTile {
  /** The ancestor tile whose content will be up-sampled. */
  private readonly _loadableTile: MapTile;

  constructor(params: RealityTileParams, mapTree: MapTileTree, quadId: QuadId, patch: TilePatch, rectangle: MapCartoRectangle, heightRange: Range1d | undefined, cornerRays: Ray3d[] | undefined, loadableTile: MapTile) {
    super(params, mapTree, quadId, patch, rectangle, heightRange, cornerRays);
    this._loadableTile = loadableTile;
  }

  public override get isUpsampled() { return true; }
  public override get isEmpty() { return false; }
  public override get loadableTile(): RealityTile { return this._loadableTile; }

  private upsampleFromParent() {
    const parent = this.loadableTerrainTile;
    const parentMesh = parent.mesh;
    if (undefined === parentMesh) {
      return undefined;
    }
    const thisId = this.quadId, parentId = parent.quadId;
    const levelDelta = thisId.level - parentId.level;
    const thisColumn = thisId.column - (parentId.column << levelDelta);
    const thisRow = thisId.row - (parentId.row << levelDelta);
    const scale = 1.0 / (1 << levelDelta);
    const parentParameterRange = Range2d.createXYXY(scale * thisColumn, scale * thisRow, scale * (thisColumn + 1), scale * (thisRow + 1));
    const upsample = upsampleRealityMeshParams(parentMesh, parentParameterRange);
    this.adjustHeights(upsample.heightRange.low, upsample.heightRange.high);
    return upsample;
  }

  public override get renderGeometry() {
    if (undefined === this._renderGeometry) {
      const upsample = this.upsampleFromParent();
      const projection = this.loadableTerrainTile.getProjection(this.heightRange);
      if (upsample)
        this._renderGeometry = IModelApp.renderSystem.createTerrainMesh(upsample.mesh, projection.transformFromLocal, true);
    }
    return this._renderGeometry;
  }

  public override get isLoading(): boolean { return this.loadableTile.isLoading; }
  public override get isQueued(): boolean { return this.loadableTile.isQueued; }
  public override get isNotFound(): boolean { return this.loadableTile.isNotFound; }
  public override get isReady(): boolean { return (this._renderGeometry !== undefined || this.loadableTile.loadStatus === TileLoadStatus.Ready) && this.baseImageryIsReady; }

  public override markUsed(args: TileDrawArgs): void {
    args.markUsed(this);
    args.markUsed(this.loadableTile);
  }
}
