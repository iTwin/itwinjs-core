/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module Tiles
 */

import { assert, compareBooleans, compareBooleansOrUndefined, compareNumbers, compareStrings, compareStringsOrUndefined, CompressedId64Set, Id64String } from "@itwin/core-bentley";
import {
  BackgroundMapSettings, BaseLayerSettings, Cartographic, ColorDef, FeatureAppearance, GeoCoordStatus, GlobeMode, MapLayerSettings, PlanarClipMaskPriority, TerrainHeightOriginMode,
  TerrainProviderName,
} from "@itwin/core-common";
import {
  Angle, AngleSweep, Constant, Ellipsoid, EllipsoidPatch, Point3d, Range1d, Range3d, Ray3d, Transform, Vector3d, XYZProps,
} from "@itwin/core-geometry";
import { ApproximateTerrainHeights } from "../../ApproximateTerrainHeights";
import { TerrainDisplayOverrides } from "../../DisplayStyleState";
import { HitDetail } from "../../HitDetail";
import { IModelConnection } from "../../IModelConnection";
import { PlanarClipMaskState } from "../../PlanarClipMaskState";
import { FeatureSymbology } from "../../render/FeatureSymbology";
import { RenderPlanarClassifier } from "../../render/RenderPlanarClassifier";
import { SceneContext } from "../../ViewContext";
import { ScreenViewport } from "../../Viewport";
import {
  BingElevationProvider,
  createDefaultViewFlagOverrides, createMapLayerTreeReference, DisclosedTileTreeSet, EllipsoidTerrainProvider, GeometryTileTreeReference, getCesiumTerrainProvider, GraphicsCollectorDrawArgs,
  ImageryMapLayerTreeReference,
  ImageryMapTileTree,
  MapCartoRectangle,
  MapLayerFeatureInfo,
  MapLayerTileTreeReference,
  MapTile,
  MapTileLoader,
  MapTilingScheme,
  ModelMapLayerTileTreeReference,
  PlanarTilePatch,
  QuadId,
  RealityTile, RealityTileDrawArgs, RealityTileTree, RealityTileTreeParams, Tile, TileDrawArgs, TileLoadPriority, TileParams, TileTree, TileTreeLoadStatus, TileTreeOwner, TileTreeReference, TileTreeSupplier, UpsampledMapTile, WebMercatorTilingScheme,
} from "../internal";

const scratchPoint = Point3d.create();
const scratchCorners = [Point3d.createZero(), Point3d.createZero(), Point3d.createZero(), Point3d.createZero(), Point3d.createZero(), Point3d.createZero(), Point3d.createZero(), Point3d.createZero()];
const scratchCorner = Point3d.createZero();
const scratchZNormal = Vector3d.create(0, 0, 1);

/** @internal */
export class MapTileTree extends RealityTileTree {
  private _mercatorFractionToDb: Transform;
  public earthEllipsoid: Ellipsoid;
  public minEarthEllipsoid: Ellipsoid;
  public maxEarthEllipsoid: Ellipsoid;
  public globeMode: GlobeMode;
  public globeOrigin: Point3d;
  private _mercatorTilingScheme: MapTilingScheme;
  public useDepthBuffer: boolean;
  public isOverlay: boolean;
  public terrainExaggeration: number;
  public baseColor?: ColorDef;
  public baseTransparent: boolean;
  public mapTransparent: boolean;
  public produceGeometry?: boolean;

  constructor(params: RealityTileTreeParams, public ecefToDb: Transform, public bimElevationBias: number, public geodeticOffset: number,
    public sourceTilingScheme: MapTilingScheme, id: MapTreeId, applyTerrain: boolean) {
    super(params);
    this._mercatorTilingScheme = new WebMercatorTilingScheme();
    this._mercatorFractionToDb = this._mercatorTilingScheme.computeMercatorFractionToDb(ecefToDb, bimElevationBias, params.iModel, applyTerrain);
    const quadId = new QuadId(sourceTilingScheme.rootLevel, 0, 0);
    this.globeOrigin = this.ecefToDb.getOrigin().clone();
    this.earthEllipsoid = Ellipsoid.createCenterMatrixRadii(this.globeOrigin, this.ecefToDb.matrix, Constant.earthRadiusWGS84.equator, Constant.earthRadiusWGS84.equator, Constant.earthRadiusWGS84.polar);
    const globalHeightRange = applyTerrain ? ApproximateTerrainHeights.instance.globalHeightRange : Range1d.createXX(0, 0);
    const globalRectangle = MapCartoRectangle.create();

    this.globeMode = id.globeMode;
    this.isOverlay = id.isOverlay;
    this.useDepthBuffer = id.useDepthBuffer;
    this.terrainExaggeration = id.terrainExaggeration;
    this.baseColor = id.baseColor;
    this.baseTransparent = id.baseTransparent;
    this.mapTransparent = id.mapTransparent;
    if (applyTerrain) {
      this.minEarthEllipsoid = Ellipsoid.createCenterMatrixRadii(this.globeOrigin, this.ecefToDb.matrix, Constant.earthRadiusWGS84.equator + globalHeightRange.low, Constant.earthRadiusWGS84.equator + globalHeightRange.low, Constant.earthRadiusWGS84.polar + globalHeightRange.low);
      this.maxEarthEllipsoid = Ellipsoid.createCenterMatrixRadii(this.globeOrigin, this.ecefToDb.matrix, Constant.earthRadiusWGS84.equator + globalHeightRange.high, Constant.earthRadiusWGS84.equator + globalHeightRange.high, Constant.earthRadiusWGS84.polar + globalHeightRange.high);
      this.produceGeometry = id.produceGeometry;
    } else {
      this.minEarthEllipsoid = this.earthEllipsoid;
      this.maxEarthEllipsoid = this.earthEllipsoid;
    }

    const rootPatch = EllipsoidPatch.createCapture(this.maxEarthEllipsoid, AngleSweep.createStartSweepRadians(0, Angle.pi2Radians), AngleSweep.createStartSweepRadians(-Angle.piOver2Radians, Angle.piRadians));
    let range;
    if (this.globeMode === GlobeMode.Ellipsoid) {
      range = rootPatch.range();
    } else {
      const corners = this.getFractionalTileCorners(quadId);
      this._mercatorFractionToDb.multiplyPoint3dArrayInPlace(corners);
      range = Range3d.createArray(MapTile.computeRangeCorners(corners, Vector3d.create(0, 0, 1), 0, scratchCorners, globalHeightRange));
    }
    this._rootTile = this.createGlobeChild({ contentId: quadId.contentId, maximumSize: 0, range }, quadId, range.corners(), globalRectangle, rootPatch, undefined);

  }

