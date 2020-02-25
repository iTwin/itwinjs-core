/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module Tile
 */

import { assert, dispose } from "@bentley/bentleyjs-core";
import {
  Angle,
  AngleSweep,
  AxisOrder,
  ClipPlane,
  ClipShape,
  ClipVector,
  Constant,
  ConvexClipPlaneSet,
  Ellipsoid,
  EllipsoidPatch,
  Matrix3d,
  Point2d,
  Point3d,
  PolygonOps,
  Range1d,
  Range3d,
  Ray3d,
  Transform,
  Vector3d,
  ClipPrimitive,
} from "@bentley/geometry-core";
import {
  Cartographic,
  ColorByName,
  ColorDef,
  FrustumPlanes,
  GlobeMode,
  QPoint3dList,
  RenderTexture,
  GeoCoordStatus,
} from "@bentley/imodeljs-common";
import {
  MapTileLoaderBase,
  MapCartoRectangle,
  MapTilingScheme,
  QuadId,
  RealityTile,
  RealityTileTree,
  Tile,
  TileContent,
  TileDrawArgs,
  TileGraphicType,
  TileParams,
  TileTreeLoadStatus,
  TileTreeParams,
  TileVisibility,
  WebMercatorTilingScheme,
} from "./internal";
import { ViewingSpace } from "../ViewingSpace";
import { GeoConverter } from "../GeoServices";
import { GraphicBuilder } from "../render/GraphicBuilder";
import { RenderGraphic } from "../render/RenderGraphic";
import { GraphicBranch } from "../render/GraphicBranch";
import { RenderSystem } from "../render/RenderSystem";
import { MeshArgs } from "../render/primitives/mesh/MeshPrimitives";
import { MeshParams } from "../render/primitives/VertexTable";
import { IModelApp } from "../IModelApp";
import { ApproximateTerrainHeights } from "../ApproximateTerrainHeights";
import { RenderMemory } from "../render/RenderMemory";
import { BackgroundMapGeometry } from "../BackgroundMapGeometry";
import { IModelConnection } from "../IModelConnection";
import { SceneContext } from "../ViewContext";

const scratchNormal = Vector3d.create();
const scratchViewZ = Vector3d.create();
const scratchPoint = Point3d.create();
const scratchClipPlanes = [ClipPlane.createNormalAndPoint(scratchNormal, scratchPoint), ClipPlane.createNormalAndPoint(scratchNormal, scratchPoint), ClipPlane.createNormalAndPoint(scratchNormal, scratchPoint), ClipPlane.createNormalAndPoint(scratchNormal, scratchPoint)];
/**
 * A specialization of Tile for terrain and map imagery.  Holds the corners (possibly reprojected) as well as the height range.
 * The true height range is unknown until the content is loaded so until a tile is loaded it will inherit its height range
 * from its ancesttors.
 * @internal
 */
export abstract class MapTile extends RealityTile {
  private _texture?: RenderTexture;
  public readonly rectangle: MapCartoRectangle;
  public static globeMeshDimension = 10;

  public get mapTree() { return this.root as MapTileTree; }
  public get heightRange(): Range1d | undefined { return undefined; }
  public get mapLoader() { return this.root.loader as MapTileLoaderBase; }
  public get isUpsampled() { return false; }
  public get texture(): RenderTexture | undefined {
    return this._texture;
  }

  constructor(params: TileParams, public quadId: QuadId, rectangle: MapCartoRectangle, protected _cornerRays: Ray3d[] | undefined) {
    super(params);
    this.rectangle = rectangle;
  }

  public disposeContents() {
    super.disposeContents();
    this._texture = dispose(this._texture);
  }