  // If we are not depth buffering we force parents and exclusive to false to cause the map tiles to be sorted by depth so that painters algorithm will approximate correct depth display.
  public override get parentsAndChildrenExclusive() { return this.useDepthBuffer ? this.loader.parentsAndChildrenExclusive : false; }

  public tileFromQuadId(quadId: QuadId): MapTile | undefined {
    return (this._rootTile as MapTile).tileFromQuadId(quadId);
  }

  public imageryTrees: ImageryMapTileTree[] = [];
  private _layerSettings = new Map<Id64String, MapLayerSettings>();
  private _modelIdToIndex = new Map<Id64String, number>();
  public layerClassifiers = new Map<number, RenderPlanarClassifier>();

  public  addImageryLayer(tree: ImageryMapTileTree, settings: MapLayerSettings, index: number) {
    this.imageryTrees.push(tree);
    this._layerSettings.set(tree.modelId, settings);
    this._modelIdToIndex.set(tree.modelId, index);
  }

  public addModelLayer(layerTreeRef: ModelMapLayerTileTreeReference, context: SceneContext) {
    const classifier = context.addPlanarClassifier(`MapLayer ${this.modelId}-${layerTreeRef.layerIndex}`, layerTreeRef);
    if (classifier)
      this.layerClassifiers.set(layerTreeRef.layerIndex, classifier);
  }

  protected override collectClassifierGraphics(args: TileDrawArgs, selectedTiles: RealityTile[]) {
    super.collectClassifierGraphics(args, selectedTiles);

    this.layerClassifiers.forEach((layerClassifier: RenderPlanarClassifier) => {
      if (!(args instanceof GraphicsCollectorDrawArgs))
        layerClassifier.collectGraphics(args.context, { modelId: this.modelId, tiles: selectedTiles, location: args.location, isPointCloud: this.isPointCloud });

    });
  }

  public clearImageryTreesAndClassifiers() {
    this.imageryTrees.length = 0;
    this._layerSettings.clear();
    this._modelIdToIndex.clear();
    this.layerClassifiers.clear();
  }

  public override get isTransparent() {
    return this.mapTransparent || this.baseTransparent;
  }

  public override get maxDepth() {
    let maxDepth = this.loader.maxDepth;
    this.imageryTrees?.forEach((imageryTree) => maxDepth = Math.max(maxDepth, imageryTree.maxDepth));

    return maxDepth;
  }
  public createPlanarChild(params: TileParams, quadId: QuadId, corners: Point3d[], normal: Vector3d, rectangle: MapCartoRectangle, chordHeight: number, heightRange?: Range1d): MapTile | undefined{
    const childAvailable = this.mapLoader.isTileAvailable(quadId);
    if (!childAvailable && this.produceGeometry)
      return undefined;
    const patch = new PlanarTilePatch(corners, normal, chordHeight);
    const cornerNormals = this.getCornerRays(rectangle);
    const ctor = childAvailable ? MapTile : UpsampledMapTile;
    return new ctor(params, this, quadId, patch, rectangle, heightRange, cornerNormals);
  }

  public createGlobeChild(params: TileParams, quadId: QuadId, _rangeCorners: Point3d[], rectangle: MapCartoRectangle, ellipsoidPatch: EllipsoidPatch, heightRange?: Range1d): MapTile {
    return new MapTile(params, this, quadId, ellipsoidPatch, rectangle, heightRange, this.getCornerRays(rectangle));
  }

  public getChildHeightRange(quadId: QuadId, rectangle: MapCartoRectangle, parent: MapTile): Range1d | undefined {
    return this.mapLoader.getChildHeightRange(quadId, rectangle, parent);
  }

  public clearLayers() {
    (this._rootTile as MapTile).clearLayers();
  }

  public static minReprojectionDepth = 8;             // Reprojection does not work with very large tiles so just do linear transform.
  public static maxGlobeDisplayDepth = 8;
  public static minDisplayableDepth = 3;
  public get mapLoader() { return this.loader as MapTileLoader; }
  public override getBaseRealityDepth(sceneContext: SceneContext) {
    // If the view has ever had global scope then preload low level (global) tiles.
    return (sceneContext.viewport.view.maxGlobalScopeFactor > 1) ? MapTileTree.minDisplayableDepth : -1;
  }

  public doCreateGlobeChildren(tile: Tile): boolean {
    if (this.globeMode !== GlobeMode.Ellipsoid)
      return false;

    const childDepth = tile.depth + 1;
    if (childDepth < MapTileTree.maxGlobeDisplayDepth)     // If the depth is too low (tile is too large) display as globe.
      return true;

    return false;  // Display as globe if more than 100 KM from project.
  }
  public override doReprojectChildren(tile: Tile): boolean {
    if (this._gcsConverter === undefined)
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

  public getCachedReprojectedPoints(gridPoints: Point3d[]): (Point3d | undefined)[] | undefined {
    const requestProps = [];
    for (const gridPoint of gridPoints)
      requestProps.push({
        x: this._mercatorTilingScheme.xFractionToLongitude(gridPoint.x) * Angle.degreesPerRadian,
        y: this._mercatorTilingScheme.yFractionToLatitude(gridPoint.y) * Angle.degreesPerRadian,
        z: this.bimElevationBias,
      });

    const iModelCoordinates = this._gcsConverter!.getCachedIModelCoordinatesFromGeoCoordinates(requestProps);

    if (iModelCoordinates.missing)
      return undefined;

    return iModelCoordinates.result.map((result) => !result || result.s ? undefined : Point3d.fromJSON(result.p));
  }

  // Minimize reprojection requests by requesting this corners tile and a grid that will include all points for 4 levels of descendants.
  // This greatly reduces the number of reprojection requests which currently require a roundtrip through the backend.
  public async loadReprojectionCache(tile: MapTile): Promise<void> {
    const quadId = tile.quadId;
    const xRange = Range1d.createXX(this.sourceTilingScheme.tileXToFraction(quadId.column, quadId.level), this.sourceTilingScheme.tileXToFraction(quadId.column + 1, quadId.level));
    const yRange = Range1d.createXX(this.sourceTilingScheme.tileYToFraction(quadId.row, quadId.level), this.sourceTilingScheme.tileYToFraction(quadId.row + 1, quadId.level));
    const cacheDepth = 4, cacheDimension = 2 ** cacheDepth;
    const delta = 1.0 / cacheDimension;
    const requestProps = [];

    for (let row = 0; row <= cacheDimension; row++) {
      for (let column = 0; column <= cacheDimension; column++) {
        let yFraction = yRange.fractionToPoint(row * delta);
        if (!(this.sourceTilingScheme instanceof WebMercatorTilingScheme))
          yFraction = this._mercatorTilingScheme.latitudeToYFraction(this.sourceTilingScheme.yFractionToLatitude(yFraction));
        requestProps.push({
          x: this._mercatorTilingScheme.xFractionToLongitude(xRange.fractionToPoint(column * delta)) * Angle.degreesPerRadian,
          y: this._mercatorTilingScheme.yFractionToLatitude(yFraction) * Angle.degreesPerRadian,
          z: this.bimElevationBias,
        });
      }
    }

    await this._gcsConverter!.getIModelCoordinatesFromGeoCoordinates(requestProps);
  }

  private static _scratchCarto = Cartographic.createZero();

  // Get the corners for planar children -- This generally will resolve immediately, but may require an asynchronous request for reprojecting the corners.
  public getPlanarChildCorners(tile: MapTile, columnCount: number, rowCount: number, resolve: (childCorners: Point3d[][]) => void) {
    const resolveCorners = (points: Point3d[], reprojected: (Point3d | undefined)[] | undefined = undefined) => {
      for (let i = 0; i < points.length; i++) {
        const gridPoint = points[i];
        this._mercatorFractionToDb.multiplyPoint3d(gridPoint, scratchCorner);
        if (this.globeMode !== GlobeMode.Ellipsoid || this.cartesianRange.containsPoint(scratchCorner)) {
          if (reprojected !== undefined && reprojected[i] !== undefined)
            reprojected[i]!.clone(gridPoint);
          else
            scratchCorner.clone(gridPoint);
        } else {
          this._mercatorTilingScheme.fractionToCartographic(gridPoint.x, gridPoint.y, MapTileTree._scratchCarto);
          this.earthEllipsoid.radiansToPoint(MapTileTree._scratchCarto.longitude, Cartographic.parametricLatitudeFromGeodeticLatitude(MapTileTree._scratchCarto.latitude), gridPoint);
          const cartesianDistance = this.cartesianRange.distanceToPoint(scratchCorner);
          if (cartesianDistance < this.cartesianTransitionDistance)
            scratchCorner.interpolate(cartesianDistance / this.cartesianTransitionDistance, gridPoint, gridPoint);
        }
      }
      resolve(this.getChildCornersFromGridPoints(points, columnCount, rowCount));
    };

    let reprojectedPoints: (Point3d | undefined)[] | undefined;
    const gridPoints = this.getMercatorFractionChildGridPoints(tile, columnCount, rowCount);
    if (this.doReprojectChildren(tile)) {
      reprojectedPoints = this.getCachedReprojectedPoints(gridPoints);
      if (reprojectedPoints) {
        // If the reprojected corners are in the cache, resolve immediately.
        resolveCorners(gridPoints, reprojectedPoints);
      } else {
        // If the reprojected corners are not in cache request them - but also request reprojection of a grid that will include descendent corners to ensure they can
        // be reloaded without expensive reprojection requests.
        this.loadReprojectionCache(tile).then(() => {
          const reprojected = this.getCachedReprojectedPoints(gridPoints);
          assert(reprojected !== undefined);     // We just cached them... they better be there now.
          resolveCorners(gridPoints, reprojected);
        }).catch((_error: Error) => {
          resolveCorners(gridPoints);
        });
      }
    } else {
      resolveCorners(gridPoints);
    }
  }

  public getFractionalTileCorners(quadId: QuadId): Point3d[] {
    const corners: Point3d[] = [];
    corners.push(Point3d.create(this.sourceTilingScheme.tileXToFraction(quadId.column, quadId.level), this.sourceTilingScheme.tileYToFraction(quadId.row, quadId.level), 0.0));
    corners.push(Point3d.create(this.sourceTilingScheme.tileXToFraction(quadId.column + 1, quadId.level), this.sourceTilingScheme.tileYToFraction(quadId.row, quadId.level), 0.0));
    corners.push(Point3d.create(this.sourceTilingScheme.tileXToFraction(quadId.column, quadId.level), this.sourceTilingScheme.tileYToFraction(quadId.row + 1, quadId.level), 0.0));
    corners.push(Point3d.create(this.sourceTilingScheme.tileXToFraction(quadId.column + 1, quadId.level), this.sourceTilingScheme.tileYToFraction(quadId.row + 1, quadId.level), 0.0));
    return corners;
  }

  public getTileRectangle(quadId: QuadId): MapCartoRectangle {
    return this.sourceTilingScheme.tileXYToRectangle(quadId.column, quadId.row, quadId.level);
  }
  public getLayerIndex(imageryTreeId: Id64String) {
    const index = this._modelIdToIndex.get(imageryTreeId);
    return index === undefined ? -1 : index;
  }

  public getLayerTransparency(imageryTreeId: Id64String): number {
    const layerSettings = this._layerSettings.get(imageryTreeId);
    assert(undefined !== layerSettings);
    return undefined === layerSettings || !layerSettings.transparency ? 0.0 : layerSettings.transparency;
  }
}

interface MapTreeId {
  tileUserId: number;
  applyTerrain: boolean;
  terrainProviderName: TerrainProviderName;
  terrainHeightOrigin: number;
  terrainHeightOriginMode: number;
  terrainExaggeration: number;
  mapGroundBias: number;
  wantSkirts: boolean;
  wantNormals: boolean;
  globeMode: GlobeMode;
  useDepthBuffer: boolean;
  isOverlay: boolean;
  baseColor?: ColorDef;
  baseTransparent: boolean;
  mapTransparent: boolean;
  maskModelIds?: string;
  produceGeometry?: boolean;
}

/** @internal */
class MapTileTreeProps implements RealityTileTreeParams {
  public id: string;
  public modelId: string;
  public location = Transform.createIdentity();
  public yAxisUp = true;
  public is3d = true;
  public rootTile = { contentId: "", range: Range3d.createNull(), maximumSize: 0 };
  public loader: MapTileLoader;
  public iModel: IModelConnection;
  public get priority(): TileLoadPriority { return this.loader.priority; }