  public collectStatistics(stats: RenderMemory.Statistics): void {
    super.collectStatistics(stats);

    if (undefined !== this.texture)
      stats.addTexture(this.texture.bytesUsed);
  }
  public addBoundingGraphic(builder: GraphicBuilder, color: ColorDef) {
    if (!this.isDisplayable)
      return;

    const heightRange = (this.heightRange === undefined) ? Range1d.createXX(-1, 1) : this.heightRange;
    const lows = [], highs = [], reorder = [0, 1, 3, 2, 0];
    const cornerRays = this._cornerRays!;
    for (let i = 0; i < 5; i++) {
      const cornerRay = cornerRays[reorder[i]];
      lows.push(cornerRay.origin.plusScaled(cornerRay.direction, heightRange.low));
      highs.push(cornerRay.origin.plusScaled(cornerRay.direction, heightRange.high));
    }
    builder.setSymbology(color, color, 1);
    builder.addLineString(lows);
    builder.addLineString(highs);
    for (let i = 0; i < 4; i++)
      builder.addLineString([lows[i], highs[i]]);

    const inColor = new ColorDef(ColorByName.cornflowerBlue);
    const outColor = new ColorDef(ColorByName.chartreuse);
    const transitionColor = new ColorDef(ColorByName.aquamarine);

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

  public getClipShape(): Point3d[] {
    const cornerRays = this._cornerRays!;
    return [cornerRays[0].origin, cornerRays[1].origin, cornerRays[3].origin, cornerRays[2].origin];
  }
  public getContentClip(): ClipVector | undefined {
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
        if (clipPlane !== undefined)      // Undefined at pole tiles...
          clipPlanes.push(clipPlane);
      }

      const planeSet = ConvexClipPlaneSet.createPlanes(clipPlanes);
      const clipPrimitive = ClipPrimitive.createCapture(planeSet);

      return ClipVector.createCapture([clipPrimitive]);
    } else {
      return ClipVector.createCapture([ClipShape.createShape(points)!]);
    }
  }

  /** Some imagery providers (Bing) do not explicitly specify tile availability but instead return a "not available" tile image when a
   * request is made for a non-availale tile.   In this case we set the parent to e a leaf so we not continue to request the tile (or its silings)
   * @internal
   */
  private setLeaf() {
    this._isLeaf = true;
    this._children = undefined;
    this._childrenLoadStatus = TileTreeLoadStatus.Loaded;
  }

  public setNotFound(): void {
    super.setNotFound();
    (this.parent! as MapTile).setLeaf();      // For map tiles assume that an unfound tile implies descendants and siblings will also be unfound.
  }

  public abstract getRangeCorners(result: Point3d[]): Point3d[];
  public getGraphic(_system: RenderSystem, _texture: RenderTexture): RenderGraphic | undefined { return undefined; }

  /** For globe tiles displaying less then depth 2 appears distorted
   * @internal
   */
  public get isDisplayable() {
    return this.mapTree.globeMode === GlobeMode.Ellipsoid ? (this.depth >= MapTileTree.minDisplayableDepth) : super.isDisplayable;
  }
  public setReprojectedCorners(reprojectedCorners: Point3d[]): void {
    const cartesianRange = this.mapTree.cartesianRange;
    if (this._cornerRays)
      for (let i = 0; i < 4; i++)
        if (cartesianRange.containsPoint(this._cornerRays[i].origin))
          this._cornerRays[i].origin = reprojectedCorners[i];
  }

  public computeVisibility(args: TileDrawArgs): TileVisibility {
    let visibility = super.computeVisibility(args);
    if (visibility === TileVisibility.Visible && !this.root.debugForcedDepth && this.isOccluded(args.viewingSpace))
      visibility = TileVisibility.OutsideFrustum;

    return visibility;
  }

  public isOccluded(viewingSpace: ViewingSpace): boolean {
    if (undefined === this._cornerRays || this.mapTree.globeMode !== GlobeMode.Ellipsoid)
      return false;

    if (viewingSpace.eyePoint !== undefined) {
      if (!this.mapTree.pointAboveEllipsoid(viewingSpace.eyePoint))
        return false;

      for (const cornerNormal of this._cornerRays) {
        const eyeNormal = Vector3d.createStartEnd(viewingSpace.eyePoint, cornerNormal.origin, scratchNormal);
        eyeNormal.normalizeInPlace();
        if (eyeNormal.dotProduct(cornerNormal.direction) < .1)
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

  protected loadChildren(): TileTreeLoadStatus {
    if (TileTreeLoadStatus.NotLoaded === this._childrenLoadStatus) {
      if (undefined === this._children) {
        this._childrenLoadStatus = TileTreeLoadStatus.Loading;
        const mapTree = this.mapTree;
        const rowCount = (this.quadId.level === 0) ? mapTree.sourceTilingScheme.numberOfLevelZeroTilesY : 2;
        const columnCount = (this.quadId.level === 0) ? mapTree.sourceTilingScheme.numberOfLevelZeroTilesX : 2;

        if (mapTree.doCreateGlobeChildren(this)) {
          this.createGlobeChildren(columnCount, rowCount);
          this._childrenLoadStatus = TileTreeLoadStatus.Loaded;
        } else {
          this.createPlanarChildren(mapTree.getChildCorners(this, columnCount, rowCount), columnCount, rowCount);

          if (mapTree.doReprojectChildren(this)) {
            mapTree.reprojectTileCorners(this, columnCount, rowCount).then(() => {
              this._childrenLoadStatus = TileTreeLoadStatus.Loaded;
              IModelApp.viewManager.onNewTilesReady();
            }).catch((_err) => {
              assert(false);
              IModelApp.viewManager.onNewTilesReady();
              this._childrenLoadStatus = TileTreeLoadStatus.NotFound;
            });
          } else {
            this._childrenLoadStatus = TileTreeLoadStatus.Loaded;
          }
        }
        if (this._children) {
          const childrenRange = Range3d.createNull();
          for (const child of this._children!)
            childrenRange.extendRange(child.range);
          if (!this.range.containsRange(childrenRange))
            this.range.extendRange(childrenRange);
        }
      }
    }
    return this._childrenLoadStatus;
  }

  private createGlobeChildren(columnCount: number, rowCount: number) {
    const level = this.quadId.level + 1;
    const column = this.quadId.column * 2;
    const row = this.quadId.row * 2;
    const mapTree = this.mapTree;
    this._children = [];
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
        this._children.push(this.mapTree.createGlobeChild({ root: mapTree, contentId: quadId.contentId, maximumSize: 512, range, parent: this, isLeaf: false }, quadId, range.corners(), rectangle, ellipsoidPatch, heightRange));
      }
    }
  }

  protected createPlanarChildren(childCorners: Point3d[][], columnCount: number, rowCount: number) {
    const level = this.quadId.level + 1;
    const column = this.quadId.column * 2;
    const row = this.quadId.row * 2;
    const mapTree = this.mapTree;
    this._children = [];
    const childrenAreLeaves = (this.depth + 1) === mapTree.loader.maxDepth;
    const globeMode = this.mapTree.globeMode;
    this._children = [];
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
        const range = Range3d.createArray(PlanarMapTile.computeRangeCorners(corners, normal!, chordHeight, scratchCorners, heightRange));
        this._children.push(this.mapTree.createPlanarChild({ root: mapTree, contentId: quadId.contentId, maximumSize: 512, range, parent: this, isLeaf: childrenAreLeaves }, quadId, corners, normal!, rectangle, chordHeight, heightRange));
      }
    }
  }

  public isRegionCulled(args: TileDrawArgs): boolean {
    return this.isContentCulled(args);
  }
  public isContentCulled(args: TileDrawArgs): boolean {
    return FrustumPlanes.Containment.Outside === args.frustumPlanes.computeContainment(this.getRangeCorners(scratchCorners));
  }

  public setContent(content: TileContent): void {
    // This should never happen but paranoia.
    this._graphic = dispose(this._graphic);
    this._texture = dispose(this._texture);

    this._graphic = content.graphic;
    this._texture = content.imageryTexture;

    if (undefined !== content.contentRange)
      this._contentRange = content.contentRange;

    if (!this._graphic && !this._texture)
      (this.parent! as MapTile).setLeaf();   // Avoid traversing bing branches after no graphics is found.

    this.setIsReady();
  }

  public selectCartoDrapeTiles(drapeTiles: MapTile[], rectangleToDrape: MapCartoRectangle, minDrapeHeight: number, args: TileDrawArgs) {
    if (this.isDisplayable && (this.isLeaf || this.rectangle.yLength() < minDrapeHeight)) {
      drapeTiles.push(this);
      return;
    }
    const childrenLoadStatus = this.loadChildren(); // NB: asynchronous
    if (TileTreeLoadStatus.Loading === childrenLoadStatus) {
      assert(false);      // This should never happen.... we are not reprojecting for imagery tiles.
      return;
    }
    this._childrenLastUsed = args.now;
    if (undefined !== this.children) {
      for (const child of this.children) {
        const mapChild = child as MapTile;
        if (mapChild.rectangle.intersectsRange(rectangleToDrape))
          mapChild.selectCartoDrapeTiles(drapeTiles, rectangleToDrape, minDrapeHeight, args);
      }
    }
  }
}