  public constructor(modelId: Id64String, loader: MapTileLoader, iModel: IModelConnection, public gcsConverterAvailable: boolean) {
    this.id = this.modelId = modelId;
    this.loader = loader;
    this.iModel = iModel;
  }
}

function createViewFlagOverrides(wantLighting: boolean, wantThematic: false | undefined) {
  return createDefaultViewFlagOverrides({ clipVolume: false, lighting: wantLighting, thematic: wantThematic });
}

class MapTreeSupplier implements TileTreeSupplier {
  public readonly isEcefDependent = true;

  public compareTileTreeIds(lhs: MapTreeId, rhs: MapTreeId): number {
    let cmp = compareNumbers(lhs.tileUserId, rhs.tileUserId);
    if (0 === cmp) {
      cmp = compareStringsOrUndefined(lhs.maskModelIds, rhs.maskModelIds);
      if (0 === cmp) {
        cmp = compareBooleans(lhs.isOverlay, rhs.isOverlay);
        if (0 === cmp) {
          cmp = compareBooleans(lhs.wantSkirts, rhs.wantSkirts);
          if (0 === cmp) {
            cmp = compareBooleans(lhs.wantNormals, rhs.wantNormals);
            if (0 === cmp) {
              cmp = compareNumbers(lhs.globeMode, rhs.globeMode);
              if (0 === cmp) {
                cmp = compareNumbers(lhs.baseColor ? lhs.baseColor.tbgr : -1, rhs.baseColor ? rhs.baseColor.tbgr : -1);
                if (0 === cmp) {
                  cmp = compareBooleans(lhs.baseTransparent, rhs.baseTransparent);
                  if (0 === cmp) {
                    cmp = compareBooleans(lhs.mapTransparent, rhs.mapTransparent);
                    if (0 === cmp) {
                      cmp = compareBooleans(lhs.applyTerrain, rhs.applyTerrain);
                      if (0 === cmp) {
                        if (lhs.applyTerrain) {
                          // Terrain-only settings.
                          cmp = compareStrings(lhs.terrainProviderName, rhs.terrainProviderName);
                          if (0 === cmp) {
                            cmp = compareNumbers(lhs.terrainHeightOrigin, rhs.terrainHeightOrigin);
                            if (0 === cmp) {
                              cmp = compareNumbers(lhs.terrainHeightOriginMode, rhs.terrainHeightOriginMode);
                              if (0 === cmp) {
                                cmp = compareNumbers(lhs.terrainExaggeration, rhs.terrainExaggeration);
                                if (0 === cmp)
                                  cmp = compareBooleansOrUndefined(lhs.produceGeometry, rhs.produceGeometry);
                              }
                            }
                          }
                        } else {
                          // Non-Terrain (flat) settings.
                          cmp = compareNumbers(lhs.mapGroundBias, rhs.mapGroundBias);
                          if (0 === cmp)
                            cmp = compareBooleans(lhs.useDepthBuffer, rhs.useDepthBuffer);
                        }
                      }
                    }
                  }
                }
              }
            }
          }
        }
      }
    }

    return cmp;
  }