const scratchCorners = [Point3d.createZero(), Point3d.createZero(), Point3d.createZero(), Point3d.createZero(), Point3d.createZero(), Point3d.createZero(), Point3d.createZero(), Point3d.createZero()];
/** @internal */
export class PlanarMapTile extends MapTile {
  constructor(params: TileParams, quadId: QuadId, public corners: Point3d[], private readonly _normal: Vector3d, rectangle: MapCartoRectangle, private _chordHeight: number, cornerNormals: Ray3d[] | undefined) {
    super(params, quadId, rectangle, cornerNormals);
  }

  public getGraphic(system: RenderSystem, texture: RenderTexture): RenderGraphic {
    return system.createTile(texture, this.corners, 0)!;
  }

  public getRangeCorners(result: Point3d[]): Point3d[] { return PlanarMapTile.computeRangeCorners(this.corners, this._normal, this._chordHeight, result); }

  public setReprojectedCorners(reprojectedCorners: Point3d[]): void {
    super.setReprojectedCorners(reprojectedCorners);
    const cartesianRange = this.mapTree.cartesianRange;
    for (let i = 0; i < 4; i++)
      if (cartesianRange.containsPoint(this.corners[i]))
        this.corners[i] = reprojectedCorners[i];
  }

  public static computeRangeCorners(corners: Point3d[], normal: Vector3d, chordHeight: number, result: Point3d[], heightRange?: Range1d) {
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

  public computeVisibility(args: TileDrawArgs): TileVisibility {
    if (this.isEmpty || this.isRegionCulled(args) || this.isOccluded(args.viewingSpace))
      return TileVisibility.OutsideFrustum;

    if (!this.isDisplayable)
      return TileVisibility.TooCoarse;

    let pixelSize = args.getPixelSize(this);
    const maxSize = this.maximumSize;

    // In a parallel view, use the dot product with the map plane to limit the pixel size - this will avoid loading huge amounts of tiles that are not visible on edge.
    if (!args.context.viewport.isCameraOn)
      pixelSize *= Math.sqrt(Math.abs(args.context.viewport.rotation.coffs[8]));

    return (pixelSize > maxSize) ? TileVisibility.TooCoarse : TileVisibility.Visible;
  }

  public getTransformFromPlane(result?: Transform) {
    return Transform.createOriginAndMatrix(undefined, Matrix3d.createRigidHeadsUp(this._normal, AxisOrder.ZYX), result);
  }
  public getClipShape(): Point3d[] {
    return [this.corners[0], this.corners[1], this.corners[3], this.corners[2]];
  }
}

/** @internal */
class GlobeMapTile extends MapTile {
  constructor(params: TileParams, public quadId: QuadId, private _rangeCorners: Point3d[], rectangle: MapCartoRectangle, private _ellipsoidPatch: EllipsoidPatch, cornerNormals: Ray3d[] | undefined) {
    super(params, quadId, rectangle, cornerNormals);
  }
  public get graphicType(): TileGraphicType | undefined { return TileGraphicType.Scene; }     // We can't allow these to be (undepthbuffered) BackgroundMapType so override here.

  public setReprojectedCorners(_reprojectedCorners: Point3d[]) {
    assert(false);   // Globe tiles should never be reprojected.
  }
  public getRangeCorners(result: Point3d[]): Point3d[] {
    for (let i = 0; i < 8; i++)
      result[i].setFromPoint3d(this._rangeCorners[i]);

    return result;
  }

  public addBoundingGraphic(builder: GraphicBuilder, color: ColorDef) {
    const doMesh = false;
    color = new ColorDef(ColorByName.bisque);

    if (!doMesh) {
      super.addBoundingGraphic(builder, color);
      return;
    }

    builder.setSymbology(color, color, 1);
    if (doMesh) {
      const delta = 1.0 / (MapTile.globeMeshDimension - 1);
      const dimensionM1 = MapTile.globeMeshDimension - 1;

      for (let iRow = 0; iRow < dimensionM1; iRow++) {
        for (let iColumn = 0; iColumn < MapTile.globeMeshDimension - 1; iColumn++) {
          const points = [];
          const jColumn = iColumn + 1;
          const jRow = iRow + 1;
          points.push(this._ellipsoidPatch.uvFractionToPoint(iColumn * delta, iRow * delta));
          points.push(this._ellipsoidPatch.uvFractionToPoint(jColumn * delta, iRow * delta));
          points.push(this._ellipsoidPatch.uvFractionToPoint(jColumn * delta, jRow * delta));
          points.push(this._ellipsoidPatch.uvFractionToPoint(iColumn * delta, jRow * delta));
          points.push(this._ellipsoidPatch.uvFractionToPoint(iColumn * delta, iRow * delta));
          builder.addLineString(points);
        }
      }
    } else {
      builder.addRangeBox(this.range);
    }
  }

  private static _scratchMeshPoints = new Array<Point3d>();
  private static _scratchEllipsoid = Ellipsoid.create(Transform.createIdentity());