  private async computeHeightBias(heightOrigin: number, heightOriginMode: TerrainHeightOriginMode, exaggeration: number, iModel: IModelConnection, elevationProvider: BingElevationProvider): Promise<number> {
    const projectCenter = iModel.projectExtents.center;
    switch (heightOriginMode) {
      case TerrainHeightOriginMode.Ground:
        return heightOrigin + exaggeration * (await elevationProvider.getHeightValue(projectCenter, iModel, true));

      case TerrainHeightOriginMode.Geodetic:
        return heightOrigin;

      case TerrainHeightOriginMode.Geoid:
        return heightOrigin + await elevationProvider.getGeodeticToSeaLevelOffset(projectCenter, iModel);
    }
  }

  public async createTileTree(id: MapTreeId, iModel: IModelConnection): Promise<TileTree | undefined> {
    let bimElevationBias = 0, terrainProvider, geodeticOffset = 0;
    let applyTerrain = id.applyTerrain;
    const modelId = iModel.transientIds.next;
    const gcsConverterAvailable = await getGcsConverterAvailable(iModel);

    if (id.applyTerrain) {
      assert(id.terrainProviderName === "CesiumWorldTerrain");
      await ApproximateTerrainHeights.instance.initialize();
      const elevationProvider = new BingElevationProvider();

      bimElevationBias = - await this.computeHeightBias(id.terrainHeightOrigin, id.terrainHeightOriginMode, id.terrainExaggeration, iModel, elevationProvider);
      geodeticOffset = await elevationProvider.getGeodeticToSeaLevelOffset(iModel.projectExtents.center, iModel);
      terrainProvider = await getCesiumTerrainProvider(iModel, modelId, id.wantSkirts, id.wantNormals, id.terrainExaggeration);

      if (!terrainProvider) {
        applyTerrain = false;
        geodeticOffset = 0;
      }
    }

    if (!terrainProvider) {
      terrainProvider = new EllipsoidTerrainProvider(iModel, modelId, id.wantSkirts);
      bimElevationBias = id.mapGroundBias;
    }

    const loader = new MapTileLoader(iModel, modelId, bimElevationBias, terrainProvider);
    const ecefToDb = iModel.getMapEcefToDb(bimElevationBias);

    if (id.maskModelIds)
      await iModel.models.load(CompressedId64Set.decompressSet(id.maskModelIds));

    const treeProps = new MapTileTreeProps(modelId, loader, iModel, gcsConverterAvailable);
    return new MapTileTree(treeProps, ecefToDb, bimElevationBias, geodeticOffset, terrainProvider.tilingScheme, id, applyTerrain);
  }
}

const mapTreeSupplier = new MapTreeSupplier();

/** @internal */
type CheckTerrainDisplayOverride = () => TerrainDisplayOverrides | undefined;

/** Specialization of tile tree that represents background map.
 * @internal
 */
export class MapTileTreeReference extends TileTreeReference {
  private _tileUserId: number;
  private _settings: BackgroundMapSettings;
  private readonly _iModel: IModelConnection;
  private _baseImageryLayerIncluded = false;
  private _baseColor?: ColorDef;
  private readonly _layerTrees = new Array<MapLayerTileTreeReference>();
  private _baseTransparent = false;
  private _symbologyOverrides: FeatureSymbology.Overrides | undefined;
  private _planarClipMask?: PlanarClipMaskState;

  public constructor(settings: BackgroundMapSettings, private _baseLayerSettings: BaseLayerSettings | undefined, private _layerSettings: MapLayerSettings[], iModel: IModelConnection, tileUserId: number, public isOverlay: boolean, private _isDrape: boolean, private _overrideTerrainDisplay?: CheckTerrainDisplayOverride) {
    super();
    this._tileUserId = tileUserId;
    this._settings = settings;
    this._iModel = iModel;
    let tree;
    if (!isOverlay && this._baseLayerSettings !== undefined) {
      if (this._baseLayerSettings instanceof MapLayerSettings) {
        tree = createMapLayerTreeReference(this._baseLayerSettings, 0, iModel);
        this._baseTransparent = this._baseLayerSettings.transparency > 0;
      } else {
        this._baseColor = this._baseLayerSettings;
        this._baseTransparent = this._baseColor?.getTransparency() > 0;
      }
    }

    if (this._baseImageryLayerIncluded = (undefined !== tree))
      this._layerTrees.push(tree);

    for (let i = 0; i < this._layerSettings.length; i++)
      if (undefined !== (tree = createMapLayerTreeReference(this._layerSettings[i], i + 1, iModel)))
        this._layerTrees.push(tree);

    if (this._settings.planarClipMask && this._settings.planarClipMask.isValid)
      this._planarClipMask = PlanarClipMaskState.create(this._settings.planarClipMask);

    if (this._overrideTerrainDisplay && this._overrideTerrainDisplay()?.produceGeometry)
      this.collectTileGeometry = (collector) => this._collectTileGeometry(collector);
  }