  public getGraphic(system: RenderSystem, texture: RenderTexture): RenderGraphic {
    const ellipsoidPatch = this._ellipsoidPatch;
    const patchCenter = ellipsoidPatch.range().localXYZToWorld(.5, .5, .5)!;
    const delta = 1.0 / (MapTile.globeMeshDimension - 3), nTotal = MapTile.globeMeshDimension * MapTile.globeMeshDimension;
    const dimensionM1 = MapTile.globeMeshDimension - 1, dimensionM2 = MapTile.globeMeshDimension - 2;
    const bordersSouthPole = this.quadId.bordersSouthPole(this.mapTree.sourceTilingScheme);
    const bordersNorthPole = this.quadId.bordersNorthPole(this.mapTree.sourceTilingScheme);
    const wantSkirts = this.mapTree.wantSkirts;
    const rowMin = (bordersNorthPole || wantSkirts) ? 0 : 1;
    const rowMax = (bordersSouthPole || wantSkirts) ? dimensionM1 : dimensionM2;
    const colMin = wantSkirts ? 0 : 1;
    const colMax = wantSkirts ? dimensionM1 : dimensionM2;
    const meshArgs = new MeshArgs();

    const vertIndices = new Array<number>();
    for (let iRow = rowMin; iRow < rowMax; iRow++) {
      for (let iColumn = colMin; iColumn < colMax; iColumn++) {
        const base = iRow * MapTile.globeMeshDimension + iColumn;
        const top = base + MapTile.globeMeshDimension;
        vertIndices.push(base);
        vertIndices.push(base + 1);
        vertIndices.push(top);
        vertIndices.push(top);
        vertIndices.push(base + 1);
        vertIndices.push(top + 1);
      }
    }

    const uvParams = new Array<Point2d>();
    for (let iRow = 0; iRow < MapTile.globeMeshDimension; iRow++) {
      const y = (iRow ? (Math.min(dimensionM2, iRow) - 1) : 0) * delta;
      for (let iColumn = 0; iColumn < MapTile.globeMeshDimension; iColumn++) {
        const x = (iColumn ? (Math.min(dimensionM2, iColumn) - 1) : 0) * delta;
        uvParams.push(Point2d.create(x, y));
      }
    }

    meshArgs.hasBakedLighting = true;
    meshArgs.vertIndices = vertIndices;
    meshArgs.textureUv = uvParams;
    meshArgs.points = new QPoint3dList();

    if (0 === GlobeMapTile._scratchMeshPoints.length)
      for (let i = 0; i < nTotal; i++)
        GlobeMapTile._scratchMeshPoints.push(Point3d.createZero());

    const qPoints = meshArgs.points!;
    ellipsoidPatch.ellipsoid.transformRef.clone(GlobeMapTile._scratchEllipsoid.transformRef);
    const scaleFactor = Math.max(.99, 1 - Math.sin(ellipsoidPatch.longitudeSweep.sweepRadians * delta));
    GlobeMapTile._scratchEllipsoid.transformRef.matrix.scaleColumnsInPlace(scaleFactor, scaleFactor, scaleFactor);

    const pointRange = Range3d.createNull();
    const skirtPatch = EllipsoidPatch.createCapture(GlobeMapTile._scratchEllipsoid, ellipsoidPatch.longitudeSweep, ellipsoidPatch.latitudeSweep);
    const skirtFraction = delta / 2.0;

    for (let iRow = 0, index = 0; iRow < MapTile.globeMeshDimension; iRow++) {
      for (let iColumn = 0; iColumn < MapTile.globeMeshDimension; iColumn++ , index++) {
        let x = (iColumn ? (Math.min(dimensionM2, iColumn) - 1) : 0) * delta;
        let y = (iRow ? (Math.min(dimensionM2, iRow) - 1) : 0) * delta;
        const thisPoint = GlobeMapTile._scratchMeshPoints[index];
        if (iRow === 0 || iRow === dimensionM1 || iColumn === 0 || iColumn === dimensionM1) {
          if (bordersSouthPole && iRow === dimensionM1)
            skirtPatch.ellipsoid.radiansToPoint(0, -Angle.piOver2Radians, thisPoint);
          else if (bordersNorthPole && iRow === 0)
            skirtPatch.ellipsoid.radiansToPoint(0, Angle.piOver2Radians, thisPoint);
          else {
            x += (iColumn === 0) ? -skirtFraction : (iColumn === dimensionM1 ? skirtFraction : 0);
            y += (iRow === 0) ? -skirtFraction : (iRow === dimensionM1 ? skirtFraction : 0);
            skirtPatch.uvFractionToPoint(x, y, thisPoint);
          }
        } else {
          ellipsoidPatch.uvFractionToPoint(x, y, thisPoint);
        }

        thisPoint.subtractInPlace(patchCenter);
        pointRange.extend(thisPoint);
      }
    }

    qPoints.params.setFromRange(pointRange);
    for (const point of GlobeMapTile._scratchMeshPoints)
      qPoints.add(point);

    meshArgs.texture = texture;
    const graphic = system.createMesh(MeshParams.create(meshArgs))!;
    const branch = new GraphicBranch();
    branch.add(graphic);
    const transform = Transform.createTranslation(patchCenter);

    return system.createBranch(branch, transform);
  }
}

/** @internal */
export async function calculateEcefToDb(iModel: IModelConnection, bimElevationBias: number): Promise<Transform> {
  if (undefined === iModel.ecefLocation)
    return Transform.createIdentity();

  const geoConverter = iModel.geoServices.getConverter("WGS84");
  if (geoConverter === undefined)
    return iModel.ecefLocation.getTransform().inverse()!;

  const projectExtents = iModel.projectExtents;
  const origin = projectExtents.localXYZToWorld(.5, .5, .5)!;
  origin.z = 0; // always use ground plane
  const northPoint = origin.plusXYZ(0, 10, 0);

  const response = await geoConverter.getGeoCoordinatesFromIModelCoordinates([origin, northPoint]);
  if (response.geoCoords[0].s !== GeoCoordStatus.Success || response.geoCoords[1].s !== GeoCoordStatus.Success)
    return iModel.ecefLocation.getTransform().inverse()!;

  const geoOrigin = Point3d.fromJSON(response.geoCoords[0].p);
  const geoNorth = Point3d.fromJSON(response.geoCoords[1].p);
  const ecefOrigin = Cartographic.fromDegrees(geoOrigin.x, geoOrigin.y, 0).toEcef()!;
  const ecefNorth = Cartographic.fromDegrees(geoNorth.x, geoNorth.y, 0).toEcef()!;

  const zVector = Vector3d.createFrom(ecefOrigin);
  const yVector = Vector3d.createStartEnd(ecefOrigin, ecefNorth);
  const matrix = Matrix3d.createRigidFromColumns(yVector, zVector, AxisOrder.YZX)!;
  const ecefToDb = Transform.createMatrixPickupPutdown(matrix, origin, ecefOrigin).inverse()!;
  ecefToDb.origin.z += bimElevationBias;
  return ecefToDb;
}

const scratchCorner = Point3d.createZero();
const scratchZNormal = Vector3d.create(0, 0, 1);

/**
 * A specialization of TileTree for map quadTrees.  This overrides the default tile selection to simplified traversal that preloads ancestors to avoid
 * unnnecessary loading during panning or zooming.
 * @internal
 */
export class MapTileTree extends RealityTileTree {
  private _mercatorFractionToDb: Transform;
  public earthEllipsoid: Ellipsoid;
  public minEarthEllipsoid: Ellipsoid;
  public maxEarthEllipsoid: Ellipsoid;
  public globeMode: GlobeMode;
  public globeOrigin: Point3d;
  public cartesianRange: Range3d;
  public cartesianTransitionDistance: number;
  private _gcsConverter: GeoConverter | undefined;
  private _mercatorTilingScheme: MapTilingScheme;