  public override get isGlobal() { return true; }
  public get baseColor(): ColorDef | undefined { return this._baseColor; }
  public override get planarclipMaskPriority(): number { return PlanarClipMaskPriority.BackgroundMap; }

  protected override _createGeometryTreeReference(): GeometryTileTreeReference | undefined {
    if (! this._settings.applyTerrain || this._isDrape)
      return undefined;     // Don't bother generating non-terrain (flat) geometry.

    const ref = new MapTileTreeReference(this._settings, undefined, [], this._iModel, this._tileUserId, false, false, () => { return { produceGeometry: true }; });
    assert(undefined !== ref.collectTileGeometry);
    return ref as GeometryTileTreeReference;
  }

  /** Terrain  tiles do not contribute to the range used by "fit view". */
  public override unionFitRange(_range: Range3d): void { }
  public get settings(): BackgroundMapSettings { return this._settings; }
  public set settings(settings: BackgroundMapSettings) {
    this._settings = settings;
    this._planarClipMask = settings.planarClipMask ? PlanarClipMaskState.create(settings.planarClipMask) : undefined;
  }
  public setBaseLayerSettings(baseLayerSettings: BaseLayerSettings) {
    assert(!this.isOverlay);
    let tree;
    this._baseLayerSettings = baseLayerSettings;

    if (baseLayerSettings instanceof MapLayerSettings) {
      tree = createMapLayerTreeReference(baseLayerSettings, 0, this._iModel);
      this._baseColor = undefined;
      this._baseTransparent = baseLayerSettings.transparency > 0;
    } else {
      this._baseColor = baseLayerSettings;
      this._baseTransparent = this._baseColor.getTransparency() > 0;
    }

    if (tree) {
      if (this._baseImageryLayerIncluded)
        this._layerTrees[0] = tree;
      else
        this._layerTrees.splice(0, 0, tree);
    } else {
      if (this._baseImageryLayerIncluded)
        this._layerTrees.shift();
    }
    this._baseImageryLayerIncluded = tree !== undefined;
    this.clearLayers();
  }
  public get layerSettings(): MapLayerSettings[] {
    return this._layerSettings;
  }

  public setLayerSettings(layerSettings: MapLayerSettings[]) {
    this._layerSettings = layerSettings;
    const baseLayerIndex = this._baseImageryLayerIncluded ? 1 : 0;

    this._layerTrees.length = Math.min(layerSettings.length + baseLayerIndex, this._layerTrees.length);    // Truncate if number of layers reduced.
    for (let i = 0; i < layerSettings.length; i++) {
      const treeIndex = i + baseLayerIndex;
      if (treeIndex >= this._layerTrees.length || !this._layerTrees[treeIndex].layerSettings.displayMatches(layerSettings[i]))
        this._layerTrees[treeIndex] = createMapLayerTreeReference(layerSettings[i], treeIndex, this._iModel)!;
    }
    this.clearLayers();
  }

  public clearLayers() {
    const tree = this.treeOwner.tileTree as MapTileTree;
    if (undefined !== tree)
      tree.clearLayers();
  }

  public override get castsShadows() {
    return false;
  }

  protected override get _isLoadingComplete(): boolean {
    // Wait until drape tree is fully loaded too.
    for (const drapeTree of this._layerTrees)
      if (!drapeTree.isLoadingComplete)
        return false;

    return super._isLoadingComplete;
  }
  public get useDepthBuffer() {
    return !this.isOverlay && (this.settings.applyTerrain || this.settings.useDepthBuffer);
  }

  public get treeOwner(): TileTreeOwner {
    let wantSkirts = (this.settings.applyTerrain || this.useDepthBuffer) && !this.settings.transparency && !this._baseTransparent;
    if (wantSkirts) {
      const maskTrans = this._planarClipMask?.settings.transparency;
      wantSkirts = (undefined === maskTrans || maskTrans <= 0);
    }

    const id: MapTreeId = {
      tileUserId: this._tileUserId,
      applyTerrain: this.settings.applyTerrain && !this._isDrape,
      terrainProviderName: this.settings.terrainSettings.providerName,
      terrainHeightOrigin: this.settings.terrainSettings.heightOrigin,
      terrainHeightOriginMode: this.settings.terrainSettings.heightOriginMode,
      terrainExaggeration: this.settings.terrainSettings.exaggeration,
      mapGroundBias: this.settings.groundBias,
      wantSkirts,
      // Can set to this.settings.terrainSettings.applyLighting if we want to ever apply lighting to terrain again so that normals are retrieved when lighting is on.
      wantNormals: false,
      globeMode: this._isDrape ? GlobeMode.Plane : this.settings.globeMode,
      isOverlay: this.isOverlay,
      useDepthBuffer: this.useDepthBuffer,
      baseColor: this._baseColor,
      baseTransparent: this._baseTransparent,
      mapTransparent: this.settings.transparency > 0,
      maskModelIds: this._planarClipMask?.settings.compressedModelIds,
      produceGeometry: false,
    };

    if (undefined !== this._overrideTerrainDisplay) {
      const ovr = this._overrideTerrainDisplay();
      if (undefined !== ovr) {
        id.wantSkirts = ovr.wantSkirts ?? id.wantSkirts;
        id.wantNormals = ovr.wantNormals ?? id.wantNormals;
        id.produceGeometry = ovr.produceGeometry === true;
      }
    }

    return this._iModel.tiles.getTileTreeOwner(id, mapTreeSupplier);
  }
  public getLayerImageryTreeRef(index: number) {
    const baseLayerIndex = this._baseImageryLayerIncluded ? 1 : 0;
    const treeIndex = index + baseLayerIndex;
    return index < 0 || treeIndex >= this._layerTrees.length ? undefined : this._layerTrees[treeIndex];
  }

  public initializeLayers(context: SceneContext): boolean {
    const tree = this.treeOwner.load() as MapTileTree;
    if (undefined === tree)
      return false;     // Not loaded yet.

    tree.imageryTrees.length = 0;
    if (0 === this._layerTrees.length)
      return !this.isOverlay;

    let treeIndex = this._layerTrees.length - 1;
    // Start displaying at the highest completely opaque layer...
    for (; treeIndex >= 1; treeIndex--) {
      const layerTreeRef = this._layerTrees[treeIndex];
      if (layerTreeRef.isOpaque)
        break;    // This layer is completely opaque and will obscure all others so ignore lower ones.
    }
    for (; treeIndex < this._layerTrees.length; treeIndex++) {
      const layerTreeRef = this._layerTrees[treeIndex];
      if (TileTreeLoadStatus.NotFound !== layerTreeRef.treeOwner.loadStatus && layerTreeRef.layerSettings.visible && !layerTreeRef.layerSettings.allSubLayersInvisible) {
        const layerTree = layerTreeRef.treeOwner.load();
        if (undefined === layerTree)
          return false; // Not loaded yet.
        if (layerTree instanceof ImageryMapTileTree) {
          tree.addImageryLayer(layerTree, layerTreeRef.layerSettings, treeIndex);
        } else if (layerTreeRef instanceof ModelMapLayerTileTreeReference)
          tree.addModelLayer(layerTreeRef, context);
      }
    }
    return true;
  }

  /** Adds this reference's graphics to the scene. By default this invokes [[TileTree.drawScene]] on the referenced TileTree, if it is loaded. */
  public override addToScene(context: SceneContext): void {
    if (!context.viewFlags.backgroundMap)
      return;

    const tree = this.treeOwner.load() as MapTileTree;
    if (undefined === tree || !this.initializeLayers(context))
      return;     // Not loaded yet.

    if (this._planarClipMask && this._planarClipMask.settings.isValid)
      context.addPlanarClassifier(tree.modelId, undefined, this._planarClipMask);

    const nonLocatable = this.settings.locatable ? undefined : true;
    const transparency = this.settings.transparency ? this.settings.transparency : undefined;
    this._symbologyOverrides = new FeatureSymbology.Overrides();
    if (nonLocatable || transparency) {
      this._symbologyOverrides.override({
        modelId: tree.modelId,
        appearance: FeatureAppearance.fromJSON({ transparency, nonLocatable }),
      });
    }

    const args = this.createDrawArgs(context);
    if (undefined !== args)
      tree.draw(args);

    tree.clearImageryTreesAndClassifiers();
  }

  public override createDrawArgs(context: SceneContext): TileDrawArgs | undefined {
    const args = super.createDrawArgs(context);
    if (undefined === args)
      return undefined;

    const tree = this.treeOwner.load() as MapTileTree;
    return new RealityTileDrawArgs(args, args.worldToViewMap, args.frustumPlanes, undefined, tree?.layerClassifiers);
  }

  protected override getViewFlagOverrides(_tree: TileTree) {
    return createViewFlagOverrides(false, this._settings.applyTerrain ? undefined : false);
  }

  protected override getSymbologyOverrides(_tree: TileTree) {
    return this._symbologyOverrides;
  }

  public override discloseTileTrees(trees: DisclosedTileTreeSet): void {
    super.discloseTileTrees(trees);
    this._layerTrees.forEach((imageryTree) => trees.disclose(imageryTree));
    if (this._planarClipMask)
      this._planarClipMask.discloseTileTrees(trees);
  }
  public imageryTreeFromTreeModelIds(mapTreeModelId: Id64String, layerTreeModelId: Id64String): ImageryMapLayerTreeReference | undefined {
    const tree = this.treeOwner.tileTree as MapTileTree;
    if (undefined === tree || tree.modelId !== mapTreeModelId)
      return undefined;

    for (const imageryTree of this._layerTrees)
      if (imageryTree.treeOwner.tileTree && imageryTree.treeOwner.tileTree.modelId === layerTreeModelId)
        return imageryTree;

    return undefined;
  }
  public layerFromTreeModelIds(mapTreeModelId: Id64String, layerTreeModelId: Id64String): MapLayerSettings | undefined {
    const imageryTree = this.imageryTreeFromTreeModelIds(mapTreeModelId, layerTreeModelId);
    return imageryTree === undefined ? imageryTree : imageryTree.layerSettings;
  }