  public static minReprojectionDepth = 8;             // Reprojection does not work with very large tiles so just do linear transform.
  public static maxGlobeDisplayDepth = 8;
  public static minDisplayableDepth = 3;
  public get mapLoader() { return this.loader as MapTileLoaderBase; }
  public getBaseRealityDepth(sceneContext: SceneContext) {
    // If the view has ever had global scope then preload low level (global) tiles.
    return (sceneContext.viewport.view.maxGlobalScopeFactor > 1) ? MapTileTree.minDisplayableDepth : -1;
  }

  constructor(params: TileTreeParams, public ecefToDb: Transform, public bimElevationBias: number, gcsConverterAvailable: boolean, public sourceTilingScheme: MapTilingScheme, protected _maxDepth: number, globeMode: GlobeMode, includeTerrain: boolean, public wantSkirts: boolean) {
    super(params);

    this._mercatorTilingScheme = new WebMercatorTilingScheme();
    this._mercatorFractionToDb = this._mercatorTilingScheme.computeMercatorFractionToDb(ecefToDb, bimElevationBias, params.iModel);
    const quadId = new QuadId(0, 0, 0);
    this.cartesianRange = BackgroundMapGeometry.getCartesianRange(this.iModel);
    this.globeOrigin = this.ecefToDb.getOrigin().clone();
    this.earthEllipsoid = Ellipsoid.createCenterMatrixRadii(this.globeOrigin, this.ecefToDb.matrix, Constant.earthRadiusWGS84.equator, Constant.earthRadiusWGS84.equator, Constant.earthRadiusWGS84.polar);
    const globalHeightRange = includeTerrain ? ApproximateTerrainHeights.instance.globalHeightRange : Range1d.createXX(0, 0);
    const globalRectangle = new MapCartoRectangle(-Angle.piRadians, - Angle.piOver2Radians, Angle.piRadians, Angle.piOver2Radians);
    this.cartesianTransitionDistance = this.cartesianRange.diagonal().magnitudeXY() * .25;      // Transition distance from elliptical to cartesian.
    if (includeTerrain) {
      this.minEarthEllipsoid = Ellipsoid.createCenterMatrixRadii(this.globeOrigin, this.ecefToDb.matrix, Constant.earthRadiusWGS84.equator + globalHeightRange.low, Constant.earthRadiusWGS84.equator + globalHeightRange.low, Constant.earthRadiusWGS84.polar + globalHeightRange.low);
      this.maxEarthEllipsoid = Ellipsoid.createCenterMatrixRadii(this.globeOrigin, this.ecefToDb.matrix, Constant.earthRadiusWGS84.equator + globalHeightRange.high, Constant.earthRadiusWGS84.equator + globalHeightRange.high, Constant.earthRadiusWGS84.polar + globalHeightRange.high);
    } else {
      this.minEarthEllipsoid = this.earthEllipsoid;
      this.maxEarthEllipsoid = this.earthEllipsoid;
    }

    const rootPatch = EllipsoidPatch.createCapture(this.maxEarthEllipsoid, AngleSweep.createStartSweepRadians(0, Angle.pi2Radians), AngleSweep.createStartSweepRadians(-Angle.piOver2Radians, Angle.piRadians));
    let range;
    if (globeMode === GlobeMode.Ellipsoid) {
      range = rootPatch.range();
    } else {
      const corners = this.getFractionalTileCorners(quadId);
      this._mercatorFractionToDb.multiplyPoint3dArrayInPlace(corners);
      range = Range3d.createArray(PlanarMapTile.computeRangeCorners(corners, Vector3d.create(0, 0, 1), 0, scratchCorners, globalHeightRange));
    }
    this._rootTile = new GlobeMapTile({ root: this, contentId: quadId.contentId, maximumSize: 0, range }, quadId, range.corners(), globalRectangle, rootPatch, undefined);
    this._gcsConverter = gcsConverterAvailable ? params.iModel.geoServices.getConverter("WGS84") : undefined;
    this.globeMode = globeMode; this.yAxisUp;
  }

  public get isDrape() { return this.mapLoader.isDrape; }
  public get maxDepth() { return this._maxDepth; }
  public getChildHeightRange(_quadId: QuadId, _rectangle: MapCartoRectangle, _parent: MapTile): Range1d | undefined { return undefined; }