  // Utility method that execute the provided function for every *imagery* tiles under a given HotDetail object.
  private async forEachImageryTileHit(hit: HitDetail, func: (imageryTreeRef: ImageryMapLayerTreeReference, quadId: QuadId, cartoGraphic: Cartographic,imageryTree: ImageryMapTileTree ) => Promise<void>): Promise<void> {
    const tree = this.treeOwner.tileTree as MapTileTree;
    if (undefined === tree || hit.iModel !== tree.iModel || tree.modelId !== hit.modelId || !hit.viewport || !hit.viewport.view.is3d)
      return undefined;

    const backgroundMapGeometry = hit.viewport.displayStyle.getBackgroundMapGeometry();
    if (undefined === backgroundMapGeometry)
      return undefined;

    const worldPoint = hit.hitPoint.clone();
    let cartoGraphic: Cartographic|undefined;
    try {
      cartoGraphic = await backgroundMapGeometry.dbToCartographicFromGcs(worldPoint);
    } catch {
    }
    if (!cartoGraphic) {
      return undefined;
    }

    const strings = [];
    const imageryTreeRef = this.imageryTreeFromTreeModelIds(hit.modelId, hit.sourceId);
    if (imageryTreeRef !== undefined) {
      strings.push(`Imagery Layer: ${imageryTreeRef.layerSettings.name}`);
      if (hit.tileId !== undefined) {
        const terrainQuadId = QuadId.createFromContentId(hit.tileId);
        const terrainTile = tree.tileFromQuadId(terrainQuadId);
        if (terrainTile && terrainTile.imageryTiles) {
          const imageryTree = imageryTreeRef.treeOwner.tileTree as ImageryMapTileTree;
          if (imageryTree) {
            for (const imageryTile of terrainTile.imageryTiles) {
              if (imageryTree === imageryTile.imageryTree && imageryTile.rectangle.containsCartographic(cartoGraphic)) {
                try {
                  await func (imageryTreeRef, imageryTile.quadId, cartoGraphic, imageryTree);
                } catch {
                  // continue iterating even though we got a failure.
                }

              }

            }
          }
        }
      }
    }
  }

  public override async getToolTip(hit: HitDetail): Promise<HTMLElement | string | undefined> {
    const tree = this.treeOwner.tileTree as MapTileTree;
    if (tree.modelId !== hit.modelId)
      return undefined;

    let carto: Cartographic|undefined;

    const strings: string[] = [];

    const getTooltipFunc = async (imageryTreeRef: ImageryMapLayerTreeReference,  quadId: QuadId, cartoGraphic: Cartographic,imageryTree: ImageryMapTileTree ) => {
      strings.push(`Imagery Layer: ${imageryTreeRef.layerSettings.name}`);
      carto = cartoGraphic;
      await imageryTree.imageryLoader.getToolTip(strings, quadId, cartoGraphic, imageryTree);
    };
    try {
      await this.forEachImageryTileHit(hit, getTooltipFunc);
    } catch {
      // No results added
    }

    if (carto) {
      strings.push(`Latitude: ${carto.latitudeDegrees.toFixed(4)}`);
      strings.push(`Longitude: ${carto.longitudeDegrees.toFixed(4)}`);
      if (this.settings.applyTerrain && tree.terrainExaggeration !== 0.0) {
        const geodeticHeight = (carto.height - tree.bimElevationBias) / tree.terrainExaggeration;
        strings.push(`Height (Meters) Geodetic: ${geodeticHeight.toFixed(1)} Sea Level: ${(geodeticHeight - tree.geodeticOffset).toFixed(1)}`);
      }
    }

    const div = document.createElement("div");
    div.innerHTML = strings.join("<br>");
    return div;
  }

  public override async getMapFeatureInfo(hit: HitDetail): Promise<MapLayerFeatureInfo[] | undefined> {
    const tree = this.treeOwner.tileTree as MapTileTree;
    if (undefined === tree || hit.iModel !== tree.iModel || tree.modelId !== hit.modelId || !hit.viewport || !hit.viewport.view.is3d)
      return undefined;

    const info: MapLayerFeatureInfo[] = [];
    const imageryTreeRef = this.imageryTreeFromTreeModelIds(hit.modelId, hit.sourceId);
    if (imageryTreeRef !== undefined) {

      const getFeatureInfoFunc = async (_imageryTreeRef: ImageryMapLayerTreeReference, quadId: QuadId, cartoGraphic: Cartographic,imageryTree: ImageryMapTileTree ) => {
        try {
          await imageryTree.imageryLoader.getMapFeatureInfo(info, quadId, cartoGraphic, imageryTree);
        } catch {
        }
      };
      try {
        await this.forEachImageryTileHit(hit, getFeatureInfoFunc);
      } catch {
        // No results added
      }

    }

    return info;
  }

  /** Add logo cards to logo div. */
  public override addLogoCards(cards: HTMLTableElement, vp: ScreenViewport): void {
    const tree = this.treeOwner.tileTree as MapTileTree;
    if (tree) {
      tree.mapLoader.terrainProvider.addLogoCards(cards, vp);
      for (const imageryTreeRef of this._layerTrees) {
        if (imageryTreeRef.layerSettings.visible) {
          const imageryTree = imageryTreeRef.treeOwner.tileTree;
          if (imageryTree instanceof ImageryMapTileTree)
            imageryTree.addLogoCards(cards, vp);
        }
      }
    }
  }
}

/** Returns whether a GCS converter is available.
 * @internal
 */
export async function getGcsConverterAvailable(iModel: IModelConnection) {
  if (iModel.noGcsDefined)
    return false;

  // Determine if we have a usable GCS.
  const converter = iModel.geoServices.getConverter("WGS84");
  if (undefined === converter)
    return false;
  const requestProps: XYZProps[] = [{ x: 0, y: 0, z: 0 }];
  let haveConverter;
  try {
    const responseProps = await converter.getIModelCoordinatesFromGeoCoordinates(requestProps);
    haveConverter = responseProps.iModelCoords.length === 1 && responseProps.iModelCoords[0].s !== GeoCoordStatus.NoGCSDefined;
  } catch {
    haveConverter = false;
  }
  return haveConverter;
}