  public doCreateGlobeChildren(tile: Tile): boolean {
    if (this.globeMode !== GlobeMode.Ellipsoid)
      return false;

    const childDepth = tile.depth + 1;
    if (childDepth < MapTileTree.maxGlobeDisplayDepth)     // If the depth is too low (tile is too large) display as globe.
      return true;

    return false;  // Display as globe if more than 100 KM from project.
  }

  public doReprojectChildren(tile: Tile): boolean {
    if (this.isDrape || this._gcsConverter === undefined)
      return false;

    const childDepth = tile.depth + 1;
    if (childDepth < MapTileTree.minReprojectionDepth)     // If the depth is too low (tile is too large) omit reprojection.
      return false;

    return this.cartesianRange.intersectsRange(tile.range);
  }

  public getCornerRays(rectangle: MapCartoRectangle): Ray3d[] | undefined {
    const rays = new Array<Ray3d>();
    if (this.globeMode === GlobeMode.Ellipsoid) {
      rays.push(this.earthEllipsoid.radiansToUnitNormalRay(rectangle.low.x, Cartographic.parametricLatitudeFromGeodeticLatitude(rectangle.high.y))!);
      rays.push(this.earthEllipsoid.radiansToUnitNormalRay(rectangle.high.x, Cartographic.parametricLatitudeFromGeodeticLatitude(rectangle.high.y))!);
      rays.push(this.earthEllipsoid.radiansToUnitNormalRay(rectangle.low.x, Cartographic.parametricLatitudeFromGeodeticLatitude(rectangle.low.y))!);
      rays.push(this.earthEllipsoid.radiansToUnitNormalRay(rectangle.high.x, Cartographic.parametricLatitudeFromGeodeticLatitude(rectangle.low.y))!);
    } else {
      const mercatorFractionRange = rectangle.getTileFractionRange(this._mercatorTilingScheme);
      rays.push(Ray3d.createCapture(this._mercatorFractionToDb.multiplyXYZ(mercatorFractionRange.low.x, mercatorFractionRange.high.y), scratchZNormal));
      rays.push(Ray3d.createCapture(this._mercatorFractionToDb.multiplyXYZ(mercatorFractionRange.high.x, mercatorFractionRange.high.y), scratchZNormal));
      rays.push(Ray3d.createCapture(this._mercatorFractionToDb.multiplyXYZ(mercatorFractionRange.low.x, mercatorFractionRange.low.y), scratchZNormal));
      rays.push(Ray3d.createCapture(this._mercatorFractionToDb.multiplyXYZ(mercatorFractionRange.high.x, mercatorFractionRange.low.y), scratchZNormal));
    }
    return rays;
  }
  public pointAboveEllipsoid(point: Point3d): boolean {
    return this.earthEllipsoid.worldToLocal(point, scratchPoint)!.magnitude() > 1;
  }

  private getMercatorFractionChildGridPoints(tile: MapTile, columnCount: number, rowCount: number): Point3d[] {
    const gridPoints = [];
    const quadId = tile.quadId;
    const deltaX = 1.0 / columnCount, deltaY = 1.0 / rowCount;
    for (let row = 0; row <= rowCount; row++) {
      for (let column = 0; column <= columnCount; column++) {
        const xFraction = this.sourceTilingScheme.tileXToFraction(quadId.column + column * deltaX, quadId.level);
        const yFraction = this.sourceTilingScheme.tileYToFraction(quadId.row + row * deltaY, quadId.level);

        gridPoints.push(Point3d.create(xFraction, yFraction, 0));
      }
    }
    // If not mercator already need to remap latitude...
    if (!(this.sourceTilingScheme instanceof WebMercatorTilingScheme))
      for (const gridPoint of gridPoints)
        gridPoint.y = this._mercatorTilingScheme.latitudeToYFraction(this.sourceTilingScheme.yFractionToLatitude(gridPoint.y));

    return gridPoints;
  }

  private getChildCornersFromGridPoints(gridPoints: Point3d[], columnCount: number, rowCount: number) {
    const childCorners = new Array<Point3d[]>();
    for (let row = 0; row < rowCount; row++) {
      for (let column = 0; column < columnCount; column++) {
        const index0 = column + row * (columnCount + 1);
        const index1 = index0 + (columnCount + 1);
        childCorners.push([gridPoints[index0], gridPoints[index0 + 1], gridPoints[index1], gridPoints[index1 + 1]]);
      }
    }
    return childCorners;
  }
  public async reprojectTileCorners(tile: MapTile, columnCount: number, rowCount: number): Promise<void> {
    const gridPoints = this.getMercatorFractionChildGridPoints(tile, columnCount, rowCount);
    const requestProps = [];
    for (const gridPoint of gridPoints)
      requestProps.push({
        x: this._mercatorTilingScheme.xFractionToLongitude(gridPoint.x) * Angle.degreesPerRadian,
        y: this._mercatorTilingScheme.yFractionToLatitude(gridPoint.y) * Angle.degreesPerRadian,
        z: this.bimElevationBias,
      });

    let iModelCoordinates = this._gcsConverter!.getCachedIModelCoordinatesFromGeoCoordinates(requestProps);
    if (undefined !== iModelCoordinates.missing) {
      await this._gcsConverter!.getIModelCoordinatesFromGeoCoordinates(iModelCoordinates.missing);
      iModelCoordinates = this._gcsConverter!.getCachedIModelCoordinatesFromGeoCoordinates(requestProps);
      assert(undefined === iModelCoordinates.missing);
    }
    for (let i = 0; i < gridPoints.length; i++)
      gridPoints[i] = Point3d.fromJSON(iModelCoordinates.result[i]!.p);

    if (undefined === tile.children)
      return;

    assert(rowCount * columnCount === tile.children.length);
    for (let row = 0; row < rowCount; row++) {
      for (let column = 0; column < columnCount; column++) {
        const child = tile.children![row * columnCount + column] as PlanarMapTile;
        const index0 = column + row * (columnCount + 1);
        const index1 = index0 + (columnCount + 1);
        child.setReprojectedCorners([gridPoints[index0], gridPoints[index0 + 1], gridPoints[index1], gridPoints[index1 + 1]]);
      }
    }
  }

  public getChildCorners(tile: MapTile, columnCount: number, rowCount: number): Point3d[][] {
    const gridPoints = this.getMercatorFractionChildGridPoints(tile, columnCount, rowCount);
    for (const gridPoint of gridPoints) {
      this._mercatorFractionToDb.multiplyPoint3d(gridPoint, scratchCorner);
      if (this.globeMode !== GlobeMode.Ellipsoid || this.cartesianRange.containsPoint(scratchCorner)) {
        scratchCorner.clone(gridPoint);
      } else {
        this._mercatorTilingScheme.fractionToCartographic(gridPoint.x, gridPoint.y, MapTileTree._scratchCarto);
        this.earthEllipsoid.radiansToPoint(MapTileTree._scratchCarto.longitude, Cartographic.parametricLatitudeFromGeodeticLatitude(MapTileTree._scratchCarto.latitude), gridPoint);
        const cartesianDistance = this.cartesianRange.distanceToPoint(scratchCorner);
        if (cartesianDistance < this.cartesianTransitionDistance)
          scratchCorner.interpolate(cartesianDistance / this.cartesianTransitionDistance, gridPoint, gridPoint);
      }
    }

    return this.getChildCornersFromGridPoints(gridPoints, columnCount, rowCount);
  }

  public getFractionalTileCorners(quadId: QuadId): Point3d[] {
    const corners: Point3d[] = [];             //    ----x----->

    corners.push(Point3d.create(this.sourceTilingScheme.tileXToFraction(quadId.column, quadId.level), this.sourceTilingScheme.tileYToFraction(quadId.row, quadId.level), 0.0));
    corners.push(Point3d.create(this.sourceTilingScheme.tileXToFraction(quadId.column + 1, quadId.level), this.sourceTilingScheme.tileYToFraction(quadId.row, quadId.level), 0.0));
    corners.push(Point3d.create(this.sourceTilingScheme.tileXToFraction(quadId.column, quadId.level), this.sourceTilingScheme.tileYToFraction(quadId.row + 1, quadId.level), 0.0));
    corners.push(Point3d.create(this.sourceTilingScheme.tileXToFraction(quadId.column + 1, quadId.level), this.sourceTilingScheme.tileYToFraction(quadId.row + 1, quadId.level), 0.0));
    return corners;
  }

  public getTileRectangle(quadId: QuadId): MapCartoRectangle {
    return this.sourceTilingScheme.tileXYToRectangle(quadId.column, quadId.row, quadId.level);
  }

  private static _scratchCarto = new Cartographic();
  private static _scratchDrapeRectangle = new MapCartoRectangle();
  private static _drapeIntersectionScale = 1.0 - 1.0E-5;

  public selectCartoDrapeTiles(tileToDrape: MapTile, args: TileDrawArgs): MapTile[] {
    const drapeRectangle = tileToDrape.rectangle.clone(MapTileTree._scratchDrapeRectangle);
    const minDrapeHeight = tileToDrape.rectangle.yLength();
    drapeRectangle.scaleAboutCenterInPlace(MapTileTree._drapeIntersectionScale);    // Contract slightly to avoid draping adjacent or slivers.
    const drapeTiles = new Array<MapTile>();
    (this.rootTile as MapTile).selectCartoDrapeTiles(drapeTiles, drapeRectangle, minDrapeHeight, args);
    return drapeTiles;
  }

  public createPlanarChild(params: TileParams, quadId: QuadId, corners: Point3d[], normal: Vector3d, rectangle: MapCartoRectangle, chordHeight: number, _heightRange?: Range1d): MapTile {
    return new PlanarMapTile(params, quadId, corners, normal, rectangle, chordHeight, this.getCornerRays(rectangle));
  }

  public createGlobeChild(params: TileParams, quadId: QuadId, rangeCorners: Point3d[], rectangle: MapCartoRectangle, ellipsoidPatch: EllipsoidPatch, _heightRange?: Range1d): MapTile {
    return new GlobeMapTile(params, quadId, rangeCorners, rectangle, ellipsoidPatch, this.getCornerRays(rectangle));
  }
}
